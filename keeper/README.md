# Keeper and independent reconciler

`reconciler.py` is a fail-closed receipt reducer. `studionet_rpc.py` adds a read-only JSON-RPC client pinned to `https://studio.genlayer.com/api`; it checks `eth_chainId == 0xf22f`, reads GenLayer transaction receipts and lifecycle state, and can inspect an externally identified EVM transfer and balance snapshots.

The adapter never signs, submits, retries, or writes transactions. It records parent and external transaction IDs, chain status, sender, destination, amount, receipt block, and optional recipient balance snapshots. It reports `UNKNOWN` when the EVM transfer cannot be causally linked to the finalized parent IC transaction. The published GenLayer receipt/lifecycle documentation does not provide that link for external messages, so EOA payouts must remain unverified until an independently verifiable index/receipt source exposes it. Failed and uncertain value transfers are never automatically resent.

Tests use explicit fake JSON-RPC fixtures and do not call StudioNet. The keeper still needs a real transaction index adapter, durable receipt archive, alerting/scheduling, and integration with permissionless onchain expiry and reconciliation methods. It has no treasury signing key or financial authority.
