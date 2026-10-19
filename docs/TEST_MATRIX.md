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

- Multi-member DAO with quorum, vote accounting, mandate immutable history, timelocks, per-project exposure + reserve tests, governance expiry and policy change safety.
- Repeatability: freeze and reject proposals violating 20%-style limits across pending commitments and outstanding principal. Reject arbitrary owner exception.

## Gate 3: Evidence + clock + consensus

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

**Important:** This starter has NO live StudioNet proofs. The only tests executed when packaging were pure Python reference-model tests and Python source compile checks.
