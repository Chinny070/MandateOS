# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""LAB-ONLY Gate 1 ProjectVault.

Only accepts value sent from its configured MandateOS parent.
Can return held funds on parent instruction. There is deliberately NO
beneficiary payout method until milestones, appeals, and settlement are built.
"""
from genlayer import *


class ProjectVault(gl.Contract):
    mandate_os: Address
    project_id: str
    total_received_wei: u256
    total_refund_scheduled_wei: u256
    refund_reserved_wei: u256
    allocations: TreeMap[str, u256]
    refund_status: TreeMap[str, str]
    refund_amount: TreeMap[str, u256]

    def __init__(self, mandate_os_address: str, project_id: str):
        if not project_id or len(project_id) > 80:
            raise gl.vm.UserError("invalid project id")
        self.mandate_os = Address(mandate_os_address)
        self.project_id = project_id
        self.total_received_wei = u256(0)
        self.total_refund_scheduled_wei = u256(0)
        self.refund_reserved_wei = u256(0)

    def _require_parent(self) -> None:
        if gl.message.sender_address != self.mandate_os:
            raise gl.vm.UserError("MandateOS parent required")

    @gl.public.write.payable
    def fund_project(self, allocation_id: str, project_id: str) -> None:
        self._require_parent()
        if project_id != self.project_id:
            raise gl.vm.UserError("project mismatch")
        if not allocation_id or allocation_id in self.allocations:
            raise gl.vm.UserError("duplicate or invalid funding id")
        amount = gl.message.value
        if amount == u256(0):
            raise gl.vm.UserError("no GEN sent")
        self.allocations[allocation_id] = amount
        self.total_received_wei += amount
        parent = gl.get_contract_at(self.mandate_os)
        parent.emit(on="finalized").record_funding_child_success(allocation_id, project_id, amount)

    @gl.public.write
    def initiate_refund(self, refund_id: str, amount_wei: u256) -> None:
        self._require_parent()
        if not refund_id or refund_id in self.refund_status:
            raise gl.vm.UserError("refund id invalid or used")
        if amount_wei == u256(0):
            raise gl.vm.UserError("zero refund")
        available = self.get_refund_available_wei()
        if amount_wei > available:
            raise gl.vm.UserError("insufficient vault balance")
        # No automatic retries: if the child fails, funds may not return.
        self.refund_status[refund_id] = "SCHEDULED"
        self.refund_amount[refund_id] = amount_wei
        self.total_refund_scheduled_wei += amount_wei
        self.refund_reserved_wei += amount_wei
        parent = gl.get_contract_at(self.mandate_os)
        parent.emit(value=amount_wei, on="finalized").receive_refund(refund_id, self.project_id)

    @gl.public.write
    def record_refund_child_success(self, refund_id: str, project_id: str, amount_wei: u256) -> None:
        """Accept the authenticated MandateOS callback after refund finality."""
        self._require_parent()
        if project_id != self.project_id:
            raise gl.vm.UserError("refund project mismatch")
        if refund_id not in self.refund_status or self.refund_status[refund_id] != "SCHEDULED":
            raise gl.vm.UserError("refund is not awaiting confirmation")
        if amount_wei != self.refund_amount[refund_id]:
            raise gl.vm.UserError("refund amount mismatch")
        if amount_wei > self.refund_reserved_wei:
            raise gl.vm.UserError("refund reservation accounting mismatch")
        self.refund_status[refund_id] = "CHILD_SUCCESS"
        self.refund_reserved_wei -= amount_wei

    @gl.public.view
    def get_parent_address(self) -> str:
        return self.mandate_os.as_hex

    @gl.public.view
    def get_project_id(self) -> str:
        return self.project_id

    @gl.public.view
    def get_allocation_amount(self, allocation_id: str) -> u256:
        return self.allocations.get(allocation_id, u256(0))

    @gl.public.view
    def get_balance_wei(self) -> u256:
        return self.balance

    @gl.public.view
    def get_refund_available_wei(self) -> u256:
        if self.refund_reserved_wei >= self.balance:
            return u256(0)
        return self.balance - self.refund_reserved_wei

    @gl.public.view
    def get_refund_status(self, refund_id: str) -> str:
        return self.refund_status.get(refund_id, "UNKNOWN")
