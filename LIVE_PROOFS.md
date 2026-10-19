# Live StudioNet proofs

**No live contract deployment or GEN settlement is claimed.** Local Direct Mode, tests, keeper fixtures, and imported keeper JSON reports are not StudioNet proof.

| Proof item | Result | Evidence |
|---|---|---|
| StudioNet endpoint and chain identity | READ-ONLY VERIFIED | On 2026-10-19, an authorized read-only JSON-RPC `eth_chainId` request to `https://studio.genlayer.com/api` returned HTTP 200 with `0xf22f` (61999). No RPC errors occurred. No state-changing call was sent. |
| Installed GenLayerPY connectivity | READ-ONLY VERIFIED | `genlayer-py==0.16.3`, configured with its StudioNet preset, read `client.w3.eth.chain_id` as `0xf22f` (61999). This confirms RPC connectivity only; no deployed contracts or transaction IDs were available for transaction-method inspection against live state. |
| Parent Intelligent Contract transactions | NONE | No MandateOS or ProjectVault address is deployed in this environment, so no real contract transaction can be queried. |
| EOA external GEN payment relationship | NOT AVAILABLE FROM SUPPORTED SDK RECEIPT API | GenLayerJS `getTriggeredTransactionIds` and GenLayerPY `get_triggered_transaction_ids` derive IDs from `InternalMessageProcessed` events. They establish internal IC child IDs. They do not expose a child receipt identifier for the EOA external value transfer. Matching value, address, balance delta, or nearby timestamp is not treated as causal proof. |
| EOA beneficiary settlement | UNVERIFIED / NOT EXECUTED | No EOA transfer was made. Dashboard and keeper cannot promote an EOA payment to verified or retry an uncertain payment. |
| MandateOS deployment | NOT DEPLOYED | No contract address, code hash, constructor arguments, or deployment transaction. |
| ProjectVault deployment | NOT DEPLOYED | No contract address, code hash, constructor arguments, or deployment transaction. |
| GEN deposit, refund, repayment, payout or distribution | NOT EXECUTED | No transfer transaction IDs, finalization results, child execution results, or before/after balances exist. |
| Native validator evidence evaluation | NOT EXECUTED | No validator-backed evidence receipt or consensus result exists. |
| Keeper | LOCAL IMPLEMENTATION; NO LIVE WATCHES | Keeper tests use deterministic reader fixtures. No deployed MandateOS transactions were supplied to its watchlist. Its SDK links are recorded as internal-message children only. |
| Dashboard | LOCAL BUILD; NO LIVE CONTRACT DATA | React/TypeScript/Vite build and state-mapping tests pass. No contract address is configured by default and no live contract data was queried. A user must enter a known address and identifier to request latest-final reads. |
| GitHub development branch | PUSH VERIFIED | Commit `c830960558e635b24a48dbd030d33cc172eff5cc` was pushed fast-forward from `d73bbc78f00b09236e7a0016d8036c9247bbf75c` to `codex/onchain-governance` and independently checked through GitHub. Remote `main` remains `4b446f04bb811c985230dee55b904e73412438b1`. |

The keeper has no signing key and does not submit transactions. Its SQLite archive and JSON reports are local operational records, not cryptographically signed receipts. Keep EOA payouts UNKNOWN until a supported source independently establishes the full parent intent → external transfer → recipient/amount → successful execution relationship.
