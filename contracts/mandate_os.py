# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""MandateOS treasury with governance-gated allocation authorization.

The initial member and baseline mandate are deployment bootstrap state. Every
subsequent vault registration, mandate update, member addition and investment
allocation uses a snapshotted member vote and execution delay. Allocation
funding remains asynchronous: a queued child is not a verified settlement.
"""
from datetime import datetime, timezone

from genlayer import *


class MandateOS(gl.Contract):
    # Bootstrap governance rules are intentionally fixed in code for this
    # iteration. A later proposal may tighten the mandate within these bounds.
    quorum_bps: u256
    approval_bps: u256
    voting_period_seconds: u256
    execution_delay_seconds: u256
    execution_window_seconds: u256
    members: DynArray[Address]
    member_weight: TreeMap[Address, u256]
    proposal_kind: TreeMap[str, str]
    proposal_status: TreeMap[str, str]
    proposal_created_at: TreeMap[str, u256]
    proposal_voting_ends_at: TreeMap[str, u256]
    proposal_execute_after: TreeMap[str, u256]
    proposal_execute_by: TreeMap[str, u256]
    proposal_snapshot_total: TreeMap[str, u256]
    proposal_votes_for: TreeMap[str, u256]
    proposal_votes_against: TreeMap[str, u256]
    proposal_voted: TreeMap[str, bool]
    proposal_member_snapshot: TreeMap[str, u256]
    proposal_address: TreeMap[str, Address]
    proposal_project: TreeMap[str, str]
    proposal_digest: TreeMap[str, str]
    proposal_amount_a: TreeMap[str, u256]
    proposal_amount_b: TreeMap[str, u256]
    proposal_amount_c: TreeMap[str, u256]
    proposal_amount_d: TreeMap[str, u256]
    proposal_amount_e: TreeMap[str, u256]
    proposal_target_id: TreeMap[str, str]
    mandate_version: u256
    mandate_max_project_exposure_bps: u256
    mandate_min_liquid_reserve_bps: u256
    mandate_max_allocation_wei: u256
    mandate_challenge_window_seconds: u256
    mandate_evidence_max_age_seconds: u256
    project_evidence_digest: TreeMap[str, str]
    project_evidence_assessed_at: TreeMap[str, u256]
    reserved_allocation_wei: u256
    allocation_project: TreeMap[str, str]
    allocation_amount: TreeMap[str, u256]
    allocation_mandate_version: TreeMap[str, u256]
    allocation_status: TreeMap[str, str]
    allocation_challenge_ends_at: TreeMap[str, u256]
    allocation_challenge_digest: TreeMap[str, str]
    allocation_resolution_id: TreeMap[str, str]
    allocation_proposer: TreeMap[str, Address]
    administrator: Address
    paused: bool
    total_deposited_wei: u256
    total_refunds_received_wei: u256
    vault_for_project: TreeMap[str, Address]
    cap_for_project: TreeMap[str, u256]
    committed_for_project: TreeMap[str, u256]
    funding_project: TreeMap[str, str]
    funding_amount: TreeMap[str, u256]
    funding_status: TreeMap[str, str]
    pending_transfer_wei: u256
    refund_project: TreeMap[str, str]
    refund_amount: TreeMap[str, u256]
    refund_status: TreeMap[str, str]
    pending_refund_for_project: TreeMap[str, u256]

    def __init__(self):
        self.administrator = gl.message.sender_address
        self.quorum_bps = u256(6666)
        self.approval_bps = u256(6666)
        self.voting_period_seconds = u256(86400)
        self.execution_delay_seconds = u256(86400)
        self.execution_window_seconds = u256(604800)
        self.members.append(gl.message.sender_address)
        self.member_weight[gl.message.sender_address] = u256(1)
        self.mandate_version = u256(1)
        self.mandate_max_project_exposure_bps = u256(2000)
        self.mandate_min_liquid_reserve_bps = u256(1500)
        self.mandate_max_allocation_wei = u256(30 * 10**18)
        self.mandate_challenge_window_seconds = u256(86400)
        self.mandate_evidence_max_age_seconds = u256(604800)
        self.paused = False
        self.total_deposited_wei = u256(0)
        self.total_refunds_received_wei = u256(0)
        self.pending_transfer_wei = u256(0)

    def _now(self) -> u256:
        return u256(int(datetime.now(timezone.utc).timestamp()))

    def _member_only(self) -> None:
        if self.member_weight.get(gl.message.sender_address, u256(0)) == u256(0):
            raise gl.vm.UserError("active DAO member required")

    def _proposal_key(self, proposal_id: str, member: Address) -> str:
        return proposal_id + "|" + member.as_hex

    def _start_proposal(self, proposal_id: str, kind: str) -> None:
        self._ensure_new_proposal_id(proposal_id)
        total = u256(0)
        for member in self.members:
            weight = self.member_weight.get(member, u256(0))
            if weight > u256(0):
                self.proposal_member_snapshot[self._proposal_key(proposal_id, member)] = weight
                total += weight
        if total == u256(0):
            raise gl.vm.UserError("governance has no active members")
        now = self._now()
        self.proposal_kind[proposal_id] = kind
        self.proposal_status[proposal_id] = "VOTING"
        self.proposal_created_at[proposal_id] = now
        self.proposal_voting_ends_at[proposal_id] = now + self.voting_period_seconds
        self.proposal_snapshot_total[proposal_id] = total
        self.proposal_votes_for[proposal_id] = u256(0)
        self.proposal_votes_against[proposal_id] = u256(0)

    def _ensure_new_proposal_id(self, proposal_id: str) -> None:
        if not proposal_id or len(proposal_id) > 80:
            raise gl.vm.UserError("invalid proposal id")
        if self.proposal_status.get(proposal_id, ""):
            raise gl.vm.UserError("proposal id already used")

    def _release_allocation_reservation(self, allocation_id: str) -> None:
        amount = self.allocation_amount[allocation_id]
        project_id = self.allocation_project[allocation_id]
        self.reserved_allocation_wei -= amount
        self.committed_for_project[project_id] -= amount

    @gl.public.write
    def propose_member_add(self, proposal_id: str, member_address: str) -> None:
        self._member_only()
        self._ensure_new_proposal_id(proposal_id)
        member = Address(member_address)
        if self.member_weight.get(member, u256(0)) > u256(0):
            raise gl.vm.UserError("member is already active")
        if len(self.members) >= 100:
            raise gl.vm.UserError("member limit reached")
        self.proposal_address[proposal_id] = member
        self._start_proposal(proposal_id, "MEMBER_ADD")

    @gl.public.write
    def propose_mandate_update(
        self,
        proposal_id: str,
        max_project_exposure_bps: u256,
        min_liquid_reserve_bps: u256,
        max_allocation_wei: u256,
        challenge_window_seconds: u256,
        evidence_max_age_seconds: u256,
    ) -> None:
        self._member_only()
        self._ensure_new_proposal_id(proposal_id)
        if max_project_exposure_bps == u256(0) or max_project_exposure_bps > u256(2000):
            raise gl.vm.UserError("project exposure outside bootstrap bounds")
        if min_liquid_reserve_bps < u256(1500) or min_liquid_reserve_bps >= u256(10000):
            raise gl.vm.UserError("reserve outside bootstrap bounds")
        if max_project_exposure_bps + min_liquid_reserve_bps > u256(10000):
            raise gl.vm.UserError("exposure and reserve exceed 10000 bps")
        if max_allocation_wei == u256(0) or max_allocation_wei > u256(30 * 10**18):
            raise gl.vm.UserError("allocation cap outside bootstrap bounds")
        if challenge_window_seconds < u256(86400) or challenge_window_seconds > u256(2592000):
            raise gl.vm.UserError("challenge window outside 1..30 days")
        if evidence_max_age_seconds == u256(0) or evidence_max_age_seconds > u256(2592000):
            raise gl.vm.UserError("evidence age outside 1..30 days")
        self.proposal_amount_a[proposal_id] = max_project_exposure_bps
        self.proposal_amount_b[proposal_id] = min_liquid_reserve_bps
        self.proposal_amount_c[proposal_id] = max_allocation_wei
        self.proposal_amount_d[proposal_id] = challenge_window_seconds
        self.proposal_amount_e[proposal_id] = evidence_max_age_seconds
        self._start_proposal(proposal_id, "MANDATE_UPDATE")

    @gl.public.write
    def propose_vault_registration(
        self,
        proposal_id: str,
        project_id: str,
        vault_address: str,
        cap_wei: u256,
        evidence_digest: str,
    ) -> None:
        self._member_only()
        self._ensure_new_proposal_id(proposal_id)
        if not project_id or len(project_id) > 80 or project_id in self.vault_for_project:
            raise gl.vm.UserError("invalid or registered project")
        if cap_wei == u256(0) or not evidence_digest or len(evidence_digest) > 128:
            raise gl.vm.UserError("project cap and evidence digest are required")
        self.proposal_project[proposal_id] = project_id
        self.proposal_address[proposal_id] = Address(vault_address)
        self.proposal_amount_a[proposal_id] = cap_wei
        self.proposal_digest[proposal_id] = evidence_digest
        self._start_proposal(proposal_id, "VAULT_REGISTER")

    @gl.public.write
    def propose_allocation(self, allocation_id: str, project_id: str, amount_wei: u256) -> None:
        self._member_only()
        self._ensure_new_proposal_id(allocation_id)
        if self.allocation_status.get(allocation_id, ""):
            raise gl.vm.UserError("allocation id already used")
        if len(self.members) < 2:
            raise gl.vm.UserError("at least two DAO members required for allocations")
        if self.paused:
            raise gl.vm.UserError("treasury paused")
        if project_id not in self.vault_for_project:
            raise gl.vm.UserError("project is not governance registered")
        if not allocation_id or len(allocation_id) > 80 or amount_wei == u256(0):
            raise gl.vm.UserError("invalid allocation id or amount")
        if amount_wei > self.mandate_max_allocation_wei:
            raise gl.vm.UserError("mandate allocation limit exceeded")
        self.allocation_project[allocation_id] = project_id
        self.allocation_amount[allocation_id] = amount_wei
        self.allocation_mandate_version[allocation_id] = self.mandate_version
        self.allocation_status[allocation_id] = "PROPOSED"
        self.allocation_proposer[allocation_id] = gl.message.sender_address

    @gl.public.write
    def evaluate_allocation(self, allocation_id: str) -> None:
        if self.allocation_status.get(allocation_id, "") != "PROPOSED":
            raise gl.vm.UserError("allocation is not proposed")
        if self.paused:
            raise gl.vm.UserError("treasury paused")
        if self.allocation_mandate_version[allocation_id] != self.mandate_version:
            self.allocation_status[allocation_id] = "EXPIRED"
            return
        project_id = self.allocation_project[allocation_id]
        amount_wei = self.allocation_amount[allocation_id]
        now = self._now()
        assessed_at = self.project_evidence_assessed_at[project_id]
        if now < assessed_at or now - assessed_at > self.mandate_evidence_max_age_seconds:
            raise gl.vm.UserError("project eligibility evidence is stale")
        gross_base = self.total_deposited_wei - self.total_refunds_received_wei
        if gross_base == u256(0):
            raise gl.vm.UserError("no funded accounting base")
        encumbered = self.pending_transfer_wei + self.reserved_allocation_wei
        if encumbered > self.balance:
            raise gl.vm.UserError("treasury balance is encumbered or value is at risk")
        spendable = self.balance - encumbered
        if amount_wei > spendable:
            raise gl.vm.UserError("insufficient unreserved treasury GEN")
        project_exposure = self.committed_for_project.get(project_id, u256(0))
        project_cap = self.cap_for_project[project_id]
        if amount_wei > project_cap or project_exposure > project_cap - amount_wei:
            raise gl.vm.UserError("project cap exceeded")
        exposure_cap = self._bps_of(gross_base, self.mandate_max_project_exposure_bps)
        if amount_wei > exposure_cap or project_exposure > exposure_cap - amount_wei:
            raise gl.vm.UserError("mandate project concentration exceeded")
        reserve_required = self._bps_of(gross_base, self.mandate_min_liquid_reserve_bps)
        if spendable - amount_wei < reserve_required:
            raise gl.vm.UserError("mandate liquid reserve would be breached")
        self.reserved_allocation_wei += amount_wei
        self.committed_for_project[project_id] = project_exposure + amount_wei
        self.proposal_project[allocation_id] = project_id
        self.proposal_amount_a[allocation_id] = amount_wei
        self.proposal_digest[allocation_id] = self.project_evidence_digest[project_id]
        self._start_proposal(allocation_id, "ALLOCATION")
        self.allocation_status[allocation_id] = "EVALUATING"

    @gl.public.write
    def propose_challenge_resolution(
        self, proposal_id: str, allocation_id: str, authorize_allocation: bool
    ) -> None:
        self._member_only()
        self._ensure_new_proposal_id(proposal_id)
        if self.allocation_status.get(allocation_id, "") != "CHALLENGED":
            raise gl.vm.UserError("allocation is not challenged")
        self.proposal_target_id[proposal_id] = allocation_id
        self.proposal_amount_a[proposal_id] = u256(1) if authorize_allocation else u256(0)
        self._start_proposal(proposal_id, "CHALLENGE_RESOLUTION")

    @gl.public.write
    def vote(self, proposal_id: str, support: bool) -> None:
        self._member_only()
        if self.proposal_status.get(proposal_id, "") != "VOTING":
            raise gl.vm.UserError("proposal is not accepting votes")
        now = self._now()
        if now < self.proposal_created_at[proposal_id] or now >= self.proposal_voting_ends_at[proposal_id]:
            raise gl.vm.UserError("vote outside voting period")
        member = gl.message.sender_address
        key = self._proposal_key(proposal_id, member)
        weight = self.proposal_member_snapshot.get(key, u256(0))
        if weight == u256(0):
            raise gl.vm.UserError("member is not in proposal snapshot")
        if self.proposal_voted.get(key, False):
            raise gl.vm.UserError("member already voted")
        self.proposal_voted[key] = True
        if support:
            self.proposal_votes_for[proposal_id] += weight
        else:
            self.proposal_votes_against[proposal_id] += weight

    @gl.public.write
    def finalize_governance_proposal(self, proposal_id: str) -> None:
        if self.proposal_status.get(proposal_id, "") != "VOTING":
            raise gl.vm.UserError("proposal is not in voting state")
        now = self._now()
        if now < self.proposal_voting_ends_at[proposal_id]:
            raise gl.vm.UserError("voting period has not ended")
        votes_for = self.proposal_votes_for[proposal_id]
        votes_against = self.proposal_votes_against[proposal_id]
        participating = votes_for + votes_against
        snapshot_total = self.proposal_snapshot_total[proposal_id]
        quorum_required = self._ceil_bps(snapshot_total, self.quorum_bps)
        approval_required = self._ceil_bps(participating, self.approval_bps)
        if participating < quorum_required:
            self.proposal_status[proposal_id] = "EXPIRED"
            self._reject_proposal_allocation(proposal_id, "EXPIRED")
            return
        if votes_for < approval_required:
            self.proposal_status[proposal_id] = "REJECTED"
            self._reject_proposal_allocation(proposal_id)
            return
        if (self.proposal_kind.get(proposal_id, "") == "ALLOCATION"
                and self.allocation_mandate_version[proposal_id] != self.mandate_version):
            self.proposal_status[proposal_id] = "EXPIRED"
            self._reject_proposal_allocation(proposal_id, "EXPIRED")
            return
        self.proposal_status[proposal_id] = "TIMELOCKED"
        execute_after = now + self.execution_delay_seconds
        self.proposal_execute_after[proposal_id] = execute_after
        self.proposal_execute_by[proposal_id] = execute_after + self.execution_window_seconds

    def _reject_proposal_allocation(self, proposal_id: str, status: str = "REJECTED") -> None:
        if self.proposal_kind.get(proposal_id, "") == "ALLOCATION":
            self.allocation_status[proposal_id] = status
            self._release_allocation_reservation(proposal_id)

    @gl.public.write
    def execute_governance_proposal(self, proposal_id: str) -> None:
        if self.proposal_status.get(proposal_id, "") != "TIMELOCKED":
            raise gl.vm.UserError("proposal is not timelocked")
        now = self._now()
        if now < self.proposal_execute_after[proposal_id]:
            raise gl.vm.UserError("governance timelock has not elapsed")
        if now > self.proposal_execute_by[proposal_id]:
            self.proposal_status[proposal_id] = "EXPIRED"
            self._reject_proposal_allocation(proposal_id, "EXPIRED")
            return
        kind = self.proposal_kind[proposal_id]
        if (kind == "ALLOCATION"
                and self.allocation_mandate_version[proposal_id] != self.mandate_version):
            self.proposal_status[proposal_id] = "EXPIRED"
            self._reject_proposal_allocation(proposal_id, "EXPIRED")
            return
        if kind == "MEMBER_ADD":
            member = self.proposal_address[proposal_id]
            if self.member_weight.get(member, u256(0)) > u256(0) or len(self.members) >= 100:
                raise gl.vm.UserError("member addition no longer valid")
            self.member_weight[member] = u256(1)
            self.members.append(member)
        elif kind == "MANDATE_UPDATE":
            self.mandate_max_project_exposure_bps = self.proposal_amount_a[proposal_id]
            self.mandate_min_liquid_reserve_bps = self.proposal_amount_b[proposal_id]
            self.mandate_max_allocation_wei = self.proposal_amount_c[proposal_id]
            self.mandate_challenge_window_seconds = self.proposal_amount_d[proposal_id]
            self.mandate_evidence_max_age_seconds = self.proposal_amount_e[proposal_id]
            self.mandate_version += u256(1)
        elif kind == "VAULT_REGISTER":
            project_id = self.proposal_project[proposal_id]
            vault_address = self.proposal_address[proposal_id]
            vault = gl.get_contract_at(vault_address)
            if vault.view().get_parent_address() != gl.message.contract_address.as_hex:
                raise gl.vm.UserError("incorrect vault parent")
            if vault.view().get_project_id() != project_id:
                raise gl.vm.UserError("incorrect vault project")
            self.vault_for_project[project_id] = vault_address
            self.cap_for_project[project_id] = self.proposal_amount_a[proposal_id]
            self.project_evidence_digest[project_id] = self.proposal_digest[proposal_id]
            self.project_evidence_assessed_at[project_id] = now
        elif kind == "ALLOCATION":
            self.allocation_status[proposal_id] = "CHALLENGEABLE"
            self.allocation_challenge_ends_at[proposal_id] = now + self.mandate_challenge_window_seconds
        elif kind == "CHALLENGE_RESOLUTION":
            allocation_id = self.proposal_target_id[proposal_id]
            if self.allocation_status.get(allocation_id, "") != "CHALLENGED":
                raise gl.vm.UserError("allocation challenge is no longer active")
            if self.allocation_mandate_version[allocation_id] != self.mandate_version:
                self.allocation_status[allocation_id] = "EXPIRED"
                self._release_allocation_reservation(allocation_id)
                self.proposal_status[proposal_id] = "EXPIRED"
                return
            if self.proposal_amount_a[proposal_id] == u256(1):
                self.allocation_status[allocation_id] = "AUTHORIZED"
            else:
                self.allocation_status[allocation_id] = "REJECTED"
                self._release_allocation_reservation(allocation_id)
        else:
            raise gl.vm.UserError("unsupported governance proposal kind")
        self.proposal_status[proposal_id] = "EXECUTED"

    @gl.public.write
    def challenge_allocation(self, allocation_id: str, evidence_digest: str) -> None:
        self._member_only()
        if self.allocation_status.get(allocation_id, "") != "CHALLENGEABLE":
            raise gl.vm.UserError("allocation is not challengeable")
        if self._now() >= self.allocation_challenge_ends_at[allocation_id]:
            raise gl.vm.UserError("allocation challenge window has ended")
        if gl.message.sender_address == self.allocation_proposer[allocation_id]:
            raise gl.vm.UserError("allocation proposer cannot challenge own allocation")
        if not evidence_digest or len(evidence_digest) > 128:
            raise gl.vm.UserError("challenge evidence digest required")
        self.allocation_challenge_digest[allocation_id] = evidence_digest
        self.allocation_status[allocation_id] = "CHALLENGED"

    @gl.public.write
    def cancel_allocation(self, allocation_id: str) -> None:
        status = self.allocation_status.get(allocation_id, "")
        if status not in ("PROPOSED", "EVALUATING"):
            raise gl.vm.UserError("allocation is not cancellable")
        if gl.message.sender_address != self.allocation_proposer[allocation_id]:
            raise gl.vm.UserError("allocation proposer required")
        if status == "PROPOSED":
            self.allocation_status[allocation_id] = "CANCELLED"
            return
        proposal_id = allocation_id
        if self.proposal_status.get(proposal_id, "") != "VOTING":
            raise gl.vm.UserError("allocation vote is no longer open")
        if self.proposal_votes_for[proposal_id] + self.proposal_votes_against[proposal_id] > u256(0):
            raise gl.vm.UserError("allocation cannot be cancelled after voting begins")
        self.proposal_status[proposal_id] = "CANCELLED"
        self.allocation_status[allocation_id] = "CANCELLED"
        self._release_allocation_reservation(allocation_id)

    @gl.public.write
    def finalize_allocation(self, allocation_id: str) -> None:
        if self.allocation_status.get(allocation_id, "") != "CHALLENGEABLE":
            raise gl.vm.UserError("allocation is not awaiting challenge expiry")
        if self._now() < self.allocation_challenge_ends_at[allocation_id]:
            raise gl.vm.UserError("allocation challenge window is active")
        if self.allocation_mandate_version[allocation_id] != self.mandate_version:
            self.allocation_status[allocation_id] = "EXPIRED"
            self._release_allocation_reservation(allocation_id)
            return
        self.allocation_status[allocation_id] = "AUTHORIZED"

    def _bps_of(self, value: u256, bps: u256) -> u256:
        return (value // u256(10000)) * bps + ((value % u256(10000)) * bps) // u256(10000)

    def _ceil_bps(self, value: u256, bps: u256) -> u256:
        whole = (value // u256(10000)) * bps
        remainder_product = (value % u256(10000)) * bps
        remainder = (remainder_product + u256(9999)) // u256(10000)
        return whole + remainder

    def _only_admin(self) -> None:
        if gl.message.sender_address != self.administrator:
            raise gl.vm.UserError("administrator required (LAB ONLY)")

    @gl.public.write.payable
    def deposit(self) -> None:
        value = gl.message.value
        if value == u256(0):
            raise gl.vm.UserError("zero GEN deposit")
        self.total_deposited_wei += value

    @gl.public.write
    def set_pause(self, paused: bool) -> None:
        self._only_admin()
        self.paused = paused

    @gl.public.write
    def register_vault(self, project_id: str, vault_address: str, cap_wei: u256) -> None:
        raise gl.vm.UserError("vault registration requires finalized governance")

    @gl.public.write
    def fund_project_vault(self, project_id: str, allocation_id: str, amount_wei: u256) -> None:
        """Permissionless execution of a fully authorized allocation only."""
        if self.paused:
            raise gl.vm.UserError("treasury paused")
        if self.allocation_status.get(allocation_id, "") != "AUTHORIZED":
            raise gl.vm.UserError("allocation not authorized")
        if self.allocation_mandate_version[allocation_id] != self.mandate_version:
            self.allocation_status[allocation_id] = "EXPIRED"
            self._release_allocation_reservation(allocation_id)
            return
        if project_id != self.allocation_project[allocation_id]:
            raise gl.vm.UserError("allocation project mismatch")
        if amount_wei != self.allocation_amount[allocation_id] or amount_wei == u256(0):
            raise gl.vm.UserError("allocation amount mismatch")
        if allocation_id in self.funding_status:
            raise gl.vm.UserError("allocation already used")
        if project_id not in self.vault_for_project:
            raise gl.vm.UserError("unregistered project")
        encumbered = self.pending_transfer_wei + self.reserved_allocation_wei
        if encumbered > self.balance or amount_wei > self.reserved_allocation_wei:
            raise gl.vm.UserError("treasury balance is encumbered or value is at risk")
        self.funding_project[allocation_id] = project_id
        self.funding_amount[allocation_id] = amount_wei
        self.funding_status[allocation_id] = "PENDING"
        self.reserved_allocation_wei -= amount_wei
        self.pending_transfer_wei += amount_wei
        self.allocation_status[allocation_id] = "FUNDING_PENDING"
        vault = gl.get_contract_at(self.vault_for_project[project_id])
        vault.emit(value=amount_wei, on="finalized").fund_project(allocation_id, project_id)

    @gl.public.write
    def record_funding_child_success(self, allocation_id: str, project_id: str, amount_wei: u256) -> None:
        """Accept a finalized-vault callback; never trust a keeper assertion."""
        if allocation_id not in self.funding_status:
            raise gl.vm.UserError("unknown allocation")
        if self.funding_status[allocation_id] not in ("PENDING", "UNKNOWN"):
            raise gl.vm.UserError("allocation is not awaiting child success")
        if self.funding_project[allocation_id] != project_id:
            raise gl.vm.UserError("funding project mismatch")
        if self.vault_for_project[project_id] != gl.message.sender_address:
            raise gl.vm.UserError("untrusted funding sender")
        if amount_wei != self.funding_amount[allocation_id]:
            raise gl.vm.UserError("funding amount mismatch")
        if self.allocation_status.get(allocation_id, "") != "FUNDING_PENDING":
            raise gl.vm.UserError("allocation funding is not pending")
        self.funding_status[allocation_id] = "CHILD_SUCCESS"
        pending = self.pending_transfer_wei
        if amount_wei > pending:
            raise gl.vm.UserError("pending transfer accounting mismatch")
        self.pending_transfer_wei = pending - amount_wei

    @gl.public.write
    def reconcile_funding(self, allocation_id: str) -> None:
        """Confirm child funding through an authenticated vault read.

        Only a finalized vault callback advances PENDING to CHILD_SUCCESS.
        Do NOT blindly reissue a payment when receipt status is uncertain.
        Independent parent/child receipt inspection is still mandatory in the
        keeper, particularly for failures or permanent value loss.
        """
        if allocation_id not in self.funding_status:
            raise gl.vm.UserError("unknown allocation")
        if self.funding_status[allocation_id] == "VERIFIED":
            return
        if self.funding_status[allocation_id] != "CHILD_SUCCESS":
            raise gl.vm.UserError("child success not confirmed")
        project_id = self.funding_project[allocation_id]
        vault = gl.get_contract_at(self.vault_for_project[project_id])
        seen_amount = vault.view().get_allocation_amount(allocation_id)
        if seen_amount != self.funding_amount[allocation_id]:
            raise gl.vm.UserError("funding unconfirmed; inspect child receipt")
        self.funding_status[allocation_id] = "VERIFIED"
        self.allocation_status[allocation_id] = "VERIFIED"

    @gl.public.write
    def request_refund(self, project_id: str, refund_id: str, amount_wei: u256) -> None:
        """LAB ONLY: request a bounded committed balance back from a ProjectVault."""
        self._only_admin()
        if project_id not in self.vault_for_project:
            raise gl.vm.UserError("unregistered project")
        if not refund_id or len(refund_id) > 80 or refund_id in self.refund_status:
            raise gl.vm.UserError("refund id invalid or used")
        if amount_wei == u256(0):
            raise gl.vm.UserError("zero refund")
        committed = self.committed_for_project.get(project_id, u256(0))
        pending_refunds = self.pending_refund_for_project.get(project_id, u256(0))
        if pending_refunds > committed or amount_wei > committed - pending_refunds:
            raise gl.vm.UserError("refund exceeds unrefunded project commitment")
        self.refund_project[refund_id] = project_id
        self.refund_amount[refund_id] = amount_wei
        self.refund_status[refund_id] = "PENDING"
        self.pending_refund_for_project[project_id] = pending_refunds + amount_wei
        vault = gl.get_contract_at(self.vault_for_project[project_id])
        vault.emit(on="finalized").initiate_refund(refund_id, amount_wei)

    @gl.public.write.payable
    def receive_refund(self, refund_id: str, project_id: str) -> None:
        if refund_id not in self.refund_status:
            raise gl.vm.UserError("unknown refund")
        if self.refund_status[refund_id] != "PENDING":
            raise gl.vm.UserError("refund already received")
        if self.refund_project[refund_id] != project_id:
            raise gl.vm.UserError("refund project mismatch")
        if self.vault_for_project[project_id] != gl.message.sender_address:
            raise gl.vm.UserError("untrusted refund sender")
        if gl.message.value != self.refund_amount[refund_id]:
            raise gl.vm.UserError("refund amount mismatch")
        committed = self.committed_for_project.get(project_id, u256(0))
        pending_refunds = self.pending_refund_for_project.get(project_id, u256(0))
        if gl.message.value > committed or gl.message.value > pending_refunds:
            raise gl.vm.UserError("refund accounting exceeds reserved commitment")
        self.refund_status[refund_id] = "CHILD_SUCCESS"
        self.total_refunds_received_wei += gl.message.value
        self.committed_for_project[project_id] = committed - gl.message.value
        self.pending_refund_for_project[project_id] = pending_refunds - gl.message.value
        vault = gl.get_contract_at(self.vault_for_project[project_id])
        vault.emit(on="finalized").record_refund_child_success(refund_id, project_id, gl.message.value)

    @gl.public.view
    def get_balance_wei(self) -> u256:
        return self.balance

    @gl.public.view
    def get_funding_status(self, allocation_id: str) -> str:
        return self.funding_status.get(allocation_id, "UNKNOWN")

    @gl.public.view
    def get_pending_transfer_wei(self) -> u256:
        return self.pending_transfer_wei

    @gl.public.view
    def get_refund_status(self, refund_id: str) -> str:
        return self.refund_status.get(refund_id, "UNKNOWN")

    @gl.public.write
    def reconcile_refund(self, refund_id: str) -> None:
        if refund_id not in self.refund_status:
            raise gl.vm.UserError("unknown refund")
        if self.refund_status[refund_id] == "VERIFIED":
            return
        if self.refund_status[refund_id] != "CHILD_SUCCESS":
            raise gl.vm.UserError("refund child success not confirmed")
        project_id = self.refund_project[refund_id]
        vault = gl.get_contract_at(self.vault_for_project[project_id])
        if vault.view().get_refund_status(refund_id) != "CHILD_SUCCESS":
            raise gl.vm.UserError("vault refund child success not confirmed")
        self.refund_status[refund_id] = "VERIFIED"

    @gl.public.view
    def get_vault_address(self, project_id: str) -> str:
        if project_id not in self.vault_for_project:
            return ""
        return self.vault_for_project[project_id].as_hex

    @gl.public.view
    def get_member_weight(self, member_address: str) -> u256:
        return self.member_weight.get(Address(member_address), u256(0))

    @gl.public.view
    def get_proposal_status(self, proposal_id: str) -> str:
        return self.proposal_status.get(proposal_id, "UNKNOWN")

    @gl.public.view
    def get_proposal_timing(self, proposal_id: str) -> tuple[u256, u256, u256]:
        return (
            self.proposal_voting_ends_at.get(proposal_id, u256(0)),
            self.proposal_execute_after.get(proposal_id, u256(0)),
            self.proposal_execute_by.get(proposal_id, u256(0)),
        )

    @gl.public.view
    def get_allocation_status(self, allocation_id: str) -> str:
        return self.allocation_status.get(allocation_id, "UNKNOWN")

    @gl.public.view
    def get_allocation_details(self, allocation_id: str) -> tuple[str, u256, u256, u256]:
        return (
            self.allocation_project.get(allocation_id, ""),
            self.allocation_amount.get(allocation_id, u256(0)),
            self.allocation_challenge_ends_at.get(allocation_id, u256(0)),
            self.allocation_mandate_version.get(allocation_id, u256(0)),
        )

    @gl.public.view
    def get_spendable_balance_wei(self) -> u256:
        encumbered = self.pending_transfer_wei + self.reserved_allocation_wei
        if encumbered >= self.balance:
            return u256(0)
        return self.balance - encumbered
