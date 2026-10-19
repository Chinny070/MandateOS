# Live StudioNet proofs

**Status: no live proof recorded.** This file contains no simulated receipts or fixture balances.

| Proof item | Result | Evidence |
|---|---|---|
| StudioNet endpoint | HISTORICAL READ-ONLY DIAGNOSTIC | A prior diagnostic reported Node.js/PowerShell success and Python HTTPS HTTP 403. No RPC request was made during this implementation turn; this is not evidence that the current process's Python SDK or deployment CLI can access StudioNet. |
| Chain identity | PRIOR READ-ONLY RESULT | The prior successful transport returned `0xf22f` (61999). No state-changing request was sent. |
| MandateOS deployment | NOT DEPLOYED | No contract address, deployment transaction, or source hash. |
| ProjectVault deployment | NOT DEPLOYED | No contract address, deployment transaction, or source hash. |
| GEN deposit/funding/refund | NOT EXECUTED | No wallet/faucet operation was attempted. No transaction IDs, finalization outcomes, child receipts, or before/after balances exist. |
| Native validator web assessment | NOT EXECUTED | Contract source now calls GenLayer web access and comparative Equivalence Principle, but no StudioNet transaction or validator result was submitted or observed. Direct Mode does not support these nondeterministic blocks. |
| Contract settlement callbacks | IMPLEMENTED, NOT EXECUTED | MandateOS and ProjectVault now contain finalized-child success callbacks and explicit state reconciliation methods. Static lint and Direct Mode guard tests pass; Direct Mode does not execute asynchronous children. |
| GitHub remote | PUSH VERIFICATION PENDING | Tested implementation commit `d3d4b080abae4e8327e17203c3893f0f8574a330`; branch push has not yet been confirmed. `main` remains at baseline `4b446f04bb811c985230dee55b904e73412438b1`. |

Local Direct Mode exercises governance, allocation and refund authorization using deterministic fixtures; cross-contract views and child queues are stubbed. Those results are excluded from StudioNet proof. Update this record only with independently checked StudioNet transactions, parent/child receipt relationships, validator outcomes, and before/after contract balances.
