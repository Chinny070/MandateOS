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
| EOA recipient acknowledgment | IMPLEMENTED LOCALLY; NOT SUBMITTED LIVE | ProjectVault accepts a wallet-signed acknowledgment only from the fixed EOA beneficiary, for an initiated EOA payout and exact amount. The record is separate from payout status and preserves all reservations. No beneficiary acknowledgment transaction was submitted to StudioNet. |
| Keeper | LOCAL ONLY | Durable read-only archive and deterministic adapter tests exist. No live transaction was watched; reports are not signed settlement receipts. |
| Dashboard | LOCAL ONLY | Contract-backed indexes, latest-final reads, wallet-signed governance/milestone actions, recipient confirmation and transaction inspection build locally. The confirmation reads the final acknowledgment record; it does not change settlement. There is no deployed contract address, so no live dashboard reads were made. |
| Local verification | PASSED | Implementation commit `71c9bc7287f3986ae6f1675d9e0f2d1d8648da8a`: 114 Python tests, 6 frontend tests, Python compilation, two GenVM lint runs, TypeScript typecheck and Vite build. These are not StudioNet transactions. |
| GitHub development branch | SOURCE COMMIT | Implementation commit `71c9bc7287f3986ae6f1675d9e0f2d1d8648da8a` is based on confirmed development-branch commit `799be9f09fa08681732db74a1e18c39aa7db5a2f`. This code contains no live transaction evidence. |
| GitHub `main` | UNCHANGED | Last independently checked main head: `4b446f04bb811c985230dee55b904e73412438b1`. No merge was made. |

The read-only StudioNet check is network identity evidence only. Deployment and every GEN transfer remain unperformed and require explicit approval. For release blockers and the conditional deployment sequence, see [docs/DEPLOYMENT_READINESS.md](docs/DEPLOYMENT_READINESS.md).
