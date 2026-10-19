# Build status — 2026-10-19

Status is evidence-based. Local Direct Mode is not StudioNet validator consensus or a live transfer proof.

| Gate | State | Verified evidence / blocker |
|---|---|---|
| 0 — environment and baseline | PARTIAL | Python 3.12.10, Node 24.14.0, npm 11.9.0, GenLayer CLI 0.39.1, `genlayer-py` 0.16.3, `genlayer-test` 0.29.2, `genvm-linter` 0.11.1rc2. Both contracts pass `genvm-lint` (3 checks each); Python syntax and local tests pass. Exact versions pinned in `requirements.txt` and `toolchain.json`. StudioNet RPC probe is blocked by the configured Codex sandbox (`CODEX_SANDBOX_NETWORK_DISABLED=1`, socket `WinError 10013`); this does not establish Windows host connectivity or indicate a StudioNet outage. Chain ID 61999 remains unverified. Local repository is initialized and the first commit is recorded below. |
| 1 — GEN custody and round trip | PARTIAL | Added authenticated finalized callbacks for vault funding and MandateOS refund receipt, plus explicit pending-transfer accounting and a read reconciliation step before `VERIFIED`. Seven Direct Mode tests cover parent/caller/value guards, duplicate callback, project binding, and zero-value checks. Added a receipt-state reducer that never retries and distinguishes child success/failure from independently verified balances. Direct Mode does not execute asynchronous child messages or receipt reconciliation. No live addresses, transaction IDs, child receipts, or balance evidence. |
| 2 — DAO mandates and risk | PARTIAL | Added immutable integer-only mandate/reference exposure evaluator with pending commitment and reserve checks. It is offchain reference code, not contract enforcement or member governance. Contract funding still uses a lab-only administrator. |
| 3 — evidence and consensus | PARTIAL | Added deterministic metadata/freshness validation and content digest helper with fail-closed URL, tier, clock, bounds and inconclusive-result checks. This does not fetch websites, attest publication dates, archive snapshots, or run native web rendering/validator consensus. |
| 4 — vault lifecycle | BLOCKED | Not implemented; only lab funding and parent-requested residual return scaffold exists. |
| 5 — keeper, dashboard, demonstrations | BLOCKED | Not implemented. |
| 6 — audit and release | BLOCKED | No release audit or live proof; earlier gates remain incomplete. |

## Verified local commands

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest tests/test_risk_model.py -q` — 22 passed.
- `python -m pytest tests/direct/test_gate1_direct.py -q` — 7 passed (GenLayer Direct Mode).
- `python -m pytest tests/test_evidence_and_mandates.py -q` — 13 passed (deterministic local policy/evidence metadata tests).
- `python -m pytest tests/test_reconciler.py -q` — 12 passed (deterministic receipt-state reducer fixtures only).
- `python -m pytest -q` — 54 passed total (22 risk, 7 Direct Mode, 13 evidence/mandate, 12 reconciler).
- `genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `genvm-lint contracts/project_vault.py` — passed, 3 checks.

The linter must run with UTF-8 output on this Windows host (`$env:PYTHONIOENCODING='utf-8'`) to avoid a console encoding crash. `genlayer-test` defaults to localnet configuration but Direct Mode tests do not contact that RPC. The receipt reducer consumes observations but no live RPC adapter has yet been implemented. A live probe of `https://studio.genlayer.com/api` failed before receiving any HTTP/RPC response because the Codex sandbox disables outbound sockets.

## Delivery blockers

- The workspace had no `.git` metadata; a local `main` repository has now been initialized and `origin` configured as `https://github.com/Chinny070/MandateOS.git`. A read-only GitHub page inspection reported the authorized repository as empty on 2026-10-19; `git ls-remote origin HEAD refs/heads/main` could not connect to github.com:443, so Git refs and push permission could not be checked. The GitHub connector currently reports `installed: false`; local `gh auth status` reports the active `Chinny070` account failed to log in. No push was attempted. Local commits remain available on `main`.
- The network diagnostic is scoped to the Codex sandbox (`CODEX_SANDBOX_NETWORK_DISABLED=1` and socket `WinError 10013`). The Windows host network was not independently probed. No RPC response or chain ID was observed and no chain write was attempted; this is not evidence of a StudioNet outage.
- No StudioNet wallet/faucet funding is available in this environment. No deployment, GEN movement, real transaction receipt, or balance claim is made.
- `CODEX_MASTER_PROMPT.md` describes desired follow-on product behavior. It does not make administrator-only lab transfer methods production authorization.

## Local milestone

- Local commits: `Add local evidence and mandate policy checks` (repository root plus evidence/mandate reference code) and `Track asynchronous vault settlement callbacks` (Gate 1 finality callbacks, receipt reducer, and tests). The working tree is clean after committing.
