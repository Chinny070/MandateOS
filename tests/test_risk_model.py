import dataclasses
import pytest
from reference.risk_model import BalanceSnapshot, Mandate, evaluate_allocation

G = 10**18


def snap(liquid=100, reserved=0, vault=0, principal=0, project_reserved=0,
         project_vault=0, project_principal=0):
    return BalanceSnapshot(liquid * G, reserved * G, vault * G, principal * G,
                           project_reserved * G, project_vault * G, project_principal * G)


@pytest.mark.parametrize("amount,allowed,reason", [
    (1, True, "ELIGIBLE_FOR_PROPOSAL"),
    (20, True, "ELIGIBLE_FOR_PROPOSAL"),
    (21, False, "PROJECT_CONCENTRATION"),
    (0, False, "NON_POSITIVE_AMOUNT"),
    (-1, False, "NON_POSITIVE_AMOUNT"),
])
def test_concentration_and_positive_amount(amount, allowed, reason):
    actual = evaluate_allocation(Mandate(), snap(), amount * G, "VERIFIED_ELIGIBLE")
    assert actual == (allowed, reason)


def test_pending_and_principal_count_toward_concentration():
    s = snap(liquid=60, reserved=10, vault=10, principal=20,
             project_reserved=5, project_vault=5, project_principal=5)
    assert evaluate_allocation(Mandate(), s, 6 * G, "VERIFIED_ELIGIBLE") == (False, "PROJECT_CONCENTRATION")
    assert evaluate_allocation(Mandate(), s, 5 * G, "VERIFIED_ELIGIBLE") == (True, "ELIGIBLE_FOR_PROPOSAL")


def test_minimum_reserve():
    mandate = Mandate(max_project_exposure_bps=10_000, min_liquid_reserve_bps=1_500,
                      max_new_allocation_wei=100 * G)
    assert evaluate_allocation(mandate, snap(), 85 * G, "VERIFIED_ELIGIBLE")[0]
    assert evaluate_allocation(mandate, snap(), 86 * G, "VERIFIED_ELIGIBLE") == (False, "LIQUID_RESERVE")


def test_unreserved_funds_do_not_include_pending_commitments():
    mandate = Mandate(max_project_exposure_bps=10_000, min_liquid_reserve_bps=0,
                      max_new_allocation_wei=100 * G)
    assert evaluate_allocation(mandate, snap(liquid=10, reserved=90), 11 * G,
                               "VERIFIED_ELIGIBLE") == (False, "INSUFFICIENT_UNRESERVED_GEN")


@pytest.mark.parametrize("status", ["", "UNRESOLVED", "STALE", "CONTRADICTED",
                                     "SOURCE_UNAVAILABLE", "REQUIRES_REVIEW"])
def test_fail_closed_on_evidence(status):
    assert evaluate_allocation(Mandate(), snap(), G, status) == (False, "EVIDENCE_NOT_VERIFIED_ELIGIBLE")


def test_single_allocation_limit():
    mandate = Mandate(max_project_exposure_bps=10_000, min_liquid_reserve_bps=0,
                      max_new_allocation_wei=10 * G)
    assert evaluate_allocation(mandate, snap(), 11 * G, "VERIFIED_ELIGIBLE") == (False, "SINGLE_ALLOCATION_CAP")


@pytest.mark.parametrize("invalid", [
    {"max_project_exposure_bps": -1},
    {"max_project_exposure_bps": 10_001},
    {"min_liquid_reserve_bps": 10_001},
    {"max_new_allocation_wei": -2},
])
def test_invalid_mandates_rejected(invalid):
    with pytest.raises(ValueError):
        Mandate(**invalid)


def test_invalid_accounting_snapshot_rejected():
    with pytest.raises(ValueError):
        snap(liquid=0, reserved=1, project_reserved=2)
    with pytest.raises(ValueError):
        snap(liquid=-1)


def test_refunds_must_not_inflate_nominal_accounting_base():
    # Transfer GEN between parent and vault; do not count the same capital twice.
    before = snap(liquid=80, vault=20, project_vault=20)
    after = snap(liquid=85, vault=15, project_vault=15)
    assert before.accounting_base_wei == after.accounting_base_wei == 100 * G


def test_reference_is_frozen_dataclass():
    with pytest.raises(dataclasses.FrozenInstanceError):
        Mandate().max_project_exposure_bps = 5000
