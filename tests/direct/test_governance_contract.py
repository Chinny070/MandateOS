from datetime import datetime, timedelta, timezone
import json

import pytest

from gltest.direct.loader import create_address


def _hex(address: bytes) -> str:
    if hasattr(address, "as_hex"):
        return address.as_hex
    return "0x" + address.hex()


BASE = datetime(2026, 1, 1, tzinfo=timezone.utc)
pytestmark = pytest.mark.direct


def test_comparator_receipt_parser_fails_closed_on_bad_schema_digest_or_status(
    direct_vm, direct_deploy
):
    treasury = direct_deploy("contracts/mandate_os.py")
    good = {
        "status": "ELIGIBLE",
        "publication": "2026-01-01",
        "reason": "filing_matches",
        "facts": "The named project appears in the filing.",
        "digest": "a" * 64,
    }
    assert treasury._validate_evidence_assessment(json.dumps(good)) == (
        "VERIFIED_ELIGIBLE", "a" * 64, "2026-01-01", "filing_matches",
        "The named project appears in the filing.",
    )
    for field, value, error in (
        ("digest", "", "validator evidence digest is invalid"),
        ("digest", "g" * 64, "validator evidence digest is invalid"),
        ("status", "APPROVED", "validator assessment status is invalid"),
        ("facts", 1, "validator assessment fields are invalid"),
        ("publication", "2026-99-99", "validator publication field is invalid"),
        ("publication", "2026-02-31", "validator publication field is invalid"),
        ("publication", "1900-02-29", "validator publication field is invalid"),
    ):
        malformed = dict(good)
        malformed[field] = value
        with direct_vm.expect_revert(error):
            treasury._validate_evidence_assessment(json.dumps(malformed))
    extra = dict(good)
    extra["source"] = "member-provided"
    with direct_vm.expect_revert("validator assessment schema is invalid"):
        treasury._validate_evidence_assessment(json.dumps(extra))
    leap_day = dict(good, publication="2024-02-29")
    assert treasury._validate_evidence_assessment(json.dumps(leap_day))[2] == "2024-02-29"


def test_vault_agreement_and_milestone_setup_require_governance_and_reconciliation(
    direct_vm, direct_deploy
):
    founder = direct_vm.sender
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    bob = create_address("financing-governance-member")
    _add_second_member(direct_vm, treasury, founder, bob)
    from genlayer.py import calldata
    from genlayer.py.public_abi import ResultCode
    from genlayer.py.types import Address

    vault_address = Address(_hex(create_address("financing-governed-vault")))
    operator = Address(_hex(create_address("financing-governed-operator")))
    beneficiary = Address(_hex(create_address("financing-governed-beneficiary")))
    treasury.vault_for_project["project-finance"] = vault_address
    treasury.allocation_project["allocation-finance"] = "project-finance"
    treasury.allocation_amount["allocation-finance"] = 100
    treasury.allocation_status["allocation-finance"] = "VERIFIED"
    treasury.allocation_mandate_version["allocation-finance"] = 1
    treasury.funding_amount["allocation-finance"] = 100
    outbound = []
    milestone_state = {"status": "CHALLENGEABLE"}
    default_state = {"status": "CHALLENGED"}

    def hook(vm, request):
        if "CallContract" in request:
            method = request["CallContract"]["calldata"]["method"]
            if method == "get_project_payment_protocol_version":
                result = 1
            elif method == "get_agreement_summary":
                result = (
                    "agreement-finance", "allocation-finance", "REPAYABLE", 1, 80,
                    int((BASE + timedelta(days=30)).timestamp()), 86400, 1, 0,
                    86400, 604800, 0, 0, 0, 0, 0, "ACTIVE", operator.as_hex,
                    beneficiary.as_hex, "IC",
                )
            elif method == "get_milestone_summary":
                result = ("DEFINED", 40, "Verified work completion")
            elif method == "get_milestone_status":
                result = milestone_state["status"]
            elif method == "get_milestone_dispute_ends_at":
                result = int((BASE + timedelta(days=20)).timestamp())
            elif method == "get_default_status":
                result = default_state["status"]
            elif method == "get_default_challenge_ends_at":
                result = int((BASE + timedelta(days=20)).timestamp())
            else:
                raise AssertionError(f"unexpected project-vault view: {method}")
            return bytes([int(ResultCode.RETURN)]) + calldata.encode(result)
        if "PostMessage" in request:
            outbound.append(request["PostMessage"])
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = hook
    with direct_vm.prank(founder):
        treasury.propose_project_agreement(
            "agreement-vote", "project-finance", "agreement-finance",
            "allocation-finance", operator.as_hex, beneficiary.as_hex, "IC", "REPAYABLE",
            80, int((BASE + timedelta(days=30)).timestamp()), 86400, 1, 0, 0,
        )
    with direct_vm.prank(founder), direct_vm.expect_revert(
        "project already has an agreement proposal"
    ):
        treasury.propose_project_agreement(
            "agreement-vote-duplicate", "project-finance", "agreement-other",
            "allocation-finance", operator.as_hex, beneficiary.as_hex, "IC", "REPAYABLE",
            80, int((BASE + timedelta(days=30)).timestamp()), 86400, 1, 0, 0,
        )
    _approve_and_execute(direct_vm, treasury, "agreement-vote", [founder, bob])
    assert treasury.project_agreement_status["project-finance"] == "PENDING"
    assert outbound[-1]["on"] == "finalized"
    treasury.reconcile_project_agreement("project-finance")
    assert treasury.project_agreement_status["project-finance"] == "VERIFIED"

    with direct_vm.prank(founder):
        treasury.propose_vault_milestone(
            "milestone-vote", "project-finance", "construction", 40,
            "Verified work completion",
        )
    _approve_and_execute(direct_vm, treasury, "milestone-vote", [founder, bob])
    assert treasury.project_milestone_status["project-finance|construction"] == "PENDING"
    treasury.reconcile_vault_milestone("project-finance", "construction")
    assert treasury.project_milestone_status["project-finance|construction"] == "VERIFIED"

    with direct_vm.prank(founder), direct_vm.expect_revert(
        "challenge directly on ProjectVault so the challenge is atomic"
    ):
        treasury.challenge_vault_milestone(
            "project-finance", "construction", "sha256:member-challenge"
        )
    assert len(outbound) == 2  # agreement + milestone setup only
    milestone_state["status"] = "CHALLENGED"
    with direct_vm.prank(founder):
        treasury.propose_milestone_resolution(
            "resolve-milestone", "project-finance", "construction", False
        )
    _approve_and_execute(direct_vm, treasury, "resolve-milestone", [founder, bob])
    assert treasury.get_proposal_status("resolve-milestone") == "EXECUTED"
    assert treasury.pending_milestone_resolution.get(
        "project-finance|construction", ""
    ) == ""

    with direct_vm.prank(founder):
        treasury.propose_default_resolution(
            "resolve-default", "project-finance", False
        )
    _approve_and_execute(direct_vm, treasury, "resolve-default", [founder, bob])
    assert treasury.get_proposal_status("resolve-default") == "EXECUTED"
    assert treasury.pending_project_default_resolution.get("project-finance", "") == ""
    assert outbound[-1]["on"] == "finalized"


def test_eoa_beneficiary_is_bound_by_governance_without_ic_receipt_contract(
    direct_vm, direct_deploy
):
    founder = direct_vm.sender
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    bob = create_address("eoa-beneficiary-voter")
    _add_second_member(direct_vm, treasury, founder, bob)
    from genlayer.py.types import Address

    vault = Address(_hex(create_address("eoa-beneficiary-vault")))
    treasury.vault_for_project["project-eoa"] = vault
    treasury.allocation_project["allocation-eoa"] = "project-eoa"
    treasury.allocation_status["allocation-eoa"] = "VERIFIED"
    treasury.allocation_mandate_version["allocation-eoa"] = 1
    treasury.funding_amount["allocation-eoa"] = 100
    recipient = _hex(create_address("ordinary-eoa-recipient"))
    with direct_vm.prank(founder):
        treasury.propose_project_agreement(
            "eoa-agreement-proposal", "project-eoa", "agreement-eoa",
            "allocation-eoa", _hex(create_address("eoa-operator")), recipient,
            "EOA", "GRANT", 100, 0, 0, 0, 0, 0,
        )
    assert treasury.proposal_kind["eoa-agreement-proposal"] == "VAULT_AGREEMENT"
    assert treasury.proposal_secondary_address["eoa-agreement-proposal"].as_hex == recipient
    assert treasury.proposal_evidence_criteria["eoa-agreement-proposal"] == "EOA"


def test_member_governance_routes_return_distribution_and_agreement_closure(
    direct_vm, direct_deploy
):
    founder = direct_vm.sender
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    bob = create_address("distribution-voter")
    _add_second_member(direct_vm, treasury, founder, bob)
    from genlayer.py import calldata
    from genlayer.py.public_abi import ResultCode
    from genlayer.py.types import Address

    vault = Address(_hex(create_address("distribution-vault")))
    treasury.vault_for_project["project-distribution"] = vault
    treasury.project_agreement_id["project-distribution"] = "agreement-distribution"
    treasury.project_agreement_status["project-distribution"] = "VERIFIED"
    dist_state = {"status": "CHILD_SUCCESS"}
    agreement_state = {"status": "ACTIVE"}
    outbound = []

    def hook(vm, request):
        if "CallContract" in request:
            method = request["CallContract"]["calldata"]["method"]
            if method == "get_distribution_available":
                result = (40, 10)
            elif method == "get_distribution_status":
                result = dist_state["status"]
            elif method == "can_close_agreement":
                result = True
            elif method == "get_agreement_summary":
                result = (
                    "agreement-distribution", "allocation-distribution", "REPAYABLE",
                    1, 50, 0, 0, 1, 0, 86400, 604800, 0, 0, 0, 0, 0,
                    agreement_state["status"], "0x" + "11" * 20,
                    "0x" + "22" * 20, "EOA",
                )
            else:
                raise AssertionError(f"unexpected vault view: {method}")
            return bytes([int(ResultCode.RETURN)]) + calldata.encode(result)
        if "PostMessage" in request:
            outbound.append(request["PostMessage"])
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = hook
    with direct_vm.prank(founder):
        treasury.propose_vault_distribution(
            "distribute-1", "project-distribution", "distribution-1", 30, 10
        )
    _approve_and_execute(direct_vm, treasury, "distribute-1", [founder, bob])
    assert treasury.distribution_status["distribution-1"] == "PENDING"
    assert outbound[-1]["on"] == "finalized"

    direct_vm.value = 40
    with direct_vm.prank(vault):
        treasury.receive_project_return(
            "distribution-1", "project-distribution", "agreement-distribution", 30, 10
        )
    direct_vm.value = 0
    assert treasury.distribution_status["distribution-1"] == "CHILD_SUCCESS"
    assert treasury.total_project_principal_received_wei == 30
    assert treasury.total_project_return_received_wei == 10

    treasury.reconcile_vault_distribution("distribution-1")
    assert treasury.distribution_status["distribution-1"] == "RECONCILIATION_PENDING"
    dist_state["status"] = "VERIFIED"
    treasury.reconcile_vault_distribution("distribution-1")
    assert treasury.distribution_status["distribution-1"] == "VERIFIED"
    assert treasury.pending_project_distribution.get("project-distribution", "") == ""

    with direct_vm.prank(founder):
        treasury.propose_agreement_close("close-agreement", "project-distribution")
    _approve_and_execute(direct_vm, treasury, "close-agreement", [founder, bob])
    assert treasury.project_agreement_status["project-distribution"] == "CLOSE_PENDING"
    assert outbound[-1]["on"] == "finalized"
    agreement_state["status"] = "CLOSED"
    treasury.reconcile_agreement_closure("project-distribution")
    assert treasury.project_agreement_status["project-distribution"] == "CLOSED"


def _warp(vm, delta: timedelta) -> None:
    vm.warp((BASE + delta).isoformat())


def _approve_and_execute(vm, treasury, proposal_id, voters):
    for voter in voters:
        with vm.prank(voter):
            treasury.vote(proposal_id, True)
    voting_ends_at, _, _ = treasury.get_proposal_timing(proposal_id)
    vm.warp(datetime.fromtimestamp(int(voting_ends_at) + 1, timezone.utc).isoformat())
    treasury.finalize_governance_proposal(proposal_id)
    assert treasury.get_proposal_status(proposal_id) == "TIMELOCKED"
    _, execute_after, _ = treasury.get_proposal_timing(proposal_id)
    vm.warp(datetime.fromtimestamp(int(execute_after), timezone.utc).isoformat())
    treasury.execute_governance_proposal(proposal_id)
    assert treasury.get_proposal_status(proposal_id) == "EXECUTED"


def _add_second_member(vm, treasury, founder, member):
    with vm.prank(founder):
        treasury.propose_member_add("add-second-member", _hex(member))
    _approve_and_execute(vm, treasury, "add-second-member", [founder])
    assert treasury.get_member_weight(_hex(member)) == 1


def test_governance_snapshots_members_and_rejects_duplicate_or_ineligible_votes(
    direct_vm, direct_deploy
):
    founder = direct_vm.sender
    newcomer = create_address("governance-new-member")
    attacker = create_address("governance-nonmember")
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    from genlayer.py.types import Address


    with direct_vm.prank(attacker), direct_vm.expect_revert("active DAO member required"):
        treasury.propose_member_add("unauthorized-add", _hex(attacker))
    with direct_vm.prank(founder):
        treasury.propose_member_add("add-member", _hex(newcomer))
    with direct_vm.prank(attacker), direct_vm.expect_revert("active DAO member required"):
        treasury.vote("add-member", True)
    with direct_vm.prank(founder):
        treasury.vote("add-member", True)
    with direct_vm.prank(founder), direct_vm.expect_revert("member already voted"):
        treasury.vote("add-member", True)

    # Simulate a corrupted or manually manipulated current membership record:
    # the proposal's immutable snapshot must still exclude the late member.
    treasury.member_weight[Address(_hex(newcomer))] = 1
    treasury.members.append(Address(_hex(newcomer)))
    with direct_vm.prank(newcomer), direct_vm.expect_revert(
        "member is not in proposal snapshot"
    ):
        treasury.vote("add-member", True)
    treasury.member_weight[Address(_hex(newcomer))] = 0
    treasury.members.pop()

    _warp(direct_vm, timedelta(days=1, seconds=1))
    treasury.finalize_governance_proposal("add-member")
    _warp(direct_vm, timedelta(days=2, seconds=1))
    treasury.execute_governance_proposal("add-member")
    assert treasury.get_member_weight(_hex(newcomer)) == 1
    assert treasury.get_member_weight(_hex(attacker)) == 0


def test_invalid_mandates_and_funding_without_finalized_authorization_are_denied(
    direct_vm, direct_deploy
):
    founder = direct_vm.sender
    bob = create_address("mandate-voter")
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    _add_second_member(direct_vm, treasury, founder, bob)

    with direct_vm.prank(founder), direct_vm.expect_revert("project exposure outside bootstrap bounds"):
        treasury.propose_mandate_update("bad-mandate", 2001, 1500, 10, 86400, 86400)
    with direct_vm.prank(founder), direct_vm.expect_revert("exposure and reserve exceed 10000 bps"):
        treasury.propose_mandate_update("bad-mandate-2", 2000, 9000, 10, 86400, 86400)

    amount = 10
    treasury.allocation_status["forged-allocation"] = "PROPOSED"
    treasury.allocation_project["forged-allocation"] = "project"
    treasury.allocation_amount["forged-allocation"] = amount
    with direct_vm.expect_revert("allocation not authorized"):
        treasury.fund_project_vault("project", "forged-allocation", amount)


def test_only_one_pending_vault_registration_can_claim_a_project(direct_vm, direct_deploy):
    founder = direct_vm.sender
    bob = create_address("registration-second-member")
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    _add_second_member(direct_vm, treasury, founder, bob)
    with direct_vm.prank(founder):
        treasury.propose_vault_registration(
            "register-project", "project-race", _hex(create_address("vault-first")), 100,
            "sha256:member-submitted",
        )
    with direct_vm.prank(founder), direct_vm.expect_revert("invalid or registered project"):
        treasury.propose_vault_registration(
            "register-project-race", "project-race", _hex(create_address("vault-second")), 200,
            "sha256:other-submission",
        )
    assert treasury.pending_vault_registration["project-race"] == "register-project"
    voting_ends_at, _, _ = treasury.get_proposal_timing("register-project")
    direct_vm.warp(
        datetime.fromtimestamp(int(voting_ends_at) + 1, timezone.utc).isoformat()
    )
    treasury.finalize_governance_proposal("register-project")
    assert treasury.pending_vault_registration["project-race"] == ""
    with direct_vm.prank(founder):
        treasury.propose_vault_registration(
            "retry-registration", "project-race", _hex(create_address("vault-retry")), 100,
            "sha256:new-member-submission",
        )


def test_evidence_sources_reject_insecure_urls(direct_vm, direct_deploy):
    founder = direct_vm.sender
    bob = create_address("evidence-source-second-member")
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    _add_second_member(direct_vm, treasury, founder, bob)
    from genlayer.py.types import Address

    treasury.vault_for_project["project-source"] = Address(
        _hex(create_address("source-test-vault"))
    )
    for url in (
        "http://example.gov/filing",
        "https://127.0.0.1/private",
        "https://user@example.gov/filing",
        "https://metadata.internal/latest",
    ):
        with direct_vm.prank(founder), direct_vm.expect_revert(
            "evidence source must be a bounded public HTTPS URL"
        ):
            treasury.propose_evidence_source(
                "invalid-source", "project-source", url, "Project is in good standing"
            )

    with direct_vm.prank(founder), direct_vm.expect_revert(
        "bounded DAO eligibility criteria are required"
    ):
        treasury.propose_evidence_source(
            "invalid-criteria", "project-source", "https://example.gov/filing", ""
        )
    with direct_vm.prank(founder):
        treasury.propose_evidence_source(
            "approved-source-a", "project-source", "https://example.gov/filing",
            "The filing identifies this registered project and confirms active status.",
        )
    with direct_vm.prank(founder), direct_vm.expect_revert(
        "evidence source change is already pending"
    ):
        treasury.propose_evidence_source(
            "approved-source-b", "project-source", "https://other.example.gov/filing",
            "The filing identifies this registered project and confirms active status.",
        )


def test_challenge_expiry_releases_reservation_without_authorizing_funding(
    direct_vm, direct_deploy
):
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    allocation_id = "dispute-timeout"
    treasury.allocation_status[allocation_id] = "CHALLENGED"
    treasury.allocation_project[allocation_id] = "project-timeout"
    treasury.allocation_amount[allocation_id] = 40
    treasury.allocation_dispute_ends_at[allocation_id] = int(
        (BASE + timedelta(days=1)).timestamp()
    )
    treasury.reserved_allocation_wei = 40
    treasury.committed_for_project["project-timeout"] = 40
    treasury.allocation_resolution_id[allocation_id] = "pending-resolution"
    treasury.proposal_status["pending-resolution"] = "TIMELOCKED"
    treasury.proposal_target_id["pending-resolution"] = allocation_id

    with direct_vm.expect_revert("allocation dispute deadline is active"):
        treasury.expire_allocation_challenge(allocation_id)
    _warp(direct_vm, timedelta(days=1, seconds=1))
    treasury.expire_allocation_challenge(allocation_id)
    assert treasury.get_allocation_status(allocation_id) == "EXPIRED"
    assert treasury.get_proposal_status("pending-resolution") == "EXPIRED"
    assert treasury.reserved_allocation_wei == 0
    assert treasury.committed_for_project["project-timeout"] == 0
    with direct_vm.expect_revert("allocation not authorized"):
        treasury.fund_project_vault("project-timeout", allocation_id, 40)


def test_expired_or_stale_authorization_cannot_fund_and_releases_reservation(
    direct_vm, direct_deploy
):
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    expired = "expired-auth"
    stale = "stale-auth"
    for allocation_id, project_id in ((expired, "project-expired"), (stale, "project-stale")):
        treasury.allocation_status[allocation_id] = "AUTHORIZED"
        treasury.allocation_project[allocation_id] = project_id
        treasury.allocation_amount[allocation_id] = 20
        treasury.allocation_mandate_version[allocation_id] = 1
        treasury.allocation_evidence_digest[allocation_id] = "sha256:approved-evidence"
        treasury.reserved_allocation_wei += 20
        treasury.committed_for_project[project_id] = 20
    treasury.allocation_authorized_until[expired] = int((BASE - timedelta(seconds=1)).timestamp())
    treasury.allocation_authorized_until[stale] = int((BASE + timedelta(days=1)).timestamp())
    treasury.project_evidence_status["project-stale"] = "INCONCLUSIVE"

    treasury.fund_project_vault("project-expired", expired, 20)
    assert treasury.get_allocation_status(expired) == "EXPIRED"
    treasury.fund_project_vault("project-stale", stale, 20)
    assert treasury.get_allocation_status(stale) == "EXPIRED"
    assert treasury.reserved_allocation_wei == 0
    assert treasury.committed_for_project["project-expired"] == 0
    assert treasury.committed_for_project["project-stale"] == 0

    permissionless = "permissionless-expiry"
    treasury.allocation_status[permissionless] = "AUTHORIZED"
    treasury.allocation_project[permissionless] = "project-permissionless"
    treasury.allocation_amount[permissionless] = 10
    treasury.allocation_authorized_until[permissionless] = int(
        (BASE - timedelta(seconds=1)).timestamp()
    )
    treasury.reserved_allocation_wei = 10
    treasury.committed_for_project["project-permissionless"] = 10
    treasury.expire_authorized_allocation(permissionless)
    assert treasury.get_allocation_status(permissionless) == "EXPIRED"
    assert treasury.reserved_allocation_wei == 0


def test_refund_requires_governance_reserves_amount_and_reconciles_authenticated_value(
    direct_vm, direct_deploy
):
    founder = direct_vm.sender
    bob = create_address("refund-second-member")
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    _add_second_member(direct_vm, treasury, founder, bob)
    from genlayer.py import calldata
    from genlayer.py.public_abi import ResultCode
    from genlayer.py.types import Address

    vault_address = Address(_hex(create_address("governed-refund-vault")))
    treasury.vault_for_project["project-refund"] = vault_address
    treasury.committed_for_project["project-refund"] = 200
    child_messages = []

    def cross_contract_hook(vm, request):
        if "CallContract" in request:
            method = request["CallContract"]["calldata"]["method"]
            if method == "get_refund_available_wei":
                result = 100
            elif method == "get_refund_reserved_wei":
                result = 0
            elif method == "get_refund_status":
                result = "CHILD_SUCCESS"
            else:
                raise AssertionError(f"unexpected refund vault view: {method}")
            return bytes([int(ResultCode.RETURN)]) + calldata.encode(result)
        if "PostMessage" in request:
            child_messages.append(request["PostMessage"])
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = cross_contract_hook
    with direct_vm.prank(founder):
        treasury.propose_refund("refund-proposal", "project-refund", "refund-1", 70)
    with direct_vm.prank(founder), direct_vm.expect_revert(
        "refund exceeds unreserved vault balance"
    ):
        treasury.propose_refund("refund-proposal-2", "project-refund", "refund-2", 40)
    _approve_and_execute(direct_vm, treasury, "refund-proposal", [founder, bob])
    assert treasury.get_refund_status("refund-1") == "PENDING"
    assert treasury.pending_refund_for_project["project-refund"] == 70
    assert child_messages[-1]["on"] == "finalized"

    with direct_vm.prank(create_address("untrusted-refund-wallet")):
        direct_vm.value = 70
        with direct_vm.expect_revert("untrusted refund sender"):
            treasury.receive_refund("refund-1", "project-refund")
    with direct_vm.prank(vault_address):
        direct_vm.value = 69
        with direct_vm.expect_revert("refund amount mismatch"):
            treasury.receive_refund("refund-1", "project-refund")
        direct_vm.value = 70
        treasury.receive_refund("refund-1", "project-refund")
    assert treasury.committed_for_project["project-refund"] == 130
    assert treasury.pending_refund_for_project["project-refund"] == 0
    assert treasury.total_refunds_received_wei == 70
    with direct_vm.prank(vault_address), direct_vm.expect_revert("refund already received"):
        treasury.receive_refund("refund-1", "project-refund")
    treasury.reconcile_refund("refund-1")
    assert treasury.get_refund_status("refund-1") == "VERIFIED"


def test_timelocked_mandate_proposal_expires_if_not_executed(direct_vm, direct_deploy):
    founder = direct_vm.sender
    bob = create_address("expired-mandate-voter")
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    _add_second_member(direct_vm, treasury, founder, bob)

    with direct_vm.prank(founder):
        treasury.propose_mandate_update("expire-mandate", 1500, 2000, 20, 172800, 172800)
    with direct_vm.prank(founder):
        treasury.vote("expire-mandate", True)
    with direct_vm.prank(bob):
        treasury.vote("expire-mandate", True)
    voting_ends_at, _, _ = treasury.get_proposal_timing("expire-mandate")
    direct_vm.warp(datetime.fromtimestamp(int(voting_ends_at) + 1, timezone.utc).isoformat())
    treasury.finalize_governance_proposal("expire-mandate")
    _, _, execute_by = treasury.get_proposal_timing("expire-mandate")
    direct_vm.warp(datetime.fromtimestamp(int(execute_by) + 1, timezone.utc).isoformat())
    treasury.execute_governance_proposal("expire-mandate")
    assert treasury.get_proposal_status("expire-mandate") == "EXPIRED"
    assert treasury.mandate_version == 1


def test_single_member_bootstrap_can_only_propose_second_member(direct_vm, direct_deploy):
    founder = direct_vm.sender
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")

    with direct_vm.prank(founder), direct_vm.expect_revert(
        "at least two active DAO members required"
    ):
        treasury.propose_mandate_update("single-mandate", 1500, 2000, 20, 86400, 86400)
    with direct_vm.prank(founder), direct_vm.expect_revert(
        "at least two active DAO members required"
    ):
        treasury.propose_vault_registration(
            "single-registration", "project-a", _hex(create_address("single-vault")),
            100, "sha256:member-input",
        )
    with direct_vm.prank(founder), direct_vm.expect_revert(
        "at least two active DAO members required"
    ):
        treasury.propose_evidence_source(
            "single-evidence", "project-a", "https://example.org/evidence", "criteria",
        )
    single_voter_guards = (
        (
            "at least two DAO members required for allocations",
            lambda: treasury.propose_allocation("single-allocation", "project-a", 1),
        ),
        (
            "at least two DAO members required for agreements",
            lambda: treasury.propose_project_agreement(
                "single-agreement", "project-a", "agreement-a", "allocation-a",
                _hex(create_address("solo-operator")), _hex(create_address("solo-beneficiary")),
                "EOA", "GRANT", 1, 0, 0, 0, 0, 0,
            ),
        ),
        (
            "at least two DAO members required to close agreements",
            lambda: treasury.propose_agreement_close("single-close", "project-a"),
        ),
        (
            "at least two DAO members required for distributions",
            lambda: treasury.propose_vault_distribution("single-distribution", "project-a", "dist-a", 1, 0),
        ),
        (
            "at least two DAO members required for milestones",
            lambda: treasury.propose_vault_milestone("single-milestone", "project-a", "milestone-a", 1, "criteria"),
        ),
        (
            "at least two DAO members required for dispute resolution",
            lambda: treasury.propose_milestone_resolution("single-resolution", "project-a", "milestone-a", True),
        ),
        (
            "at least two DAO members required for default resolution",
            lambda: treasury.propose_default_resolution("single-default", "project-a", True),
        ),
    )
    for error, proposal in single_voter_guards:
        with direct_vm.prank(founder), direct_vm.expect_revert(error):
            proposal()

    # The bootstrap exception is limited to onboarding another voter.
    second = create_address("second-bootstrap-member")
    with direct_vm.prank(founder):
        treasury.propose_member_add("add-second-member-bootstrap", _hex(second))
    _approve_and_execute(
        direct_vm, treasury, "add-second-member-bootstrap", [founder],
    )
    assert treasury.get_member_weight(_hex(second)) == 1


def test_quorum_without_required_approval_rejects_governance_change(direct_vm, direct_deploy):
    founder = direct_vm.sender
    bob = create_address("against-mandate-voter")
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    _add_second_member(direct_vm, treasury, founder, bob)

    with direct_vm.prank(founder):
        treasury.propose_mandate_update("rejected-mandate", 1500, 2000, 20, 172800, 172800)
        treasury.vote("rejected-mandate", True)
    with direct_vm.prank(bob):
        treasury.vote("rejected-mandate", False)
    voting_ends_at, _, _ = treasury.get_proposal_timing("rejected-mandate")
    direct_vm.warp(datetime.fromtimestamp(int(voting_ends_at) + 1, timezone.utc).isoformat())
    treasury.finalize_governance_proposal("rejected-mandate")
    assert treasury.get_proposal_status("rejected-mandate") == "REJECTED"
    assert treasury.mandate_version == 1


def test_allocation_auth_expires_when_mandate_version_changes(direct_vm, direct_deploy):
    founder = direct_vm.sender
    bob = create_address("stale-mandate-voter")
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    _add_second_member(direct_vm, treasury, founder, bob)

    allocation_id = "stale-mandate-allocation"
    treasury.allocation_project[allocation_id] = "project-stale"
    treasury.allocation_amount[allocation_id] = 50
    treasury.allocation_mandate_version[allocation_id] = treasury.mandate_version
    treasury.allocation_status[allocation_id] = "CHALLENGEABLE"
    treasury.allocation_challenge_ends_at[allocation_id] = int(
        (BASE + timedelta(days=3)).timestamp()
    )
    treasury.reserved_allocation_wei = 50
    treasury.committed_for_project["project-stale"] = 50

    with direct_vm.prank(founder):
        treasury.propose_mandate_update("tighten-mandate", 1500, 2000, 20, 172800, 172800)
    _approve_and_execute(direct_vm, treasury, "tighten-mandate", [founder, bob])
    assert treasury.mandate_version == 2

    treasury.finalize_allocation(allocation_id)
    assert treasury.get_allocation_status(allocation_id) == "EXPIRED"
    assert treasury.reserved_allocation_wei == 0
    assert treasury.committed_for_project["project-stale"] == 0


def test_allocation_requires_two_member_final_vote_challenge_expiry_and_is_idempotent(
    direct_vm, direct_deploy
):
    founder = direct_vm.sender
    bob = create_address("allocation-voter")
    direct_vm.warp(BASE.isoformat())
    treasury = direct_deploy("contracts/mandate_os.py")
    treasury_address = bytes(direct_vm._contract_address)
    direct_vm.deal(treasury_address, 1000)
    direct_vm.deal(founder, 1000)
    direct_vm.value = 1000
    treasury.deposit()
    direct_vm.value = 0
    assert treasury.total_deposited_wei == 1000
    assert treasury.balance == 1000

    _add_second_member(direct_vm, treasury, founder, bob)
    # Direct Mode loads one IC class at a time. Stub only the registered vault's
    # two identity views and child-message queue; all MandateOS authorization,
    # accounting, vote and challenge transitions below use actual contract code.
    from genlayer.py import calldata
    from genlayer.py.public_abi import ResultCode
    from genlayer.py.types import Address

    parent_address = Address(_hex(treasury_address)).as_hex
    vault_address = _hex(create_address("governance-registered-vault"))
    child_messages = []

    def cross_contract_hook(vm, request):
        if "CallContract" in request:
            call = request["CallContract"]["calldata"]
            if call["method"] == "get_parent_address":
                result = parent_address
            elif call["method"] == "get_project_id":
                result = "project-a"
            else:
                raise AssertionError(f"unexpected vault view: {call}")
            return bytes([int(ResultCode.RETURN)]) + calldata.encode(result)
        if "PostMessage" in request:
            child_messages.append(request["PostMessage"])
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = cross_contract_hook
    treasury.propose_vault_registration(
        "register-project-a",
        "project-a",
        vault_address,
        1000,
        "sha256:member-reviewed-project-evidence",
    )
    _approve_and_execute(direct_vm, treasury, "register-project-a", [founder, bob])
    assert treasury.get_vault_address("project-a") == vault_address
    assert treasury.get_registered_project_count() == 1
    assert treasury.get_registered_project_id_at(0) == "project-a"
    assert treasury.get_registered_project_id_at(1) == ""
    assert treasury.get_proposal_count() >= 2
    assert treasury.get_proposal_id_at(1) == "register-project-a"
    with direct_vm.prank(founder), direct_vm.expect_revert("invalid or registered project"):
        treasury.propose_vault_registration(
            "register-project-a-again", "project-a", vault_address, 1000,
            "sha256:replacement-submission",
        )
    assert treasury.project_evidence_status["project-a"] == "UNASSESSED"
    assert treasury.get_project_submitted_evidence_digest("project-a") == (
        "sha256:member-reviewed-project-evidence"
    )
    assert treasury.project_evidence_digest["project-a"] == ""
    with direct_vm.prank(founder):
        treasury.propose_allocation("member-digest-only", "project-a", 20)
    with direct_vm.expect_revert("project eligibility is not validator-verified"):
        treasury.evaluate_allocation("member-digest-only")

    # Test-only deterministic assessment state lets the rest of this Direct
    # Mode case exercise funding authorization. Native web consensus is tested
    # only by the GenLayer validator runtime, never by this fixture.
    assessment_time = int((BASE + timedelta(days=2, seconds=1)).timestamp())
    treasury.project_evidence_status["project-a"] = "VERIFIED_ELIGIBLE"
    treasury.project_evidence_digest["project-a"] = "sha256:direct-mode-fixture"
    treasury.project_evidence_assessed_at["project-a"] = assessment_time
    treasury.project_evidence_expires_at["project-a"] = assessment_time + 604800
    treasury.project_evidence_mandate_version["project-a"] = treasury.mandate_version

    # Explicitly model the balance held for an unresolved child transfer. This
    # models the value already removed from cash by the emitted child; it is
    # not a receipt or settlement proof.
    direct_vm.warp(datetime.fromtimestamp(assessment_time, timezone.utc).isoformat())
    treasury.pending_transfer_wei = 800
    direct_vm.deal(treasury_address, 200)
    with direct_vm.prank(founder):
        treasury.propose_allocation("reserve-breach", "project-a", 100)
    with direct_vm.expect_revert("mandate liquid reserve would be breached"):
        treasury.evaluate_allocation("reserve-breach")
    assert treasury.reserved_allocation_wei == 0
    treasury.pending_transfer_wei = 0
    direct_vm.deal(treasury_address, 1000)

    with direct_vm.prank(founder):
        treasury.propose_allocation("no-quorum-allocation", "project-a", 50)
    assert treasury.get_allocation_status("no-quorum-allocation") == "PROPOSED"
    treasury.evaluate_allocation("no-quorum-allocation")
    assert treasury.get_allocation_status("no-quorum-allocation") == "EVALUATING"
    assert treasury.reserved_allocation_wei == 50
    with direct_vm.prank(founder):
        treasury.vote("no-quorum-allocation", True)
    voting_ends_at, _, _ = treasury.get_proposal_timing("no-quorum-allocation")
    direct_vm.warp(datetime.fromtimestamp(int(voting_ends_at) + 1, timezone.utc).isoformat())
    with direct_vm.prank(founder), direct_vm.expect_revert("vote outside voting period"):
        treasury.vote("no-quorum-allocation", True)
    with direct_vm.prank(bob), direct_vm.expect_revert("vote outside voting period"):
        treasury.vote("no-quorum-allocation", True)
    treasury.finalize_governance_proposal("no-quorum-allocation")
    assert treasury.get_proposal_status("no-quorum-allocation") == "EXPIRED"
    assert treasury.get_allocation_status("no-quorum-allocation") == "EXPIRED"
    assert treasury.reserved_allocation_wei == 0

    with direct_vm.prank(founder):
        treasury.propose_allocation("cancelled-allocation", "project-a", 50)
    with direct_vm.prank(bob), direct_vm.expect_revert("allocation proposer required"):
        treasury.cancel_allocation("cancelled-allocation")
    with direct_vm.prank(founder):
        treasury.cancel_allocation("cancelled-allocation")
    assert treasury.get_allocation_status("cancelled-allocation") == "CANCELLED"
    assert treasury.reserved_allocation_wei == 0

    with direct_vm.prank(founder):
        treasury.propose_allocation("allocation-a", "project-a", 100)
    assert treasury.get_allocation_status("allocation-a") == "PROPOSED"
    treasury.evaluate_allocation("allocation-a")
    assert treasury.get_allocation_status("allocation-a") == "EVALUATING"
    assert treasury.reserved_allocation_wei == 100
    assert treasury.get_spendable_balance_wei() == 900
    treasury.pending_transfer_wei = 850
    direct_vm.deal(treasury_address, 150)
    with direct_vm.prank(bob):
        treasury.propose_allocation("cross-allocation-overcommit", "project-a", 60)
    with direct_vm.expect_revert("insufficient unreserved treasury GEN"):
        treasury.evaluate_allocation("cross-allocation-overcommit")
    assert treasury.reserved_allocation_wei == 100
    treasury.pending_transfer_wei = 0
    direct_vm.deal(treasury_address, 1000)
    with direct_vm.prank(bob):
        treasury.propose_allocation("over-concentration", "project-a", 101)
    with direct_vm.prank(bob), direct_vm.expect_revert("mandate project concentration exceeded"):
        treasury.evaluate_allocation("over-concentration")
    _approve_and_execute(direct_vm, treasury, "allocation-a", [founder, bob])
    assert treasury.get_allocation_status("allocation-a") == "CHALLENGEABLE"

    with direct_vm.prank(bob):
        treasury.challenge_allocation("allocation-a", "sha256:challenge-evidence")
    assert treasury.get_allocation_status("allocation-a") == "CHALLENGED"
    with direct_vm.expect_revert("allocation not authorized"):
        treasury.fund_project_vault("project-a", "allocation-a", 100)
    assert treasury.reserved_allocation_wei == 100

    with direct_vm.prank(founder):
        treasury.propose_challenge_resolution("resolve-allocation-a", "allocation-a", True)
    _approve_and_execute(
        direct_vm, treasury, "resolve-allocation-a", [founder, bob]
    )
    assert treasury.get_allocation_status("allocation-a") == "AUTHORIZED"
    assert treasury.reserved_allocation_wei == 100

    # A non-admin executor may submit the already-authorized child transfer.
    with direct_vm.prank(create_address("permissionless-keeper")):
        treasury.fund_project_vault("project-a", "allocation-a", 100)
    assert treasury.get_allocation_status("allocation-a") == "FUNDING_PENDING"
    assert treasury.get_pending_transfer_wei() == 100
    assert treasury.reserved_allocation_wei == 0
    with direct_vm.expect_revert("allocation not authorized"):
        treasury.fund_project_vault("project-a", "allocation-a", 100)
    assert treasury.get_pending_transfer_wei() == 100
    assert treasury_address
    assert child_messages
    assert child_messages[-1]["value"] == 100
    assert child_messages[-1]["on"] == "finalized"
