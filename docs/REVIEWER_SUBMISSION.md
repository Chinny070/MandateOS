# MandateOS — reviewer submission brief

**Project:** MandateOS

**Network:** GenLayer StudioNet, chain ID `61999`

**Submission target:** Saturday evening, October 24, 2026
**Current repository branch:** `codex/onchain-governance`

## Project overview

MandateOS is a governed treasury and project-financing system built from two GenLayer Intelligent Contracts. MandateOS Core stores membership, voting snapshots, investment mandates, treasury accounting, project registry, and funding authorization. A reusable ProjectVault holds funds for one project, records agreement and milestone obligations, tracks actual repayments, and prevents distributions or closure while relevant liabilities remain unresolved.

The intended problem is that an investment group needs to make bounded capital decisions from outside evidence while preserving a public, auditable trail of who approved an allocation, which mandate applied, what evidence was evaluated, and what GEN was actually received or paid. The contracts make those rules persistent and checkable at transaction time. External web content and AI judgments remain untrusted inputs until a validator-backed assessment reaches a final onchain state.

## Why GenLayer

Eligibility and milestone claims depend on information outside the chain. The contracts use GenLayer nondeterministic web reads within the Equivalence Principle so validators can compare decision-bearing results and persist a bounded assessment receipt. Governance and value authorization remain deterministic contract state. A local model result, website response, or keeper observation alone does not authorize funding.

## Architecture and controls

- **MandateOS Core:** DAO member weights and proposal snapshots; quorum, approval and execution delays; versioned mandate; treasury and pending-funding accounting; evidence-source policy; allocation authorization; governed refunds and agreement actions.
- **ProjectVault:** authenticated parent Core; immutable project identity; financing agreement; milestone states, evidence and challenges; reserved payouts/refunds; payable repayments; received-principal/return separation; governed distribution and closure checks.
- **Frontend:** React, TypeScript, Vite and GenLayerJS; latest-final contract reads; wallet-signed StudioNet calls with exact EVM fee preflight; connected account/network rechecks; duplicate-write lock; no application signing key.
- **Keeper:** local durable transaction archive and read-only reconciliation; no spending key, arbitrary treasury authority or blind retry.

EOA payment acknowledgments are stored as beneficiary attestations only. They do not mark settlement verified, release a reservation, enable retry, or prove an external transfer. EOA payouts remain unavailable for production settlement while the protocol/RPC receipt surface cannot prove a causal transfer relationship.

## Evidence classes

### VERIFIED LIVE

- MandateOS Core: `0x32698630D6144882Bd0c1D5B00C74348c53ea58B`, deployment transaction `0x8c5c53afc9e6f8958688df572e946dc8c3880133a388bf98640615e5fd1841a7`.
- ProjectVault: `0x03325B7EB2668CfF6bE3B2e9805d600bB9E1a2F4`, deployment transaction `0xd42a4c5dcb6a25ba7909eb312239d21bc8c27ffa2ef4b3cd1c33e320b5931d39`.
- Core source SHA-256 at deployment: `a0cad2bdc2a7be57d5e80e4f681d5f0897708bcf8b6ace53a81480c2e849a5d4`; ProjectVault source SHA-256: `2da278f14385feee0191dfd2ed9d8cfe0c29a03d5138aa638885f179f9be3c33`.
- MEMBER_ADD proposal, founder YES vote, and finalization are finalized with majority agreement and successful leader execution. The Rabby member is **not yet added**: current latest-final status remains `TIMELOCKED`, Rabby weight `0`.
- Fresh read-only StudioNet observation at `2026-10-21T07:13:29.863Z` (latest block timestamp `1792566806`, 2026-10-21 07:13:26 UTC): chain ID `0xf22f`; Core treasury summary all zero; mandate version 1, max project exposure 2000 bps, reserve 1500 bps, max single allocation 30 GEN, 86400-second challenge window, and 604800-second (7-day) evidence freshness limit; registered project count 0; Core has no registered vault for the project; deployed vault points to Core, reports project ID `mandateos-demo-001`, balance 0.
- Full live receipts, times, and limitations are in [LIVE_PROOFS.md](../LIVE_PROOFS.md).

### TESTED LOCALLY

Local Direct Mode tests exercise governance, accounting, evidence gating, and contract state paths. Frontend tests cover wallet connection decisions, fee guard behavior, state mapping, and duplicate-submit prevention. Python and deployment test instructions are in [TEST_MATRIX.md](TEST_MATRIX.md) and [BUILD_STATUS.md](../BUILD_STATUS.md).

### NOT YET VERIFIED LIVE

- Rabby account compatibility with this specific browser installation and a Rabby-signed governance vote.
- Rabby membership execution, second-member voting, vault registration, treasury deposit, project funding, evidence assessment, milestones, payout, refund, repayment, distribution, and closure.
- Any project eligibility result or independent settlement proof.
- The registration cap cannot be queried directly from the deployed Core: this version has no public cap getter. The final cap would need to be shown in the finalized registration proposal/transaction evidence; source change and redeployment are outside this submission preparation.

## Registration preparation (not submitted)

Candidate registration proposal ID: `vault-register-mandateos-demo-001-20261022-01`. Latest-final check at `2026-10-21T07:13:29.863Z` returned status `UNKNOWN` and the ID was absent from the proposal index. It must be checked again immediately before proposing.

Proposed demonstration cap: **0.001 GEN** (`1000000000000000` wei). It is a proposed limit, not a user-approved or onchain value. A hypothetical first-test value plan of `0.009 GEN` treasury deposit plus `0.001 GEN` treasury-to-vault funding totals `0.01 GEN` across both value transfers. Under the deployed 20% concentration limit and 15% liquid reserve, the 0.009 GEN deposited base implies a 0.0018 GEN concentration bound and 0.00135 GEN required reserve; a 0.001 GEN funding amount is below the cap and leaves 0.008 GEN in treasury. This arithmetic does not make the plan authorized, eligible, or sufficient for any real project.

Prepared commitment: `sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4` (recompute with `node scripts/registration-evidence-digest.mjs`). The committed package is [mandateos-demo-001-registration.json](evidence/mandateos-demo-001-registration.json). It contains deployment and project identity metadata only, no external project claims, and explicitly says `NOT_ASSESSED`. The deployed method stores the submitted string as metadata and resets eligibility to `UNASSESSED`; the hash cannot prove eligibility or substitute for the contract’s later validator-backed evidence flow.

Exact intended call arguments, encoded for the deployed contract signature:

```text
MandateOS.propose_vault_registration(
  "vault-register-mandateos-demo-001-20261022-01",
  "mandateos-demo-001",
  "AzJbfrJmjP9r47LpgF1gC7nhovQ=",  # base64 string encoding of the exact ProjectVault address
  1000000000000000,                # proposed cap_wei; requires owner approval
  "sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4"
)
```

No registration transaction is authorized. The owner must approve both the proposed cap and digest before any proposal uses them. The cap getter limitation must be disclosed to reviewers.

## Reproduction and demonstration

Run the local checks using [TEST_MATRIX.md](TEST_MATRIX.md). Use the read-only dashboard demonstration in [DEMO_SCRIPT.md](DEMO_SCRIPT.md); it shows actual zero balances, the current timelocked member proposal, and the unregistered vault without suggesting that financial flows have occurred. Do not present mocked receipts or hypothetical project history as live data.
