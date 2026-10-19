"""Pure-Python policy reference, NOT executable treasury authorization.

Used for deterministic test vectors. Production checks must be ported to the
GenLayer Intelligent Contract, reviewed and independently tested there.
All amounts are integer wei. Never use float for financial calculations.
"""
from dataclasses import dataclass

BPS = 10_000


@dataclass(frozen=True)
class Mandate:
    max_project_exposure_bps: int = 2_000
    min_liquid_reserve_bps: int = 1_500
    max_new_allocation_wei: int = 30 * 10**18

    def __post_init__(self):
        if not (0 <= self.max_project_exposure_bps <= BPS):
            raise ValueError("invalid project exposure ratio")
        if not (0 <= self.min_liquid_reserve_bps <= BPS):
            raise ValueError("invalid liquid reserve ratio")
        if self.max_new_allocation_wei < 0:
            raise ValueError("negative allocation cap")


@dataclass(frozen=True)
class BalanceSnapshot:
    # The liquid balance excludes money already reserved for commitments.
    liquid_unreserved_wei: int
    reserved_pending_wei: int
    all_vault_held_wei: int
    outstanding_principal_wei: int
    # Project-specific exposures are subsets of global reserved/vault/principal.
    project_reserved_wei: int = 0
    project_vault_held_wei: int = 0
    project_outstanding_principal_wei: int = 0

    def __post_init__(self):
        if any(value < 0 for value in vars(self).values()):
            raise ValueError("negative balance")
        if self.project_reserved_wei > self.reserved_pending_wei:
            raise ValueError("project reserved exceeds all reserved")
        if self.project_vault_held_wei > self.all_vault_held_wei:
            raise ValueError("project vault balance exceeds all vault balances")
        if self.project_outstanding_principal_wei > self.outstanding_principal_wei:
            raise ValueError("project principal exceeds all principal")

    @property
    def accounting_base_wei(self) -> int:
        return (self.liquid_unreserved_wei + self.reserved_pending_wei
                + self.all_vault_held_wei + self.outstanding_principal_wei)

    @property
    def project_exposure_wei(self) -> int:
        return (self.project_reserved_wei + self.project_vault_held_wei
                + self.project_outstanding_principal_wei)


def evaluate_allocation(mandate: Mandate, snapshot: BalanceSnapshot,
                        amount_wei: int, evidence_status: str) -> tuple[bool, str]:
    """Return (allowed, reason); fail closed if material evidence not verified.

    The accounting base here is a nominal GEN-denominated exposure base, not a
    real NAV valuation. Losses/impairments require a separate production policy.
    """
    if amount_wei <= 0:
        return False, "NON_POSITIVE_AMOUNT"
    if evidence_status != "VERIFIED_ELIGIBLE":
        return False, "EVIDENCE_NOT_VERIFIED_ELIGIBLE"
    if amount_wei > mandate.max_new_allocation_wei:
        return False, "SINGLE_ALLOCATION_CAP"
    if snapshot.accounting_base_wei <= 0:
        return False, "EMPTY_ACCOUNTING_BASE"
    if amount_wei > snapshot.liquid_unreserved_wei:
        return False, "INSUFFICIENT_UNRESERVED_GEN"
    projected_exposure = snapshot.project_exposure_wei + amount_wei
    if projected_exposure * BPS > snapshot.accounting_base_wei * mandate.max_project_exposure_bps:
        return False, "PROJECT_CONCENTRATION"
    if (snapshot.liquid_unreserved_wei - amount_wei) * BPS < \
            snapshot.accounting_base_wei * mandate.min_liquid_reserve_bps:
        return False, "LIQUID_RESERVE"
    return True, "ELIGIBLE_FOR_PROPOSAL"
