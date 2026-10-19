"""Read-only MandateOS keeper CLI; it never signs or submits transactions."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import tempfile
import time
from typing import Any

from keeper.archive import ReceiptArchive, Watch
from keeper.monitor import Monitor
from keeper.sdk_reader import GenLayerPYReader


def load_watchlist(path: str | None) -> list[Watch]:
    if not path:
        return []
    content = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(content, dict) or content.get("chain_id") != "0xf22f":
        raise ValueError("watchlist must explicitly pin chain_id to 0xf22f")
    rows = content.get("transactions", [])
    if not isinstance(rows, list):
        raise ValueError("watchlist transactions must be an array")
    result = []
    allowed = {
        "tx_id", "transfer_id", "source_address", "destination_address", "amount_wei",
        "recipient_kind", "destination_contract", "destination_method", "destination_args",
    }
    for row in rows:
        if not isinstance(row, dict) or set(row) - allowed:
            raise ValueError("watchlist contains an invalid entry or unsupported field")
        required = allowed & {"tx_id", "transfer_id", "source_address", "destination_address", "amount_wei", "recipient_kind"}
        if not required.issubset(row):
            raise ValueError("watchlist entry is missing required fields")
        args = row.get("destination_args", [])
        if not isinstance(args, list):
            raise ValueError("destination_args must be an array")
        result.append(Watch(
            tx_id=row["tx_id"],
            transfer_id=row["transfer_id"],
            source_address=row["source_address"],
            destination_address=row["destination_address"],
            amount_wei=int(row["amount_wei"]),
            recipient_kind=row["recipient_kind"],
            destination_contract=row.get("destination_contract", ""),
            destination_method=row.get("destination_method", ""),
            destination_args_json=json.dumps(args, separators=(",", ":")),
        ))
    return result


def write_report(path: str, report: dict[str, Any]) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    file_name = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=target.parent,
            prefix=f".{target.name}.", suffix=".tmp", delete=False,
        ) as handle:
            file_name = handle.name
            json.dump(report, handle, sort_keys=True, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(file_name, target)
    finally:
        if file_name and os.path.exists(file_name):
            os.unlink(file_name)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--db", default="keeper-data/mandateos.sqlite3", help="SQLite receipt archive path")
    result.add_argument("--watchlist", help="JSON watchlist containing already submitted transaction IDs")
    result.add_argument("--report", help="Atomically write the current JSON reconciliation report")
    result.add_argument("--interval", type=int, default=30, help="Polling interval in seconds (5..3600)")
    result.add_argument("--once", action="store_true", help="Poll every durable watch once, then exit")
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if not 5 <= args.interval <= 3600:
        parser().error("--interval must be between 5 and 3600")
    try:
        archive = ReceiptArchive(args.db)
        for watch in load_watchlist(args.watchlist):
            archive.track(watch)
        reader = GenLayerPYReader()
        monitor = Monitor(archive, reader)
        while True:
            monitor.poll_all_once()
            report = archive.report()
            rendered = json.dumps(report, sort_keys=True, indent=2)
            if args.report:
                write_report(args.report, report)
            print(rendered, flush=True)
            if args.once:
                return 0
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("keeper stopped; receipt archive is durable", file=sys.stderr)
        return 130
    except Exception as error:
        print(f"keeper error: {type(error).__name__}: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
