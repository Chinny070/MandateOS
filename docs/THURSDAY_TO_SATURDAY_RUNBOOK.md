# Thursday–Saturday StudioNet checklist

This is a dependency checklist, not transaction authorization. Every write needs its own explicit user authorization, current fee cap, and latest-final preflight. The local planner and signer runner must be rerun for each stage; never reuse timestamps from a previous read.

## Current anchor

The member-add execution is complete. Read-only StudioNet verification at `2026-10-22T08:03:03.902Z` returned chain ID `0xf22f`, proposal `EXECUTED`, 1 YES / 0 NO, founder weight 1, Rabby weight 1. The `executeAfter` / `executeBy` values were `1792650476` / `1793255276`. Transaction and fee evidence are in `LIVE_PROOFS.md`.

## Thursday, October 22

1. **Completed:** the one separately authorized `execute_governance_proposal` transaction finalized as `MAJORITY_AGREE` / leader `SUCCESS`; the matching EVM receipt records actual fee 0 GEN. Latest-final state verifies proposal `EXECUTED` and member weights 1/1. See `LIVE_PROOFS.md`.
2. Before a VAULT_REGISTER proposal, recheck the exact candidate ID is unused, project/vault identity, owner-approved parameter record, registration state, and fee quote. Obtain a separate one-transaction authorization; the parameter approval alone is not sufficient.
3. Only after membership readback, recheck the exact candidate registration ID, Core registration state, vault parent/project identity, mandate summary, treasury balance and current fee estimate. The candidate is `vault-register-mandateos-demo-001-20261022-01`; it was UNKNOWN and absent from the index at the latest read, but must be checked again.
4. The owner has approved the exact project ID, cap, and metadata digest as parameters only (recorded in `deployments/registration-parameter-approval.json`). This is not proposal authorization. Before proposing, recheck that the proposal ID is unused, verify exact calldata and latest-final registration state, refresh the fee quote, and obtain a separate one-transaction authorization with fee cap. Founder and Rabby must each submit a YES vote from their own wallet after latest-final checks confirm proposal kind, voting window, and each member's eligible snapshot weight. Do not treat two transactions from the founder as two members.

## Friday, October 23

5. Read the proposal's actual `votingEndsAt` from latest-final state and compare with latest block timestamp. Do not finalize early or use a guessed local deadline. After the timestamp has passed, obtain separate one-step authorization and finalize once.
6. Verify FINALIZED / MAJORITY_AGREE / leader SUCCESS, 2 YES / 0 NO, proposal `TIMELOCKED`, and the actual `executeAfter` / `executeBy` established by finalization. Write those onchain values and the finalized transaction hash to the journal.

## Saturday, October 24

7. Before execution, read latest-final state again and require chain timestamp in `[executeAfter, executeBy]`, proposal still `TIMELOCKED`, no executed/active transaction conflict, the exact project/vault/cap/digest, and the actual fee within the user-approved cap. Obtain separate explicit authorization and execute once.
8. Verify latest-final proposal `EXECUTED`, registered vault address and project count. This deployed Core has **no public cap getter**; do not claim direct cap readback. Preserve the finalized proposal receipt/calldata and disclose this observability gap to reviewers.
9. Refresh the dashboard, rerun the local suite, update `LIVE_PROOFS.md` only from actual receipts and reads, and prepare reviewer materials. A registered vault remains **unfunded**; no financial test is part of these governance approvals.

## Saturday target risk

The registration cycle has two mandatory 24-hour intervals after it can start: proposal-to-voting-deadline and finalization-to-execution. Its earliest execution is approximately 48 hours after proposal creation plus the real delay between the voting deadline and successful finalization. If membership execution occurs Thursday after **18:00 Lagos**, the earliest registration execution is already later than Saturday 18:00 even before finalization lag. Any delayed proposal, missing Rabby YES vote, RPC outage, missed voting deadline/finalization window, fee-cap failure or unknown transaction outcome can push it past Saturday evening. Because each deadline comes from actual chain state, recalculate immediately after each finalized stage; do not shorten governance periods.
