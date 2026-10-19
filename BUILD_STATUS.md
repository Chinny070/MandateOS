# Build status — 2026-10-19

Status is evidence-based. Local Direct Mode is not StudioNet validator consensus or a live transfer proof.

| Gate | State | Verified evidence / blocker |
|---|---|---|
| 0 — environment and baseline | PARTIAL | This implementation starts from repository `main` HEAD `4b446f04bb811c985230dee55b904e73412438b1` on development branch `codex/onchain-governance`. The recorded toolchain is Python 3.12.10, `genlayer-py` 0.16.3, `genlayer-test` 0.29.2, `genvm-linter` 0.11.1rc2. Python compilation, both contract lint runs, and all 68 local tests pass. Earlier read-only SDK transport verified chain ID `0xf22f` (61999); no deployment method was tested. |
| 1 — GEN custody and round trip | PARTIAL | Added authenticated finalized callbacks for vault funding and MandateOS refund receipt, plus explicit pending-transfer accounting and a read reconciliation step before `VERIFIED`. Seven Direct Mode tests cover parent/caller/value guards, duplicate callback, project binding, and zero-value checks. Added a receipt-state reducer that never retries and distinguishes child success/failure from independently verified balances. Direct Mode does not execute asynchronous child messages or receipt reconciliation. No live addresses, transaction IDs, child receipts, or balance evidence. |
| 2 — DAO mandates and risk | PARTIAL | MandateOS now stores member registry/weights, proposal snapshots and votes, voting and timelock deadlines, fixed quorum/approval rules, versioned bounded mandates, governance-approved vault registration, allocation commitment/exposure and liquid-reserve accounting, allocation challenges and DAO resolution, plus permissionless execution only after final authorization. `fund_project_vault` requires the exact authorized allocation, project and amount; the legacy administrator registration entry point reverts. Direct Mode tests execute the actual MandateOS authorization methods. Partial because membership removal/delegation and independently assessed native web eligibility are absent; admin-triggered refunds remain lab-only; Direct Mode fixtures supply vault identity and only observe child-message enqueueing. No validator consensus or live transfer has been verified. |
| 3 — evidence and consensus | PARTIAL | Added deterministic metadata/freshness validation and content digest helper with fail-closed URL, tier, clock, bounds and inconclusive-result checks. This does not fetch websites, attest publication dates, archive snapshots, or run native web rendering/validator consensus. |
| 4 — vault lifecycle | BLOCKED | Not implemented; only lab funding and parent-requested residual return scaffold exists. |
| 5 — keeper, dashboard, demonstrations | BLOCKED | Not implemented. |
| 6 — audit and release | BLOCKED | No release audit or live proof; earlier gates remain incomplete. |

## Verified local commands

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest tests/test_risk_model.py -q` — 22 passed.
- `python -m pytest tests/direct/test_gate1_direct.py tests/direct/test_governance_contract.py -q` — 13 passed at focused run (GenLayer Direct Mode).
- `python -m pytest tests/test_evidence_and_mandates.py -q` — 13 passed (deterministic local policy/evidence metadata tests).
- `python -m pytest tests/test_reconciler.py -q` — 12 passed (deterministic receipt-state reducer fixtures only).
- `python -m pytest tests/test_governance.py -q` — 8 passed (deterministic governance reference-model tests only).
- `python -m pytest -q` — 68 passed total (22 risk, 13 Direct Mode, 13 evidence/mandate, 12 reconciler, 8 governance).
- `genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `genvm-lint contracts/project_vault.py` — passed, 3 checks.

The linter must run with UTF-8 output on this Windows host (`$env:PYTHONIOENCODING='utf-8'`) to avoid a console encoding crash. `genlayer-test` reports its default localnet config; Direct Mode tests do not contact that RPC. The receipt reducer has no live RPC adapter. The prior read-only StudioNet chain ID probe returned `0xf22f`; there is no current deployment or transaction evidence. Direct Mode uses deterministic test clock/balance fixtures and stubs only cross-contract vault identity and child queue behavior; it is not validator consensus, real child execution, or settlement evidence.

## Delivery blockers

- Development branch `codex/onchain-governance` was created from `4b446f04bb811c985230dee55b904e73412438b1`. Changes are not yet committed/pushed. `main` is not modified by this work.
- No StudioNet wallet/faucet funding is available in this environment. No deployment, GEN movement, real transaction receipt, or balance claim is made.
- `CODEX_MASTER_PROMPT.md` describes desired follow-on product behavior. It does not make administrator-only lab transfer methods production authorization.

## Local milestone

- No development-branch commit recorded yet.
