"""Fail-closed reducer for independently observed parent/child transfer data.

This module consumes receipt and balance observations from a trusted RPC
adapter; it does not fabricate or fetch them. An UNKNOWN or VALUE_AT_RISK
result is a stop condition and is never automatically resent.
"""

from dataclasses import dataclass
from enum import StrEnum


class TransferState(StrEnum):
    PARENT_FAILED = "PARENT_FAILED"
    PENDING = "PENDING"
    CHILD_SUCCESS = "CHILD_SUCCESS"
    CHILD_FAILED = "CHILD_FAILED"
    UNKNOWN = "UNKNOWN"
    VALUE_AT_RISK = "VALUE_AT_RISK"
    VERIFIED = "VERIFIED"


@dataclass(frozen=True)
class TransferObservation:
    transfer_id: str
    amount_wei: int
    parent_tx_id: str | None
    parent_status: str
    child_tx_id: str | None
    child_status: str | None
    destination_balance_before_wei: int | None = None
    destination_balance_after_wei: int | None = None
    destination_recorded_amount_wei: int | None = None


@dataclass(frozen=True)
class Reconciliation:
    state: TransferState
    reason: str
    retry_permitted: bool = False


def reconcile_transfer(observation: TransferObservation) -> Reconciliation:
    if not observation.transfer_id or observation.amount_wei <= 0:
        return Reconciliation(TransferState.UNKNOWN, "transfer identity or positive amount missing")
    if not observation.parent_tx_id:
        return Reconciliation(TransferState.UNKNOWN, "parent transaction ID missing")
    if observation.parent_status.upper() in {"SUBMITTED", "ACCEPTED", "PENDING", "PROCESSING"}:
        return Reconciliation(TransferState.PENDING, "parent has not finalized")
    if observation.parent_status.upper() not in {"FINALIZED", "SUCCESS", "SUCCEEDED"}:
        if observation.parent_status.upper() in {"FAILED", "REVERTED"}:
            return Reconciliation(TransferState.PARENT_FAILED, "parent failed; no child settlement is assumed")
        return Reconciliation(TransferState.UNKNOWN, "parent status is not recognized")
    if not observation.child_tx_id or not observation.child_status:
        return Reconciliation(TransferState.UNKNOWN, "finalized parent has no independently identified child receipt")
    child_status = observation.child_status.upper()
    if child_status in {"SUBMITTED", "ACCEPTED", "PENDING", "PROCESSING"}:
        return Reconciliation(TransferState.PENDING, "child has not finalized")
    if child_status in {"FAILED", "REVERTED"}:
        return Reconciliation(TransferState.CHILD_FAILED, "value-carrying child failed; protocol does not guarantee refund")
    if child_status not in {"FINALIZED", "SUCCESS", "SUCCEEDED"}:
        return Reconciliation(TransferState.UNKNOWN, "child status is not recognized")
    if observation.destination_recorded_amount_wei is None:
        return Reconciliation(TransferState.CHILD_SUCCESS, "child succeeded; destination contract state not yet reconciled")
    if observation.destination_recorded_amount_wei != observation.amount_wei:
        return Reconciliation(TransferState.VALUE_AT_RISK, "destination contract amount does not match transfer intent")
    before = observation.destination_balance_before_wei
    after = observation.destination_balance_after_wei
    if before is None or after is None:
        return Reconciliation(TransferState.CHILD_SUCCESS, "destination record matches; independent balance delta is missing")
    if after - before != observation.amount_wei:
        return Reconciliation(TransferState.VALUE_AT_RISK, "destination balance delta does not match transfer amount")
    return Reconciliation(TransferState.VERIFIED, "parent, child, destination record, and balance delta agree")
