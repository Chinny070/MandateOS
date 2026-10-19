"""Deterministic governance reference model; not contract authorization.

The model snapshots member voting power when a proposal is created, accepts
one vote per snapshot member before the voting deadline, checks quorum and
approval thresholds, and applies a timelock before execution. Contract-side
state transitions and transaction timestamps must be implemented and tested
separately before this model can authorize any GEN movement.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum


class ProposalStatus(StrEnum):
    VOTING = "VOTING"
    QUEUED = "QUEUED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    EXECUTED = "EXECUTED"


class VoteChoice(StrEnum):
    FOR = "FOR"
    AGAINST = "AGAINST"
    ABSTAIN = "ABSTAIN"


@dataclass(frozen=True)
class GovernancePolicy:
    quorum_bps: int
    approval_bps: int
    voting_period_seconds: int
    execution_delay_seconds: int

    def __post_init__(self) -> None:
        if not 0 < self.quorum_bps <= 10_000:
            raise ValueError("quorum must be within 1..10000 bps")
        if not 0 < self.approval_bps <= 10_000:
            raise ValueError("approval must be within 1..10000 bps")
        if self.voting_period_seconds <= 0 or self.execution_delay_seconds <= 0:
            raise ValueError("voting period and execution delay must be positive")


@dataclass(frozen=True)
class GovernanceProposal:
    proposal_id: str
    payload_digest: str
    created_at: datetime
    voting_ends_at: datetime
    total_snapshot_weight: int
    member_weights: tuple[tuple[str, int], ...]
    votes: tuple[tuple[str, VoteChoice, int], ...] = ()
    status: ProposalStatus = ProposalStatus.VOTING
    execute_after: datetime | None = None

    def __post_init__(self) -> None:
        _require_utc(self.created_at)
        _require_utc(self.voting_ends_at)
        if self.execute_after is not None:
            _require_utc(self.execute_after)
        if not self.proposal_id or len(self.proposal_id) > 80:
            raise ValueError("proposal id is required and must be at most 80 characters")
        if not self.payload_digest:
            raise ValueError("proposal payload digest is required")
        if self.voting_ends_at <= self.created_at:
            raise ValueError("voting deadline must follow creation")
        if self.total_snapshot_weight <= 0:
            raise ValueError("snapshot must have positive voting weight")
        members = [member for member, _ in self.member_weights]
        weights = [weight for _, weight in self.member_weights]
        if len(set(members)) != len(members) or any(not m for m in members):
            raise ValueError("snapshot members must be unique and nonempty")
        if any(weight <= 0 for weight in weights) or sum(weights) != self.total_snapshot_weight:
            raise ValueError("snapshot weights must be positive and sum to total")
        voters = [member for member, _, _ in self.votes]
        if len(set(voters)) != len(voters):
            raise ValueError("a member may vote only once")
        snapshot = dict(self.member_weights)
        if any(member not in snapshot or weight != snapshot[member] for member, _, weight in self.votes):
            raise ValueError("votes must use the member's snapshotted weight")


def create_proposal(
    policy: GovernancePolicy,
    *,
    proposal_id: str,
    payload_digest: str,
    members: dict[str, int],
    created_at: datetime,
) -> GovernanceProposal:
    _require_utc(created_at)
    if not members or any(not member or weight <= 0 for member, weight in members.items()):
        raise ValueError("membership snapshot must contain positive member weights")
    snapshot = tuple(sorted(members.items()))
    return GovernanceProposal(
        proposal_id=proposal_id,
        payload_digest=payload_digest,
        created_at=created_at,
        voting_ends_at=created_at + timedelta(seconds=policy.voting_period_seconds),
        total_snapshot_weight=sum(weight for _, weight in snapshot),
        member_weights=snapshot,
    )


def cast_vote(
    proposal: GovernanceProposal,
    *,
    member: str,
    choice: VoteChoice,
    now: datetime,
) -> GovernanceProposal:
    _require_utc(now)
    if proposal.status != ProposalStatus.VOTING:
        raise ValueError("proposal is not accepting votes")
    if now < proposal.created_at:
        raise ValueError("vote predates proposal")
    if now >= proposal.voting_ends_at:
        raise ValueError("voting period has ended")
    weights = dict(proposal.member_weights)
    if member not in weights:
        raise ValueError("member is not in the proposal snapshot")
    if member in {voter for voter, _, _ in proposal.votes}:
        raise ValueError("member has already voted")
    if not isinstance(choice, VoteChoice):
        raise ValueError("invalid vote choice")
    return GovernanceProposal(
        proposal_id=proposal.proposal_id,
        payload_digest=proposal.payload_digest,
        created_at=proposal.created_at,
        voting_ends_at=proposal.voting_ends_at,
        total_snapshot_weight=proposal.total_snapshot_weight,
        member_weights=proposal.member_weights,
        votes=proposal.votes + ((member, choice, weights[member]),),
        status=proposal.status,
        execute_after=proposal.execute_after,
    )


def close_voting(proposal: GovernanceProposal, policy: GovernancePolicy, *, now: datetime) -> GovernanceProposal:
    _require_utc(now)
    if proposal.status != ProposalStatus.VOTING:
        raise ValueError("proposal is not in voting state")
    if now < proposal.voting_ends_at:
        raise ValueError("voting period has not ended")
    participating = sum(weight for _, _, weight in proposal.votes)
    affirmative = sum(weight for _, choice, weight in proposal.votes if choice == VoteChoice.FOR)
    has_quorum = participating * 10_000 >= proposal.total_snapshot_weight * policy.quorum_bps
    has_approval = participating > 0 and affirmative * 10_000 >= participating * policy.approval_bps
    if not has_quorum:
        status = ProposalStatus.EXPIRED
    elif not has_approval:
        status = ProposalStatus.REJECTED
    else:
        status = ProposalStatus.QUEUED
    execute_after = (
        now + timedelta(seconds=policy.execution_delay_seconds)
        if status == ProposalStatus.QUEUED
        else None
    )
    return GovernanceProposal(
        proposal_id=proposal.proposal_id,
        payload_digest=proposal.payload_digest,
        created_at=proposal.created_at,
        voting_ends_at=proposal.voting_ends_at,
        total_snapshot_weight=proposal.total_snapshot_weight,
        member_weights=proposal.member_weights,
        votes=proposal.votes,
        status=status,
        execute_after=execute_after,
    )


def execute_proposal(proposal: GovernanceProposal, *, now: datetime) -> GovernanceProposal:
    _require_utc(now)
    if proposal.status != ProposalStatus.QUEUED or proposal.execute_after is None:
        raise ValueError("proposal is not queued for execution")
    if now < proposal.execute_after:
        raise ValueError("governance timelock has not elapsed")
    return GovernanceProposal(
        proposal_id=proposal.proposal_id,
        payload_digest=proposal.payload_digest,
        created_at=proposal.created_at,
        voting_ends_at=proposal.voting_ends_at,
        total_snapshot_weight=proposal.total_snapshot_weight,
        member_weights=proposal.member_weights,
        votes=proposal.votes,
        status=ProposalStatus.EXECUTED,
        execute_after=proposal.execute_after,
    )


def _require_utc(value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() != timezone.utc.utcoffset(value):
        raise ValueError("timestamps must be timezone-aware UTC")
