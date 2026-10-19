"""Durable, idempotent archive for read-only GenLayer reconciliation."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sqlite3
from typing import Any


HASH_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")
ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
CHAIN_ID = "0xf22f"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


@dataclass(frozen=True)
class Watch:
    tx_id: str
    transfer_id: str
    source_address: str
    destination_address: str
    amount_wei: int
    recipient_kind: str
    destination_contract: str = ""
    destination_method: str = ""
    destination_args_json: str = "[]"


class ReceiptArchive:
    """SQLite archive; identical receipt polls are deduplicated by content hash."""

    def __init__(self, path: str | Path):
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 15000")
        if self.path != ":memory:":
            connection.execute("PRAGMA journal_mode = WAL")
            connection.execute("PRAGMA synchronous = FULL")
        return connection

    def _initialize(self) -> None:
        with self._connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS watches (
                    tx_id TEXT PRIMARY KEY,
                    chain_id TEXT NOT NULL,
                    transfer_id TEXT NOT NULL,
                    source_address TEXT NOT NULL,
                    destination_address TEXT NOT NULL,
                    amount_wei TEXT NOT NULL,
                    recipient_kind TEXT NOT NULL,
                    destination_contract TEXT NOT NULL DEFAULT '',
                    destination_method TEXT NOT NULL DEFAULT '',
                    destination_args_json TEXT NOT NULL DEFAULT '[]',
                    state TEXT NOT NULL DEFAULT 'UNKNOWN',
                    last_polled_at TEXT,
                    last_error TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS receipt_snapshots (
                    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tx_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    content_sha256 TEXT NOT NULL,
                    observed_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    UNIQUE(tx_id, source, content_sha256)
                );
                CREATE TABLE IF NOT EXISTS transaction_edges (
                    parent_tx_id TEXT NOT NULL REFERENCES watches(tx_id),
                    child_tx_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    source TEXT NOT NULL,
                    observed_at TEXT NOT NULL,
                    PRIMARY KEY(parent_tx_id, child_tx_id, kind)
                );
                CREATE TABLE IF NOT EXISTS audit_events (
                    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tx_id TEXT NOT NULL REFERENCES watches(tx_id),
                    event_type TEXT NOT NULL,
                    state TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    event_key TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS alerts (
                    alert_key TEXT PRIMARY KEY,
                    tx_id TEXT NOT NULL REFERENCES watches(tx_id),
                    severity TEXT NOT NULL,
                    state TEXT NOT NULL,
                    message TEXT NOT NULL,
                    first_seen_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    occurrences INTEGER NOT NULL DEFAULT 1
                );
            """)

    @staticmethod
    def validate_watch(watch: Watch) -> Watch:
        tx_id = watch.tx_id.lower() if isinstance(watch.tx_id, str) else ""
        source = watch.source_address.lower() if isinstance(watch.source_address, str) else ""
        destination = watch.destination_address.lower() if isinstance(watch.destination_address, str) else ""
        if not HASH_RE.fullmatch(tx_id):
            raise ValueError("transaction id must be a 32-byte hex hash")
        if not ADDRESS_RE.fullmatch(source) or not ADDRESS_RE.fullmatch(destination):
            raise ValueError("source and destination must be 20-byte hex addresses")
        if not watch.transfer_id or len(watch.transfer_id) > 120 or watch.amount_wei <= 0:
            raise ValueError("transfer id and positive wei amount are required")
        if watch.recipient_kind not in {"IC", "EOA"}:
            raise ValueError("recipient kind must be IC or EOA")
        if watch.destination_contract and not ADDRESS_RE.fullmatch(watch.destination_contract):
            raise ValueError("destination contract must be a 20-byte hex address")
        if watch.destination_method and not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,79}", watch.destination_method):
            raise ValueError("destination read method name is invalid")
        try:
            args = json.loads(watch.destination_args_json)
        except (TypeError, json.JSONDecodeError):
            raise ValueError("destination args must be JSON") from None
        if not isinstance(args, list):
            raise ValueError("destination args must be a JSON array")
        if watch.destination_method and not watch.destination_contract:
            raise ValueError("destination read method requires a contract address")
        return Watch(
            tx_id, watch.transfer_id, source, destination, int(watch.amount_wei),
            watch.recipient_kind, watch.destination_contract.lower(),
            watch.destination_method, _json(args),
        )

    def track(self, watch: Watch, chain_id: str = CHAIN_ID) -> bool:
        if chain_id.lower() != CHAIN_ID:
            raise ValueError("archive accepts StudioNet chain ID 61999 only")
        watch = self.validate_watch(watch)
        inserted = False
        with self._connect() as db:
            cursor = db.execute("""
                INSERT OR IGNORE INTO watches (
                    tx_id, chain_id, transfer_id, source_address, destination_address,
                    amount_wei, recipient_kind, destination_contract, destination_method,
                    destination_args_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                watch.tx_id, CHAIN_ID, watch.transfer_id, watch.source_address,
                watch.destination_address, str(watch.amount_wei), watch.recipient_kind,
                watch.destination_contract, watch.destination_method, watch.destination_args_json,
            ))
            if cursor.rowcount == 0:
                existing = db.execute("SELECT * FROM watches WHERE tx_id = ?", (watch.tx_id,)).fetchone()
                expected = asdict(watch)
                expected["amount_wei"] = str(expected["amount_wei"])
                actual = {key: existing[key] for key in expected}
                if actual != expected:
                    raise ValueError("transaction is already tracked with different immutable intent")
                return False
            inserted = True
        if inserted:
            self.audit(watch.tx_id, "TRACKED", "UNKNOWN", "watch added by operator")
        return inserted

    def get_watch(self, tx_id: str) -> dict[str, Any] | None:
        with self._connect() as db:
            row = db.execute("SELECT * FROM watches WHERE tx_id = ?", (tx_id.lower(),)).fetchone()
            return dict(row) if row else None

    def watches(self) -> list[dict[str, Any]]:
        with self._connect() as db:
            return [dict(row) for row in db.execute("SELECT * FROM watches ORDER BY tx_id")]

    def append_receipt(self, tx_id: str, source: str, payload: Any) -> bool:
        if source not in {"parent_receipt", "parent_lifecycle", "parent_messages", "child_receipt", "child_lifecycle", "contract_read", "balance_read", "recipient_acknowledgment"}:
            raise ValueError("unsupported receipt source")
        serialized = _json(payload)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        with self._connect() as db:
            cursor = db.execute("""
                INSERT OR IGNORE INTO receipt_snapshots
                    (tx_id, source, content_sha256, observed_at, payload_json)
                VALUES (?, ?, ?, ?, ?)
            """, (tx_id.lower(), source, digest, utc_now(), serialized))
            return cursor.rowcount == 1

    def balance_snapshots(self, tx_id: str, phase: str = "before_finalization") -> list[dict[str, int]]:
        with self._connect() as db:
            rows = db.execute("""
                SELECT payload_json FROM receipt_snapshots
                WHERE tx_id = ? AND source = 'balance_read'
                ORDER BY snapshot_id
            """, (tx_id.lower(),)).fetchall()
        snapshots = []
        for row in rows:
            payload = json.loads(row["payload_json"])
            if (isinstance(payload, dict) and payload.get("phase") == phase
                    and isinstance(payload.get("source_wei"), int)
                    and isinstance(payload.get("destination_wei"), int)):
                snapshots.append(payload)
        return snapshots

    def add_edge(self, parent_tx_id: str, child_tx_id: str, kind: str, source: str) -> bool:
        if kind not in {"internal_message_child", "external_message_unlinked"}:
            raise ValueError("unsupported transaction edge type")
        with self._connect() as db:
            cursor = db.execute("""
                INSERT OR IGNORE INTO transaction_edges
                    (parent_tx_id, child_tx_id, kind, source, observed_at)
                VALUES (?, ?, ?, ?, ?)
            """, (parent_tx_id.lower(), child_tx_id.lower(), kind, source, utc_now()))
            return cursor.rowcount == 1

    def audit(self, tx_id: str, event_type: str, state: str, reason: str) -> bool:
        event_key = hashlib.sha256(f"{tx_id.lower()}|{event_type}|{state}|{reason}".encode()).hexdigest()
        with self._connect() as db:
            cursor = db.execute("""
                INSERT OR IGNORE INTO audit_events
                    (tx_id, event_type, state, reason, event_key, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (tx_id.lower(), event_type, state, reason, event_key, utc_now()))
            return cursor.rowcount == 1

    def set_state(self, tx_id: str, state: str, *, error: str = "") -> None:
        with self._connect() as db:
            db.execute("""
                UPDATE watches SET state = ?, last_polled_at = ?, last_error = ? WHERE tx_id = ?
            """, (state, utc_now(), error[:1000], tx_id.lower()))

    def alert(self, tx_id: str, state: str, severity: str, message: str) -> None:
        alert_key = hashlib.sha256(f"{tx_id.lower()}|{state}|{message}".encode()).hexdigest()
        now = utc_now()
        with self._connect() as db:
            db.execute("""
                INSERT INTO alerts
                    (alert_key, tx_id, severity, state, message, first_seen_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(alert_key) DO UPDATE SET
                    last_seen_at = excluded.last_seen_at
            """, (alert_key, tx_id.lower(), severity, state, message, now, now))

    def report(self) -> dict[str, Any]:
        with self._connect() as db:
            watches = [dict(row) for row in db.execute(
                "SELECT * FROM watches ORDER BY last_polled_at DESC, tx_id"
            )]
            alerts = [dict(row) for row in db.execute(
                "SELECT * FROM alerts ORDER BY last_seen_at DESC, alert_key"
            )]
            edges = [dict(row) for row in db.execute(
                "SELECT * FROM transaction_edges ORDER BY observed_at, parent_tx_id, child_tx_id"
            )]
            audit = [dict(row) for row in db.execute(
                "SELECT * FROM audit_events ORDER BY created_at, event_id"
            )]
        return {
            "chain_id": CHAIN_ID,
            "generated_at": utc_now(),
            "spending_authority": False,
            "automatic_retry": False,
            "watches": watches,
            "transaction_edges": edges,
            "alerts": alerts,
            "audit_events": audit,
        }
