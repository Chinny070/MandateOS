"""Direct Mode checks for the Gate 1 lab contracts.

Direct Mode is an in-memory execution harness. It validates contract guards
and accounting transitions, but does not emulate GenLayer finalization or
value-bearing child transactions; live settlement remains a StudioNet gate.
"""

import pytest

from gltest.direct.loader import create_address


def _hex(address: bytes) -> str:
    return "0x" + address.hex()


pytestmark = pytest.mark.direct


def test_treasury_admin_and_funding_guards(direct_vm, direct_deploy):
    treasury = direct_deploy("contracts/mandate_os.py")
    stranger = create_address("gate1-stranger")

    with direct_vm.prank(stranger), direct_vm.expect_revert("administrator required"):
        treasury.set_pause(True)
    assert treasury.get_funding_status("missing") == "UNKNOWN"
    assert treasury.get_refund_status("missing") == "UNKNOWN"

    with direct_vm.expect_revert("vault registration requires finalized governance"):
        treasury.register_vault("project", "0x" + "11" * 20, 100)
    with direct_vm.expect_revert("allocation not authorized"):
        treasury.fund_project_vault("missing", "allocation-1", 1)
    with direct_vm.expect_revert("refund requires finalized governance proposal"):
        treasury.request_refund("project", "legacy-refund", 1)


def test_vault_rejects_wrong_parent_and_duplicate_or_wrong_project(direct_vm, direct_deploy):
    parent = create_address("gate1-parent")
    attacker = create_address("gate1-attacker")
    direct_vm.sender = create_address("vault-deployer")
    direct_vm.value = 0
    vault = direct_deploy("contracts/project_vault.py", _hex(parent), "project-a")

    with direct_vm.prank(attacker), direct_vm.expect_revert("MandateOS parent required"):
        vault.fund_project("allocation-1", "project-a")
    with direct_vm.prank(parent), direct_vm.expect_revert("project mismatch"):
        vault.fund_project("allocation-1", "project-b")
    with direct_vm.prank(parent), direct_vm.expect_revert("no GEN sent"):
        vault.fund_project("allocation-1", "project-a")
    assert vault.get_allocation_amount("allocation-1") == 0


def test_vault_funding_records_one_allocation_and_rejects_replay(direct_vm, direct_deploy):
    parent = create_address("gate1-parent-success")
    direct_vm.sender = create_address("vault-deployer-success")
    direct_vm.value = 0
    vault = direct_deploy("contracts/project_vault.py", _hex(parent), "project-a")
    direct_vm.sender = parent
    direct_vm.value = 17
    vault.fund_project("allocation-unique", "project-a")

    assert vault.get_allocation_amount("allocation-unique") == 17
    assert vault.total_received_wei == 17
    with direct_vm.expect_revert("duplicate or invalid funding id"):
        vault.fund_project("allocation-unique", "project-a")
    assert vault.total_received_wei == 17


def test_vault_refund_authorization_and_balance_guards(direct_vm, direct_deploy):
    parent = create_address("gate1-refund-parent")
    attacker = create_address("gate1-refund-attacker")
    direct_vm.sender = create_address("vault-deployer-refund")
    direct_vm.value = 0
    vault = direct_deploy("contracts/project_vault.py", _hex(parent), "project-a")

    with direct_vm.prank(attacker), direct_vm.expect_revert("MandateOS parent required"):
        vault.initiate_refund("refund-1", 1)
    with direct_vm.prank(parent), direct_vm.expect_revert("insufficient vault balance"):
        vault.initiate_refund("refund-1", 1)
    assert vault.get_refund_status("refund-1") == "UNKNOWN"


def test_funding_success_callback_requires_registered_vault_and_exact_amount(direct_vm, direct_deploy):
    treasury = direct_deploy("contracts/mandate_os.py")
    treasury_address = bytes(direct_vm._contract_address)
    vault_address = create_address("registered-callback-vault")
    treasury.vault_for_project["project-a"] = vault_address
    treasury.funding_project["allocation-a"] = "project-a"
    treasury.funding_amount["allocation-a"] = 17
    treasury.funding_status["allocation-a"] = "PENDING"
    treasury.allocation_status["allocation-a"] = "FUNDING_PENDING"
    treasury.pending_transfer_wei = 17

    with direct_vm.prank(create_address("untrusted-callback")), direct_vm.expect_revert("untrusted funding sender"):
        treasury.record_funding_child_success("allocation-a", "project-a", 17)
    with direct_vm.prank(vault_address), direct_vm.expect_revert("funding amount mismatch"):
        treasury.record_funding_child_success("allocation-a", "project-a", 16)
    with direct_vm.prank(vault_address):
        treasury.record_funding_child_success("allocation-a", "project-a", 17)
    assert treasury.get_funding_status("allocation-a") == "CHILD_SUCCESS"
    assert treasury.get_pending_transfer_wei() == 0
    assert treasury_address  # confirms this test deployed the parent contract


def test_duplicate_funding_success_callback_cannot_release_pending_reservation(direct_vm, direct_deploy):
    treasury = direct_deploy("contracts/mandate_os.py")
    vault_address = create_address("registered-callback-vault-duplicate")
    treasury.vault_for_project["project-a"] = vault_address
    treasury.funding_project["allocation-a"] = "project-a"
    treasury.funding_amount["allocation-a"] = 17
    treasury.funding_status["allocation-a"] = "CHILD_SUCCESS"
    treasury.pending_transfer_wei = 0

    with direct_vm.prank(vault_address), direct_vm.expect_revert("allocation is not awaiting child success"):
        treasury.record_funding_child_success("allocation-a", "project-a", 17)


def test_vault_refund_success_callback_requires_parent_and_exact_value(direct_vm, direct_deploy):
    parent = create_address("refund-callback-parent")
    direct_vm.sender = create_address("refund-callback-deployer")
    direct_vm.value = 0
    vault = direct_deploy("contracts/project_vault.py", _hex(parent), "project-a")
    vault.refund_status["refund-a"] = "SCHEDULED"
    vault.refund_amount["refund-a"] = 9
    vault.refund_reserved_wei = 9

    with direct_vm.prank(create_address("untrusted-refund-callback")), direct_vm.expect_revert("MandateOS parent required"):
        vault.record_refund_child_success("refund-a", "project-a", 9)
    with direct_vm.prank(parent), direct_vm.expect_revert("refund amount mismatch"):
        vault.record_refund_child_success("refund-a", "project-a", 8)
    with direct_vm.prank(parent):
        vault.record_refund_child_success("refund-a", "project-a", 9)
    assert vault.get_refund_status("refund-a") == "CHILD_SUCCESS"
    assert vault.refund_reserved_wei == 0
    with direct_vm.prank(parent), direct_vm.expect_revert("refund is not awaiting confirmation"):
        vault.record_refund_child_success("refund-a", "project-a", 9)


def test_vault_refund_reservation_prevents_simultaneous_overcommit(direct_vm, direct_deploy):
    parent = create_address("refund-reservation-parent")
    direct_vm.sender = create_address("refund-reservation-deployer")
    direct_vm.value = 0
    vault = direct_deploy("contracts/project_vault.py", _hex(parent), "project-a")
    direct_vm.deal(bytes(direct_vm._contract_address), 100)
    vault.refund_reserved_wei = 70

    with direct_vm.prank(parent), direct_vm.expect_revert("insufficient vault balance"):
        vault.initiate_refund("refund-overcommit", 40)
    assert vault.get_refund_status("refund-overcommit") == "UNKNOWN"
    assert vault.refund_reserved_wei == 70
