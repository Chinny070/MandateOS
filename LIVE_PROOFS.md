# Live StudioNet proofs

**No MandateOS deployment, wallet unlock/signature, contract write, or GEN transfer was performed for this preparation.** Read-only observations include StudioNet and the already-deployed SpecLock reference contract. SpecLock is not MandateOS proof. Test fixtures and local receipts are not live StudioNet proof.

| Proof item | Result | Evidence |
|---|---|---|
| StudioNet chain identity | READ-ONLY VERIFIED | `eth_chainId` returned `0xf22f` (61999); the same endpoint returned `eth_gasPrice=0x0` at the time checked. This is not a future fee guarantee. |
| SpecLock deployment | EXTERNAL REFERENCE VERIFIED | Read-only CLI receipt for `0x6505c1e2602432706a9e40d258ae53b1d514e4c7a54384b1eca91a4a695490c7` returned `FINALIZED`, `MAJORITY_AGREE`, leader `execution_result: SUCCESS`, and contract `0xD47ed31c0b58100101Ec1d7DE1c11bB15A252DBE`. Recorded source SHA-256: `5F5204E9BF3941D688ABD0F34A31FCF2C788A29772A1A0237585008D8A54AC7F`. This proves the external SpecLock deployment, not MandateOS. |
| SpecLock EVM deployment fee | EXTERNAL REFERENCE VERIFIED | `eth_getTransactionReceipt` for the deployment returned `status=0x1`, `gasUsed=0x7a1200` (8,000,000), and `effectiveGasPrice=0x0`; observed EVM gas spend was 0 wei for that transaction. No separate fee-accounting object was present in the CLI GenLayer receipt. This does not quote future fees. |
| SpecLock EOA withdrawal child | EXTERNAL REFERENCE VERIFIED | Parent withdrawal `0x59c4b3e87574d798f45a451098088a536eab5c9e28f194b1a576f1a4f68d6244` returned child ID `0x82e7d8428b9e49c619198659d4a47dbcb78bdcc97e75b71b08541c931348a88e` from GenLayerJS `getTriggeredTransactionIds`. Child receipt was `FINALIZED`, result label `NO_MAJORITY`, `value_credited=true`, sender SpecLock, destination the recorded provider wallet, exact value `10000000000000` wei (0.00001 GEN). SpecLock separately records the matching beneficiary balance delta. This shows a causal receipt path; MandateOS keeper has not implemented it or tested its own payout, so MandateOS EOA settlement stays unverified. |
| Installed CLI route | READ-ONLY TOOLCHAIN VERIFIED | CLI `0.39.1`, bundled `genlayer-js 1.1.8`, active network `studionet` and active account alias `my-studionet-wallet`. Direct `deploy --contract` waits only for `ACCEPTED`; script mode runs sorted `deploy/*.js` scripts and permits explicit finality checks. No signer unlock was attempted. |
| Installed CLI fee estimator | UNAVAILABLE | CLI `0.39.1` has no `estimate-fees` command. Its bundled SDK uses EVM gas estimation and `eth_gasPrice`, with a 200,000 gas fallback on estimation failure. MandateOS now blocks that fallback and checks signed gas limit × price against the 10 GEN ceiling. No MandateOS fee quote exists. |
| GenLayerJS 2.0.0-rc.1 fee policy | UNSUPPORTED BY THIS RPC | Earlier read-only query returned JSON-RPC `-32601 Method not found: sim_getFeeConfig`. This does not block legacy CLI deployment; dashboard fee-aware writes still fail closed. |
| MandateOS Core / ProjectVault | NOT DEPLOYED | No MandateOS transaction IDs, finalized receipts, addresses, source hashes onchain, or live contract state exist. |
| Governance with two distinct wallets | NOT VERIFIED | No two genuine DAO member wallets are confirmed; there is no live vote/finalization/timelock run. |
| Validator evidence / Equivalence Principle | NOT VERIFIED | No live MandateOS `gl.nondet.web` assessment or consensus receipt exists. |
| GEN deposit, funding, payout, refund, repayment or distribution | NOT EXECUTED | No MandateOS transaction IDs, child execution results, finality or before/after balance records exist. |
| IC beneficiary payout | NOT VERIFIED LIVE | No compatible deployed beneficiary IC or live MandateOS payout cycle was tested. |
| Beneficiary acknowledgment | LOCAL ONLY | The contract/UI record beneficiary-signed attestation separately from settlement state; no acknowledgment was signed live. |
| Keeper / dashboard | LOCAL ONLY | Tests and build only; no deployed MandateOS contract data or live transaction history is configured. |
| Signer | CONFIGURED, LOCKED / NOT UNLOCKED | CLI config reports active alias `my-studionet-wallet`; previous safe inspection found its encrypted keystore locked. This task did not unlock or sign. |
| Local checks | VERIFIED LOCALLY | See `BUILD_STATUS.md` for this task's exact run results. |
| Repository source | DEVELOPMENT BRANCH | `codex/onchain-governance`; task began at `60c4d84b83da4958463c79d95611ac483fe9e142`. Final commit is reported in `BUILD_STATUS.md`. |
| `main` | UNCHANGED | No merge or push to `main`. |

Do not treat SpecLock's reference transaction as a MandateOS deployment or infer future fee rates from its zero-price receipt. Publish later MandateOS results only with actual finalized transaction IDs, execution results, child records where supported, exact addresses/amounts, source hashes, fee observations and independently read balances. EOA beneficiary acknowledgment remains an attestation, not settlement evidence.
