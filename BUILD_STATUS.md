# Build and deployment preparation status — 2026-10-19

**Branch:** `codex/onchain-governance` | **Starting HEAD:** `60c4d84b83da4958463c79d95611ac483fe9e142` | **Verified implementation commit:** `dd51811fa9d3a5c51a93890621d2fc545171a256`. `main` remains unchanged.
**Verdicts:** **CONDITIONAL GO for an explicitly authorized, deployment-only StudioNet demonstration. NO-GO for a financial test or production.**
**This task:** no MandateOS deployment, wallet unlock, transaction signature, contract write, or GEN transfer.

## Implementation

- Inspected SpecLock's actual deployment record, CLI notes, constructor-argument failure analysis, live receipts and withdrawal evidence. A read-only lookup of SpecLock's deployment returned `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS`, and the expected contract address. Its EVM receipt was successful, with 8,000,000 gas and zero effective gas price for that exact transaction.
- Replaced the MandateOS deployment's GenLayerJS 2.0.0-rc.1 fee-policy dependency with the installed GenLayer CLI 0.39.1 script runner and its bundled GenLayerJS 1.1.8. This route is confirmed by the successful SpecLock transaction. The direct CLI `--contract` path only waits for `ACCEPTED`; the MandateOS wrapper instead calls the ordered `deploy/*.js` runner and polls `FINALIZED`.
- Core is deployed first with `args: []`. ProjectVault receives `[coreAddress, exactProjectIdString]`. This avoids CLI shell parsing that converts digit-only strings to numbers and avoids the documented mistake of passing `--args '[]'` as one constructor argument.
- The script checks the existing active alias, configured StudioNet, chain ID, clean development branch/worktree, explicit authorization, source hashes and 10 GEN budget. It rejects the legacy SDK's gas-estimation fallback, checks every signed request's actual gas limit and price before signing, blocks nonzero deployment value or a wrong destination, and records the per-transaction fee cap. It then requires finalized majority agreement, leader execution success, deployed address, and a matching successful EVM receipt. Unknown outcomes preserve the journal and budget liability; no blind retries are allowed.
- The deployment budget remains 10 GEN maximum; current actual/committed expenditure is 0. The first financial test value remains capped at 0.01 GEN and is not part of the deployment script.
- SpecLock's finalized parent exposes a triggered child ID. The child receipt identifies the exact sender, recipient, amount, `FINALIZED` status and `value_credited: true`, despite result label `NO_MAJORITY`; SpecLock separately records a matching beneficiary balance delta. This is reusable receipt evidence. MandateOS's keeper does not yet consume this path, and MandateOS has not paid a beneficiary; EOA settlement stays unverified.

## Verification

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest -q` — **116 passed**.
- `python -m pytest tests/direct -q` — **39 passed**.
- Core GenVM `check` — passed, 3 checks; `validate` — passed, 58 methods (20 views, 38 writes).
- ProjectVault GenVM `check` — passed, 3 checks; `validate` — passed, 64 methods (35 views, 29 writes).
- `cd web; npm test` — **12 passed**; `npm run typecheck` — passed; `npm run build` — passed. Main JS chunk: 865.67 kB minified / 206.72 kB gzip, non-blocking Vite size warning.
- `node --check deploy/01_studionet.js` and `node --check deploy/cli-deployment.cjs` — passed.
- `node --test scripts/deployment-runner.test.cjs scripts/cli-deployment.test.cjs scripts/deployment-safety.test.cjs` — **13 passed**, including isolated temp-repository dry runs of Core→Vault journaling, exact constructor strings, finalized receipt/fee processing and refusal of the SDK gas fallback before signing. The dry run uses a fixture signer only and does not access StudioNet or represent live proof.
- PowerShell parser check for `scripts/deploy-studionet.ps1` — passed. Toolchain JSON parsing and `git diff --check` — passed.
- CLI read-only checks: version `0.39.1`; bundled SDK `1.1.8`; network `studionet`, chain `61999`, RPC `https://studio.genlayer.com/api`; active account alias `my-studionet-wallet`.
- StudioNet read-only checks: `eth_chainId=0xf22f`, current `eth_gasPrice=0x0`. These do not estimate future MandateOS fees. The GenLayerJS v2 `sim_getFeeConfig` method remains unsupported and CLI 0.39.1 has no `estimate-fees` command.
- GenVM lint attempted its remote version check and received Windows `WinError 10013`; both lint and validation completed successfully from the locally cached runner. This is a host socket restriction, not evidence of StudioNet failure.

The script was not run against MandateOS because deployment, wallet unlock and signing were expressly prohibited. Local tests and SpecLock's separate live deployment are not MandateOS validator or financial proof.

## Readiness and blockers

| Area | Status | Evidence / limitation |
|---|---|---|
| MandateOS deployment method | PREPARED / LOCALLY VERIFIED | CLI script runner, typed constructor values, ordered Core→Vault, finalized receipt check, actual EVM fee reconciliation, journal and no-retry guard. Not live-executed for MandateOS. |
| Current EVM deployment fee | OBSERVED, NOT FORECAST | SpecLock transaction effective gas price 0; current StudioNet `eth_gasPrice` 0. A fresh signed gas cap and actual receipt will be recorded at an authorized run. |
| Other protocol or child-message fees | NOT VERIFIED FOR FINANCIAL WRITES | Installed legacy CLI deploy route has no v0.6 GenVM fee preset. It is proven for SpecLock deployment, not for MandateOS financing/emitted messages. Dashboard v2 fee writes remain fail-closed. |
| Signer | CONFIGURED, LOCKED / NOT UNLOCKED | Active alias confirmed; local encrypted key remains locked per prior safe inspection. The CLI will prompt locally only after authorization. |
| Two genuine DAO wallets | NOT CONFIRMED | No distinct second genuine signer has been confirmed. Required before sensitive governance and finance. |
| EOA payout reconciliation | REUSABLE PROTOCOL EVIDENCE; MandateOS ADAPTER NOT IMPLEMENTED | SpecLock proves triggered-child IDs and a value-credited EOA transfer. MandateOS keeper still reports EOA payment as unverified. |
| First 0.01 GEN value transfer | NOT AUTHORIZED / NOT EXECUTED | Separate approval required. |
| Financial demonstration | NO-GO | Two real wallets, dashboard fee-compatible writes and MandateOS child receipt reconciliation are outstanding. |
| Production | NO-GO | No MandateOS live deployment, live governance/financing, IC beneficiary payout, validator-backed evidence, child-failure recovery, or independent audit. |
| Main | UNCHANGED | No merge or push to `main`. |

## Final repository revision

- Development branch: `codex/onchain-governance`.
- Verified implementation commit: `dd51811fa9d3a5c51a93890621d2fc545171a256`.
- The final GitHub branch tip is reported from the post-push remote check; the status document is committed as part of this release sequence.

See [LIVE_PROOFS.md](LIVE_PROOFS.md), [PREDEPLOYMENT_READINESS.md](docs/PREDEPLOYMENT_READINESS.md), and [TEST_MATRIX.md](docs/TEST_MATRIX.md) for the external reference evidence, exact run sequence and evidence classes.
