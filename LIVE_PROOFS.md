# Live StudioNet proofs

**No deployment, wallet signature, contract write, or GEN transfer was performed for this preparation.** This log contains one read-only network identity observation. Test fixtures and local receipts are not live StudioNet proof.

| Proof item | Result | Evidence |
|---|---|---|
| StudioNet chain identity, raw JSON-RPC | READ-ONLY VERIFIED | 2026-10-19 `eth_chainId` at `https://studio.genlayer.com/api` returned `0xf22f` (61999) through an approved network-enabled execution path. |
| GenLayerJS 2.0.0-rc.1 connectivity | PARTIAL | The SDK's read-only `eth_chainId` returned `0xf22f`. Its `getCurrentFeePolicy()` then failed with JSON-RPC `-32601 Method not found: sim_getFeeConfig`. No account or signer was configured in that check. |
| Installed CLI fee estimator | BLOCKED | CLI `0.39.1`; read-only `genlayer estimate-fees --rpc https://studio.genlayer.com/api --json` returned `unknown command 'estimate-fees'`. |
| Fee estimate / measured deployment profile | NOT AVAILABLE | The RPC fee method is unsupported in this environment and installed `genlayer-test==0.29.2` exposes no `--fee-profile` pytest option. No estimate or profile was fabricated. |
| MandateOS Core / ProjectVault | NOT DEPLOYED | No deployment transaction ID, finalized receipt, address, source hash onchain, or live contract state exists. |
| Governance with two distinct wallets | NOT VERIFIED | No two real DAO member wallets are confirmed; no live vote/finalization/timelock run exists. |
| Validator evidence / Equivalence Principle | NOT VERIFIED | No live `gl.nondet.web` validator assessment or consensus receipt exists. |
| GEN deposit, funding, payout, refund, repayment or distribution | NOT EXECUTED | No transaction IDs, child execution results, finality or before/after balance records exist. |
| IC beneficiary payout | NOT VERIFIED LIVE | Authenticated callback/read-back path exists locally; no compatible deployed beneficiary IC or live payout cycle was tested. |
| EOA transfer linkage | UNAVAILABLE THROUGH INSPECTED API | Existing SDK triggered IDs cover internal message events; no causal external EOA transfer receipt is available. EOA payments remain unverified/value-at-risk, with no retry or admin override. |
| Beneficiary acknowledgment | LOCAL ONLY | Contract/UI record beneficiary-signed attestation separately from settlement state; no acknowledgment was signed live. |
| Keeper / dashboard | LOCAL ONLY | Tests and build only; no deployed contract data or live transaction history is configured. |
| Local checks | VERIFIED LOCALLY | 116 Python tests (39 Direct Mode subset), 12 frontend tests, 8 deployment-budget helper tests, Python compilation, both GenVM lints, typecheck and production build. See `BUILD_STATUS.md` for exact commands and the bundle warning. |
| Repository source | DEVELOPMENT BRANCH | `codex/onchain-governance`; this preparation began at `2a353b92668954f2c3526ec84957dc28ca4fe3ef`. The final committed HEAD will be recorded after push. |
| `main` | UNCHANGED | No merge or push to `main`. |

Do not treat read-only chain identity as proof of fee compatibility, validator execution, deployment, or settlement. Publish any later live result only with the actual finalized transaction ID, execution result, child records where supported, exact addresses/amounts, source hashes, fee details and independently read balances. EOA acknowledgment remains an attestation, not independent settlement evidence.
