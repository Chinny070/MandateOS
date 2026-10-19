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
| ProjectVault financing lifecycle | LOCAL IMPLEMENTATION ONLY | Governance-gated agreement setup, milestone evidence/challenges, payout reservations, repayment/revenue deposits, default handling and closure guards are covered by local Direct Mode tests. The current full local suite has 99 passing tests. No validator assessment, child transfer or financial settlement was executed. |
| EOA beneficiary payment path | IMPLEMENTED, NOT EXECUTED | The governed vault supports a fixed EOA destination through GenLayer's external finalized `emit_transfer`. Direct Mode does not execute EVM `EthSend`; the contract therefore refuses callbacks/reconciliation and retains pending/uncertain reservations. No EOA transfer hash or settlement proof exists. |
| Keeper RPC inspection | FIXTURE-TESTED, NOT CONNECTED | A read-only adapter is pinned to StudioNet chain ID `0xf22f` and reads GenLayer transaction receipt/lifecycle and EVM tx/receipt/balance fields. Deterministic adapter tests only; this turn did not query StudioNet. Parent-to-external EOA transaction linkage is absent from the documented receipt schemas, so the reducer returns `UNKNOWN`. |
| Governed distributions and closure | LOCAL IMPLEMENTATION ONLY | MandateOS proposals now route actual received principal/realized return back from ProjectVault and route agreement closure through a timelocked proposal plus vault state read-back. These were exercised with Direct Mode stubs; no live value transfer or close was performed. |
| GitHub remote | IMPLEMENTATION PUSH VERIFIED | Source/test commit `22d0d89de1ea0e56651764bd22c2b3d5a0006690` was pushed by fast-forward to `codex/onchain-governance` from baseline `e085583ef4ec4a6c2e4548b98968fb57c505f9a5`. Remote `main` remained `4b446f04bb811c985230dee55b904e73412438b1` at verification. A status-only follow-up records this proof; no StudioNet transaction was executed. |

Local Direct Mode exercises governance, allocation, refunds, IC-recipient callbacks, EOA authorization guards, distributions and agreement closure using deterministic fixtures; cross-contract views and child queues are stubbed, and external `EthSend` is unsupported. The RPC adapter tests use deterministic JSON-RPC responses. These results are excluded from StudioNet proof. Update this file only with independently checked StudioNet transactions, parent/child receipt relationships, validator outcomes, and before/after contract balances.
