# Live proof matrix and release gates

## Gate 0: Environment and static validation

- Python version and package lock recorded; `genvm-lint` passes; `pytest` reference model passes; GenLayer Direct Mode tests pass.
- Probe StudioNet RPC; inspect chain ID 61999. If 403/timeout/chain mismatch occurs, **STOP all live claims** and write a blocker with exact sanitized RPC response.
- Validate SDK method signatures against installed version, not outdated examples.

## Gate 1: GEN round trip — critical

- Deploy MandateOS and ProjectVault; record code hashes, constructor args and confirmed addresses.
- Deposit GEN into MandateOS and verify actual balance.
- Call native parent→vault `emit(value=..., on='finalized')`; independently verify parent, child and vault balance.
- Reconcile funding against independent child evidence; no automatic retry if ambiguous.
- Initiate vault→treasury refund; verify both child links and before/after balances.
- Negative: untrusted funding sender, invalid project, wrong parent, duplicate allocation, unauthorized refund, zero amount, cap breach, insufficient balance, replay.

## Gate 2: Governance and risk

- Direct Mode contract tests cover: member registration/snapshot manipulation; duplicate/ineligible/late votes; quorum and approval rejection; voting and execution deadlines; mandate bounds/version expiry; concurrent and replayed vault registration; governance-gated HTTPS evidence sources and criteria; member digest cannot authorize; challenge expiry; expired/stale funding authorization; concentration, liquid reserve and pending-transfer reservations; permissionless execution only for an exact authorized allocation; governed refund reservations, caller/value authentication, replay denial and reconciliation; vault-side simultaneous refund reservation.
- Both actual MandateOS contract entry points and state transitions are exercised. Deterministic clock and balance are Direct Mode fixtures. Cross-contract identity views and child-transaction enqueueing are stubbed; there is no child execution or settlement proof.
- Remaining Gate 2 checks: native validator-backed evidence in a live GenLayer runtime, member removal/delegation policy, independently verified async child failure/recovery, and live consensus.

## ProjectVault financing lifecycle

- Direct Mode calls the real vault agreement, milestone, payout, repayment, revenue, default, refund and close-guard methods. It verifies parent-only configuration, allocation/project/beneficiary binding, installment due amounts, unique repayment IDs, report IDs, payment IDs, obligation release, refund/payout non-overlap, pending versus value-at-risk payout states, recipient callback authentication, and no automatic retry.
- MandateOS Direct Mode checks governance gating and asynchronous configuration/reconciliation for agreements and milestones, member-authorized challenges, and governance-timelocked milestone/default resolutions.
- Deterministic test fixtures set an already validator-approved milestone or model a child balance change where Direct Mode lacks nondeterministic or asynchronous execution. Those fixtures test subsequent deterministic contract paths only. They are not evidence that web evaluation, a child transfer, recipient settlement, or GEN movement happened.
- Direct Mode cannot prove the beneficiary IC receipt protocol, successful/failed child transactions, real contract balance deltas, web/Equivalence Principle consensus, scheduled receipt ordering, or StudioNet settlement. No live deployment or GEN transfer is claimed.

## Gate 3: Evidence + clock + consensus

- Contract implementation now performs an independently re-fetched comparative eligibility assessment and persists a SHA-256 receipt, provenance URL/host, claimed publication date, assessment timestamp, expiry, mandate version, result and incrementing receipt version. Direct Mode cannot execute Equivalence Principle blocks; no validator verdict is claimed.
- Live `.get()` and `.render()` on authenticated allowed domains; screenshot mode live where runtime supports it.
- Real network validator-backed nondeterministic decision; evidence hashes and publication/transaction timestamps; different-validator disagreement; stale and contradictory evidence; malicious prompt injection fail closed.

## Gate 4: Vault lifecycle

- Multiple milestones and beneficiary allowlists, pending/approved/challenged/rejected/expired/paid, partial payouts, dispute freeze, timeout liveness, refundable residuals, deposit repayment, return principal, revenue-sharing receipts, missed repayments/default, agreement closure.
- Negative: early payout, recursive/duplicate payout, forged completion, invalid beneficiary, partial refund over available escrow, excessive distribution, late appeal, malicious operator withdrawals.

## Gate 5: Full operation and public UI

- Keeper has no special financial rights; tracks accepted vs finalized vs failed parent/child tx; reconciliation and alerting.
- Frontend wallet auth, responsive mobile, no mock metrics, every displayed money movement maps to actual StudioNet state.
- Run a full real-fund-cycle with distinct member, operator, keeper wallets; inspect actual hashes/addresses and contract state. No invented telemetry.

## Gate 6: Audit and release

- Fuzz/property/invariant tests and full regression, documented threat model, no bypassed security tests, code hash verification, fresh wallet secrets excluded, source/docs/transaction report, no unaddressed critical findings. Mark each gate `PASS`, `PARTIAL`, `BLOCKED` or `FAIL` with actual evidence.

**Important:** There are no live StudioNet proofs. Pure Python reference tests and Direct Mode contract tests are distinct evidence classes; neither proves validator consensus or GEN settlement.
