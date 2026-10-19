# Live StudioNet proofs

**This audit performed no deployment, wallet signing, contract write, or GEN transfer.** All newly reported test results are local. Direct Mode, fixtures, keeper archives and dashboard views are not live StudioNet evidence.

| Proof item | Result | Evidence |
|---|---|---|
| StudioNet chain identity | READ-ONLY VERIFIED EARLIER | A raw `eth_chainId` query to `https://studio.genlayer.com/api` returned `0xf22f` (61999) on 2026-10-19. This establishes chain identity only. |
| SDK/CLI deployment and fee path | NOT VERIFIED | No deployment/write call was sent. The local `genlayer` CLI executable is unavailable. GenLayerJS estimation is implemented in the dashboard, but actual fee distribution, message fees and finalization have not been measured on StudioNet. |
| MandateOS Core / ProjectVault | NOT DEPLOYED | No deployed addresses, source/code hashes, constructor receipts or live state reads exist. |
| Governance with two real wallets | NOT VERIFIED | Local tests exercise governance and two-member authorization; there is no live two-wallet vote/finalization/timelock run. |
| Validator evidence / Equivalence Principle | NOT VERIFIED | No live `gl.nondet.web` validator judgment or consensus receipt was produced. |
| GEN deposits, funding, payouts, refunds, repayments or distributions | NOT EXECUTED | No transaction IDs, child execution result, finality, or before/after balances exist. |
| IC-beneficiary payout | NOT VERIFIED LIVE | The code path and Direct Mode checks exist. No compatible deployed beneficiary IC or live payout/read-back cycle was used. |
| EOA transfer linkage | UNAVAILABLE THROUGH INSPECTED API | The documented triggered-transaction APIs expose internal IC message processing; this audit found no supported causal receipt proving an external EOA value transfer's relationship to its finalized parent intent. Amount/address/time matching is insufficient. |
| EOA beneficiary acknowledgment | LOCAL ONLY | Contract and UI record a beneficiary-signed attestation separately from payout status. It does not release reservations or prove independent settlement. No acknowledgment was signed live. |
| Keeper and dashboard | LOCAL ONLY | Regression/build checks passed; no deployed contract state or live transaction history is configured. |
| Audit working-tree checks | PASSED LOCALLY | 116 Python tests, 7 frontend tests, Python compilation, both GenVM lints (3 checks each), typecheck and production build. See `BUILD_STATUS.md` for commands and the bundle warning. |
| Current audit source | DEVELOPMENT BRANCH | `codex/onchain-governance`, starting from `729f53ba809d16a4c5d7e5f0e082fd5d0cfdad8d`. GitHub's branch HEAD identifies the reviewed source; this does not provide live execution evidence. |
| `main` | UNCHANGED | No merge or push to `main` was performed. |

Do not use this file as proof of deployment or settlement. Publish a live result only with actual finalized transaction IDs, parent/child receipts where available, execution status, exact source/destination/amount and independently read balances. EOA acknowledgment remains an attestation and is not a substitute for external-transfer settlement evidence.
