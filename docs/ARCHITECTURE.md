# Architecture and trust boundaries

## Product statement

MandateOS is a **StudioNet-only** autonomous, evidence-driven treasury DAO. DAO members govern written constraints. The treasury judges project eligibility with validator-backed external evidence, proposes bounded investments, permits transaction-specific challenges, and releases GEN into reusable ProjectVault instances. The vault adjudicates milestones, safeguards unreleased GEN, records refunds and received repayments, and distributes only actual received funds.

## Core deployment units

1. `MandateOS`: holds principal treasury GEN, policy history, member/governance state, investment decisions, project registry, risk and accounting snapshots, pending transfer records.
2. `ProjectVault`: one deployment per project, with unique immutable parent/project IDs, financing model, milestone states, repayable obligations, refundable unused balance and transfer ledger.
3. Offchain **noncustodial** evidence archive and keeper, no signing authority to bypass contract checks. Frontend using GenLayerJS and browser wallet, no trusted internal balance database.

Use one repo. Independent contracts are deployed and verified on the same StudioNet chain, not on an EVM side chain.

## Trust boundaries

- Web pages, news, PDFs and screenshots are **untrusted evidence**, never executable prompts or authorization.
- LLM/leader output is **untrusted judgment** until independently validator-verified, sanitized and bound to an identified mandate, project, scope and evidence record.
- Member votes govern risk limits and eligible financial agreements. An AI decision is **not** a mandate amendment.
- The keeper may invoke permissionless maintenance, but cannot waive challenge windows or change recipient addresses.
- Project operators may submit information but not approve their own milestones or withdraw escrow at will.
- Child messages are asynchronous. Parent success is not child success; a failed value-carrying child is not necessarily refunded.
- Gate 1 uses a vault-to-parent finalized callback for child success, followed by an explicit cross-contract state read before treasury status becomes `VERIFIED`. Receipt IDs and failed-child classification still require the independent keeper/RPC reconciler.
- Each irreversible disbursement requires a finalized application authorization and proof of independently finalized child settlement.

## Suggested architecture refinements

Choose and document whether value is sent only when a challenge window expires, or if an earlier accepted decision must be confirmed at protocol finalization. Default to `on='finalized'` for all fund-moving child messages. Keep a separate `funding_intent -> message_queued -> child_processed -> destination_verified` lifecycle. Do not allow an unauthenticated callback to advance accounting.

## MandateOS contract methods implemented in the current development branch

The contract contains persistent member/weight snapshots, proposal vote accounting, quorum/approval rules, voting deadlines and execution timelocks. Public write methods now also include `propose_project_agreement`, `reconcile_project_agreement`, `propose_vault_milestone`, `reconcile_vault_milestone`, `challenge_vault_milestone`, `propose_milestone_resolution`, and `propose_default_resolution`. Agreements require a verified allocation under the current mandate; terms and milestone conditions flow to ProjectVault through finalized parent messages and are reconciled by read-back. Financing and milestone proposals/resolutions require at least two active DAO members. Allocation funding rechecks mandate/evidence version, freshness and authorization expiry.

The current implementation is not release-ready: native web/validator assessment is implemented but not executed on a validator runtime; source snapshots are not archived; redirect/DNS rebinding defenses and multiple-source contradiction handling are incomplete; Direct Mode stubs cross-contract views and child queues; live child execution is untested. Membership removal and mandate upgrades are incomplete. ProjectVault supports one agreement per project, governed milestone definitions, web-evaluated evidence, challenges and resolutions, milestone payments to a beneficiary contract implementing the receipt protocol, repayments, equal principal installments, reported/received revenue ledgers and bounded default disputes. Final distribution of realized returns beyond the governed principal refund cap, a governed agreement-close/cancellation entry point, per-installment receipt IDs, and failed-child reconciliation remain incomplete. The default-installment policy and beneficiary callback protocol need an external security review before meaningful funds are used.

## Remaining required contract methods (not implemented or not yet wired)

**MandateOS:** `create_mandate`, `amend_mandate`, membership removal/delegation, governed milestone cancellation and agreement closure, `reconcile_funding` failure/unknown receipt integration, full treasury/exposure summaries.

**ProjectVault:** persisted snapshot archive, independent receipt-based failed/unknown child reconciliation, governed return of realized gains beyond allocated principal, parent-routed milestone cancellation/close agreement, independent payout-failure resolution, and explicit per-installment payment receipts.

Exact signatures and GenLayer persistence types must be validated and pinned against current SDK versions.

## Financing models

- `GRANT`: earned milestone payments; refund only of eligible remaining escrow, not earned paid amounts.
- `REPAYABLE`: define principal, due dates, installment application rules, overdue/default states, realized GEN repayments and potential verified collateral.
- `REVENUE_SHARE`: define contractual rate, eligible revenue evidence, due dates and amounts **actually deposited**; never assume onchain control of external sales.

Disbursed principal and contractual claims are not necessarily recoverable. The dashboard must not conflate promised return with realized income.
