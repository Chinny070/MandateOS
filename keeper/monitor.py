"""Restart-safe, noncustodial transaction monitor for tracked StudioNet writes."""

from __future__ import annotations

import json
from typing import Any, Protocol

from keeper.archive import CHAIN_ID, ReceiptArchive
from keeper.reconciler import TransferObservation, reconcile_transfer


class ReadClient(Protocol):
    def verify_chain(self) -> str: ...
    def get_transaction(self, tx_id: str) -> dict[str, Any]: ...
    def get_lifecycle(self, tx_id: str) -> dict[str, Any]: ...
    def get_triggered_transaction_ids(self, tx_id: str) -> list[str]: ...
    def get_balance(self, address: str) -> int: ...
    def read_contract(self, address: str, function_name: str, args: list[Any]) -> Any: ...


def _value(record: dict[str, Any], *names: str, default: Any = None) -> Any:
    for name in names:
        if name in record and record[name] is not None:
            return record[name]
    return default


def _quantity(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, str):
        try:
            return int(value, 16) if value.lower().startswith("0x") else int(value)
        except ValueError:
            return None
    return None


def _status(tx: dict[str, Any]) -> str:
    status = _value(tx, "statusName", "status_name", "status", default="UNKNOWN")
    return str(status).upper().replace(" ", "_")


def _execution(tx: dict[str, Any]) -> str:
    result = _value(
        tx, "txExecutionResultName", "tx_execution_result_name", "txExecutionResult",
        "tx_execution_result", default="UNKNOWN",
    )
    return str(result).upper().replace(" ", "_")


def _is_finalized(status: str) -> bool:
    return status in {"FINALIZED", "7"}


def _is_successful(tx: dict[str, Any]) -> bool:
    return _is_finalized(_status(tx)) and _execution(tx) in {
        "FINISHED_WITH_RETURN", "FINISHEDWITHRETURN", "1",
    }


def _message_type(message: dict[str, Any]) -> str:
    value = _value(message, "messageType", "message_type", default="")
    if value in (0, "0") or str(value).lower() == "external":
        return "external"
    if value in (1, "1") or str(value).lower() == "internal":
        return "internal"
    return "unknown"


def _message_value(message: dict[str, Any]) -> int | None:
    return _quantity(_value(message, "value", "userValue", "user_value"))


def _message_recipient(message: dict[str, Any]) -> str:
    return str(_value(message, "recipient", default="")).lower()


def _message_is_finalized(message: dict[str, Any]) -> bool:
    on_acceptance = _value(message, "onAcceptance", "on_acceptance")
    return on_acceptance is False or on_acceptance in (0, "false", "False")


def _child_sender(child: dict[str, Any]) -> str:
    return str(_value(child, "sender", "tx_sender", default="")).lower()


def _child_recipient(child: dict[str, Any]) -> str:
    return str(_value(child, "recipient", "tx_recipient", default="")).lower()


def _child_value(child: dict[str, Any]) -> int | None:
    fees = _value(child, "fees", default={})
    if isinstance(fees, dict):
        return _quantity(_value(fees, "userValue", "user_value"))
    return _quantity(_value(child, "value", "userValue", "user_value"))


class Monitor:
    """Polls known transaction IDs and persists observations without write access."""

    def __init__(self, archive: ReceiptArchive, reader: ReadClient):
        self.archive = archive
        self.reader = reader

    def poll_all_once(self) -> list[dict[str, Any]]:
        results = []
        for watch in self.archive.watches():
            results.append(self.poll_once(watch["tx_id"]))
        return results

    def poll_once(self, tx_id: str) -> dict[str, Any]:
        watch = self.archive.get_watch(tx_id)
        if watch is None:
            raise KeyError("transaction is not in the durable watch list")
        try:
            chain_id = self.reader.verify_chain().lower()
            if chain_id != CHAIN_ID:
                raise RuntimeError("RPC endpoint is not StudioNet chain ID 61999")
            parent = self.reader.get_transaction(watch["tx_id"])
            lifecycle = self.reader.get_lifecycle(watch["tx_id"])
            self.archive.append_receipt(watch["tx_id"], "parent_receipt", parent)
            self.archive.append_receipt(watch["tx_id"], "parent_lifecycle", lifecycle)

            messages = _value(parent, "messages", "emitted_messages", default=[])
            if not isinstance(messages, list):
                messages = []
            self.archive.append_receipt(watch["tx_id"], "parent_messages", messages)

            parent_status = _status(parent)
            balance_phase = "after_finalization" if _is_finalized(parent_status) else "before_finalization"
            prior = self._balance_snapshots(watch["tx_id"])
            before = prior[0] if prior else None
            balances = {
                "source_wei": self.reader.get_balance(watch["source_address"]),
                "destination_wei": self.reader.get_balance(watch["destination_address"]),
                "phase": balance_phase,
            }
            self.archive.append_receipt(watch["tx_id"], "balance_read", balances)
            after = balances

            if parent_status in {"PENDING", "ACCEPTED", "PROCESSING", "PROPOSING", "COMMITTING", "REVEALING"}:
                return self._finish(watch, "PENDING", "parent is not finalized")
            if not _is_finalized(parent_status):
                state = "PARENT_FAILED" if parent_status in {"FAILED", "CANCELED", "CANCELLED", "REVERTED"} else "UNKNOWN"
                return self._finish(watch, state, f"parent status is {parent_status}")
            if not _is_successful(parent):
                return self._finish(watch, "PARENT_FAILED", "parent finalized without successful contract execution")

            matching_messages = [
                message for message in messages
                if isinstance(message, dict)
                and _message_type(message) == ("external" if watch["recipient_kind"] == "EOA" else "internal")
                and _message_recipient(message) == watch["destination_address"]
                and _message_value(message) == int(watch["amount_wei"])
                and _message_is_finalized(message)
            ]
            if len(matching_messages) != 1:
                return self._finish(
                    watch, "VALUE_AT_RISK",
                    "finalized parent has no unique emitted message matching the immutable destination, amount, and finalization mode",
                )

            # The GenLayerPY/GenLayerJS triggered-transaction API currently
            # derives links only from InternalMessageProcessed events. Keep
            # these edges explicitly typed and never treat them as EOA links.
            triggered = self.reader.get_triggered_transaction_ids(watch["tx_id"])
            triggered = [item.lower() for item in triggered]
            for child_id in triggered:
                self.archive.add_edge(watch["tx_id"], child_id, "internal_message_child", "GenLayerPY get_triggered_transaction_ids")
                child = self.reader.get_transaction(child_id)
                child_lifecycle = self.reader.get_lifecycle(child_id)
                self.archive.append_receipt(child_id, "child_receipt", child)
                self.archive.append_receipt(child_id, "child_lifecycle", child_lifecycle)

            if watch["recipient_kind"] == "EOA":
                self.archive.audit(
                    watch["tx_id"], "EXTERNAL_INTENT_OBSERVED", "UNKNOWN",
                    "parent emitted the exact authorized external message; SDK child IDs cover internal messages only",
                )
                acknowledgment = self._read_eoa_acknowledgment(watch)
                self.archive.append_receipt(watch["tx_id"], "recipient_acknowledgment", acknowledgment)
                self.archive.audit(
                    watch["tx_id"], "BENEFICIARY_ATTESTATION", acknowledgment["status"],
                    json.dumps(acknowledgment, sort_keys=True),
                )
                result = self._finish(
                    watch, "UNKNOWN",
                    "external EOA execution has no supported parent-linked child receipt; no automatic retry permitted",
                )
                result["recipient_acknowledgment"] = acknowledgment
                return result

            child_candidates = []
            for child_id in triggered:
                child = self.reader.get_transaction(child_id)
                if (_child_sender(child) == watch["source_address"]
                        and _child_recipient(child) == watch["destination_address"]
                        and _child_value(child) == int(watch["amount_wei"])):
                    child_candidates.append((child_id, child))
            if len(child_candidates) != 1:
                return self._finish(watch, "UNKNOWN", "triggered internal child does not uniquely match the fixed payment intent")

            child_id, child = child_candidates[0]
            child_status = _status(child)
            if child_status in {"PENDING", "ACCEPTED", "PROCESSING", "PROPOSING", "COMMITTING", "REVEALING"}:
                return self._finish(watch, "PENDING", "linked child transaction is not finalized")
            if not _is_finalized(child_status) or not _is_successful(child):
                return self._finish(watch, "CHILD_FAILED", "linked child did not finalize with successful execution")

            destination_record = None
            if watch["destination_contract"] and watch["destination_method"]:
                args = json.loads(watch["destination_args_json"])
                destination_record = _quantity(self.reader.read_contract(
                    watch["destination_contract"], watch["destination_method"], args,
                ))
                self.archive.append_receipt(watch["tx_id"], "contract_read", {
                    "contract": watch["destination_contract"],
                    "function": watch["destination_method"],
                    "args": args,
                    "value_wei": destination_record,
                })

            # Current balances are archived every poll. Only the first
            # pre-finalization snapshot can be used as a baseline; if monitoring
            # starts after finalization, the balance delta remains unavailable.
            before_source = before.get("source_wei") if before else None
            before_destination = before.get("destination_wei") if before else None
            observation = TransferObservation(
                transfer_id=watch["transfer_id"],
                amount_wei=int(watch["amount_wei"]),
                parent_tx_id=watch["tx_id"],
                parent_status="FINALIZED",
                child_tx_id=child_id,
                child_status="FINALIZED",
                expected_source_address=watch["source_address"],
                expected_destination_address=watch["destination_address"],
                observed_source_address=_child_sender(child),
                observed_destination_address=_child_recipient(child),
                child_amount_wei=_child_value(child),
                parent_child_link_verified=True,
                recipient_kind="IC",
                destination_balance_before_wei=before_destination,
                destination_balance_after_wei=after["destination_wei"] if before else None,
                source_balance_before_wei=before_source,
                source_balance_after_wei=after["source_wei"] if before else None,
                destination_recorded_amount_wei=destination_record,
            )
            result = reconcile_transfer(observation)
            return self._finish(watch, result.state.value, result.reason)
        except Exception as error:  # Network/schema failures are archived as UNKNOWN and polling can resume.
            reason = f"read/reconciliation failure: {type(error).__name__}"
            self.archive.set_state(watch["tx_id"], "UNKNOWN", error=reason)
            self.archive.alert(watch["tx_id"], "UNKNOWN", "ERROR", reason)
            self.archive.audit(watch["tx_id"], "POLL_ERROR", "UNKNOWN", reason)
            return {"tx_id": watch["tx_id"], "state": "UNKNOWN", "reason": reason}

    def _balance_snapshots(self, tx_id: str) -> list[dict[str, int]]:
        # Archive exposes deduplicated snapshots for restart recovery.
        return self.archive.balance_snapshots(tx_id)

    def _read_eoa_acknowledgment(self, watch: dict[str, Any]) -> dict[str, Any]:
        base = {
            "status": "UNKNOWN",
            "evidence_type": "beneficiary_attestation",
            "project_vault": watch["source_address"],
            "project_id": "",
            "payment_id": watch["transfer_id"],
            "beneficiary": watch["destination_address"],
            "amount_wei": str(watch["amount_wei"]),
            "signer": "",
            "acknowledged_at": "0",
            "settlement_status": "UNVERIFIED",
        }
        try:
            raw = self.reader.read_contract(
                watch["source_address"],
                "get_eoa_payout_acknowledgment",
                [watch["transfer_id"]],
            )
            fields = list(raw) if isinstance(raw, (list, tuple)) else []
            if len(fields) < 8:
                base["reason"] = "ProjectVault returned no complete beneficiary acknowledgment view"
                return base
            status, vault, project, payment, beneficiary, amount, signer, timestamp = fields[:8]
            amount_value = _quantity(amount)
            timestamp_value = _quantity(timestamp)
            identity_matches = (
                str(vault).lower() == watch["source_address"].lower()
                and str(payment) == watch["transfer_id"]
                and str(beneficiary).lower() == watch["destination_address"].lower()
                and amount_value == int(watch["amount_wei"])
            )
            acknowledgment_status = str(status)
            if acknowledgment_status == "RECIPIENT_ACKNOWLEDGED":
                identity_matches = (
                    identity_matches
                    and str(signer).lower() == watch["destination_address"].lower()
                    and timestamp_value is not None and timestamp_value > 0
                )
            if not identity_matches:
                acknowledgment_status = "ATTESTATION_MISMATCH"
            elif acknowledgment_status not in {"NOT_ACKNOWLEDGED", "RECIPIENT_ACKNOWLEDGED"}:
                acknowledgment_status = "UNKNOWN"
            base.update({
                "status": acknowledgment_status,
                "project_vault": str(vault),
                "project_id": str(project),
                "payment_id": str(payment),
                "beneficiary": str(beneficiary),
                "amount_wei": str(amount_value) if amount_value is not None else "UNKNOWN",
                "signer": str(signer),
                "acknowledged_at": str(timestamp_value) if timestamp_value is not None else "UNKNOWN",
                "reason": "beneficiary onchain attestation only; external GEN settlement remains unverified",
            })
            return base
        except Exception as error:
            base["reason"] = f"beneficiary acknowledgment read failed: {type(error).__name__}"
            return base

    def _finish(self, watch: dict[str, Any], state: str, reason: str) -> dict[str, Any]:
        self.archive.set_state(watch["tx_id"], state)
        self.archive.audit(watch["tx_id"], "RECONCILED", state, reason)
        if state in {"UNKNOWN", "VALUE_AT_RISK", "CHILD_FAILED", "PARENT_FAILED"}:
            severity = "CRITICAL" if state in {"VALUE_AT_RISK", "CHILD_FAILED"} else "WARNING"
            self.archive.alert(watch["tx_id"], state, severity, reason)
        return {"tx_id": watch["tx_id"], "state": state, "reason": reason}
