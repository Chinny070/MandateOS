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

    with direct_vm.expect_revert("unregistered project"):
        treasury.fund_project_vault("missing", "allocation-1", 1)


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
