# Thursday–Saturday StudioNet checklist

This is a dependency checklist, not transaction authorization. Every write needs its own explicit user authorization, current fee cap, and latest-final preflight. The local planner and signer runner must be rerun for each stage; never reuse timestamps from a previous read.

## Current anchor

Read-only StudioNet review at `2026-10-21T07:13:29.863Z` returned chain ID `0xf22f`, latest block timestamp `1792566806` (`2026-10-21 07:13:26 UTC`), member proposal `TIMELOCKED`, 1 YES / 0 NO, founder weight 1, Rabby weight 0. The earliest member-execution timestamp is `1792650476` = **Thursday, October 22, 2026 07:27:56 Africa/Lagos**. Its execution window closes `1793255276` = **Thursday, October 29 07:27:56 Africa/Lagos**.

## Thursday, October 22

1. Before attempting membership execution, run `node scripts/membership-onboarding-status.mjs`. Confirm latest-final status is still `TIMELOCKED`, member weight remains 0, chain timestamp is at least `executeAfter` and no later than `executeBy`, no prior execution transaction is journaled, fee estimate succeeds, and fee is within the exact separately approved cap.
2. Obtain explicit authorization for the single `execute_governance_proposal` step. No authorization is included in this preparation task. Execute once with the resumable workflow, then verify its actual hash, FINALIZED status, MAJORITY_AGREE, leader SUCCESS, EVM receipt/fee, proposal `EXECUTED`, and Rabby weight 1. Stop on an uncertain result; reconcile the same hash.
3. Only after membership readback, recheck the exact candidate registration ID, Core registration state, vault parent/project identity, mandate summary, treasury balance and current fee estimate. The candidate is `vault-register-mandateos-demo-001-20261022-01`; it was UNKNOWN and absent from the index at the latest read, but must be checked again.
4. Use the proposed cap/digest only after the owner separately approves them. Propose once. Founder and Rabby each submit a YES vote from their own wallet, only after latest-final state confirms proposal kind, voting window and each member's eligible snapshot weight. Do not treat two transactions from the founder as two members.

## Friday, October 23

5. Read the proposal's actual `votingEndsAt` from latest-final state and compare with latest block timestamp. Do not finalize early or use a guessed local deadline. After the timestamp has passed, obtain separate one-step authorization and finalize once.
6. Verify FINALIZED / MAJORITY_AGREE / leader SUCCESS, 2 YES / 0 NO, proposal `TIMELOCKED`, and the actual `executeAfter` / `executeBy` established by finalization. Write those onchain values and the finalized transaction hash to the journal.

## Saturday, October 24

7. Before execution, read latest-final state again and require chain timestamp in `[executeAfter, executeBy]`, proposal still `TIMELOCKED`, no executed/active transaction conflict, the exact project/vault/cap/digest, and the actual fee within the user-approved cap. Obtain separate explicit authorization and execute once.
8. Verify latest-final proposal `EXECUTED`, registered vault address and project count. This deployed Core has **no public cap getter**; do not claim direct cap readback. Preserve the finalized proposal receipt/calldata and disclose this observability gap to reviewers.
9. Refresh the dashboard, rerun the local suite, update `LIVE_PROOFS.md` only from actual receipts and reads, and prepare reviewer materials. A registered vault remains **unfunded**; no financial test is part of these governance approvals.

## Saturday target risk

The registration cycle has two mandatory 24-hour intervals after it can start: proposal-to-voting-deadline and finalization-to-execution. Its earliest execution is approximately 48 hours after proposal creation plus the real delay between the voting deadline and successful finalization. If membership execution occurs Thursday after **18:00 Lagos**, the earliest registration execution is already later than Saturday 18:00 even before finalization lag. Any delayed proposal, missing Rabby YES vote, RPC outage, missed voting deadline/finalization window, fee-cap failure or unknown transaction outcome can push it past Saturday evening. Because each deadline comes from actual chain state, recalculate immediately after each finalized stage; do not shorten governance periods.
