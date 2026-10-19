# Live StudioNet proofs

**Status: no live proof recorded.** This file contains no simulated receipts or fixture balances.

| Proof item | Result | Evidence |
|---|---|---|
| StudioNet endpoint | BLOCKED | RPC probe to `https://studio.genlayer.com/api` did not receive an HTTP response. Python socket error: `WinError 10013`; Codex environment declares `CODEX_SANDBOX_NETWORK_DISABLED=1`. This describes the sandbox probe only and does not establish Windows host connectivity or a StudioNet outage. |
| Chain identity | NOT VERIFIED | Expected chain ID is 61999; no chain ID was read. |
| MandateOS deployment | NOT DEPLOYED | No contract address, deployment transaction, or source hash. |
| ProjectVault deployment | NOT DEPLOYED | No contract address, deployment transaction, or source hash. |
| GEN deposit/funding/refund | NOT EXECUTED | No wallet/faucet operation was attempted. No transaction IDs, finalization outcomes, child receipts, or before/after balances exist. |
| GitHub remote | BLOCKED | `git ls-remote origin HEAD refs/heads/main` could not connect to `github.com:443`. Remote branch state and push permission are unknown. |

Local Direct Mode tests and in-memory balances are not live execution and are deliberately excluded from this table. Update this record only with independently checked StudioNet transactions, parent/child receipt relationships, and before/after contract balances.
