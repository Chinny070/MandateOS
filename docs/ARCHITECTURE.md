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

## Required contract methods (target, NOT starter implementation)

**MandateOS:** `deposit`, `create_governance_proposal`, `vote`, `execute_governance_proposal`, `create_mandate`, `amend_mandate`, `register_project`, `evaluate_project`, `refresh_project_evidence`, `propose_allocation`, `challenge_allocation`, `resolve_allocation_challenge`, `finalize_allocation`, `fund_project_vault`, `reconcile_funding`, `request_refund`, `receive_refund`, `record_vault_settlement`, `get_treasury_summary`, `get_portfolio_exposure`, `get_evidence_receipt`.

**ProjectVault:** `fund_project`, `submit_milestone_evidence`, `evaluate_milestone`, `challenge_milestone`, `resolve_milestone_challenge`, `authorize_disbursement`, `execute_disbursement`, `reconcile_disbursement`, `deposit_repayment`, `request_refund`, `initiate_refund`, `distribute_repayment`, `record_default`, `resolve_default`, `close_agreement`, `get_vault_balance`, `get_milestone`, `get_obligations`.

Exact signatures and GenLayer persistence types must be validated and pinned against current SDK versions.

## Financing models

- `GRANT`: earned milestone payments; refund only of eligible remaining escrow, not earned paid amounts.
- `REPAYABLE`: define principal, due dates, installment application rules, overdue/default states, realized GEN repayments and potential verified collateral.
- `REVENUE_SHARE`: define contractual rate, eligible revenue evidence, due dates and amounts **actually deposited**; never assume onchain control of external sales.

Disbursed principal and contractual claims are not necessarily recoverable. The dashboard must not conflate promised return with realized income.
