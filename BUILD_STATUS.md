# Build status — 2026-10-19

**Verified implementation commit:** `61df489fac4ec6f39062d07592337c4f6d431a92` on `codex/onchain-governance`, based on reported branch commit `c2f8a53b9a16fc25f4cff0909497673f6f77fdb2`. The status/proof documentation update is a follow-up commit. `main` remains unchanged at `4b446f04bb811c985230dee55b904e73412438b1`.

| Gate / stage | State | Verified evidence and remaining work |
|---|---|---|
| Gate 0 — environment and local validation | PASS | Python compilation, full pytest, both GenVM lint runs, frontend typecheck/tests/build pass. Raw JSON-RPC and the installed GenLayerPY StudioNet client previously returned `0xf22f` (61999). The StudioNet check was read-only. |
| Gate 1 — custody and settlement | PARTIAL | Source audit found no demonstrated double-spend or authorization defect requiring a core ledger rewrite. Existing paths separate terms from actual received GEN, bind IDs/amounts/destinations, reserve pending value, and write state before finalized emissions. No live contract or transfer proof exists. EOA settlement remains unverified and production-disabled. |
| Gate 2 — governance and risk | PARTIAL | Existing governance/mandate/authorization implementation and Direct Mode regressions remain. New bounded indexes expose proposals and registered projects; Direct Mode covers current list views. Local test execution does not prove validator consensus. |
| Gate 3 — native evidence and consensus | PARTIAL | Evidence, provenance and freshness paths exist locally. No live validator assessment, Equivalence Principle judgment, or validator agreement has been verified. |
| Gate 4 — ProjectVault financing | PARTIAL | Agreement, milestone, challenge, payout, refund, repayment, return-distribution, default and closure paths remain. Local tests do not establish child finality or actual settlement. Vault indexes now expose bounded discovery for milestone, payout, refund, repayment, distribution and revenue records. |
| Stage 1 — GEN custody review | REVIEWED LOCALLY | Reviewed payable deposit/funding/repayment/revenue paths and milestone payout/refund/return-distribution paths against GenLayer's finalized-message model. No accounting or authorization defect was demonstrated in the reviewed code. Review is not a formal audit or live child execution proof. |
| Stage 2 — keeper | PARTIAL | Read-only, restart-safe SQLite observations, exact-intent reconciliation, internal child monitoring, balance samples, alerts and reports. It has no signer/spending key, arbitrary treasury authority, blind retry or write-based maintenance. EOA external settlement is not independently linked. |
| Stage 3 — dashboard | PARTIAL | Responsive React/TypeScript/Vite dashboard reads latest-final Core and vault contract state. It discovers the latest 30 proposals/projects and latest 20 records per vault category through bounded contract views; offers wallet-signed voting, milestone proposal and challenge forms; transaction inspection and keeper report import. It has no live deployment addresses and cannot establish EOA settlement. |
| Gate 6 — deployment readiness | BLOCKED | No deployment or full StudioNet fund-cycle proof. External EOA receipt linkage, live validator evidence, independent audit, live async failure/recovery and approved operational controls remain. |

## Verification results for implementation commit `61df489fac4ec6f39062d07592337c4f6d431a92`

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest -q` — **109 passed**.
- `genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `genvm-lint contracts/project_vault.py` — passed, 3 checks.
- `cd web; npm run typecheck` — passed.
- `cd web; npm test` — **4 passed**.
- `cd web; npm run build` — passed; Vite reports a non-blocking main-chunk warning (778.56 kB minified, 188.56 kB gzip).
- `git diff --check` — passed before commit.
- Secret-pattern scan of changed source/docs/tests/frontend — no credential patterns found.

The first GenVM lint invocation hit a Windows `cp1252` console encoding exception while printing a checkmark, not a contract lint failure. Rerunning both commands with `PYTHONIOENCODING=utf-8` produced three checks passed for each contract.

All Python and frontend tests are local. They do not submit to StudioNet. No local fixture, keeper report or dashboard index is live deployment/settlement evidence.

## Release blockers and next milestone

1. GenLayer or its RPC/SDK must expose independently checkable evidence linking a finalized parent payment intent to the exact successful external EOA transfer, destination and amount. Until then EOA settlement remains unavailable for production; no retry or operator override is allowed.
2. After explicit approval, execute and document a small IC-recipient StudioNet fund cycle, including exact parent/child IDs, finality, result and before/after balances; exercise failure, unknown and restart recovery.
3. Complete independent contract/security review and document membership, upgrade and incident procedures.
4. Verify the deployed dashboard against real finalized contract state; do not populate missing data with fixtures.

The deployment sequence and small-value verification runbook are in [docs/DEPLOYMENT_READINESS.md](docs/DEPLOYMENT_READINESS.md). They are not deployment authorization.
