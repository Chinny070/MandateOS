"""Direct Mode checks for actual ProjectVault lifecycle entry points.

Balance changes and successful nondeterministic evidence/payment checks are
explicit deterministic fixtures here; they are not StudioNet proof.
"""

from datetime import datetime, timedelta, timezone

import pytest

from gltest.direct.loader import create_address


pytestmark = pytest.mark.direct
BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _hex(address: bytes) -> str:
    if hasattr(address, "as_hex"):
        return address.as_hex
    return "0x" + address.hex()


def _make_vault(direct_vm, direct_deploy, model="REPAYABLE", due_days=1, share_bps=0,
                challenge_seconds=86400, installment_count=1,
                installment_interval_seconds=0, beneficiary_mode="IC"):
    parent = create_address("vault-parent-" + model + str(due_days))
    operator = create_address("vault-operator-" + model + str(due_days))
    beneficiary = create_address("vault-beneficiary-" + model + str(due_days))
    direct_vm.sender = create_address("vault-deployer-" + model + str(due_days))
    direct_vm.value = 0
    vault = direct_deploy("contracts/project_vault.py", _hex(parent), "project-lifecycle")
    vault.allocations["funding-1"] = 100
    vault.total_received_wei = 100
    direct_vm.deal(bytes(direct_vm._contract_address), 100)
    from genlayer.py import calldata
    from genlayer.py.public_abi import ResultCode

    def protocol_hook(vm, request):
        if "CallContract" in request:
            return bytes([int(ResultCode.RETURN)]) + calldata.encode(1)
        if "PostMessage" in request:
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = protocol_hook
    due_at = int((BASE + timedelta(days=due_days)).timestamp()) if due_days else 0
    with direct_vm.prank(parent):
        vault.configure_agreement(
            "agreement-1", "funding-1", "project-lifecycle", _hex(operator),
            _hex(beneficiary), beneficiary_mode, model, 1, 100, due_at, 0 if not due_days else 3600,
            installment_count if model == "REPAYABLE" else 0,
            installment_interval_seconds, challenge_seconds, 86400, share_bps,
        )
    return vault, parent, operator, beneficiary


def test_agreement_is_parent_bound_and_milestone_schedule_is_capped(direct_vm, direct_deploy):
    direct_vm.warp(BASE.isoformat())
    vault, parent, operator, beneficiary = _make_vault(direct_vm, direct_deploy)
    with direct_vm.prank(create_address("untrusted-agreement-caller")), direct_vm.expect_revert("MandateOS parent required"):
        vault.configure_agreement(
            "agreement-2", "funding-1", "project-lifecycle", _hex(operator),
            _hex(beneficiary), "IC", "GRANT", 1, 100, 0, 0, 0, 0, 86400, 86400, 0,
        )
    with direct_vm.prank(parent):
        vault.define_milestone("build", 60, "Verified construction completion")
    with direct_vm.prank(parent), direct_vm.expect_revert(
        "milestone amounts exceed agreement principal"
    ):
        vault.define_milestone("launch", 41, "Verified launch")
    assert vault.get_milestone_status("build") == "DEFINED"
    assert vault.get_milestone_count() == 1
    assert vault.get_milestone_id_at(0) == "build"
    assert vault.get_milestone_id_at(1) == ""
    assert vault.milestone_obligations_wei == 60
    assert vault.get_refund_available_wei() == 40


def test_payout_reservation_cannot_overlap_refund_and_requires_reconciliation(
    direct_vm, direct_deploy
):
    direct_vm.warp(BASE.isoformat())
    vault, parent, operator, beneficiary = _make_vault(direct_vm, direct_deploy)
    with direct_vm.prank(parent):
        vault.define_milestone("build", 40, "Verified construction completion")
    # Deterministic state fixture bypasses only the nondeterministic web evaluator.
    vault.milestone_status["build"] = "AUTHORIZED"
    vault.milestone_evidence_digest["build"] = "a" * 64
    vault.milestone_assessed_at["build"] = int(BASE.timestamp())
    vault.milestone_expires_at["build"] = int((BASE + timedelta(days=1)).timestamp())
    vault.milestone_mandate_version["build"] = 1
    messages = []
    from genlayer.py import calldata
    from genlayer.py.public_abi import ResultCode

    def hook(vm, request):
        if "CallContract" in request:
            method = request["CallContract"]["calldata"]["method"]
            if method == "get_project_payment_amount":
                result = 40
            else:
                raise AssertionError(f"unexpected beneficiary view: {method}")
            return bytes([int(ResultCode.RETURN)]) + calldata.encode(result)
        if "PostMessage" in request:
            messages.append(request["PostMessage"])
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = hook
    with direct_vm.prank(parent):
        vault.initiate_milestone_payout("payment-1", "build")
    assert vault.get_payout_count() == 1
    assert vault.get_payout_id_at(0) == "payment-1"
    assert vault.get_payout_id_at(1) == ""
    # Direct Mode does not debit the asynchronous child value; this fixture
    # applies the documented balance effect before subsequent cash checks.
    direct_vm.deal(bytes(direct_vm._contract_address), 60)
    assert vault.get_payout_status("payment-1") == "PENDING"
    assert vault.payout_reserved_wei == 40
    assert vault.get_refund_available_wei() == 60
    assert messages[-1]["value"] == 40
    assert messages[-1]["on"] == "finalized"
    with direct_vm.prank(parent), direct_vm.expect_revert(
        "payout id or milestone authorization invalid"
    ):
        vault.initiate_milestone_payout("payment-replay", "build")
    with direct_vm.prank(parent), direct_vm.expect_revert("insufficient vault balance"):
        vault.initiate_refund("overlapping-refund", 61)

    direct_vm.warp((BASE + timedelta(days=1, seconds=1)).isoformat())
    vault.flag_payout_uncertain("payment-1")
    assert vault.get_payout_status("payment-1") == "VALUE_AT_RISK"
    assert vault.payout_reserved_wei == 40

    with direct_vm.prank(create_address("fake-payout-recipient")), direct_vm.expect_revert(
        "configured beneficiary required"
    ):
        vault.record_payout_child_success("payment-1")
    with direct_vm.prank(beneficiary):
        vault.record_payout_child_success("payment-1")
    with direct_vm.prank(beneficiary), direct_vm.expect_revert(
        "payout is not awaiting child success"
    ):
        vault.record_payout_child_success("payment-1")
    assert vault.get_payout_status("payment-1") == "CHILD_SUCCESS"
    with direct_vm.expect_revert("beneficiary payment state mismatch"):
        # The test hook intentionally returns a settlement-shaped receipt only
        # after the test models child completion below.
        direct_vm._gl_call_hook = lambda vm, request: (
            bytes([int(ResultCode.RETURN)]) + calldata.encode(39)
            if "CallContract" in request else {"ok": None}
        )
        vault.reconcile_payout("payment-1")

    # Direct Mode does not execute the child. These explicit state changes are
    # fixtures to exercise the contract's post-child reconciliation path.
    direct_vm.deal(bytes(direct_vm._contract_address), 60)
    direct_vm._gl_call_hook = hook
    vault.reconcile_payout("payment-1")
    assert vault.get_payout_status("payment-1") == "VERIFIED"
    assert vault.get_milestone_status("build") == "PAID"
    assert vault.outstanding_principal_wei == 40
    assert vault.get_refund_available_wei() == 60
    with direct_vm.prank(parent), direct_vm.expect_revert(
        "payout id or milestone authorization invalid"
    ):
        vault.initiate_milestone_payout("payment-2", "build")


def test_eoa_payout_uses_finalized_external_transfer_and_never_self_verifies(
    direct_vm, direct_deploy
):
    direct_vm.warp(BASE.isoformat())
    vault, parent, _, _ = _make_vault(
        direct_vm, direct_deploy, beneficiary_mode="EOA"
    )
    with direct_vm.prank(parent):
        vault.define_milestone("build", 40, "Verified construction completion")
    vault.milestone_status["build"] = "AUTHORIZED"
    vault.milestone_evidence_digest["build"] = "b" * 64
    vault.milestone_expires_at["build"] = int((BASE + timedelta(days=1)).timestamp())
    vault.milestone_mandate_version["build"] = 1
    from genlayer.py import calldata
    from genlayer.py.public_abi import ResultCode
    def external_hook(vm, request):
        if "CallContract" in request:
            return bytes([int(ResultCode.RETURN)]) + calldata.encode(0)
        return None

    direct_vm._gl_call_hook = external_hook
    with direct_vm.prank(parent):
        vault.initiate_milestone_payout("eoa-payment-1", "build")
    assert vault.get_payout_status("eoa-payment-1") == "PENDING"
    assert vault.payout_destination["eoa-payment-1"] == vault.agreement_beneficiary
    assert vault.payout_amount["eoa-payment-1"] == 40
    assert vault.payout_destination_mode["eoa-payment-1"] == "EOA"
    assert vault.get_payout_details("eoa-payment-1")[:4] == (
        "PENDING", "EOA", vault.agreement_beneficiary.as_hex, 40,
    )
    assert vault.payout_reserved_wei == 40
    assert vault.unsettled_payout_count == 1
    with direct_vm.prank(vault.agreement_beneficiary), direct_vm.expect_revert(
        "EOA settlement requires independent receipt reconciliation"
    ):
        vault.record_payout_child_success("eoa-payment-1")
    with direct_vm.expect_revert(
        "EOA payout remains unverified pending independent receipt proof"
    ):
        vault.reconcile_payout("eoa-payment-1")
    direct_vm.warp((BASE + timedelta(days=1, seconds=1)).isoformat())
    vault.flag_payout_uncertain("eoa-payment-1")
    assert vault.get_payout_status("eoa-payment-1") == "VALUE_AT_RISK"
    assert vault.payout_reserved_wei == 40
    with direct_vm.prank(parent), direct_vm.expect_revert(
        "payout id or milestone authorization invalid"
    ):
        vault.initiate_milestone_payout("eoa-payment-retry", "build")
    with direct_vm.prank(parent), direct_vm.expect_revert("agreement has unresolved obligations"):
        vault.close_agreement()


def test_governed_return_distribution_reserves_principal_and_realized_income(
    direct_vm, direct_deploy
):
    direct_vm.warp(BASE.isoformat())
    vault, parent, _, _ = _make_vault(direct_vm, direct_deploy)
    vault.outstanding_principal_wei = 0
    vault.principal_recovered_wei = 30
    vault.realized_return_wei = 20
    vault.total_repayment_received_wei = 50
    outbound = []
    direct_vm._gl_call_hook = lambda vm, request: (
        outbound.append(request["PostMessage"]) or {"ok": None}
        if "PostMessage" in request else None
    )

    with direct_vm.prank(create_address("unauthorized-distribution")), direct_vm.expect_revert(
        "MandateOS parent required"
    ):
        vault.initiate_return_distribution("dist-1", 20, 10)
    with direct_vm.prank(parent):
        vault.initiate_return_distribution("dist-1", 20, 10)
    assert vault.get_distribution_available() == (10, 10)
    assert vault.principal_distribution_reserved_wei == 20
    assert vault.return_distribution_reserved_wei == 10
    assert outbound[-1]["value"] == 30
    assert outbound[-1]["on"] == "finalized"
    with direct_vm.prank(parent), direct_vm.expect_revert(
        "distribution exceeds received available funds"
    ):
        vault.initiate_return_distribution("dist-overlap", 11, 0)

    with direct_vm.prank(parent):
        vault.record_return_distribution_child_success("dist-1", 20, 10)
    assert vault.get_distribution_status("dist-1") == "CHILD_SUCCESS"
    assert vault.get_distribution_available() == (10, 10)
    with direct_vm.prank(parent), direct_vm.expect_revert("distribution is not pending"):
        vault.record_return_distribution_child_success("dist-1", 20, 10)
    with direct_vm.prank(parent):
        vault.record_return_distribution_reconciled("dist-1")
    assert vault.get_distribution_status("dist-1") == "VERIFIED"
    assert vault.principal_distributed_wei == 20
    assert vault.realized_return_distributed_wei == 10


def test_repayments_separate_principal_recovery_from_realized_return(direct_vm, direct_deploy):
    direct_vm.warp(BASE.isoformat())
    vault, _, _, _ = _make_vault(direct_vm, direct_deploy)
    vault.outstanding_principal_wei = 40  # fixture for a previously verified payout
    payer = direct_vm.sender
    direct_vm.deal(payer, 50)
    direct_vm.value = 25
    vault.deposit_repayment("agreement-1", "repayment-1")
    direct_vm.value = 0
    assert vault.outstanding_principal_wei == 15
    assert vault.principal_recovered_wei == 25
    assert vault.realized_return_wei == 0

    direct_vm.deal(payer, 50)
    direct_vm.value = 25
    vault.deposit_repayment("agreement-1", "repayment-2")
    direct_vm.value = 0
    assert vault.outstanding_principal_wei == 0
    assert vault.principal_recovered_wei == 40
    assert vault.realized_return_wei == 10
    assert vault.total_repayment_received_wei == 50
    assert vault.get_repayment_status("repayment-1") == "RECEIVED"
    assert vault.get_repayment_count() == 2
    assert vault.get_repayment_id_at(0) == "repayment-1"
    assert vault.get_repayment_id_at(1) == "repayment-2"
    direct_vm.deal(payer, 25)
    direct_vm.value = 25
    with direct_vm.expect_revert("repayment amount or unique id invalid"):
        vault.deposit_repayment("agreement-1", "repayment-1")
    direct_vm.value = 0
    assert vault.total_repayment_received_wei == 50


def test_revenue_share_requires_unique_report_and_actual_capped_gen_deposit(
    direct_vm, direct_deploy
):
    direct_vm.warp(BASE.isoformat())
    vault, _, operator, _ = _make_vault(
        direct_vm, direct_deploy, model="REVENUE_SHARE", due_days=0, share_bps=2500
    )
    with direct_vm.prank(operator):
        vault.report_revenue("period-1", 100)
    assert vault.total_revenue_reported_wei == 100
    assert vault.total_revenue_received_wei == 0
    with direct_vm.prank(operator), direct_vm.expect_revert(
        "revenue report id invalid or already used"
    ):
        vault.report_revenue("period-1", 100)

    payer = direct_vm.sender
    direct_vm.deal(payer, 30)
    direct_vm.value = 10
    vault.deposit_revenue_share("period-1")
    direct_vm.value = 0
    assert vault.get_revenue_period("period-1") == (100, 10)
    with direct_vm.prank(payer):
        direct_vm.value = 16
        with direct_vm.expect_revert("revenue-share deposit exceeds reported obligation"):
            vault.deposit_revenue_share("period-1")
    direct_vm.value = 0
    direct_vm.deal(payer, 15)
    direct_vm.value = 15
    vault.deposit_revenue_share("period-1")
    direct_vm.value = 0
    assert vault.get_revenue_period("period-1") == (100, 25)
    assert vault.realized_return_wei == 25


def test_challenged_milestone_expiry_never_authorizes_payment(direct_vm, direct_deploy):
    direct_vm.warp(BASE.isoformat())
    vault, parent, operator, _ = _make_vault(direct_vm, direct_deploy, challenge_seconds=60)
    with direct_vm.prank(parent):
        vault.define_milestone("build", 40, "Verified construction completion")
    vault.milestone_status["build"] = "CHALLENGEABLE"
    vault.milestone_challenge_ends_at["build"] = int((BASE + timedelta(seconds=60)).timestamp())
    challenger = create_address("milestone-challenger")
    with direct_vm.prank(parent):
        vault.challenge_milestone("build", _hex(challenger), "sha256:challenge")
    with direct_vm.expect_revert("milestone dispute window is active"):
        vault.expire_milestone_challenge("build")
    direct_vm.warp((BASE + timedelta(seconds=181)).isoformat())
    vault.expire_milestone_challenge("build")
    assert vault.get_milestone_status("build") == "EXPIRED"
    assert vault.milestone_obligations_wei == 0
    with direct_vm.prank(parent), direct_vm.expect_revert(
        "payout id or milestone authorization invalid"
    ):
        vault.initiate_milestone_payout("payment-after-expiry", "build")


def test_default_challenge_and_resolution_are_bounded(direct_vm, direct_deploy):
    direct_vm.warp(BASE.isoformat())
    vault, parent, operator, _ = _make_vault(
        direct_vm, direct_deploy, model="REPAYABLE", due_days=1, challenge_seconds=60
    )
    vault.outstanding_principal_wei = 20  # fixture for prior verified payout
    direct_vm.warp((BASE + timedelta(days=1, hours=1, seconds=1)).isoformat())
    vault.record_default()
    assert vault.get_default_status() == "CHALLENGEABLE"
    with direct_vm.prank(operator):
        vault.challenge_default("sha256:operator-rebuttal")
    assert vault.get_default_status() == "CHALLENGED"
    with direct_vm.prank(parent):
        vault.resolve_default(False)
    assert vault.get_default_status() == "RESOLVED"
    with direct_vm.expect_revert("agreement has unresolved obligations"):
        with direct_vm.prank(parent):
            vault.close_agreement()


def test_unresolved_default_appeal_freezes_agreement_and_is_never_auto_confirmed(
    direct_vm, direct_deploy
):
    direct_vm.warp(BASE.isoformat())
    vault, parent, operator, _ = _make_vault(
        direct_vm, direct_deploy, model="REPAYABLE", due_days=1, challenge_seconds=60
    )
    vault.outstanding_principal_wei = 20  # fixture for prior verified payout
    direct_vm.warp((BASE + timedelta(days=1, hours=1, seconds=1)).isoformat())
    vault.record_default()
    with direct_vm.prank(operator):
        vault.challenge_default("sha256:operator-rebuttal")
    direct_vm.warp((BASE + timedelta(days=1, hours=1, seconds=182)).isoformat())
    vault.expire_default_challenge()
    assert vault.get_default_status() == "UNRESOLVED"
    with direct_vm.prank(parent), direct_vm.expect_revert("default challenge is not active"):
        vault.resolve_default(True)
    with direct_vm.prank(parent), direct_vm.expect_revert("agreement has unresolved obligations"):
        vault.close_agreement()


def test_installment_default_checks_only_matured_unpaid_principal(direct_vm, direct_deploy):
    direct_vm.warp(BASE.isoformat())
    vault, _, _, _ = _make_vault(
        direct_vm, direct_deploy, due_days=1, installment_count=3,
        installment_interval_seconds=86400,
    )
    vault.outstanding_principal_wei = 100
    direct_vm.deal(direct_vm.sender, 33)
    direct_vm.value = 33
    vault.deposit_repayment("agreement-1", "first-installment")
    direct_vm.value = 0
    assert vault.installment_paid_wei.get("0", 0) == 33
    assert vault.outstanding_principal_wei == 67
    direct_vm.warp((BASE + timedelta(days=1, hours=1, seconds=1)).isoformat())
    with direct_vm.expect_revert("no overdue unpaid installment"):
        vault.record_default()
    direct_vm.warp((BASE + timedelta(days=2, hours=1, seconds=1)).isoformat())
    vault.record_default()
    assert vault.get_default_status() == "CHALLENGEABLE"
