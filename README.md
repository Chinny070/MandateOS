# MandateOS — Codex starter

**Status: Gate 0 starter / LAB-ONLY. NOT production-ready, NOT live-deployed.**

**Authorized GitHub repository:** https://github.com/Chinny070/MandateOS (`main`). This ZIP is a local starter, not a claim that files were pushed to GitHub. Codex must verify the remote before pushing.

MandateOS is a GenLayer StudioNet-native, evidence-driven treasury DAO with separately deployable ProjectVault Intelligent Contracts. It is designed to govern real *StudioNet GEN* flows under versioned investment mandates and challengeable, milestone-controlled project agreements.

## What is in this starter

- `contracts/mandate_os.py`: **laboratory** GEN deposits, administrator-only project-vault registration, outbound **on-finalized IC-to-IC** GEN funding, read-based funding reconciliation, and refund receipt.
- `contracts/project_vault.py`: **laboratory** parent-authenticated payable funding and return of eligible unspent GEN to MandateOS.
- `reference/risk_model.py`: independent reference model for concentration, reserves, pending commitments, and evidence failure states. **Not wired to the onchain contract.**
- `tests/test_risk_model.py`: deterministic reference-model tests.
- `docs/`: product scope, state machines, financial invariants, evidence/web renderer, integration matrix, and test/runbook requirements.
- `CODEX_MASTER_PROMPT.md`: handoff instruction to implement all remaining features and prove them on StudioNet.

## Known missing components (intentionally NOT represented as implemented)

Distributed governance, policy enforcement in the onchain funding path, evidence assessment, native web rendering, validator Equivalence Principle, timestamps, per-milestone disbursements, project debt accounting, revenue sharing, challenges, keeper, frontend, secure upgrade controls, comprehensive adversarial testing, independent child-receipt verification, and public deployment proofs.

> The administrator-only lab functions MUST NOT ship to users or hold meaningful assets. They exist only to demonstrate and diagnose GEN custody and child-message semantics. No trading or ERC-20 dependency is in scope.

## Run local reference-model tests

From the repository root:

```bash
python -m compileall -q contracts reference
python -m pytest tests/test_risk_model.py -q
```

GenLayer runner dependencies are not available in the file-generation environment; **no GenLayer runtime, validator consensus or StudioNet results are claimed here**. Codex must install compatible `genlayer-test` / `genvm-linter` tooling and verify contracts against a real GenLayer runner.

## Initial deployment gate

1. Probe `https://studio.genlayer.com/api` for network identification; require `61999` and record raw responses.
2. Pin the SDK versions and ensure `genvm-lint` and Direct Mode tests pass.
3. Deploy `MandateOS` first; deploy `ProjectVault(mandate_os_address, project_id)` second; register the vault on the main contract.
4. Fund MandateOS with faucet GEN using the payable `deposit` method.
5. Call the lab-only `fund_project_vault` with a unique allocation ID; **wait for finalization of the parent and independent child**.
6. Verify the vault's `get_allocation_amount`, both balances, and transaction statuses before calling `reconcile_funding`.
7. Initiate a uniquely identified refund and verify its entire reverse message chain.
8. Document failures and non-recoverable states. Never blind-resubmit a transaction that may already have escrowed value in a child message.

This is *not* the final production flow. It must be redesigned around the complete DAO and investor-protection scope specified in the handoff.

## Network

- Target: **GenLayer StudioNet only**
- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- Explorer: `https://explorer-studio.genlayer.com`
- Currency: `GEN`; amounts in contract storage are **u256 wei**, `1 GEN = 10**18 wei`

## Security and operating notes

- Do not put private keys, mnemonics, API tokens, signing secrets or sensitive identifying evidence in source or logs.
- Multiple GenLayer versions exist; Codex must reconcile current docs and installed runtime behavior before editing interfaces and deployment scripts.
- No broad EOA withdrawal method is included in the lab contracts.
- `SCHEDULED` is not settled, and `CONFIRMED` in the current prototype indicates read-based destination state only. Keeper receipt matching and full transfer accounting are needed before production.
- The demo's GEN is test-network currency; no real-world return is implied.

## Official primary references

- [Value Transfers](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers)
- [IC-to-IC Messages](https://docs.genlayer.com/developers/intelligent-contracts/features/messages)
- [Interacting with Intelligent Contracts](https://docs.genlayer.com/developers/intelligent-contracts/features/interacting-with-intelligent-contracts)
- [Web Access](https://docs.genlayer.com/developers/intelligent-contracts/features/web-access)
- [Transaction Context](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context)
- [Testing](https://docs.genlayer.com/developers/intelligent-contracts/testing)
