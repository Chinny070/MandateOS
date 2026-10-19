# Suggested application state machines

These states are targets for Codex implementation, not guarantees of the starter code.

- Allocation: `PROPOSED → UNDER_REVIEW → ELIGIBLE → CHALLENGE_WINDOW → AUTHORIZED → FUNDING_SCHEDULED → FUNDED_CONFIRMED` or `REJECTED`, `CHALLENGED → RESOLVED`, `CANCELLED`, `EXPIRED`, `RECONCILIATION_REQUIRED`.
- Child financial transfer: `NOT_SENT → PARENT_SUBMITTED → PARENT_FINALIZED → CHILD_CREATED → CHILD_FINALIZED_SUCCESS → DESTINATION_VERIFIED` or `CHILD_FINALIZED_FAILURE`, `UNKNOWN`, `VALUE_AT_RISK`. Keep source and destination states distinct.
- Milestone: `SUBMITTED → EVALUATED → CHALLENGE_WINDOW → PAYMENT_AUTHORIZED → PAYMENT_SENT → PAID_VERIFIED`, or `CHALLENGED`, `FAILED`, `TIMEOUT_REJECTED`, `EXPIRED`, `VOID`.
- Repayment: `NOT_DUE → DUE → PARTIALLY_PAID → PAID` or `OVERDUE`, `DEFAULTED`, `DISPUTED`, `WRITTEN_OFF`. `PAID` requires received GEN, never just external receipts.
- ProjectVault: `CREATED → AWAITING_FUNDING → FUNDED → ACTIVE → SETTLING → CLOSED` with controlled `PAUSED`, `DEFAULTED`, `CANCELLED` transitions.
- Evidence: `SUBMITTED → FETCHING → UNRESOLVED / VERIFIED_ELIGIBLE / VERIFIED_INELIGIBLE / CONFLICTING / STALE` and explicit `SUPERSEDED` histories.

Every transition must have allowed actor(s), timestamp source, monetary pre/post conditions, terminal/timeout behavior, and tests. Unknown or incomplete child transfers must never be represented as settled.
