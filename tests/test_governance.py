from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta, timezone

import pytest

from reference.governance import (
    GovernancePolicy,
    ProposalStatus,
    VoteChoice,
    cast_vote,
    close_voting,
    create_proposal,
    execute_proposal,
)


NOW = datetime(2026, 10, 19, 12, tzinfo=timezone.utc)
POLICY = GovernancePolicy(
    quorum_bps=5_000,
    approval_bps=6_000,
    voting_period_seconds=100,
    execution_delay_seconds=50,
)


def proposal():
    return create_proposal(
        POLICY,
        proposal_id="policy-2",
        payload_digest="sha256:canonical-payload",
        members={"alice": 2, "bob": 1, "carol": 1},
        created_at=NOW,
    )


def test_snapshot_votes_quorum_and_timelock_lifecycle():
    p = proposal()
    # Later membership changes do not change the proposal's voting weights.
    p = cast_vote(p, member="alice", choice=VoteChoice.FOR, now=NOW + timedelta(seconds=1))
    p = cast_vote(p, member="bob", choice=VoteChoice.AGAINST, now=NOW + timedelta(seconds=2))
    closed = close_voting(p, POLICY, now=p.voting_ends_at)
    assert closed.status == ProposalStatus.QUEUED
    assert closed.total_snapshot_weight == 4
    assert closed.execute_after == p.voting_ends_at + timedelta(seconds=50)
    with pytest.raises(ValueError, match="timelock"):
        execute_proposal(closed, now=closed.execute_after - timedelta(seconds=1))
    executed = execute_proposal(closed, now=closed.execute_after)
    assert executed.status == ProposalStatus.EXECUTED
    with pytest.raises(FrozenInstanceError):
        executed.status = ProposalStatus.REJECTED


def test_duplicate_nonmember_and_late_votes_are_rejected():
    p = proposal()
    p = cast_vote(p, member="alice", choice=VoteChoice.FOR, now=NOW)
    with pytest.raises(ValueError, match="already voted"):
        cast_vote(p, member="alice", choice=VoteChoice.FOR, now=NOW)
    with pytest.raises(ValueError, match="snapshot"):
        cast_vote(p, member="dave", choice=VoteChoice.FOR, now=NOW)
    with pytest.raises(ValueError, match="ended"):
        cast_vote(p, member="bob", choice=VoteChoice.FOR, now=p.voting_ends_at)


def test_insufficient_quorum_expires_and_failed_approval_rejects():
    p = cast_vote(proposal(), member="bob", choice=VoteChoice.FOR, now=NOW)
    assert close_voting(p, POLICY, now=p.voting_ends_at).status == ProposalStatus.EXPIRED

    p = proposal()
    p = cast_vote(p, member="alice", choice=VoteChoice.AGAINST, now=NOW)
    p = cast_vote(p, member="bob", choice=VoteChoice.FOR, now=NOW)
    assert close_voting(p, POLICY, now=p.voting_ends_at).status == ProposalStatus.REJECTED


@pytest.mark.parametrize(
    "kwargs",
    [
        {"quorum_bps": 0, "approval_bps": 5000, "voting_period_seconds": 1, "execution_delay_seconds": 1},
        {"quorum_bps": 5000, "approval_bps": 10001, "voting_period_seconds": 1, "execution_delay_seconds": 1},
        {"quorum_bps": 5000, "approval_bps": 5000, "voting_period_seconds": 0, "execution_delay_seconds": 1},
        {"quorum_bps": 5000, "approval_bps": 5000, "voting_period_seconds": 1, "execution_delay_seconds": 0},
    ],
)
def test_governance_policy_rejects_unbounded_parameters(kwargs):
    with pytest.raises(ValueError):
        GovernancePolicy(**kwargs)


def test_naive_or_non_utc_proposal_times_are_rejected():
    with pytest.raises(ValueError, match="UTC"):
        create_proposal(
            POLICY,
            proposal_id="policy-3",
            payload_digest="sha256:payload",
            members={"alice": 1},
            created_at=NOW.replace(tzinfo=None),
        )
    with pytest.raises(ValueError, match="UTC"):
        create_proposal(
            POLICY,
            proposal_id="policy-3",
            payload_digest="sha256:payload",
            members={"alice": 1},
            created_at=NOW.astimezone(timezone(timedelta(hours=1))),
        )
