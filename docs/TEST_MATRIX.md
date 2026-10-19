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
- Additional Direct Mode cases bind EOA/IC recipient mode and a fixed destination, deny any EOA callback or local reconciliation from promoting a payment, retain reservations after timeout, deny duplicate payout attempts, govern actual repayment/return distributions, and route closure through a timelocked DAO proposal.
- EOA beneficiary acknowledgment Direct Mode checks cover a valid signer and exact amount, wrong wallet, amount mismatch, duplicate acknowledgment, unknown payment ID, IC-recipient rejection, acknowledgment before payout initiation, unchanged payout/reservation state, and the agreement close guard remaining locked. The acknowledgment view binds ProjectVault address, project ID, payment ID, expected beneficiary, amount, signer and time.
- `tests/test_studionet_rpc.py` uses deterministic JSON-RPC fixtures to check chain ID 61999, receipt identity, source/destination/value mismatches, failed/pending transfers, balance snapshots and fail-closed missing parent-child linkage. These fixtures are adapter tests only; this turn did not query StudioNet.

## Keeper persistence and dashboard state mapping

- `tests/test_keeper_archive_monitor.py` and `tests/test_reconciler.py` use deterministic reader fixtures to cover SQLite restart recovery, duplicate receipt/edge/audit handling, idempotent watch registration, internal-child verification requiring the exact child plus contract read-back and two-sided balances, EOA intent remaining UNKNOWN even when local observations appear to match, failed child execution, wrong recipient, inconsistent and incomplete balances, RPC error followed by successful re-poll, and mismatched emitted payment intent.
- `keeper.sdk_reader.GenLayerPYReader` pins reads to `studionet` and verifies chain ID `0xf22f` for each request. `keeper.cli` accepts only pre-existing transaction IDs and exact immutable payment intents; it never signs, submits, retries, or calls treasury methods. SQLite receipt snapshots are content-hash deduplicated and durable across process restarts.
- `web/src/models.test.ts` checks finalized execution success/failure separately from accepted/unknown status, prevents EOA contract states from being shown as verified settlement, and formats wei/timestamps without floating-point conversion.
- Direct Mode regressions also verify bounded Core proposal/project indexes and ProjectVault milestone, payout and repayment indexes, including empty out-of-range reads. These indexes support discovery; details are still read from finalized contract views.
- Governance regressions now require at least two active members before mandate, vault registration, evidence-source, dispute-resolution and refund proposals. The single-member bootstrap exception is limited to proposing the second member. A milestone challenge is a direct ProjectVault transaction: the caller must match `challenger_address`, Core must report positive member weight, duplicate/late/non-challengeable states fail, and the challenge state is set atomically before any payout can proceed. The Core asynchronous challenge wrapper is disabled to prevent a queued child from losing a race to payout.
- Evidence schema regressions reject impossible calendar dates (including non-leap-year February 29) while accepting valid leap days. Frontend state tests reject write submission after account disconnect, account switch or chain change.
- The dashboard reads bounded recent Core and vault indexes and offers wallet-signed voting, milestone proposal and challenge workflows using existing Core methods. It does not conduct browser-driven tests against deployed contracts.
- Frontend acknowledgment state tests require the connected wallet, StudioNet chain, matching ProjectVault/payment/beneficiary/amount, initiated EOA payout and an unacknowledged record. The wallet confirmation is rendered as an attestation separately from independent settlement. Keeper tests verify that a matching beneficiary acknowledgment appears in audit reports while EOA transfer state remains `UNKNOWN`, including a mismatched attestation case.
- Previous audit outcomes (before deployment preparation): `python -m pytest -q` — 116 passed; frontend Vitest — 7 passed; Python compilation, typecheck, production build and both GenVM lints passed. These figures are historical; the current run is documented at the end of this file.
- Before this preparation, EOA observation remained UNKNOWN because MandateOS's adapter did not consume a causal external child ID. The SpecLock reference now establishes that the installed CLI/SDK can return `triggered_transactions` for a finalized parent and a child receipt with `value_credited`, exact sender/destination/value, and finality. MandateOS's keeper still does not consume those fields; EOA payments therefore remain UNKNOWN and are not automatically retried.

## Gate 3: Evidence + clock + consensus

- Contract implementation now performs an independently re-fetched comparative eligibility assessment and persists a SHA-256 receipt, provenance URL/host, claimed publication date, assessment timestamp, expiry, mandate version, result and incrementing receipt version. Direct Mode cannot execute Equivalence Principle blocks; no validator verdict is claimed.
- Live `.get()` and `.render()` on authenticated allowed domains; screenshot mode live where runtime supports it.
- Real network validator-backed nondeterministic decision; evidence hashes and publication/transaction timestamps; different-validator disagreement; stale and contradictory evidence; malicious prompt injection fail closed.

## Gate 4: Vault lifecycle

- Single immutable governance-approved beneficiary per agreement, including ordinary EOA mode; milestone pending/approved/challenged/rejected/expired/paid states; dispute freeze; refundable residuals; actual payable repayment and revenue deposits; governed principal/return distribution; and timelocked closure after obligations are cleared.
- Negative: early payout, recursive/duplicate payout, forged completion, invalid beneficiary, partial refund over available escrow, excessive distribution, late appeal, malicious operator withdrawals.
- EOA external transfers cannot be completed or reconciled in Direct Mode. A live EOA payout must remain unverified unless the external transaction receipt is causally tied to its finalized IC parent and matches the bound sender, destination, amount and balance evidence.

## Gate 5: Full operation and public UI

- Keeper has no special financial rights; tracks accepted vs finalized vs failed parent/child tx; reconciliation and alerting.
- Frontend wallet auth, responsive mobile, no mock metrics, every displayed money movement maps to actual StudioNet state.
- Run a full real-fund-cycle with distinct member, operator, keeper wallets; inspect actual hashes/addresses and contract state. No invented telemetry.

## Gate 6: Audit and release

- Fuzz/property/invariant tests and full regression, documented threat model, no bypassed security tests, code hash verification, fresh wallet secrets excluded, source/docs/transaction report, no unaddressed critical findings. Mark each gate `PASS`, `PARTIAL`, `BLOCKED` or `FAIL` with actual evidence.

**Important:** There are no live StudioNet proofs. Pure Python reference tests and Direct Mode contract tests are distinct evidence classes; neither proves validator consensus or GEN settlement.

## Deployment preparation and current verification

- `scripts/deployment-safety.test.cjs` verifies fee commitment and ceiling enforcement, actual versus unknown fee settlement, the 0.01 GEN first-test value limit, and budget reconciliation. It uses only deterministic local data and does not simulate a StudioNet fee quote.
- Dashboard transaction helper tests verify chain ID 61999, required fee data, pass-through of SDK `messageAllocations`, failure on fee estimation errors, and the exact `sim_getFeeConfig` unsupported-method case; failed preflights submit no write.
- Deployment tests cover the installed CLI 0.39.1 receipt shape (numeric FINALIZED/MAJORITY_AGREE plus leader SUCCESS), exact constructor string typing, wrong-chain/signing refusal, gas×price cap calculation, and EVM receipt fee reconciliation. An isolated temp-repository harness invokes the actual deployment script with a fixture CLI client to verify Core→Vault order, journal updates, fee cap and the gas-estimation fallback stop. It does not access StudioNet or sign. Script inspection found the direct CLI deploy waits for ACCEPTED; the deployment wrapper instead invokes ordered script-runner mode and polls FINALIZED. No MandateOS deployment was performed.
- Current run results are recorded in `BUILD_STATUS.md`. Local tests do not establish MandateOS validator consensus or financial settlement.
- Read-only StudioNet checks: `eth_chainId=0xf22f`, `eth_gasPrice=0x0`. SpecLock's unrelated finalized deployment receipt had EVM status success, gasUsed 8,000,000 and effectiveGasPrice 0. This is transaction-specific fee observation, not a MandateOS quote. GenLayerJS v2 `getCurrentFeePolicy()` still fails with `-32601 sim_getFeeConfig`; the installed CLI 0.39.1 has no `estimate-fees` command.
