# Build and deployment preparation status — 2026-10-19

**Branch:** `codex/onchain-governance` | **Starting commit:** `2a353b92668954f2c3526ec84957dc28ca4fe3ef` | **Release verdict:** **NO-GO for a controlled StudioNet deployment or any GEN transfer in the current toolchain. Production: NO-GO.**
**This turn:** no wallet signing, deployment, or GEN movement.

## What changed

- Pinned the dashboard to `genlayer-js@2.0.0-rc.1` and routed all four wallet write paths through one StudioNet chain check and fee submission helper. It carries the SDK's `messageAllocations` through unchanged and refuses to submit if a fee estimate fails or lacks required fields. It reports StudioNet's unsupported `sim_getFeeConfig` method directly and sends no transaction in that case.
- Read-only live integration identified that StudioNet chain identity works, but the SDK's fee-policy request fails because the RPC does not expose `sim_getFeeConfig` (`-32601 Method not found`). The GenLayer CLI is `0.39.1`; it has no `estimate-fees` command. No fee estimate is available, so the deployment script blocks.
- Added ordered Core then ProjectVault deployment automation using the current SDK, explicit chain ID and project ID checks, measured source-matched deploy fee profile, 10 GEN cumulative budget ledger, fee reservations, transaction journaling, finality and execution success checks, and no retry on unknown/failed outcomes. It will not run without separate user approval and a deployment-specific gate.
- Added an operational budget ledger for actual fees, committed fee quotes, actual test-value amounts, committed/unknown test value, unknown fee liabilities and remaining ceiling. The first financial verification value is capped at 0.01 GEN. Current actual/committed amounts are zero.
- Added two-wallet/governance and stop-condition analysis in [PREDEPLOYMENT_READINESS.md](docs/PREDEPLOYMENT_READINESS.md).

## Verification

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest -q` — **116 passed**.
- `python -m pytest tests/direct -q` — **39 passed** (subset of the full Python suite).
- `PYTHONIOENCODING=utf-8 genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `PYTHONIOENCODING=utf-8 genvm-lint contracts/project_vault.py` — passed, 3 checks.
- `cd web; npm test` — **12 passed** after final fee-path regression additions.
- `cd web; npm run typecheck` — passed.
- `cd web; npm run build` — passed; main chunk 865.67 kB minified / 206.72 kB gzip, non-blocking size warning.
- `node --check deploy/01_studionet.js`, `node --check scripts/deployment-safety.cjs`, and `node --test scripts/deployment-safety.test.cjs` — passed; 8 deployment-safety tests.
- `git diff --check` — passed after final implementation and documentation edits.
- Read-only raw RPC `eth_chainId` — `0xf22f` (61999).
- Read-only GenLayerJS RPC `eth_chainId` — `0xf22f`; `getCurrentFeePolicy()` failed with JSON-RPC `-32601`, `sim_getFeeConfig` not found.
- `genlayer estimate-fees --rpc https://studio.genlayer.com/api --json` — CLI error: unknown command `estimate-fees`.

Local Python/Direct Mode, lint, frontend and deployment-helper tests do not establish validator consensus, deployment, fee payment, child execution, GEN settlement, or wallet readiness. The ordinary sandbox environment reports `CODEX_SANDBOX_NETWORK_DISABLED=1`; the read-only RPC requests above used the approved network-enabled execution path. This is a sandbox boundary, not a StudioNet outage.

## Readiness

| Area | Status | Evidence / blocker |
|---|---|---|
| Contract regressions and static checks | PASS LOCALLY | 116 Python tests, including 39 Direct Mode; both contract lints. |
| Dashboard fee-aware writes | PARTIAL / FAIL CLOSED | Fee estimator and allocation wiring tested; current StudioNet RPC lacks the fee-policy method the pinned v2 release-candidate SDK requires, so writes do not submit. |
| Automated two-contract deployment | PREPARED, BLOCKED | Sequence and journal implemented; no compatible fee policy endpoint, no measured StudioNet fee profile, signer locked, and deployment not authorized. |
| Chain identity | READ-ONLY VERIFIED | Raw RPC and SDK return chain ID `0xf22f`; no state-changing call. |
| Signer | NOT READY | Existing configured account is encrypted and locked; no unlock was attempted. |
| Two genuine DAO wallets | NOT CONFIRMED | Local aliases do not prove two distinct user-controlled StudioNet wallets. |
| GEN budget | PREPARED, UNSPENT | 10 GEN ceiling; fees/value/liabilities/actual expenditure are zero. First test-value cap: 0.01 GEN. |
| Controlled demonstration | NO-GO CURRENTLY | Fee API/profile, signer, second member and live compatibility checks remain. |
| Production | NO-GO | EOA settlement linkage, IC beneficiary live test, live governance, evidence consensus, child failure recovery, independent security review and operational policies remain. |
| Main | UNCHANGED | No merge or write to `main`. |

See [LIVE_PROOFS.md](LIVE_PROOFS.md) for live versus local evidence, [PREDEPLOYMENT_READINESS.md](docs/PREDEPLOYMENT_READINESS.md) for the staged runbook and [TEST_MATRIX.md](docs/TEST_MATRIX.md) for the test evidence classes.
