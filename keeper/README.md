# MandateOS keeper

The keeper is a read-only StudioNet observer. It has no account, private key, transaction submission, payout retry, or treasury authorization path. It archives receipts and observations in SQLite so polling can resume after a process restart.

## Run

Create a JSON watchlist for already submitted parent transaction IDs. Bind each row to the exact transfer intent; use `EOA` or `IC` for the recipient kind:

```json
{
  "chain_id": "0xf22f",
  "transactions": [
    {
      "tx_id": "0x<64 hex characters>",
      "transfer_id": "allocation-or-payment-id",
      "source_address": "0x<40 hex characters>",
      "destination_address": "0x<40 hex characters>",
      "amount_wei": "1000000000000000000",
      "recipient_kind": "IC",
      "destination_contract": "0x<40 hex characters>",
      "destination_method": "get_received_amount",
      "destination_args": ["payment-id"]
    }
  ]
}
```

Run one reconciliation pass or poll continuously:

```powershell
python -m keeper.cli --db keeper-data/mandateos.sqlite3 --watchlist keeper-data/watchlist.json --report keeper-data/latest-report.json --once
python -m keeper.cli --db keeper-data/mandateos.sqlite3 --watchlist keeper-data/watchlist.json --report keeper-data/latest-report.json --interval 30
```

The archive uses SQLite WAL with full synchronous writes; duplicate receipt snapshots, child edges, and audit events are idempotently deduplicated. Reports contain observed transaction IDs, receipts, lifecycle snapshots, message fields, balance samples, current states, and alerts. Keep the database and report access-controlled because they may contain public transaction metadata and operational details.

## Settlement limits

The installed GenLayerPY `get_triggered_transaction_ids` method derives child IDs from `InternalMessageProcessed` lifecycle events. It can establish internal IC message children. It does not return a causally linked transaction hash for EOA external value transfers. Therefore, even when a finalized parent emits an exact EOA transfer intent, EOA settlement remains `UNKNOWN`; matching addresses, values, balances, or timestamps cannot upgrade it. No local operator or administrator override exists, and UNKNOWN or VALUE_AT_RISK is never retried.

For IC recipients, `VERIFIED` requires one exactly matching triggered child, finalized successful execution, a destination contract read-back equal to the bound amount, and matching source and destination balance deltas from a recorded pre-finalization snapshot. If the keeper starts after finalization, that balance comparison is unavailable, so it cannot claim verification.

The keeper does not submit supported permissionless onchain maintenance calls. Those can be invoked by a wallet through the normal contract interface after a user reviews the precise call. The keeper identifies conditions and records observations only.

Tests use deterministic local fixtures. They are not StudioNet execution or settlement proof.
