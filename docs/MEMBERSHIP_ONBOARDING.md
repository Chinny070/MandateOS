# Historical StudioNet DAO membership onboarding preparation

> **Historical preparation snapshot:** The member-add proposal, founder YES vote, and finalization described below have since been submitted and finalized; the proposal has also been executed. Current verified status is `EXECUTED`, with founder and Rabby weights both `1`. See [LIVE_PROOFS.md](../LIVE_PROOFS.md) for the receipt and latest-final readback. The first sections preserve the original pre-submission preparation snapshot.

The workflow was prepared for the already deployed MandateOS Core. It does not deploy contracts. Subsequent separately authorized membership governance transactions are recorded in `LIVE_PROOFS.md`.

## Latest-final preflight

Read-only checks through the CLI-compatible GenLayerJS 1.1.8 client returned StudioNet chain ID `0xf22f` (61999), Core proposal count `0`, candidate status `UNKNOWN`, founder voting weight `1`, and Rabby voting weight `0`. The candidate ID `member-add-rabby-1af111b06e6f6a05-20261020-01` was absent from the proposal index at latest block time `1792455328` (`2026-10-20T00:15:28Z`). A further preflight is mandatory immediately before a write.

The deployed Core source hash matches the local source used for deployment. Constructor bootstrap values in that deployed source are quorum `6666` bps, approval `6666` bps, voting period `86400` seconds, execution delay `86400` seconds, and execution window `604800` seconds. These settings have no public mutator/getter in this contract version; their persisted state is established by the source-hash match and deployment record, not by a dedicated read view.

The currently configured CLI alias is `my-studionet-wallet` and its public address matches the founder. No password, keychain secret, or signing operation was accessed for this preparation.

## Exact proposed first transaction

```text
Core:         0x32698630D6144882Bd0c1D5B00C74348c53ea58B
Method:       propose_member_add(string proposal_id, string member_address)
Proposal ID:  member-add-rabby-1af111b06e6f6a05-20261020-01
Member:       0x1Af111b06E6f6A05Bd41572A016318f1356aF85c
Attached GEN: 0
```

CLI 0.39.1's argument parser treats an unquoted `0x...` argument as a typed Address. Because this contract method accepts a string and constructs `Address(member_address)` from its base64 representation, the CLI argument must be the base64 string `GvERsG5vagW9QVcqAWMY8TVq+Fw=`. The script pins and constructs that value itself; do not substitute the hexadecimal address in the CLI argument.

Read-only exact-call preflight at `2026-10-20T00:15:28.923Z` used the stable SDK and a fake provider that throws before wallet or broadcast. StudioNet returned gas estimate and transaction gas limit `500000`, `eth_gasPrice=0 wei`, and maximum EVM fee commitment `0 GEN`. This quote is time-specific. The transaction script will recheck immediately before signing and stop if the gas estimate fails, the gas price changes, or the actual signed gas-limit × gas-price exceeds the explicitly approved cap. There is no child message in this member-add call. No fee is presently committed or spent; the budget ledger still has the full 10 GEN available.

## Safe, resumable sequence

The read-only planner is `scripts/membership-onboarding-status.mjs`. It checks chain identity, latest-final proposal index/status, vote summary, member weights, onchain timing, and latest chain time. It prints the next permissible action but contains no signer and cannot write.

The single-step signer route is `scripts/member-onboarding-cli.cjs`, dispatched through the installed GenLayer CLI script runner. Each invocation can sign at most one governance method, reserves the explicitly approved maximum fee in `deployments/studionet-budget.json` before signing, records the exact transaction hash, checks the finalized GenLayer result and EVM fee receipt, and will not replay a journaled stage. If the outcome is uncertain, the same transaction hash is reconciled; a hashless signing attempt blocks further writes for manual reconciliation. Wait steps only store the onchain timestamp and exit.

After the owner explicitly authorizes the first proposal and its maximum fee commitment, Codex can invoke the CLI runner in this explicit mode (the dispatch returns before the deployment code is loaded):

```powershell
$env:MANDATEOS_MEMBERSHIP_APPROVED = 'I_AUTHORIZE_MANDATEOS_MEMBER_ONBOARDING_STEP'
$env:MANDATEOS_MEMBERSHIP_MAX_FEE_WEI = '0'
genlayer deploy --rpc https://studio.genlayer.com/api
Remove-Item Env:MANDATEOS_MEMBERSHIP_APPROVED
Remove-Item Env:MANDATEOS_MEMBERSHIP_MAX_FEE_WEI
```

The authorization token is an execution gate, not a substitute for the user's approval in chat. The active alias is the only signer used; the script never reads or prints its key. With the proposed zero-wei cap, a changed nonzero fee quote aborts before signing. Each later transaction is separately preflighted and requires its own explicit fee cap. No founder vote, finalization, or execution is bundled with the initial proposal authorization.

After each finalized stage, rerun the read-only planner and then the one-step workflow. It will request the founder YES vote only if no vote exists. It will not finalize until latest chain time reaches the onchain `votingEndsAt`; after finalize it waits until the onchain `executeAfter` and refuses after `executeBy`. Final confirmation requires latest-final proposal status `EXECUTED` and Rabby weight `1`.

## Governance arithmetic

The member-add bootstrap exception allows the sole current member to create this membership proposal. The snapshot is one founder with weight one. With 6666-bps quorum and approval rounded up, the founder's one YES vote satisfies both thresholds. The 24-hour voting period starts at the actual proposal timestamp; finalization sets a fresh 24-hour execution delay and seven-day execution window. No deadline is guessed or hardcoded by the workflow.

## Rabby wallet votes

The dashboard now pins GenLayerJS 1.1.8, the version bundled with the verified CLI. The fee guard rechecks wallet and RPC chain IDs, active account, StudioNet consensus destination, exact calldata gas estimate, current gas price, and zero attached GEN before asking the user to review the maximum EVM fee. If any check fails, it does not open the Rabby popup. After signing, the dashboard continues to require finalized contract receipt/readback; an accepted or unknown result is not shown as completed.

This is local unit-tested compatibility, not a live Rabby write test. No wallet was connected or asked to sign during this preparation.

## Subsequent VAULT_REGISTER (not submitted)

The exact intended project and vault are known: project `mandateos-demo-001`, vault `0x03325B7EB2668CfF6bE3B2e9805d600bB9E1a2F4`. The Core method is `propose_vault_registration(proposal_id, project_id, vault_address, cap_wei, evidence_digest)`. A positive cap and nonempty evidence digest are mandatory. Neither was supplied, so this proposal is not ready and no value or digest has been invented.

After the member-add proposal executes, the two-member snapshot has total weight two. At 6666 bps, quorum rounds up to two; two affirmative votes are also needed to satisfy the approval threshold. One YES with no second vote fails quorum; one YES and one NO reaches quorum but fails approval. Both distinct members must vote YES before finalization. The exact vault and project ID must be read back at every stage.

## Current stop conditions

- No governance writes, wallet unlocks, GEN transfers, or treasury actions occurred in this task.
- Proposal-specific deadlines do not exist until its proposal transaction finalizes; the workflow reads them afterward.
- The fee quote must be refreshed before signing. The measured zero price is not a future fee guarantee.
- EOA payment settlement remains independently unverified; membership changes do not remove that restriction.
- `main` remains untouched. (Historical note: cap and metadata were unapproved at this snapshot.) The planned registration now has parameter-only approval, but still needs separate transaction authorization plus a fresh uniqueness and state check.

## Current continuation status — 2026-10-21

Fresh read-only latest-final StudioNet check at `2026-10-21T07:13:29.863Z` returned proposal `TIMELOCKED`, votes 1 YES / 0 NO, founder weight 1, Rabby weight 0, chain timestamp `1792566806`. Execution opens at `1792650476` (2026-10-22 07:27:56 Africa/Lagos). Do not execute without a new explicit one-transaction authorization, successful current gas estimate within its separately authorized cap, and fresh onchain preflight.

The candidate VAULT_REGISTER proposal ID `vault-register-mandateos-demo-001-20261022-01` was `UNKNOWN` and absent from the proposal index at that same observation, but uniqueness must be rechecked immediately before use. The owner subsequently approved preserving project ID `mandateos-demo-001`, cap `1000000000000000` wei, and digest `sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4` as **registration parameters only**. This did not authorize a proposal or any other write. The approval record is `deployments/registration-parameter-approval.json`. The evidence package explicitly states `NOT_ASSESSED`; it does not establish project eligibility. See the reviewer brief for the exact encoded future call and cap/getter limitation.

## Owner parameter approval update — 2026-10-21

Preserve these exact VAULT_REGISTER inputs: project ID `mandateos-demo-001`, cap `1000000000000000` wei (`0.001 GEN`), and metadata digest `sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4`. The digest was recomputed from the unchanged metadata package and matches. Approval is strictly parameter-only. No proposal, vote, finalization, execution, signer unlock, signature, deposit, or transfer is authorized by it. Recheck the candidate proposal ID for uniqueness immediately before a separately authorized proposal.

## Rabby membership execution — 2026-10-22

The separately authorized execution transaction `0x90c256ce0e85cccf075337a9dbb19a8ead85b51fff5303934e8085134c2d6e6a` called `execute_governance_proposal` for the exact member-add proposal. Independent StudioNet receipt reconciliation confirms `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS`, five agreeing validator votes, and matching successful EVM receipt with actual fee `0 GEN`. Latest-final reads at `2026-10-22T08:03:03.902Z` show proposal `EXECUTED`, 1 YES / 0 NO, founder weight `1`, Rabby weight `1`. The journal and live proof record were updated. No additional transaction was submitted.

The next possible governance step is the separately authorized VAULT_REGISTER proposal using the approved project ID, cap, and metadata digest in `deployments/registration-parameter-approval.json`. That approval covers parameters only. Recheck the candidate proposal ID and all state/fee conditions, and obtain separate authorization before any proposal submission. Both members must cast their own YES votes to meet the two-member quorum and approval thresholds.
