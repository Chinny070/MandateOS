# MandateOS StudioNet deployment preparation

**Preparation only. No MandateOS transaction, wallet unlock, signature, deployment, or GEN transfer was performed.** Target remains StudioNet, chain ID `61999`, RPC `https://studio.genlayer.com/api`. `main` is unchanged.

## Verdicts

- **Two-contract deployment demonstration: CONDITIONAL GO.** The installed CLI route has now been matched to SpecLock's successful StudioNet deployment and independently verified against its live finalized receipt. Run only after separate explicit authorization, on the clean development branch, with the exact approved project ID and a successful secure CLI unlock. The script stops on any failed preflight, unknown receipt, fee mismatch, wrong chain, or budget overrun.
- **First financial verification: NO-GO for now.** No two genuine distinct DAO signer wallets have been confirmed, MandateOS's EOA reconciliation adapter has not consumed triggered-transfer receipts, and the dashboard still depends on the unsupported v2 fee-policy route for wallet writes. Do not use funds for project financing.
- **Production: NO-GO.** MandateOS has no live deployment, live governance sequence, live contract-to-contract funding, own-contract payment receipt, or validator-backed evidence result. Failed child recovery and external message fee sufficiency still need a controlled live demonstration.

These verdicts separate ability to deploy the two contracts from authorization to use their financial features.

## SpecLock reference and CLI behavior

SpecLock's public deployment record identifies CLI command `genlayer deploy --contract contracts/speclock.py` (no `--args`), StudioNet chain `61999`, contract `0xD47ed31c0b58100101Ec1d7DE1c11bB15A252DBE`, and deployment transaction `0x6505c1e2602432706a9e40d258ae53b1d514e4c7a54384b1eca91a4a695490c7`. A read-only CLI receipt lookup in this workspace returned `FINALIZED`, `MAJORITY_AGREE`, and leader `execution_result: SUCCESS`. Its source digest was recorded as `5F5204E9BF3941D688ABD0F34A31FCF2C788A29772A1A0237585008D8A54AC7F`.

The installed toolchain here is GenLayer CLI `0.39.1`, bundled `genlayer-js` `1.1.8`, CLI network alias `studionet`, and active account alias `my-studionet-wallet`. `genlayer network info` reports chain `61999` and the expected Studio RPC. The CLI's direct `deploy --contract` implementation returns after `ACCEPTED`, so MandateOS must not use that command as its completion check. With no `--contract`, the same CLI runs sorted `deploy/*.js` scripts and passes them the configured CLI client/account. The adapted deployment script uses that route, then explicitly waits for `FINALIZED` and checks `MAJORITY_AGREE` plus the leader's `SUCCESS` result.

### Constructor argument encoding

The CLI's variadic `--args` parser converts `0x...` into a typed address and numeric-looking tokens into numbers/BigInts. SpecLock documented and reproduced the no-argument trap: `--args '[]'` is one literal string argument and causes a zero-argument constructor to fail. A numeric-only project ID can also lose its string type with that CLI token parser.

MandateOS uses the CLI script runner's bundled SDK directly so constructor arguments are passed as JavaScript values without shell parsing:

1. Core: `cliClient.deployContract({ code: mandateOsSource, args: [], leaderOnly: false })`.
2. Vault: `cliClient.deployContract({ code: projectVaultSource, args: [finalizedCoreAddress, exactProjectIdString], leaderOnly: false })`.

The ProjectVault source constructor is `(mandate_os_address: str, project_id: str)`. The helper rejects a non-string project ID or invalid Core address, and tests cover digit-only IDs such as `"00123"`. No constructor is invoked in this preparation task.

## Fees and budget behavior

StudioNet returned `eth_gasPrice = 0x0` during the read-only check. The SpecLock deployment EVM receipt returned `status=0x1`, `gasUsed=0x7a1200` (8,000,000), `effectiveGasPrice=0x0`, and therefore measured EVM gas expenditure `0 wei` for that exact transaction. These observations are not a promised future rate or a MandateOS estimate. The SpecLock GenLayer receipt did not report a separate fee-accounting object.

The installed CLI's legacy SDK estimates EVM gas, reads `eth_gasPrice`, signs a legacy EVM transaction, and submits it to StudioNet's configured consensus contract. Its implementation falls back to 200,000 gas when gas estimation fails. MandateOS's script instruments the signer request and **refuses that fallback**, enforces the exact signed `gasLimit × gasPrice` cap against the fixed 10 GEN cumulative ledger before signing, then reconciles `gasUsed × effectiveGasPrice` from the finalized EVM receipt. Missing or mismatched fee data retains the full cap as an unknown liability and blocks the sequence. No fee is guessed or automatically increased.

This is the old CLI deployment route, not GenLayerJS v2 fee allocation for transactions that emit child messages. The v2 `sim_getFeeConfig` failure and absent `estimate-fees` command remain valid for the dashboard/financial-write path. The 10 GEN cap is an operational limit for this authorized run, not an onchain global cap. The 0.01 GEN first-transfer maximum remains separate and unchanged; this deployment command contains no test transfer or investment.

## Signer and governance readiness

- Active CLI account configuration is `my-studionet-wallet` on `studionet`. Earlier safe inspection found its encrypted local keystore locked and no cached signing key. This task did not unlock it. When separately authorized, the CLI must prompt locally for secure unlocking; never put a password, private key, or recovery phrase in chat or a source file.
- No second genuine, distinct DAO member wallet has been confirmed. The presence of test aliases does not satisfy this requirement.
- Core bootstraps the first member at weight 1. Its narrow one-member exception permits proposing/executing addition of a second member. New members receive weight 1. Quorum and approval are each 6,666 bps; with exactly two equal-weight members, both must participate to meet quorum and both must vote yes to meet approval. The source enforces weighted thresholds and a two-member minimum, rather than a separately named two-distinct-yes-voter rule. A real two-wallet test is mandatory before sensitive governance or financing.

## Exact deployment sequence after authorization

Run from a clean checkout on `codex/onchain-governance`, after the approved source commit is pushed and reviewed. Set the exact project ID approved for this deployment. The signer remains handled only by the local CLI:

```powershell
$env:MANDATEOS_DEPLOYMENT_APPROVED = 'I_APPROVE_MANDATEOS_STUDIONET_DEPLOYMENT'
$env:MANDATEOS_PROJECT_ID = '<exact approved project ID>'
.\scripts\deploy-studionet.ps1
```

The wrapper checks CLI `0.39.1`, bundled SDK `1.1.8`, network alias, chain, active signer alias, clean branch, clean worktree, budget ledger, and explicit authorization before starting the CLI. The script rechecks live chain identity, source hashes and exact constructor argument types. It then deploys Core, waits for the same transaction to finalize and execute successfully, reconciles the EVM fee, records the address/hash/source hash, and only then deploys ProjectVault with that Core address and exact project ID. Finalized verified addresses update `deployments/studionet.json`.

Never rerun blindly after a submitted or uncertain transaction. The deployment journal preserves each attempted transaction and makes unresolved states stop conditions. If Core succeeds but Vault fails, Core remains deployed; there is no rollback. Stop and reconcile the recorded transaction before any further instruction. Deployment approval does not authorize a test transfer, governance proposal, project investment, or treasury funding.

## After deployment, not part of this authorization

1. Verify both contract addresses, deployed source/code hashes, schema, constructor bindings, and Core initial member state with read-only calls.
2. Separately configure and verify a second genuine DAO wallet; test member snapshot, quorum, affirmative votes, deadlines, and timelock with both signers.
3. Port the known triggered-child EOA receipt evidence into the keeper only with full parent/child hash linkage, exact sender/destination/value, child finality/value-credit interpretation, and independent balance evidence. Until then EOA settlement remains unverified.
4. Resolve dashboard write fee compatibility and verify any child-message fee requirements.
5. Obtain separate explicit approval before any financial transaction. The total cumulative budget may never exceed 10 GEN, and the first test value may never exceed 0.01 GEN. Stop on any unknown execution, receipt, balance, fee, or budget state.

## Evidence links

- [SpecLock deployment and StudioNet lifecycle evidence](https://github.com/Chinny070/SpecLock/blob/main/docs/DEPLOYMENT.md)
- [SpecLock source, CLI argument correction, and receipt findings](https://github.com/Chinny070/SpecLock/blob/main/DECISION.md)
- [GenLayer CLI 0.39.1 installed source](https://github.com/genlayerlabs/genlayer-cli)
- [Current GenLayer CLI documentation](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-cli)
- [GenLayerJS API documentation](https://docs.genlayer.com/api-references/genlayer-js)
