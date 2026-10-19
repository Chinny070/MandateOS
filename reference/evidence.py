"""Deterministic evidence receipt validation helpers.

These helpers validate archive metadata and freshness supplied to them. They
do not fetch sources, prove claims, or replace GenLayer validator consensus.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from hashlib import sha256
from ipaddress import ip_address
from urllib.parse import urlsplit


class EvidenceStatus(StrEnum):
    VERIFIED_ELIGIBLE = "VERIFIED_ELIGIBLE"
    VERIFIED_INELIGIBLE = "VERIFIED_INELIGIBLE"
    INSUFFICIENT = "INSUFFICIENT"
    STALE = "STALE"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"


class SourceTier(StrEnum):
    REGULATORY = "REGULATORY"
    INDEPENDENT = "INDEPENDENT"
    PROJECT_DISCLOSURE = "PROJECT_DISCLOSURE"


@dataclass(frozen=True)
class EvidenceReceipt:
    evidence_id: str
    project_id: str
    claim_type: str
    source_url: str
    source_tier: SourceTier
    assessed_at: datetime
    claimed_published_at: datetime | None
    expires_at: datetime
    content: bytes
    assessment: EvidenceStatus
    assessment_version: str
    mandate_digest: str
    snapshot_uri: str | None = None

    @property
    def content_digest(self) -> str:
        return sha256(self.content).hexdigest()


@dataclass(frozen=True)
class EvidencePolicy:
    allowed_hosts: frozenset[str]
    max_age: timedelta
    max_content_bytes: int = 1_000_000
    minimum_tier: SourceTier = SourceTier.INDEPENDENT


@dataclass(frozen=True)
class EvidenceValidation:
    accepted: bool
    status: EvidenceStatus
    reason: str
    content_digest: str | None


_TIER_RANK = {
    SourceTier.PROJECT_DISCLOSURE: 0,
    SourceTier.INDEPENDENT: 1,
    SourceTier.REGULATORY: 2,
}


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamps must include a timezone")
    return value.astimezone(timezone.utc)


def _safe_allowed_source(url: str, allowed_hosts: frozenset[str]) -> bool:
    try:
        parsed = urlsplit(url)
        host = (parsed.hostname or "").rstrip(".").lower()
        if parsed.scheme != "https" or not host or parsed.username or parsed.password:
            return False
        if parsed.port not in (None, 443):
            return False
        try:
            ip_address(host)
            return False
        except ValueError:
            pass
        if host == "localhost" or host.endswith(".localhost") or host.endswith(".local"):
            return False
        return any(host == allowed.lower().rstrip(".") or host.endswith("." + allowed.lower().rstrip(".")) for allowed in allowed_hosts)
    except ValueError:
        return False


def validate_receipt(receipt: EvidenceReceipt, policy: EvidencePolicy, *, now: datetime) -> EvidenceValidation:
    """Fail closed on bad provenance, clocks, freshness, or evidence bounds."""
    digest = receipt.content_digest
    try:
        assessed_at = _utc(receipt.assessed_at)
        expires_at = _utc(receipt.expires_at)
        current = _utc(now)
        published_at = _utc(receipt.claimed_published_at) if receipt.claimed_published_at else None
    except ValueError as exc:
        return EvidenceValidation(False, EvidenceStatus.REQUIRES_REVIEW, str(exc), digest)

    if not receipt.evidence_id or not receipt.project_id or not receipt.claim_type:
        return EvidenceValidation(False, EvidenceStatus.INSUFFICIENT, "receipt identity fields are required", digest)
    if not _safe_allowed_source(receipt.source_url, policy.allowed_hosts):
        return EvidenceValidation(False, EvidenceStatus.SOURCE_UNAVAILABLE, "source URL is not an allowed HTTPS host", digest)
    if len(receipt.content) == 0 or len(receipt.content) > policy.max_content_bytes:
        return EvidenceValidation(False, EvidenceStatus.INSUFFICIENT, "content is empty or exceeds the configured bound", digest)
    if not receipt.assessment_version or not receipt.mandate_digest:
        return EvidenceValidation(False, EvidenceStatus.INSUFFICIENT, "assessment and mandate versions are required", digest)
    if _TIER_RANK[receipt.source_tier] < _TIER_RANK[policy.minimum_tier]:
        return EvidenceValidation(False, EvidenceStatus.REQUIRES_REVIEW, "source tier is below policy minimum", digest)
    if assessed_at > current or expires_at <= assessed_at:
        return EvidenceValidation(False, EvidenceStatus.REQUIRES_REVIEW, "assessment or expiry clock is invalid", digest)
    if published_at and published_at > assessed_at:
        return EvidenceValidation(False, EvidenceStatus.REQUIRES_REVIEW, "claimed publication time is after assessment time", digest)
    if current - assessed_at > policy.max_age or current >= expires_at:
        return EvidenceValidation(False, EvidenceStatus.STALE, "evidence is outside its freshness window", digest)
    if receipt.assessment not in (EvidenceStatus.VERIFIED_ELIGIBLE, EvidenceStatus.VERIFIED_INELIGIBLE):
        return EvidenceValidation(False, receipt.assessment, "assessment is not a conclusive eligibility result", digest)
    return EvidenceValidation(True, receipt.assessment, "receipt metadata and freshness are valid", digest)
