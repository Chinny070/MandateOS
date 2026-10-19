# Live StudioNet proofs

**No contract deployment or GEN settlement is claimed.** Local Direct Mode, test fixtures, keeper archives and imported dashboard reports are not live StudioNet proof.

| Proof item | Result | Evidence |
|---|---|---|
| StudioNet endpoint and chain identity | READ-ONLY VERIFIED | On 2026-10-19, raw JSON-RPC `eth_chainId` to `https://studio.genlayer.com/api` returned HTTP 200 and `0xf22f` (61999). No state-changing call was sent. |
| Installed GenLayerPY connectivity | READ-ONLY VERIFIED | `genlayer-py==0.16.3`, StudioNet preset, read `client.w3.eth.chain_id` as `0xf22f` (61999). This proves RPC read connectivity, not SDK deployment or transaction submission. |
| GenLayer deployment SDK/CLI transaction path | NOT VERIFIED | No deployment or write call was submitted. Raw RPC or Python chain-ID success does not prove deployment, finality, or child handling. |
| MandateOS Core | NOT DEPLOYED | No contract address, constructor record, code hash or deployment transaction exists. |
| ProjectVault | NOT DEPLOYED | No contract address, constructor record, code hash or deployment transaction exists. |
| Deposits, funding, payouts, refunds, repayments or distributions | NOT EXECUTED | No live transaction hashes, child results, finalization status, or before/after contract balances exist. |
| Native validator evidence | NOT EXECUTED | No validator-backed receipt or consensus result exists. |
| EOA payment relationship | UNAVAILABLE FROM SUPPORTED RECEIPT API | GenLayerJS `getTriggeredTransactionIds` and GenLayerPY `get_triggered_transaction_ids` expose `InternalMessageProcessed` internal IC children. They do not expose a causally linked external EOA transfer receipt. Equal amounts, addresses, balances or timestamps are not treated as causal proof. |
| EOA beneficiary settlement | UNVERIFIED / NOT EXECUTED | No EOA payment was sent. Contract, dashboard and keeper cannot mark it successful or retry an uncertain transfer. EOA payout is not production-usable until independent linkage is supported. |
| Keeper | LOCAL ONLY | Durable read-only archive and deterministic adapter tests exist. No live transaction was watched; reports are not signed settlement receipts. |
| Dashboard | LOCAL ONLY | Contract-backed indexes, latest-final read paths, wallet-signed governance/milestone actions and transaction inspection build locally. There is no deployed contract address configured, so no live dashboard contract reads were made. |
| Local verification | PASSED | Implementation commit `61df489fac4ec6f39062d07592337c4f6d431a92`: 109 Python tests, 4 frontend tests, Python compilation, two GenVM lint runs, TypeScript typecheck and Vite build. These are not StudioNet transactions. |
| GitHub development branch | IMPLEMENTATION COMMIT READY | `61df489fac4ec6f39062d07592337c4f6d431a92` is the implementation/source commit. The accompanying build/proof document update is a separate follow-up commit; branch push and final remote HEAD must be verified after publication. |
| GitHub `main` | UNCHANGED | Last independently checked main head: `4b446f04bb811c985230dee55b904e73412438b1`. No merge was made. |

The read-only StudioNet check is network identity evidence only. Deployment and every GEN transfer remain unperformed and require explicit approval. For release blockers and the conditional deployment sequence, see [docs/DEPLOYMENT_READINESS.md](docs/DEPLOYMENT_READINESS.md).
