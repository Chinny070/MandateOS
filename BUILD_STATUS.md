# Build status — 2026-10-19

**Verified implementation commit:** `71c9bc7287f3986ae6f1675d9e0f2d1d8648da8a` on `codex/onchain-governance`, based on previously verified branch commit `799be9f09fa08681732db74a1e18c39aa7db5a2f`. This update records a wallet-authenticated EOA beneficiary acknowledgment as a separate attestation. `main` remains unchanged at `4b446f04bb811c985230dee55b904e73412438b1`.

| Gate / stage | State | Verified evidence and remaining work |
|---|---|---|
| Gate 0 — environment and local validation | PASS | Python compilation, full pytest, both GenVM lint runs, frontend typecheck/tests/build pass. Raw JSON-RPC and the installed GenLayerPY StudioNet client previously returned `0xf22f` (61999). The StudioNet check was read-only. |
| Gate 1 — custody and settlement | PARTIAL | Source audit found no demonstrated double-spend or authorization defect requiring a core ledger rewrite. EOA beneficiaries can now sign an acknowledgment bound to ProjectVault, project, payment ID, expected recipient and exact amount. It is stored separately and does not change payout state, reservation, unsettled count, refund/closure rights or finance accounting. No live contract, acknowledgment, or transfer proof exists. EOA settlement remains unverified and production-disabled. |
| Gate 2 — governance and risk | PARTIAL | Existing governance/mandate/authorization implementation and Direct Mode regressions remain. New bounded indexes expose proposals and registered projects; Direct Mode covers current list views. Local test execution does not prove validator consensus. |
| Gate 3 — native evidence and consensus | PARTIAL | Evidence, provenance and freshness paths exist locally. No live validator assessment, Equivalence Principle judgment, or validator agreement has been verified. |
| Gate 4 — ProjectVault financing | PARTIAL | Agreement, milestone, challenge, payout, refund, repayment, return-distribution, default and closure paths remain. Local tests do not establish child finality or actual settlement. Vault indexes now expose bounded discovery for milestone, payout, refund, repayment, distribution and revenue records. |
| Stage 1 — GEN custody review | REVIEWED LOCALLY | Reviewed payable deposit/funding/repayment/revenue paths and milestone payout/refund/return-distribution paths against GenLayer's finalized-message model. No accounting or authorization defect was demonstrated in the reviewed code. Review is not a formal audit or live child execution proof. |
| Stage 2 — keeper | PARTIAL | Read-only, restart-safe SQLite observations, exact-intent reconciliation, internal child monitoring, balance samples, alerts and reports. For EOA watches it archives the ProjectVault acknowledgment view in a `BENEFICIARY_ATTESTATION` audit event, while leaving transfer state `UNKNOWN`. It has no signer/spending key, arbitrary treasury authority, blind retry or write-based maintenance. |
| Stage 3 — dashboard | PARTIAL | Responsive React/TypeScript/Vite dashboard reads latest-final Core and vault state. It discovers bounded recent records and offers wallet-signed voting, milestone proposal, challenge, and now **Confirm GEN Received** for an initiated EOA payout. The acknowledgment form requires matching StudioNet account and payout details, waits for transaction finality, then reads the latest-final record. It labels acknowledgment separately from settlement, which remains unverified. |
| Gate 6 — deployment readiness | BLOCKED | No deployment or full StudioNet fund-cycle proof. External EOA receipt linkage, live validator evidence, independent audit, live async failure/recovery and approved operational controls remain. |

## Verification results for implementation commit `71c9bc7287f3986ae6f1675d9e0f2d1d8648da8a`

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest -q` — **114 passed** (109-test baseline retained and 5 new acknowledgment/keeper regression cases).
- `genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `genvm-lint contracts/project_vault.py` — passed, 3 checks.
- `cd web; npm run typecheck` — passed.
- `cd web; npm test` — **6 passed** (4 existing tests retained and 2 acknowledgment state tests).
- `cd web; npm run build` — passed; Vite reports a non-blocking main-chunk warning (785.85 kB minified, 190.38 kB gzip).
- `git diff --check` — passed before commit.
- Secret-pattern scan of changed source/docs/tests/frontend — no credential patterns found.

Both GenVM lints passed with `PYTHONIOENCODING=utf-8` (3 checks each). The Windows default `cp1252` console cannot print the linter's checkmark; this is a console encoding issue, not a contract lint failure.

All Python and frontend tests are local. They do not submit to StudioNet. The EOA acknowledgment and keeper report coverage are local Direct Mode/adapter tests, not a live beneficiary transaction. No local fixture, keeper report or dashboard index is live deployment/settlement evidence.

## Release blockers and next milestone

1. GenLayer or its RPC/SDK must expose independently checkable evidence linking a finalized parent payment intent to the exact successful external EOA transfer, destination and amount. Until then EOA settlement remains unavailable for production; no retry or operator override is allowed.
2. After explicit approval, execute and document a small IC-recipient StudioNet fund cycle, including exact parent/child IDs, finality, result and before/after balances; exercise failure, unknown and restart recovery.
3. Complete independent contract/security review and document membership, upgrade and incident procedures.
4. Verify the deployed dashboard against real finalized contract state; do not populate missing data with fixtures.

The deployment sequence and small-value verification runbook are in [docs/DEPLOYMENT_READINESS.md](docs/DEPLOYMENT_READINESS.md). They are not deployment authorization.
