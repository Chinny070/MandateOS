# Live StudioNet proofs

**Status: no live proof recorded.** This file contains no simulated receipts or fixture balances.

| Proof item | Result | Evidence |
|---|---|---|
| StudioNet endpoint | BLOCKED IN THIS EXECUTION | Current read-only JSON-RPC `eth_chainId` request via Python failed with `WinError 10013`; Node `fetch` failed with `EACCES`. `CODEX_SANDBOX_NETWORK_DISABLED=1`. Neither request received an HTTP/RPC response. A prior separate diagnostic reported success, but its result is not treated as proof for this execution's SDK/CLI. |
| Chain identity | NOT VERIFIED | Expected chain ID is 61999; no chain ID was read. |
| MandateOS deployment | NOT DEPLOYED | No contract address, deployment transaction, or source hash. |
| ProjectVault deployment | NOT DEPLOYED | No contract address, deployment transaction, or source hash. |
| GEN deposit/funding/refund | NOT EXECUTED | No wallet/faucet operation was attempted. No transaction IDs, finalization outcomes, child receipts, or before/after balances exist. |
| Contract settlement callbacks | IMPLEMENTED, NOT EXECUTED | MandateOS and ProjectVault now contain finalized-child success callbacks and explicit state reconciliation methods. Static lint and Direct Mode guard tests pass; Direct Mode does not execute asynchronous children. |
| GitHub remote | VERIFIED READ ONLY | GitHub connector identifies `Chinny070/MandateOS`, reports `push: true`, and confirms `main` at `ca3c0be070b5b3099d26e38c1bab7c0bf7ab63fa`, matching the local baseline. Direct shell push is still blocked at `github.com:443`; no remote write is claimed for this work session. |

Local Direct Mode tests and in-memory balances are not live execution and are deliberately excluded from this table. Update this record only with independently checked StudioNet transactions, parent/child receipt relationships, and before/after contract balances.
