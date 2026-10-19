# Build status — 2026-10-19

Status is evidence-based. Local Direct Mode is not StudioNet validator consensus or a live transfer proof.

| Gate | State | Verified evidence / blocker |
|---|---|---|
| 0 — environment and baseline | PARTIAL | Python 3.12.10, Node 24.14.0, npm 11.9.0, GenLayer CLI 0.39.1, `genlayer-py` 0.16.3, `genlayer-test` 0.29.2, `genvm-linter` 0.11.1rc2. Both contracts pass `genvm-lint` (3 checks each); Python syntax and local tests pass. Exact versions pinned in `requirements.txt` and `toolchain.json`. StudioNet RPC probe is blocked by the configured Codex sandbox (`CODEX_SANDBOX_NETWORK_DISABLED=1`, socket `WinError 10013`); this does not establish Windows host connectivity or indicate a StudioNet outage. Chain ID 61999 remains unverified. Local repository is initialized and the first commit is recorded below. |
| 1 — GEN custody and round trip | PARTIAL | Four GenLayer Direct Mode tests pass for admin guard, registration guard, parent authentication, project binding, duplicate allocation, zero-value receive and refund guard. These checks execute real contract code in the in-memory Direct Mode harness. Harness does not model finalized child message execution or receipt reconciliation. No live addresses, transaction IDs, or balance evidence; StudioNet access and faucet wallet are unavailable. |
| 2 — DAO mandates and risk | PARTIAL | Added immutable integer-only mandate/reference exposure evaluator with pending commitment and reserve checks. It is offchain reference code, not contract enforcement or member governance. Existing contract remains lab-only. |
| 3 — evidence and consensus | PARTIAL | Added deterministic metadata/freshness validation and content digest helper with fail-closed URL, tier, clock, bounds and inconclusive-result checks. This does not fetch websites, attest publication dates, archive snapshots, or run native web rendering/validator consensus. |
| 4 — vault lifecycle | BLOCKED | Not implemented; only lab funding and parent-requested residual return scaffold exists. |
| 5 — keeper, dashboard, demonstrations | BLOCKED | Not implemented. |
| 6 — audit and release | BLOCKED | No release audit or live proof; earlier gates remain incomplete. |

## Verified local commands

- `python -m compileall -q contracts reference` — passed.
- `python -m pytest tests/test_risk_model.py -q` — 22 passed.
- `python -m pytest tests/direct/test_gate1_direct.py -q` — 4 passed (GenLayer Direct Mode).
- `python -m pytest tests/test_evidence_and_mandates.py -q` — 13 passed (deterministic local policy/evidence metadata tests).
- `python -m pytest -q` — 39 passed total (26 existing baseline + 13 new local evidence/mandate checks).
- `genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `genvm-lint contracts/project_vault.py` — passed, 3 checks.

The linter must run with UTF-8 output on this Windows host (`$env:PYTHONIOENCODING='utf-8'`) to avoid a console encoding crash. `genlayer-test` defaults to localnet configuration but these Direct Mode tests do not contact that RPC. A live probe of `https://studio.genlayer.com/api` failed before receiving any HTTP/RPC response because outbound sockets are disabled.

## Delivery blockers

- The workspace had no `.git` metadata; a local `main` repository has now been initialized and `origin` configured as `https://github.com/Chinny070/MandateOS.git`. A read-only GitHub page inspection reported the authorized repository as empty on 2026-10-19; `git ls-remote origin HEAD refs/heads/main` could not connect to github.com:443, so Git refs and push permission could not be checked. A local root commit is recorded in Git. No push was attempted after the failed fetch.
- The network diagnostic is scoped to the Codex sandbox (`CODEX_SANDBOX_NETWORK_DISABLED=1` and socket `WinError 10013`). The Windows host network was not independently probed. No RPC response or chain ID was observed and no chain write was attempted; this is not evidence of a StudioNet outage.
- No StudioNet wallet/faucet funding is available in this environment. No deployment, GEN movement, real transaction receipt, or balance claim is made.
- `CODEX_MASTER_PROMPT.md` describes desired follow-on product behavior. It does not make administrator-only lab transfer methods production authorization.

## Local milestone

- Commit: `Add local evidence and mandate policy checks`. The root commit contains the supplied extracted starter and the changes recorded above. The working tree is clean after committing.
