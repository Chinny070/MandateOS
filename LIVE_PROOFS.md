# Live StudioNet proofs

**Status: no live proof recorded.** This file contains no simulated receipts or fixture balances.

| Proof item | Result | Evidence |
|---|---|---|
| StudioNet endpoint | READ-ONLY ACCESS VERIFIED | `Web3(HTTPProvider('https://studio.genlayer.com/api')).eth.chain_id` using the installed Python/Web3 transport returned successfully when network access was explicitly granted for this read-only probe. Ordinary Python and Node probes without that grant fail with `WinError 10013` / `EACCES`; `CODEX_SANDBOX_NETWORK_DISABLED=1`. |
| Chain identity | VERIFIED READ ONLY | JSON-RPC `eth_chainId` returned `0xf22f` (61999), matching StudioNet. No state-changing request was sent. |
| MandateOS deployment | NOT DEPLOYED | No contract address, deployment transaction, or source hash. |
| ProjectVault deployment | NOT DEPLOYED | No contract address, deployment transaction, or source hash. |
| GEN deposit/funding/refund | NOT EXECUTED | No wallet/faucet operation was attempted. No transaction IDs, finalization outcomes, child receipts, or before/after balances exist. |
| Contract settlement callbacks | IMPLEMENTED, NOT EXECUTED | MandateOS and ProjectVault now contain finalized-child success callbacks and explicit state reconciliation methods. Static lint and Direct Mode guard tests pass; Direct Mode does not execute asynchronous children. |
| GitHub remote | BASELINE VERIFIED | Work starts from `main` commit `4b446f04bb811c985230dee55b904e73412438b1`. Development changes are on `codex/onchain-governance`; until push is confirmed, no new remote commit is claimed. |

Local Direct Mode now exercises contract governance and allocation authorization, but its clock and balances are fixtures; vault identity views and child message enqueueing are stubbed. These results are not live execution and are deliberately excluded from StudioNet transaction proof. Update this record only with independently checked StudioNet transactions, parent/child receipt relationships, and before/after contract balances.
