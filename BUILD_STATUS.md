# Build status — 2026-10-19

Status is evidence-based. Local Direct Mode is not StudioNet validator consensus or a live transfer proof.

| Gate | State | Verified evidence / blocker |
|---|---|---|
| 0 — environment and baseline | PARTIAL | This work continues from development branch `codex/onchain-governance`, baseline HEAD `e085583ef4ec4a6c2e4548b98968fb57c505f9a5`, based on `main` commit `4b446f04bb811c985230dee55b904e73412438b1`. Recorded versions: Python 3.12.10, `genlayer-py` 0.16.3, `genlayer-test` 0.29.2 and `genvm-linter` 0.11.1rc2. Python compilation, both contract lint runs, and all 99 local tests pass for this implementation. No StudioNet request or deployment method was used this turn. |
| 1 — GEN custody and round trip | PARTIAL | Added authenticated finalized callbacks for vault funding and MandateOS refund receipt, plus explicit pending-transfer accounting and a read reconciliation step before `VERIFIED`. Seven Direct Mode tests cover parent/caller/value guards, duplicate callback, project binding, and zero-value checks. Added a receipt-state reducer that never retries and distinguishes child success/failure from independently verified balances. Direct Mode does not execute asynchronous child messages or receipt reconciliation. No live addresses, transaction IDs, child receipts, or balance evidence. |
| 2 — DAO mandates and risk | PARTIAL | MandateOS stores member/vote snapshots, quorum and approval rules, voting/timelock deadlines, bounded mandate versions, and governance-approved vault/source/refund decisions. Concurrent vault registrations are reserved by project ID and checked again at execution. Allocation exposure, liquid reserve, pending transfers and refund reservations are bounded. Challenges have permissionless expiry that only expires and releases reservations; it cannot authorize funding. Funding rechecks evidence digest/status/freshness, mandate version, and a bounded authorization deadline. Direct Mode tests execute these actual contract methods. Membership removal/delegation and identity resistance remain absent. |
| 3 — evidence and consensus | PARTIAL | Added permissionless `refresh_project_evidence` using `gl.nondet.web.get` and `gl.eq_principle.prompt_comparative`. A DAO proposal binds a bounded HTTPS URL and eligibility criteria to the registered project. The contract bounds response bodies, computes SHA-256, and records source URL/host, criteria, validator-compared eligibility/facts, claimed publication date, UTC assessment time, expiry, mandate version and an append-only versioned receipt. Comparator output now fails closed on malformed schema, types, status, digest, or length. Member registration digests remain separate. Direct Mode cannot run Equivalence Principle operations, so native validator execution, redirect/SSRF defenses, archived snapshots and StudioNet consensus remain unverified. |
| 4 — vault lifecycle | PARTIAL | Added governance-bound immutable beneficiary mode/address for IC or EOA payout. EOA uses the documented external finalized transfer mechanism; no callback can promote it, and timeout retains `VALUE_AT_RISK` with no retry. Added governed actual-repayment/principal/realized-return distributions to MandateOS and timelocked closure with vault preflight/read-back. Refund remains governed and closure requires refundable balance to be cleared. Per-installment tracking allocates received principal oldest-first. Direct Mode cannot execute external `EthSend`, asynchronous child messages, or prove settlement. |
| 5 — keeper, dashboard, demonstrations | PARTIAL | Added a read-only, StudioNet-pinned JSON-RPC adapter for chain identity, GenLayer receipt/lifecycle, EVM transaction/receipt, and EOA balance snapshots; strengthened the reducer to require matching sender, destination, amount and parent-child linkage before `VERIFIED`. The documented receipt schema does not expose the causal link from an external EOA transfer to its parent IC transaction, so EOA observations stay `UNKNOWN`. No RPC query was made; durable event archive, scheduling, alerts and frontend remain unimplemented. |
| 6 — audit and release | BLOCKED | No release audit or live proof; earlier gates remain incomplete. |

## Verified local commands

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest tests/test_risk_model.py -q` — 22 passed.
- `python -m pytest tests/test_evidence_and_mandates.py -q` — 13 passed (deterministic local policy/evidence metadata tests).
- `python -m pytest tests/test_governance.py -q` — 8 passed (deterministic governance reference-model tests only).
- `python -m pytest tests/direct -q` — 33 passed (Direct Mode; local contract execution, not validator consensus).
- `python -m pytest tests/test_reconciler.py -q` — 17 passed (fixture-only fail-closed receipt reducer).
- `python -m pytest tests/test_studionet_rpc.py -q` — 6 passed (fixture-only RPC adapter schema tests; no StudioNet calls).
- `python -m pytest -q` — 99 passed total (22 risk, 33 Direct Mode, 13 evidence/mandate, 17 reconciler, 8 governance reference model, 6 StudioNet RPC adapter fixtures).
- `genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `genvm-lint contracts/project_vault.py` — passed, 3 checks.

The linter must run with UTF-8 output on this Windows host (`$env:PYTHONIOENCODING='utf-8'`) to avoid a console encoding crash. `genlayer-test` reports its default localnet config; Direct Mode tests do not contact that RPC and its WASI runner rejects Equivalence Principle / nondeterministic blocks and external EVM `EthSend`. The read-only RPC adapter has only been fixture-tested. The previous read-only StudioNet chain ID probe returned `0xf22f`; no deployment, live validator decision, transaction, or balance evidence exists. Direct Mode uses deterministic fixtures and stubs cross-contract views/child queues; it is not validator consensus, real child execution, or settlement evidence.

## Delivery blockers

- Verified implementation commit `22d0d89de1ea0e56651764bd22c2b3d5a0006690` is pushed to `origin/codex/onchain-governance` as a fast-forward from `e085583ef4ec4a6c2e4548b98968fb57c505f9a5`. Remote `main` remains `4b446f04bb811c985230dee55b904e73412438b1`. This status-only follow-up records the verified source commit; its own commit is the branch's final documentation head.
- No StudioNet wallet/faucet funding is available in this environment. No deployment, GEN movement, real transaction receipt, or balance claim is made.
- `CODEX_MASTER_PROMPT.md` describes desired follow-on product behavior. It does not make administrator-only lab transfer methods production authorization.

## Local milestone

- Latest local verification: 99 passed, Python compilation passed, and both contract lint runs passed. Source/test commit `22d0d89de1ea0e56651764bd22c2b3d5a0006690` is the verified implementation pushed to GitHub. This status-only follow-up does not change tested source.
