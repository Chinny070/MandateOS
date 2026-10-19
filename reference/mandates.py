"""Immutable, integer-only mandate limits for local policy evaluation.

Onchain governance and enforcement remain separate work. This module gives
tests and offchain tooling a deterministic policy representation; it is not
an authorization source for a contract or a wallet.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Mandate:
    version: int
    digest: str
    max_project_exposure_bps: int
    minimum_liquid_reserve_bps: int
    challenge_window_seconds: int
    evidence_max_age_seconds: int

    def __post_init__(self) -> None:
        if self.version < 1 or not self.digest:
            raise ValueError("mandate version and digest are required")
        if not 0 < self.max_project_exposure_bps <= 10_000:
            raise ValueError("project exposure must be within 1..10000 bps")
        if not 0 <= self.minimum_liquid_reserve_bps < 10_000:
            raise ValueError("liquid reserve must be within 0..9999 bps")
        if self.max_project_exposure_bps + self.minimum_liquid_reserve_bps > 10_000:
            raise ValueError("exposure and reserve limits cannot exceed 10000 bps")
        if self.challenge_window_seconds <= 0 or self.evidence_max_age_seconds <= 0:
            raise ValueError("challenge and evidence windows must be positive")


@dataclass(frozen=True)
class ExposureDecision:
    allowed: bool
    projected_exposure_wei: int
    project_cap_wei: int
    minimum_reserve_wei: int
    available_after_commitment_wei: int
    reason: str


def evaluate_allocation(
    mandate: Mandate,
    *,
    treasury_liquid_wei: int,
    pending_commitments_wei: int,
    project_exposure_wei: int,
    new_commitment_wei: int,
    exposure_base_wei: int,
) -> ExposureDecision:
    values = (treasury_liquid_wei, pending_commitments_wei, project_exposure_wei, new_commitment_wei, exposure_base_wei)
    if any(value < 0 for value in values):
        raise ValueError("amounts must be nonnegative wei integers")
    project_cap = exposure_base_wei * mandate.max_project_exposure_bps // 10_000
    min_reserve = exposure_base_wei * mandate.minimum_liquid_reserve_bps // 10_000
    projected = project_exposure_wei + new_commitment_wei
    after_commitment = treasury_liquid_wei - pending_commitments_wei - new_commitment_wei
    if new_commitment_wei == 0:
        reason = "allocation must be positive"
    elif projected > project_cap:
        reason = "project exposure cap exceeded"
    elif after_commitment < min_reserve:
        reason = "minimum liquid reserve would be breached"
    else:
        reason = "allocation meets this mandate's numeric limits"
    return ExposureDecision(
        allowed=reason == "allocation meets this mandate's numeric limits",
        projected_exposure_wei=projected,
        project_cap_wei=project_cap,
        minimum_reserve_wei=min_reserve,
        available_after_commitment_wei=after_commitment,
        reason=reason,
    )
