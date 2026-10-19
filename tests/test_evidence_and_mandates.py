from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta, timezone

import pytest

from reference.evidence import (
    EvidencePolicy,
    EvidenceReceipt,
    EvidenceStatus,
    SourceTier,
    validate_receipt,
)
from reference.mandates import Mandate, evaluate_allocation


NOW = datetime(2026, 10, 19, 12, tzinfo=timezone.utc)
POLICY = EvidencePolicy(frozenset({"regulator.example", "filings.example"}), timedelta(days=7))


def make_receipt(**overrides):
    values = dict(
        evidence_id="evidence-1",
        project_id="project-1",
        claim_type="registration",
        source_url="https://www.regulator.example/filing/123",
        source_tier=SourceTier.REGULATORY,
        assessed_at=NOW - timedelta(hours=1),
        claimed_published_at=NOW - timedelta(days=1),
        expires_at=NOW + timedelta(days=1),
        content=b"archived evidence bytes",
        assessment=EvidenceStatus.VERIFIED_ELIGIBLE,
        assessment_version="assessment-v1",
        mandate_digest="sha256:mandate-v1",
    )
    values.update(overrides)
    return EvidenceReceipt(**values)


def test_valid_receipt_has_reproducible_content_commitment():
    receipt = make_receipt()
    result = validate_receipt(receipt, POLICY, now=NOW)
    assert result.accepted
    assert result.status == EvidenceStatus.VERIFIED_ELIGIBLE
    assert result.content_digest == receipt.content_digest
    assert len(result.content_digest) == 64


@pytest.mark.parametrize(
    "url",
    [
        "http://regulator.example/filing",
        "https://regulator.example.attacker.invalid/filing",
        "https://attacker.invalid/regulator.example",
        "https://127.0.0.1/private",
        "https://localhost/metadata",
        "https://user:secret@regulator.example/path",
        "https://regulator.example:8443/path",
    ],
)
def test_disallowed_or_spoofed_source_fails_closed(url):
    result = validate_receipt(make_receipt(source_url=url), POLICY, now=NOW)
    assert not result.accepted
    assert result.status == EvidenceStatus.SOURCE_UNAVAILABLE


def test_stale_and_inconclusive_evidence_do_not_authorize():
    stale = make_receipt(
        assessed_at=NOW - timedelta(days=8),
        claimed_published_at=NOW - timedelta(days=9),
    )
    assert validate_receipt(stale, POLICY, now=NOW).status == EvidenceStatus.STALE
    unresolved = make_receipt(assessment=EvidenceStatus.REQUIRES_REVIEW)
    result = validate_receipt(unresolved, POLICY, now=NOW)
    assert not result.accepted
    assert result.status == EvidenceStatus.REQUIRES_REVIEW


def test_weak_source_and_untrusted_publication_clock_require_review():
    project_claim = make_receipt(source_tier=SourceTier.PROJECT_DISCLOSURE)
    assert validate_receipt(project_claim, POLICY, now=NOW).status == EvidenceStatus.REQUIRES_REVIEW
    future_publication = make_receipt(claimed_published_at=NOW + timedelta(minutes=1))
    assert validate_receipt(future_publication, POLICY, now=NOW).status == EvidenceStatus.REQUIRES_REVIEW


def test_evidence_content_bound_and_timezone_are_enforced():
    small = EvidencePolicy(POLICY.allowed_hosts, POLICY.max_age, max_content_bytes=4)
    assert validate_receipt(make_receipt(), small, now=NOW).status == EvidenceStatus.INSUFFICIENT
    naive = make_receipt(assessed_at=NOW.replace(tzinfo=None))
    assert validate_receipt(naive, POLICY, now=NOW).status == EvidenceStatus.REQUIRES_REVIEW


def default_mandate():
    return Mandate(1, "sha256:mandate-v1", 2_000, 1_500, 86_400, 604_800)


def test_mandate_is_immutable_and_numeric_limits_are_bounded():
    mandate = default_mandate()
    with pytest.raises(FrozenInstanceError):
        mandate.version = 2
    with pytest.raises(ValueError):
        Mandate(1, "bad", 9_000, 2_000, 1, 1)


def test_allocation_counts_pending_commitments_and_reserve():
    mandate = default_mandate()
    allowed = evaluate_allocation(
        mandate,
        treasury_liquid_wei=100_000,
        pending_commitments_wei=5_000,
        project_exposure_wei=10_000,
        new_commitment_wei=10_000,
        exposure_base_wei=100_000,
    )
    assert allowed.allowed
    assert allowed.projected_exposure_wei == allowed.project_cap_wei == 20_000
    reserve_breach = evaluate_allocation(
        mandate,
        treasury_liquid_wei=29_999,
        pending_commitments_wei=5_000,
        project_exposure_wei=0,
        new_commitment_wei=10_000,
        exposure_base_wei=100_000,
    )
    assert not reserve_breach.allowed
    assert reserve_breach.reason == "minimum liquid reserve would be breached"
    concentration_breach = evaluate_allocation(
        mandate,
        treasury_liquid_wei=100_000,
        pending_commitments_wei=0,
        project_exposure_wei=15_000,
        new_commitment_wei=5_001,
        exposure_base_wei=100_000,
    )
    assert not concentration_breach.allowed
    assert concentration_breach.reason == "project exposure cap exceeded"
