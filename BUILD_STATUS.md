# Build status — 2026-10-19

Status is evidence-based. Local Direct Mode is not StudioNet validator consensus or a live transfer proof.

| Gate | State | Verified evidence / blocker |
|---|---|---|
| 0 — environment and baseline | PARTIAL | Current checkout is Windows, Python 3.12.10, Node 24.14.0, npm 11.9.0; Python packages are `genlayer-py` 0.16.3, `genlayer-test` 0.29.2, and `genvm-linter` 0.11.1rc2. `genlayer` CLI executable is not found on this execution environment's PATH, so CLI deployment is unavailable here. Python SDK-level direct JSON-RPC and Node `fetch` probes both fail before an RPC response (`WinError 10013` / `EACCES`); `CODEX_SANDBOX_NETWORK_DISABLED=1`. The earlier separate diagnostic reported successful Node/PowerShell RPC, but it does not establish connectivity for this checkout's process. StudioNet chain ID is unverified in this execution environment. Both contracts pass lint (3 checks each), Python compilation and all 62 local tests pass. |
| 1 — GEN custody and round trip | PARTIAL | Added authenticated finalized callbacks for vault funding and MandateOS refund receipt, plus explicit pending-transfer accounting and a read reconciliation step before `VERIFIED`. Seven Direct Mode tests cover parent/caller/value guards, duplicate callback, project binding, and zero-value checks. Added a receipt-state reducer that never retries and distinguishes child success/failure from independently verified balances. Direct Mode does not execute asynchronous child messages or receipt reconciliation. No live addresses, transaction IDs, child receipts, or balance evidence. |
| 2 — DAO mandates and risk | PARTIAL | Added immutable integer-only mandate/exposure reference checks and deterministic governance reference lifecycle: membership weight snapshot, one vote per member, UTC voting deadline, quorum/approval result, and execution timelock. Eight new local tests cover these rules. These remain offchain reference code, not contract enforcement or member-governed authorization. Contract funding still uses a lab-only administrator. |
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
- `python -m pytest tests/test_governance.py -q` — 8 passed (deterministic governance reference-model tests only).
- `python -m pytest -q` — 62 passed total (22 risk, 7 Direct Mode, 13 evidence/mandate, 12 reconciler, 8 governance).
- `genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `genvm-lint contracts/project_vault.py` — passed, 3 checks.

The linter must run with UTF-8 output on this Windows host (`$env:PYTHONIOENCODING='utf-8'`) to avoid a console encoding crash. `genlayer-test` defaults to localnet configuration but Direct Mode tests do not contact that RPC. The receipt reducer consumes observations but no live RPC adapter has yet been implemented. In this execution, Python's JSON-RPC request failed with `WinError 10013`, Node's `fetch` failed with `EACCES`, and `CODEX_SANDBOX_NETWORK_DISABLED=1`; no chain ID was received. This is a local process/network restriction, not a StudioNet outage result.

## Delivery blockers

- GitHub connector confirms `main` at `bdff1703fab7340e6476576bbf8904b3a0d7ea6b`, matching local `HEAD`. The tested governance reference milestone was pushed with a normal fast-forward update; no force push was used.
- The network diagnostic is scoped to this execution environment (`CODEX_SANDBOX_NETWORK_DISABLED=1`, Python `WinError 10013`, Node `EACCES`). No RPC response or chain ID was observed and no chain write was attempted; this is not evidence of a StudioNet outage. A separate earlier diagnostic's successful Node/PowerShell request is a distinct environment observation, not current SDK proof.
- No StudioNet wallet/faucet funding is available in this environment. No deployment, GEN movement, real transaction receipt, or balance claim is made.
- `CODEX_MASTER_PROMPT.md` describes desired follow-on product behavior. It does not make administrator-only lab transfer methods production authorization.

## Local milestone

- Current pushed milestone: `bdff1703fab7340e6476576bbf8904b3a0d7ea6b` (`Add deterministic governance reference model`).
