# Live StudioNet proofs

**Status: no live proof recorded.** This file contains no simulated receipts or fixture balances.

| Proof item | Result | Evidence |
|---|---|---|
| StudioNet endpoint | READ-ONLY ACCESS VERIFIED | `Web3(HTTPProvider('https://studio.genlayer.com/api')).eth.chain_id` using the installed Python/Web3 transport returned successfully when network access was explicitly granted for this read-only probe. Ordinary Python and Node probes without that grant fail with `WinError 10013` / `EACCES`; `CODEX_SANDBOX_NETWORK_DISABLED=1`. |
| Chain identity | VERIFIED READ ONLY | JSON-RPC `eth_chainId` returned `0xf22f` (61999), matching StudioNet. No state-changing request was sent. |
| MandateOS deployment | NOT DEPLOYED | No contract address, deployment transaction, or source hash. |
| ProjectVault deployment | NOT DEPLOYED | No contract address, deployment transaction, or source hash. |
| GEN deposit/funding/refund | NOT EXECUTED | No wallet/faucet operation was attempted. No transaction IDs, finalization outcomes, child receipts, or before/after balances exist. |
| Native validator web assessment | NOT EXECUTED | Contract source now calls GenLayer web access and comparative Equivalence Principle, but no StudioNet transaction or validator result was submitted or observed. Direct Mode does not support these nondeterministic blocks. |
| Contract settlement callbacks | IMPLEMENTED, NOT EXECUTED | MandateOS and ProjectVault now contain finalized-child success callbacks and explicit state reconciliation methods. Static lint and Direct Mode guard tests pass; Direct Mode does not execute asynchronous children. |
| GitHub remote | DEVELOPMENT PUSH VERIFIED | Prior branch HEAD `9a47c10f120c997988d8a4a544b239df142b1ab7`; this turn's verified commit will be recorded after push. `main` remains at baseline `4b446f04bb811c985230dee55b904e73412438b1`. |

Local Direct Mode exercises governance, allocation and refund authorization using deterministic fixtures; cross-contract views and child queues are stubbed. Those results are excluded from StudioNet proof. Update this record only with independently checked StudioNet transactions, parent/child receipt relationships, validator outcomes, and before/after contract balances.
