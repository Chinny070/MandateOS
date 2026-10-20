# MandateOS

MandateOS is a StudioNet-native treasury DAO built from two GenLayer Intelligent Contracts: **MandateOS Core** and a reusable **ProjectVault**. The Core governs treasury allocation and agreement actions. Each ProjectVault holds project funds, tracks milestone obligations, receives actual repayments, and returns eligible GEN through authenticated parent-contract messages.

The repository also contains a noncustodial, read-only StudioNet keeper and a React, TypeScript, Vite dashboard. The keeper stores transaction observations locally; it has no signing key, arbitrary spending power, automatic retry, or governance bypass. The dashboard reads latest-final contract state through GenLayerJS and requests wallet signatures only when the user starts a supported governance action.

## Release status

MandateOS Core and the first ProjectVault are deployed on StudioNet. Their addresses, finalized transaction receipts, constructor arguments and source hashes are documented in [LIVE_PROOFS.md](LIVE_PROOFS.md). No treasury funding or GEN transfer has been performed. The current task prepares the first DAO-member proposal; it does not submit governance transactions.

SpecLock's live StudioNet withdrawal evidence demonstrates a parent-to-triggered-child relationship with an exact EOA recipient, amount, finalized child receipt and `value_credited: true`. This provides a concrete receipt pattern for a future MandateOS keeper adapter. MandateOS has not yet wired this observation into its reconciler or run its own beneficiary payout, so its EOA milestone payouts remain unverified and cannot be marked successful or retried automatically.

The configured EOA beneficiary can sign a separate ProjectVault acknowledgment for the exact payment ID and expected amount. The onchain record proves that the beneficiary wallet attested to receipt; it does not change payout settlement status or reservations and is not independent settlement evidence.

Read [BUILD_STATUS.md](BUILD_STATUS.md), [LIVE_PROOFS.md](LIVE_PROOFS.md), and [docs/PREDEPLOYMENT_READINESS.md](docs/PREDEPLOYMENT_READINESS.md) for the verified CLI route, current fee observations and limits, signer status, budget controls, deployment sequence and remaining financial-test blockers. The older [deployment audit](docs/DEPLOYMENT_READINESS.md) remains historical.

## Repository layout

- `contracts/mandate_os.py` — membership, proposal snapshots and voting, mandates, evidence receipts, allocations, refunds, agreements, milestones, challenges and governed resolutions.
- `contracts/project_vault.py` — project funding custody, agreement and milestone records, reserved payouts/refunds/distributions, payable repayments and revenue, default and closure guards.
- `keeper/` — StudioNet-pinned RPC reader, durable SQLite observation archive, reconciliation classifications, alerts and reports. It never signs or sends GEN.
- `web/` — real-data dashboard. Core and vault indexes allow recent proposal, project and vault record discovery. Wallet writes use the CLI-compatible GenLayerJS 1.1.8 route with a strict StudioNet gas-estimation guard, account/chain validation and fee confirmation before Rabby opens. Native GEN value transfer remains disabled in this wallet-write helper.
- `deploy/` and `scripts/` — explicit-gate ordered CLI script-runner deployment, per-signature EVM gas caps, finalized receipt checks, deployment journals and the cumulative 10 GEN operational budget.
- `tests/` — Direct Mode contract tests, keeper/RPC adapter tests, and frontend state-mapping tests. Test fixtures are local evidence only.
- `docs/` — architecture, financial model, test matrix and readiness documentation.

## Local verification

Use Python dependencies from `requirements.txt`, the pinned GenLayer toolchain, and Node.js dependencies in `web/package-lock.json`.

```powershell
python -m compileall -q contracts reference keeper tests
python -m pytest -q
genvm-lint contracts/mandate_os.py
genvm-lint contracts/project_vault.py
Set-Location web
npm ci
npm run typecheck
npm test
npm run build
```

Passing local checks are not live transaction proof. Keep actual StudioNet deployment addresses, finalized transaction IDs, child results, and before/after balances in `LIVE_PROOFS.md` only after independently verifying them.

## Dashboard

```powershell
Set-Location web
npm ci
npm run dev
```

Optional `.env.local` query handles:

```text
VITE_MANDATE_OS_ADDRESS=0x...
VITE_PROJECT_VAULT_ADDRESS=0x...
VITE_PROJECT_ID=...
```

No deployment address or sample financial data is bundled. Connect a wallet only to sign an action you choose. The dashboard pins writes to StudioNet chain ID `61999` and displays transaction submission separately from finalization. It does not submit deposits or GEN transfers.

## Network and amount units

- Target network: GenLayer StudioNet only.
- Chain ID: `61999` (`0xf22f`).
- RPC: `https://studio.genlayer.com/api`.
- Native currency: GEN; contract values use wei (`1 GEN = 10^18 wei`).

Never store private keys, mnemonics, API credentials, or signing secrets in this repository. No Solidity, ERC-20, DEX, or EVM-side deployment is part of the architecture.
