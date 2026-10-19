# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""LAB-ONLY Gate 1 MandateOS treasury.

This contract is intentionally NOT a production DAO or investment manager.
The single administrator can register and fund vaults. Codex MUST replace that
power with mandate-governed approvals, distributed governance, review windows,
portfolio reservations and dispute handling before progressing to V1 release.

In particular, 'SCHEDULED' is NOT proof of value received by ProjectVault.
"""
from genlayer import *


class MandateOS(gl.Contract):
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
    refund_project: TreeMap[str, str]
    refund_amount: TreeMap[str, u256]
    refund_status: TreeMap[str, str]

    def __init__(self):
        self.administrator = gl.message.sender_address
        self.paused = False
        self.total_deposited_wei = u256(0)
        self.total_refunds_received_wei = u256(0)

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
        self._only_admin()
        if not project_id or len(project_id) > 80:
            raise gl.vm.UserError("invalid project id")
        if project_id in self.vault_for_project:
            raise gl.vm.UserError("vault already registered")
        if cap_wei == u256(0):
            raise gl.vm.UserError("zero project cap")
        target = Address(vault_address)
        # Read must succeed and match before accepting the vault address.
        vault = gl.get_contract_at(target)
        if vault.view().get_parent_address() != gl.message.contract_address.as_hex:
            raise gl.vm.UserError("incorrect vault parent")
        if vault.view().get_project_id() != project_id:
            raise gl.vm.UserError("incorrect vault project")
        self.vault_for_project[project_id] = target
        self.cap_for_project[project_id] = cap_wei

    @gl.public.write
    def fund_project_vault(self, project_id: str, allocation_id: str, amount_wei: u256) -> None:
        """Schedule a child tx ON FINALIZED; do not mark settlement as complete."""
        self._only_admin()
        if self.paused:
            raise gl.vm.UserError("treasury paused")
        if project_id not in self.vault_for_project:
            raise gl.vm.UserError("unregistered project")
        if not allocation_id or len(allocation_id) > 80:
            raise gl.vm.UserError("invalid allocation id")
        if allocation_id in self.funding_status:
            raise gl.vm.UserError("allocation already used")
        if amount_wei == u256(0):
            raise gl.vm.UserError("zero allocation")
        current = self.committed_for_project.get(project_id, u256(0))
        cap = self.cap_for_project[project_id]
        if amount_wei > cap or current > cap - amount_wei:
            raise gl.vm.UserError("project funding cap exceeded")
        if amount_wei > self.balance:
            raise gl.vm.UserError("insufficient treasury GEN")
        self.committed_for_project[project_id] = current + amount_wei
        self.funding_project[allocation_id] = project_id
        self.funding_amount[allocation_id] = amount_wei
        self.funding_status[allocation_id] = "SCHEDULED"
        vault = gl.get_contract_at(self.vault_for_project[project_id])
        vault.emit(value=amount_wei, on="finalized").fund_project(allocation_id, project_id)

    @gl.public.write
    def reconcile_funding(self, allocation_id: str) -> None:
        """Confirm child funding through an authenticated vault read.

        If evidence is absent, leave SCHEDULED. Do NOT blindly reissue payment.
        Independent parent/child receipt inspection is still mandatory in the
        keeper, particularly for failures or permanent value loss.
        """
        if allocation_id not in self.funding_status:
            raise gl.vm.UserError("unknown allocation")
        if self.funding_status[allocation_id] == "CONFIRMED":
            return
        project_id = self.funding_project[allocation_id]
        vault = gl.get_contract_at(self.vault_for_project[project_id])
        seen_amount = vault.view().get_allocation_amount(allocation_id)
        if seen_amount != self.funding_amount[allocation_id]:
            raise gl.vm.UserError("funding unconfirmed; inspect child receipt")
        self.funding_status[allocation_id] = "CONFIRMED"

    @gl.public.write
    def request_refund(self, project_id: str, refund_id: str, amount_wei: u256) -> None:
        """LAB ONLY: request eligible unspent GEN back from a ProjectVault."""
        self._only_admin()
        if project_id not in self.vault_for_project:
            raise gl.vm.UserError("unregistered project")
        if not refund_id or len(refund_id) > 80 or refund_id in self.refund_status:
            raise gl.vm.UserError("refund id invalid or used")
        if amount_wei == u256(0):
            raise gl.vm.UserError("zero refund")
        self.refund_project[refund_id] = project_id
        self.refund_amount[refund_id] = amount_wei
        self.refund_status[refund_id] = "SCHEDULED"
        vault = gl.get_contract_at(self.vault_for_project[project_id])
        vault.emit(on="finalized").initiate_refund(refund_id, amount_wei)

    @gl.public.write.payable
    def receive_refund(self, refund_id: str, project_id: str) -> None:
        if refund_id not in self.refund_status:
            raise gl.vm.UserError("unknown refund")
        if self.refund_status[refund_id] != "SCHEDULED":
            raise gl.vm.UserError("refund already received")
        if self.refund_project[refund_id] != project_id:
            raise gl.vm.UserError("refund project mismatch")
        if self.vault_for_project[project_id] != gl.message.sender_address:
            raise gl.vm.UserError("untrusted refund sender")
        if gl.message.value != self.refund_amount[refund_id]:
            raise gl.vm.UserError("refund amount mismatch")
        self.refund_status[refund_id] = "CONFIRMED"
        self.total_refunds_received_wei += gl.message.value

    @gl.public.view
    def get_balance_wei(self) -> u256:
        return self.balance

    @gl.public.view
    def get_funding_status(self, allocation_id: str) -> str:
        return self.funding_status.get(allocation_id, "UNKNOWN")

    @gl.public.view
    def get_refund_status(self, refund_id: str) -> str:
        return self.refund_status.get(refund_id, "UNKNOWN")

    @gl.public.view
    def get_vault_address(self, project_id: str) -> str:
        if project_id not in self.vault_for_project:
            return ""
        return self.vault_for_project[project_id].as_hex
