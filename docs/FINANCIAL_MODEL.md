# Financial accounting, pricing, and invariants

## Units

- All onchain GEN amounts are `u256` **wei** (1 GEN = 10^18 wei). Do not store IEEE floats.
- Basis-point limits are integers out of 10,000. When rounding affects safety limits, round conservatively.
- A GEN-denominated cost or principal amount is **not** market NAV for offchain investments. Clearly label accounting and economic exposures.

## Balances, commitments and exposure

Keep these distinct: `main_contract_balance`, `unreserved_liquid_gen`, `pending_commitments`, `vault_escrow_gen`, `disbursed_principal`, `contractual_repayment_due`, `repaid_gen_actually_received`, `paid_distributions`, `realized_income`, `impairments`, `unresolved_message_value`, and `eligible_refunds`.

Pending commitments count against concentration even while GEN remains in the treasury. Moving GEN from treasury to vault must not increase total accounted GEN. Repaid GEN must not be double-counted as both principal outstanding and liquid balance. Revenue-only claims not yet paid must not be represented as cash or guaranteed income.

Current implementation notes: MandateOS subtracts unspent allocation reservations from its live balance. `pending_transfer_wei` is an audit and risk ledger; finalized GenLayer messages debit the sender's balance when their value is emitted, so subtracting the same pending value again would double count it. Uncertain child messages are never resent. ProjectVault refund and payout reservation maps record unresolved child state, while their values have already left its live balance; refund availability subtracts only unspent milestone obligations from the remaining balance. DAO refund proposals reserve both the amount awaiting return and the part of project commitment they can reduce, and compare that reservation with the vault's separate in-flight refund amount to avoid subtracting it twice. These assumptions are statically linted and tested in Direct Mode; actual child balance timing still needs StudioNet verification.

ProjectVault currently binds one governed agreement to one reconciled allocation. Milestone obligations are reserved before payout; queued payouts transition `PENDING → VALUE_AT_RISK` when their callback is late, and only a configured beneficiary contract callback plus a read-back of that beneficiary's payment record reaches `VERIFIED`. Uncertain transfers stay locked and have no retry method. Repayment IDs are unique; received principal reduces outstanding principal first and only excess counts as realized return. Revenue reports are kept separate from native GEN deposits actually received.

## Hard invariants

1. No spend exceeds contract-controlled available GEN or its allocated limit.
2. No two intents with the same ID can pay twice; terminal states are immutable except through explicitly permitted appeal/reversal flows.
3. Exposures include **pending + vault-held + disbursed principal**; liquidity constraints include unpaid commitments.
4. Every GEN movement has source, destination, project, allocation/payment ID, mandate version, amount and independently verifiable transaction evidence.
5. Refunds and repayments can be marked `RECEIVED` only when a payable destination contract actually accepts GEN and the child settles.
6. A project may not be closed while unsettled messages or outstanding obligations remain unless those obligations are explicitly written off through governed rules.
7. Do not blindly retry outbound funds if the child transaction is unknown; failed value messages may have irreversible economic implications.
8. Operator repayments use explicit payable methods and separate claimed obligations from actual transfers.
9. One project vault must not spend or report another vault's balance.
10. Contract-level emergency pause may stop new exposure without blocking safe reconciliation of funds and legitimately due refunds.

## Example accounting

At outset, MandateOS holds 100 GEN. After a **verified** 20 GEN treasury→vault transfer, MandateOS has 80 GEN, vault 20 GEN. Following a verified 5 GEN milestone payout, vault holds 15 GEN; a repayable agreement may record 5 GEN principal outstanding. A separate verified 3 GEN repayment increases vault balance to 18 GEN, decreases outstanding principal (per agreement's payment waterfall), then a verified 3 GEN distribution returns treasury to 83 GEN and vault to 15 GEN.

Those are test vectors, not live deployment evidence.

## Policy examples (require member approval)

20% per project concentration, 15% minimum liquid reserve, 24-hour challenge window, stale evidence fail-closed. Neither Codex nor the deployer may silently choose or revise material economic limits after deployment without authorization.
