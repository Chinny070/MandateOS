# Build status — 2026-10-19

**Audit branch:** `codex/onchain-governance`; work started from `729f53ba809d16a4c5d7e5f0e082fd5d0cfdad8d`. The branch HEAD is the authoritative source for this report. `main` was not modified.

**Release verdict: NO-GO for deployment or GEN movement.** Local checks pass, but StudioNet validator execution, fee allocation, and real child settlement have not been verified; EOA external settlement remains unprovable through the supported receipt interface. No deployment, transaction signing, or GEN transfer was performed.

| Area | State | Evidence and remaining work |
|---|---|---|
| Local build and regressions | PASS | 116 Python tests; 7 frontend tests; Python compilation; two GenVM lint runs (3 checks each); frontend typecheck and production build pass. |
| Governance | PARTIAL | Direct Mode tests cover snapshots, voting, quorum, timelocks and now reject sensitive solo-member proposals. There is no live two-wallet governance run. |
| Cross-contract funding and escrow | PARTIAL | Source and Direct Mode accounting checks cover reservations, unique IDs, authentication and state-before-emission. Live value-bearing child behavior, failure recovery and balances are unverified. |
| Milestone challenges | HARDENED LOCALLY | Challenge now authenticates the EOA and current Core membership and transitions the vault atomically. The former asynchronous Core wrapper reverts. Direct Mode regression closes the demonstrated payout race. |
| Evidence assessment | PARTIAL | Schema checks now reject impossible ISO publication dates. Live `gl.nondet.web` and Equivalence Principle consensus, redirects/DNS defenses, snapshots and contradictory-source behavior remain unverified or incomplete. |
| Fees and SDK | NOT VERIFIED LIVE | Frontend uses GenLayerJS dynamic fee estimation and submits `distribution` plus `feeValue`; no StudioNet transaction or measured fee/profile verification was performed. The local GenLayer CLI executable is unavailable. |
| IC payout | PARTIAL | Authenticated receipt/read-back path exists; no live compatible beneficiary IC or child settlement has been exercised. |
| EOA payout | BLOCKED | Beneficiary acknowledgment is a separate attestation. Supported APIs do not establish a causal external transfer receipt; status remains UNKNOWN/value-at-risk, with no retry or override. |
| Keeper and dashboard | PARTIAL | Keeper remains read-only/noncustodial. Dashboard rejects stale async reads after key changes and rechecks active account and chain before writes. Both remain local because no contract deployment exists. |
| StudioNet | READ-ONLY IDENTITY CHECK ONLY | Previously verified endpoint chain ID `0xf22f` (61999); this audit did not submit contract or financial transactions. |

## Commands and results

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest -q` — **116 passed**.
- `PYTHONIOENCODING=utf-8 genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `PYTHONIOENCODING=utf-8 genvm-lint contracts/project_vault.py` — passed, 3 checks.
- `cd web; npm test` — **7 passed**.
- `cd web; npm run typecheck` — passed.
- `cd web; npm run build` — passed; Vite reports a non-blocking main chunk of 786.97 kB minified (190.63 kB gzip).
- `git diff --check` — passed before documentation updates; rerun before commit.

Local tests and Direct Mode do not prove validator agreement, deployment, child finality, GEN settlement, or live wallet governance. See [docs/RELEASE_READINESS_AUDIT.md](docs/RELEASE_READINESS_AUDIT.md), [docs/DEPLOYMENT_READINESS.md](docs/DEPLOYMENT_READINESS.md), and [LIVE_PROOFS.md](LIVE_PROOFS.md).
