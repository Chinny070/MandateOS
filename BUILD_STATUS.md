# Build status — 2026-10-19

Status is evidence-based. Local Direct Mode is not StudioNet validator consensus or a live transfer proof.

| Gate | State | Verified evidence / blocker |
|---|---|---|
| 0 — environment and baseline | PARTIAL | This work continues from development branch `codex/onchain-governance`, based on `main` commit `4b446f04bb811c985230dee55b904e73412438b1`. Recorded versions: Python 3.12.10, `genlayer-py` 0.16.3, `genlayer-test` 0.29.2 and `genvm-linter` 0.11.1rc2. Python compilation, both contract lint runs, and all 84 local tests pass at implementation commit `acfd17c801b1e4f3ebe9c7ff83e080a53aa247b0`. The prior read-only RPC diagnostic had transport-dependent results (Node.js/PowerShell returned `0xf22f`; Python HTTPS returned HTTP 403); this turn sent no RPC request and no deployment method was tested. |
| 1 — GEN custody and round trip | PARTIAL | Added authenticated finalized callbacks for vault funding and MandateOS refund receipt, plus explicit pending-transfer accounting and a read reconciliation step before `VERIFIED`. Seven Direct Mode tests cover parent/caller/value guards, duplicate callback, project binding, and zero-value checks. Added a receipt-state reducer that never retries and distinguishes child success/failure from independently verified balances. Direct Mode does not execute asynchronous child messages or receipt reconciliation. No live addresses, transaction IDs, child receipts, or balance evidence. |
| 2 — DAO mandates and risk | PARTIAL | MandateOS stores member/vote snapshots, quorum and approval rules, voting/timelock deadlines, bounded mandate versions, and governance-approved vault/source/refund decisions. Concurrent vault registrations are reserved by project ID and checked again at execution. Allocation exposure, liquid reserve, pending transfers and refund reservations are bounded. Challenges have permissionless expiry that only expires and releases reservations; it cannot authorize funding. Funding rechecks evidence digest/status/freshness, mandate version, and a bounded authorization deadline. Direct Mode tests execute these actual contract methods. Membership removal/delegation and identity resistance remain absent. |
| 3 — evidence and consensus | PARTIAL | Added permissionless `refresh_project_evidence` using `gl.nondet.web.get` and `gl.eq_principle.prompt_comparative`. A DAO proposal binds a bounded HTTPS URL and eligibility criteria to the registered project. The contract bounds response bodies, computes SHA-256, and records source URL/host, criteria, validator-compared eligibility/facts, claimed publication date, UTC assessment time, expiry, mandate version and an append-only versioned receipt. Comparator output now fails closed on malformed schema, types, status, digest, or length. Member registration digests remain separate. Direct Mode cannot run Equivalence Principle operations, so native validator execution, redirect/SSRF defenses, archived snapshots and StudioNet consensus remain unverified. |
| 4 — vault lifecycle | PARTIAL | Added governance-proposed, parent-bound GRANT/REPAYABLE/REVENUE_SHARE agreements, milestone definitions and dispute resolutions. ProjectVault has operator evidence submission, native web/EP assessment, freshness-bounded challenge/finalization, permissionless non-authorizing expiry, unique authorized payouts with pending/uncertain/child-success/reconciled states, native GEN repayment deposits, installment obligations, revenue reporting/deposits, bounded default challenges, and guarded agreement closure. MandateOS reconciles agreement and milestone setup and routes member challenges/resolutions through timelocked governance. Direct Mode verifies authorization/state guards and accounting logic but cannot run EP, execute asynchronous child transactions, prove payout settlement, or verify live balances. Installment schedule enforcement is principal-level; per-installment receipt/payment tracking, payout failure proof/recovery, all agreement closure/refund governance paths, and a governed distribution of realized excess returns remain incomplete. |
| 5 — keeper, dashboard, demonstrations | BLOCKED | Not implemented. |
| 6 — audit and release | BLOCKED | No release audit or live proof; earlier gates remain incomplete. |

## Verified local commands

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest tests/test_risk_model.py -q` — 22 passed.
- `python -m pytest tests/test_evidence_and_mandates.py -q` — 13 passed (deterministic local policy/evidence metadata tests).
- `python -m pytest tests/test_reconciler.py -q` — 12 passed (deterministic receipt-state reducer fixtures only).
- `python -m pytest tests/test_governance.py -q` — 8 passed (deterministic governance reference-model tests only).
- `python -m pytest tests/direct -q` — 29 passed (GenLayer Direct Mode; local contract execution, not validator consensus; includes 8 ProjectVault lifecycle tests and governance-to-vault integration).
- `python -m pytest -q` — 84 passed total (22 risk, 29 Direct Mode, 13 evidence/mandate, 12 reconciler, 8 governance).
- `genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `genvm-lint contracts/project_vault.py` — passed, 3 checks.

The linter must run with UTF-8 output on this Windows host (`$env:PYTHONIOENCODING='utf-8'`) to avoid a console encoding crash. `genlayer-test` reports its default localnet config; Direct Mode tests do not contact that RPC and its WASI runner rejects Equivalence Principle / nondeterministic blocks. The receipt reducer has no live RPC adapter. The earlier read-only StudioNet chain ID probe returned `0xf22f`; no deployment, live validator decision, transaction, or balance evidence exists. Direct Mode uses deterministic test fixtures and stubs cross-contract views/child queues; it is not validator consensus, real child execution, or settlement evidence.

## Delivery blockers

- The current development branch is `codex/onchain-governance`; verified implementation commit `acfd17c801b1e4f3ebe9c7ff83e080a53aa247b0` was pushed and read back from GitHub. At verification, remote branch HEAD was that SHA and `main` remained `4b446f04bb811c985230dee55b904e73412438b1`.
- No StudioNet wallet/faucet funding is available in this environment. No deployment, GEN movement, real transaction receipt, or balance claim is made.
- `CODEX_MASTER_PROMPT.md` describes desired follow-on product behavior. It does not make administrator-only lab transfer methods production authorization.

## Local milestone

- Latest verified implementation: `acfd17c801b1e4f3ebe9c7ff83e080a53aa247b0` (`Implement governed ProjectVault financing lifecycle`), pushed to `origin/codex/onchain-governance`; remote SHA and unchanged `main` were verified with `git ls-remote`.
