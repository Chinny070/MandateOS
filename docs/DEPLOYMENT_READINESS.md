# Deployment readiness audit

> **Current status is superseded by [PREDEPLOYMENT_READINESS.md](PREDEPLOYMENT_READINESS.md).** The current SDK read-only chain check succeeds, but current StudioNet fee-policy reads fail with JSON-RPC `-32601 sim_getFeeConfig` and the installed CLI cannot estimate fees. Do not follow the older statement below that reachability alone was enough to continue.

**Verdict: NOT READY FOR PRODUCTION. Do not deploy or transfer GEN until the open release blockers are resolved and the user explicitly approves the operation.** This document describes a runbook; it is not deployment authorization.

The 2026-10-19 source audit found and fixed a milestone challenge race, a single-member governance path, and permissive calendar-date validation. See [RELEASE_READINESS_AUDIT.md](RELEASE_READINESS_AUDIT.md) for severity, tests, and remaining limitations. Local verification does not change the verdict.

## Audit summary

The two contract sources were reviewed for payable deposits, funding, milestone payouts, refunds, repayments, revenue receipts and return distributions. The reviewed paths keep contractual terms separate from native amounts actually received, bind outgoing value to unique IDs and fixed destinations, reserve pending or uncertain amounts, and perform the corresponding state transition before emitting external value messages. ProjectVault checks available received principal/returns against existing obligations and reservations before distribution. MandateOS includes allocation reservations in spendable treasury calculations. Existing Direct Mode coverage exercises duplicate IDs, unauthorized callers, concurrent reservations, repayment categorization, replay attempts and uncertain payout states.

This review did not demonstrate a specific escrow double-spend or authorization defect requiring a contract accounting rewrite. It is a source review backed by local tests, not a formal audit. GenLayer Direct Mode fixtures do not execute or independently prove live asynchronous child settlement.

| Area | Status | Evidence / limitation |
|---|---|---|
| Contract custody and pre-emission accounting | REVIEWED LOCALLY | Two contract sources and Direct Mode regressions; no live transfer was submitted. |
| EOA milestone settlement | BLOCKED | Supported receipt APIs expose internal IC child IDs, not a causally linked external EOA transfer receipt. EOA payout remains pending/value-at-risk, unavailable for production. No administrator override or automatic retry exists. |
| IC beneficiary settlement | PARTIAL | Authenticated callback and read-back paths exist. Live child execution, finality, and balance evidence have not been tested. |
| StudioNet reachability | READ-ONLY VERIFIED | Raw JSON-RPC and installed GenLayerPY independently returned `0xf22f` (61999). This does not prove deployment SDK transaction compatibility. |
| Validator-backed contract behavior | NOT VERIFIED LIVE | Local Direct Mode and GenVM lint do not establish validator consensus, Equivalence Principle results, or external web assessment. |
| Keeper | PARTIAL | Read-only, persistent, idempotent observation and alerts; no signing key. It cannot independently promote EOA settlement. Permissionless maintenance still requires an explicit review of each callable path. |
| Dashboard | LOCAL IMPLEMENTATION | Reads enumerable Core/vault indexes, bounded recent records, and latest-final contract views. No deployment addresses or live contract state are configured. |
| Independent audit and operational controls | NOT COMPLETE | No third-party audit, live fund-cycle exercise, or recovery drill. Membership removal/delegation and upgrade/incident policy remain release concerns. |

## Required pre-deployment checks

1. Confirm the development branch, repository commit, clean working tree, secret scan, and immutable release artifact hashes. Keep `main` unchanged until a separately authorized review and merge.
2. Verify StudioNet chain ID `0xf22f` using raw JSON-RPC and the exact pinned GenLayer deployment SDK/CLI. Confirm deploy, constructor, receipt and query formats through documented nonfinancial checks. SDK read connectivity alone is insufficient.
3. Pin Python, GenLayer compiler/VM, GenLayerJS, GenLayerPY and CLI versions. Run compilation, full pytest, both GenVM lint checks, frontend typecheck/tests/build, and the Direct Mode suites on the exact release commit.
4. Review initial DAO membership, administrator powers, mandates, eligible evidence hosts, allocation limits, reserve limits, governance quorum, timelocks, challenge windows, and agreement defaults. Use dedicated wallets; never put signing secrets in source or keeper configuration.
5. Have an independent reviewer approve the threat model and the exact deployment artifacts. Record source and artifact hashes before publishing addresses.

## Exact deployment order

This order is conditional on all checks above and explicit user approval. It does not authorize a deployment or transfer.

1. Deploy **MandateOS Core** to StudioNet using the reviewed constructor configuration. Record the deploy transaction hash, finalized status, deployed address, code/artifact hash, constructor arguments, and post-deploy state.
2. Deploy one **ProjectVault** with the finalized MandateOS Core address and exact project ID. Record the same deployment evidence and verify the vault's parent/project views against the deployment transaction.
3. Establish DAO membership and the initial mandate through the supported governance lifecycle. Read back weights, mandate version, quorum and deadlines from finalized state.
4. Register the vault using a finalized `VAULT_REGISTER` governance proposal. Read back the project-to-vault binding from MandateOS and the parent/project binding from ProjectVault. Never use a privileged registration bypass.
5. Configure allowed evidence sources and eligibility criteria through governance. Submit real evidence and record its validator assessment receipt, provenance, content digest, assessment time, freshness expiry and mandate version. Do not substitute local fixtures.
6. Propose an allocation. Verify snapshot, vote result, quorum, timelock, challenge window, mandate version, evidence freshness and concentration/reserve limits. Wait until the exact allocation is final and funding-eligible.
7. Deposit GEN into MandateOS only after separately approving the amount and transaction. Record pre/post treasury balances and the finalized deposit receipt. Terms or a proposal amount are not evidence of an actual deposit.
8. Fund the exact allocation once. Record the finalized parent transaction, unique allocation ID, triggered internal child ID, child finalization and success result, vault read-back, and pre/post balances at both contracts. If any child result is unknown, retain the reservation and do not retry.
9. Configure the project agreement through finalized governance and reconcile the exact immutable recipient, mode, principal cap and terms against ProjectVault state.
10. Define and approve milestone criteria through governance. For the first end-to-end run, use an authenticated IC beneficiary only. EOA payout is disabled for production until independent causal settlement proof is available.
11. Under a separately approved small-value run, submit real evidence, allow the challenge period to elapse, and initiate one milestone payout. Verify parent and child receipts, destination state, amount, obligations, reservations and balances. A queued message, callback alone, or sender-side balance change is not enough.
12. Deposit a small repayment through the payable ProjectVault method. Record its finalized transaction and exact received amount. Verify installment allocation, outstanding principal and separately categorized realized return.
13. If distribution is in scope, pass its own governance proposal, send only actually received principal/return, reconcile both legs, and verify ProjectVault and MandateOS ledgers plus balances. Do not distribute reported income or unverified recoveries.
14. Close the agreement only through finalized governance and after the vault reports no unpaid obligations, active reservations, uncertain transfers or pending messages. Archive all transaction and reconciliation evidence and conduct a restart/recovery drill.

At each step, a failed or ambiguous message is a stop condition. Do not infer causal transaction links from equal amounts, matching addresses or timestamps.

## Small-value GEN verification runbook

The following is an example after deployment and governance limits have been reviewed. It is **not approved for execution**. Obtain explicit approval for each real deployment/transfer operation. Set the test amount no higher than the active mandate and use the smallest amount that the current network supports.

- Example amount: `0.01 GEN = 10000000000000000 wei`.
- Use a dedicated StudioNet test wallet and a registered ProjectVault with a reviewed, minimal agreement. Keep all other balances out of the test path where practical.
- Capture finalized balance snapshots before and after each payable action. Record tx ID, status/finality, sender, destination, amount, allocation/payment/repayment ID, child IDs and child result where the protocol exposes them.
- First test MandateOS deposit and governed Core-to-vault funding. Stop if the parent or child state is not final and successful, the destination/read-back differs, or balance accounting is inconsistent.
- Test a tiny IC-beneficiary payout and repayment cycle, with challenges and governance rules active. Verify every state transition and no duplicate value movement.
- Test refund and distribution separately with distinct IDs and independent governance approvals; do not reuse a transfer or fabricate receipt evidence.
- Do not use an EOA beneficiary in this runbook while the receipt relationship is unavailable. Keep any uncertain EOA payment reserved and do not retry it.
- Publish only raw, independently checked transaction records and exact balance snapshots in `LIVE_PROOFS.md`. Local tests and imported keeper JSON are not live evidence.

### Minimal first demonstration and fee controls

Run this only after a separately approved deployment. This is the smallest useful governance and escrow demonstration, not an authorization to transact:

1. Use two distinct, dedicated StudioNet member wallets and a separate project operator wallet. Verify `eth_chainId == 0xf22f` for every signer. Bootstrap the second DAO member through the documented member-add proposal; then use both member wallets for a vault registration proposal and a minimal grant agreement. Never reuse a single wallet as two voters.
2. Deploy Core, then one ProjectVault configured with that Core address and a unique project ID. Before funding, read back both addresses, bindings, active member weights, proposal quorum/deadlines, mandate limits and pause state from finalized contract views.
3. Use a demonstration cap of at most **0.01 GEN (10,000,000,000,000,000 wei)** for the first deposit/funding cycle, or the lower amount approved by the DAO. Confirm the active cap and reserve leave enough unencumbered GEN for fees and required operations.
4. For each signed transaction, request the current SDK fee estimate for that exact call. Review the proposed fee value and distribution with the wallet signer; keep message/child execution budgets separate from the payable GEN amount. Do not hardcode a fee profile or reuse a quote after changing method, calldata, contract code or network state. If the pinned SDK cannot quote a call, or its required fee exceeds the amount approved by the signer, stop and obtain a reviewed fee configuration before proceeding.
5. Record the parent transaction ID and inspect its lifecycle until final. For each internal child, record the exact triggered ID and inspect child finality, execution result, recipient state, contract state and before/after balances. A successful parent alone does not authorize continuing. If a receipt, child ID, result, destination amount or balance is unknown or inconsistent, stop; leave the reservation/value-at-risk in place and do not resend.
6. For milestone delivery, use one tiny milestone amount within the 0.01 GEN cap and a compatible IC beneficiary whose receipt interface has been independently reviewed. A Direct Mode stub is not a compatible live recipient. Require a finalized child, authenticated callback and read-back before treating the IC payout as verified. Do not use EOA payout as the first settlement demonstration.
7. Make at most one tiny payable repayment with a unique ID. Verify actual received amount, oldest-installment allocation and separate realized return. Do not close the agreement, refund or distribute until every prior child is reconciled. Exercise refund/distribution only as a separate approved run with a fresh ID and fresh fee quote.
8. Archive signed transaction IDs (never private keys), lifecycle and child records, exact fee values/distributions, source hashes, code hashes, addresses, timestamps, and independent balance snapshots. A beneficiary acknowledgment is recorded only as an attestation, never as proof of EOA settlement.

**Immediate stop conditions:** chain ID mismatch; wallet/contract address mismatch; stale or unavailable fee estimate; proposal has fewer than two real voters; proposal or evidence expired; unexpected contract state; challenge unresolved; accepted-but-not-final transaction; any failed or missing child; source/destination/amount mismatch; inconsistent balance; RPC/keeper outage; or unresolved value-at-risk. Do not deploy onward or send another transaction to work around a stop condition. Preserve the exact IDs and logs for incident review.

**Recovery limits:** GenLayer's internal messages are asynchronous and a failed value-carrying child is not automatically refunded. Unknown or failed value is not retried; reservations can remain locked indefinitely. Stop the demonstration and seek protocol-supported recovery/reconciliation before additional money moves. No administrator or keeper override is available. EOA transfers remain unsuitable for production until an independent causal receipt is supported.

## Release blockers and next milestone

1. A supported protocol/RPC record must causally connect a finalized parent payment intent to the exact external EOA GEN transfer and independently establish destination, amount, execution success and finality.
2. Run a live StudioNet validator and IC-to-IC fund cycle after approval, including failed/unknown child handling, refunds, repayment and restart-safe keeper reconciliation.
3. Complete external security review and document membership/upgrade/incident procedures.
4. Confirm that the dashboard can query deployed contracts and verify all displayed states against finalized records.

Until then, the correct release verdict remains **NO-GO**; no deployment address or financial settlement should be claimed. The dynamic SDK estimate path is code-reviewed but not verified against live StudioNet fee distribution or child-message costs.
