# MandateOS dashboard

React, TypeScript and Vite dashboard using GenLayerJS `studionet` (chain ID 61999). It reads latest-final contract state and bounded contract indexes for recent proposals, registered projects, and ProjectVault milestone, payout, refund, repayment, distribution and revenue records. Select an entry to populate its query handle, then refresh to read its details.

Available wallet-signed writes use existing Core contract methods: governance voting, milestone proposal creation and milestone challenges. The app never stores wallet keys. It does not deposit or transfer GEN. A transaction ID returned on submission is not presented as finalization or execution success.

## Start

```powershell
npm ci
npm run dev
```

Optional `.env.local` values:

```text
VITE_MANDATE_OS_ADDRESS=0x...
VITE_PROJECT_VAULT_ADDRESS=0x...
VITE_PROJECT_ID=...
```

The repository has no deployed MandateOS or ProjectVault addresses. Leave configuration empty until real addresses are available. Empty states mean unavailable and are not populated from fixtures. Browser storage contains query handles only, not authoritative financial data.

The milestone challenge digest is member-supplied reference data; it is not treated as an independently verified AI assessment. Evidence receipts show the contract's assessment, source provenance, content digest and freshness fields.

EOA payment remains `UNVERIFIED`: GenLayerJS `getTriggeredTransactionIds` reads internal IC child links, not a causally linked EVM execution record for the external EOA value transfer. Matching balance changes, addresses, amounts or timestamps are not settlement proof; no dashboard or keeper shortcut can mark success or retry an uncertain EOA transfer.

Keeper reports are unsigned local JSON evidence and remain visibly labeled as such. The dashboard's transaction inspector loads a user-supplied GenLayer transaction ID and available triggered internal-message IDs. It does not claim that those IDs prove EOA settlement.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

No sample projects, balances, profits, transaction hashes, settlement results or validator decisions are bundled.
