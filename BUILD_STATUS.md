# Build status — 2026-10-19

This status separates local verification from StudioNet evidence. The code and test commit `c830960558e635b24a48dbd030d33cc172eff5cc` was pushed as a fast-forward from `d73bbc78f00b09236e7a0016d8036c9247bbf75c`; GitHub independently reported it as the `codex/onchain-governance` head. The remote `main` head remains `4b446f04bb811c985230dee55b904e73412438b1`. This status/proof update is a separate documentation-only follow-up.

| Gate / stage | State | Verified evidence and remaining work |
|---|---|---|
| Gate 0 — environment and static validation | PARTIAL | Python compileall passed; both GenVM lint runs passed. A read-only JSON-RPC `eth_chainId` request to `https://studio.genlayer.com/api` returned HTTP 200 and `0xf22f` (61999). No contracts or wallets were modified. |
| Gate 1 — custody and settlement | PARTIAL | Native transfers and contract callbacks exist in the two-contract architecture. No live contracts are deployed, so there are no real parent transactions, transfer receipts, child receipts, or before/after contract balances. |
| Gate 2 — governance and risk | PARTIAL | Existing contract authorization, governance, mandate and challenge coverage is preserved. Existing Direct Mode and regression tests pass as part of the 107-test suite. Local execution is not StudioNet validator consensus. |
| Gate 3 — native evidence and consensus | PARTIAL | Native contract evidence evaluation and provenance remain in the implementation. No live validator assessment was submitted; Direct Mode cannot prove Equivalence Principle judgments or validator agreement. |
| Gate 4 — ProjectVault financing lifecycle | PARTIAL | Existing governed agreements, milestones, payouts, refunds, repayments, distributions, defaults and closure remain. Local tests do not prove asynchronous child execution or financial settlement. |
| Stage 1 — independent settlement investigation | BLOCKED for EOA production settlement | Official GenLayerJS and installed GenLayerPY child-ID implementations derive triggered IDs from `InternalMessageProcessed` events. They expose internal Intelligent Contract child links, not a causally linked EOA external-transfer child receipt. Exact EOA execution therefore cannot be independently tied to its parent intent using the supported APIs. The keeper and UI keep those payouts UNKNOWN/UNVERIFIED and do not retry them. |
| Stage 2 — durable keeper | PARTIAL | Added read-only StudioNet GenLayerPY reader, chain pinning, restart-safe SQLite WAL archive, idempotent receipt snapshots, internal child edges, balance/read receipts, audit records, alerts, UNKNOWN/VALUE_AT_RISK states, atomic JSON reports and restart recovery. It has no account, spending key, signing or automatic retry. It observes and reports; it does not invoke maintenance writes. |
| Stage 3 — real-data dashboard | PARTIAL | Added responsive React/TypeScript/Vite UI using GenLayerJS latest-final reads for treasury, mandates, membership, known proposal/project/allocation/refund/vault/agreement/milestone/payment/repayment/distribution states and transaction receipts. A wallet-signed governance vote is user initiated. Contract addresses and IDs must be supplied because contracts expose no enumerable indexes and no deployment addresses exist. Missing records and EOA settlement are shown as unavailable/unverified. Keeper reports are explicitly labeled unsigned local files. |
| Gate 6 — audit and release | BLOCKED | No deployment or full StudioNet fund-cycle proof. EOA settlement linkage is a protocol/API blocker; no live validator evidence, contract addresses or audited production operations exist. |

## Verification results

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest -q` — 109 passed (reported prior baseline 99 plus 10 new keeper/reconciliation cases).
- `genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `genvm-lint contracts/project_vault.py` — passed, 3 checks.
- `cd web; npm run typecheck` — passed.
- `cd web; npm test` — 4 passed.
- `cd web; npm run build` — passed. Vite emitted a non-blocking warning that the main minified chunk is approximately 769 kB (187 kB gzip).
- `git diff --cached --check` — passed.
- Secret review of changed contract, keeper, test, and frontend files — no credentials or wallet secrets found.

The Python suite includes local Direct Mode and deterministic fixture tests; none of the 109 tests submits to StudioNet. Frontend tests only map data states and formatting. Build/test success does not claim live UI state or GEN settlement.

## Release blockers and next action

1. GenLayer must expose an independently verifiable parent-to-external-message transaction receipt or equivalent authenticated execution record before EOA payouts can be marked settled. Until then they stay unverified and cannot be automatically retried.
2. Deployments and addresses are absent. Deployment, deposits, payouts and all other GEN transfers still require explicit user approval and a reviewed security lifecycle.
3. Governance and agreement discovery needs an onchain index/event service or manually supplied known IDs; the current UI does not invent histories.
4. Bundle splitting can reduce the frontend production chunk warning.

The next development milestone is a supported external-message reconciliation source, followed by live read-only inspection of deployed contract state when deployment is explicitly approved.
