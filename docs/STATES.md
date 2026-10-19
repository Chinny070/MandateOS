# Suggested application state machines

These are implementation states in the current development branch. Direct Mode tests do not establish live validator consensus or child settlement.

- Allocation: `PROPOSED → UNDER_REVIEW → ELIGIBLE → CHALLENGE_WINDOW → AUTHORIZED → FUNDING_SCHEDULED → FUNDED_CONFIRMED` or `REJECTED`, `CHALLENGED → RESOLVED`, `CANCELLED`, `EXPIRED`, `RECONCILIATION_REQUIRED`.
- Child financial transfer: `NOT_SENT → PARENT_SUBMITTED → PARENT_FINALIZED → CHILD_CREATED → CHILD_FINALIZED_SUCCESS → DESTINATION_VERIFIED` or `CHILD_FINALIZED_FAILURE`, `UNKNOWN`, `VALUE_AT_RISK`. Keep source and destination states distinct.
- Agreement: governance `VOTING → TIMELOCKED → CONFIGURATION_PENDING → ACTIVE`, bound to one verified funding allocation and mandate version. Agreement terms support `GRANT`, `REPAYABLE`, and `REVENUE_SHARE`.
- Milestone: `DEFINED → EVIDENCE_SUBMITTED → CHALLENGEABLE → AUTHORIZED → PAYOUT_PENDING → PAID`, or `REJECTED`, `CHALLENGED → AUTHORIZED | REJECTED | EXPIRED`, `PAYOUT_PENDING → VALUE_AT_RISK → CHILD_SUCCESS → VERIFIED`. For EOA external transfers, there is no beneficiary callback; remain `PENDING`/`VALUE_AT_RISK` until an independent causal receipt link is available. Never retry automatically.
- Repayment/distribution: unique payable repayment `RECEIVED`; oldest-installment-first principal recovery reduces actual outstanding principal; excess is separate `REALIZED_RETURN`. Only DAO-approved distributions return actually received principal/return to treasury through a finalized value-bearing message and authenticated callback/read-back. Scheduled installment amounts and due dates produce `CHALLENGEABLE` default state, then `CHALLENGED → RESOLVED | CONFIRMED | UNRESOLVED`. Reported revenue remains separate from actual revenue-share GEN receipts.
- Agreement close: `ACTIVE → CLOSE_PENDING → CLOSED` only after timelocked DAO approval, vault preflight and read-back; unresolved balances, obligations, disputes, refunds and uncertain payments prevent closure.
- ProjectVault: `CREATED → AWAITING_FUNDING → FUNDED → ACTIVE → SETTLING → CLOSED` with controlled `PAUSED`, `DEFAULTED`, `CANCELLED` transitions.
- Evidence: `SUBMITTED → FETCHING → UNRESOLVED / VERIFIED_ELIGIBLE / VERIFIED_INELIGIBLE / CONFLICTING / STALE` and explicit `SUPERSEDED` histories.

Every transition must have allowed actor(s), timestamp source, monetary pre/post conditions, terminal/timeout behavior, and tests. Unknown or incomplete child transfers must never be represented as settled. An unresolved default dispute and uncertain child value deliberately freeze closure and further release; no automatic timeout resolves a disputed claim in favor of funding.
