# MandateOS pre-deployment security and integration audit

**Date:** 2026-10-19  
**Branch/base:** `codex/onchain-governance`, starting at `729f53ba809d16a4c5d7e5f0e082fd5d0cfdad8d`  
**Verdict: NO-GO.** Do not deploy or move GEN based on this review. The local contract checks pass, but there is no live validator, fee, two-wallet governance, beneficiary IC, or settlement evidence. No deployment or wallet transaction was performed during this audit.

This is a focused source and regression audit, not an independent formal security audit. Severity labels describe release impact: **Critical** means immediate unauthorized loss or total authorization bypass; **High** means a credible unsafe release/payment or governance path; **Medium** means material liveness, reconciliation, or trust-boundary risk; **Low** means operational or usability risk with bounded financial impact.

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| A-01 | High | A challenge submitted through Core used an asynchronous finalized child call. The parent could finalize while ProjectVault still showed `CHALLENGEABLE`; permissionless milestone finalization and payout could race ahead of the queued challenge. | **Fixed locally.** Challenges are direct ProjectVault writes, require `challenger_address == gl.message.sender_address` and positive current Core member weight, then set `CHALLENGED` synchronously. Core's old wrapper now reverts. A Direct Mode regression verifies the member check, spoof rejection, atomic freeze and payout denial. |
| A-02 | High | A single active member could satisfy a one-person voting snapshot and self-approve selected mandate, registration, evidence-source, refund and challenge-resolution proposals. | **Fixed locally.** Require at least two current members for sensitive policy/control proposals; preserve the narrow one-member bootstrap path for adding a second member. Direct Mode coverage verifies sensitive proposal rejection and bootstrap. Agreement, milestone, distribution, closure and default proposals already enforce the two-member minimum. |
| A-03 | Medium | Evidence publication dates were checked for shape/range but not actual calendar validity, so impossible dates could be persisted as provenance. | **Fixed locally.** Shared Gregorian date validation rejects invalid dates and accepts leap dates; parser regressions cover February 31 and 1900-02-29. |
| A-04 | Medium | Dashboard reads started for an old project/address could complete after inputs changed and replace the screen with stale state; wallet state could change after initial connect and before signing. | **Fixed locally.** Generation guards discard stale refresh results and clear affected reads; each write rechecks active `eth_accounts` and chain `0xf22f`. Model tests cover disconnect, account switch and network switch. |
| A-05 | High / release blocker | An EOA transfer emitted by an IC cannot currently be independently linked by the inspected receipt API to the exact finalized parent intent, recipient, amount, successful execution and finality. A beneficiary acknowledgment proves only what the signer attests to. | **Open protocol limitation.** EOA payout remains UNKNOWN/value-at-risk, acknowledgment does not release reservations or change payout status, and no retry or privileged success override exists. A production-capable causal receipt source is required. |
| A-06 | High / release blocker | No live compatible beneficiary IC has been used to verify the existing authenticated callback/read-back protocol end to end. Direct Mode stubs cross-contract calls/child execution. | **Open.** Find and independently review an already-compatible IC recipient, or agree on an additive ProjectVault receipt adapter within the existing two contract types. Then test a tiny live payout after approval. No third contract type is proposed here. |
| A-07 | High / release blocker | No StudioNet write, validator execution, child finalization, two-real-wallet governance sequence, or live balance reconciliation was run. | **Open.** Chain-ID read-only identity is not proof of transaction submission or consensus. Deployment is prohibited until separately approved and protocol paths are verified. |
| A-08 | High / release blocker | The local GenLayer CLI executable is unavailable, and dynamic fee-estimation plus fee distribution has not been validated against an actual StudioNet write and emitted child. | **Open.** The dashboard uses GenLayerJS `estimateTransactionFeesForWrite` and passes returned `distribution` and `feeValue`; actual fee profile/message budgets and fee sufficiency remain unmeasured. The official API describes this call as estimating a concrete write and deriving the fee preset, but only a live transaction can verify the pinned app/network combination. |
| A-09 | Medium | Failed or uncertain value-carrying child transactions can strand value. Reservations correctly remain held and uncertain transfers are not retried, but the system has no proven trustless recovery route for a child whose value is held or whose result is unavailable. | **Open liveness risk.** Keep value-at-risk visible, stop further related operations, and require protocol-supported recovery evidence. Do not weaken reservations or add an administrator success toggle. |
| A-10 | Medium | Evidence URL validation and native evaluation do not yet establish robust protection against redirect/DNS rebinding, archived source snapshots or contradictory sources. Live Equivalence Principle outcomes are untested. | **Open.** Add a reviewed source-fetch policy and live validator tests before using evidence judgments for capital decisions. Validators must independently assess the source and decision-bearing fields; JSON shape checks alone are not consensus evidence. |
| A-11 | Medium | Operational lifecycle gaps remain, including incomplete member removal/delegation policy, no external audit, no deployment/incident recovery drill and manual keeper maintenance. | **Open.** Finalize governance and incident policy, review contract upgrade/immutability assumptions and perform an independent security review. |

## Scope reviewed

Reviewed the two Intelligent Contract sources and their tested interaction surfaces: payable Core deposits; governance-authorized funding; ProjectVault configuration; milestone assessment, challenge, payout and dispute resolution; governed refunds and closure; actual repayment/revenue receipts and return distributions; pending/value-at-risk reservations; evidence receipt parsing and dates; keeper reconciliation boundaries; and frontend reads/writes. Existing regression coverage includes replay, duplicate IDs, unauthorized callbacks, allocation/refund/payout overlap, concurrent reservations, receipt mismatch, failed/pending child observations, RPC failures, repayment installment allocation, challenge expiry, and agreement-close guards. The full local suite was run after the fixes.

Source review did not demonstrate an additional double-spend in the reviewed deposit/funding/refund/repayment/distribution accounting paths. This is not a proof of correctness: Direct Mode uses deterministic fixtures and stubs async children; live balance timing and settlement remain untested.

## GenLayer protocol compatibility observations

- Official message documentation describes internal IC calls as asynchronous: emitted child transactions are created only after the selected parent state, then execute independently. External messages to EOA recipients are finalized-only. This supports the project's pending/uncertain state model and explains why the challenge needed an atomic vault write. See [GenLayer Messages](https://docs.genlayer.com/developers/intelligent-contracts/features/messages).
- GenLayerJS documents `estimateTransactionFeesForWrite` as constructing an estimate for a concrete write and deriving the fee preset that the app passes. MandateOS calls this API, but there is no observed StudioNet transaction proving the returned distribution and budget cover the real call and its messages. See [GenLayerJS contract methods](https://docs.genlayer.com/api-references/genlayer-js/contracts) and [writing contract data](https://docs.genlayer.com/developers/decentralized-applications/writing-data).
- Equivalence Principle is contract-defined validator logic. Validators need independent evidence and explicit stable decision fields; validating only the leader's output shape is insufficient. The MandateOS web/evidence flow has static and Direct Mode coverage but no live validator judgment. See [Implementing the Equivalence Principle](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle).
- Direct Mode is a local deterministic contract-testing mode; it is not evidence of live validator consensus or value movement. See [GenLayer Direct Mode](https://docs.genlayer.com/api-references/genlayer-test/direct).

## Verification results

Executed on the audit working tree:

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest -q` — **116 passed** (reported starting baseline: 114).
- `genvm-lint contracts/mandate_os.py` — passed, 3 checks.
- `genvm-lint contracts/project_vault.py` — passed, 3 checks.
- `cd web; npm test` — **7 passed** (reported starting baseline: 6).
- `cd web; npm run typecheck` — passed.
- `cd web; npm run build` — passed; non-blocking chunk warning at 786.97 kB minified / 190.63 kB gzip.

The first GenVM lint invocation hit Windows `cp1252` while printing a checkmark; rerunning with `PYTHONIOENCODING=utf-8` passed both contract lint suites. This was terminal encoding, not a lint finding. No local test establishes a StudioNet transaction. See [BUILD_STATUS.md](../BUILD_STATUS.md) and [LIVE_PROOFS.md](../LIVE_PROOFS.md).

## Exact minimal-value demonstration runbook

The conditional order, wallet controls, dynamic fee controls, stop conditions and recovery limitations are specified in [DEPLOYMENT_READINESS.md](DEPLOYMENT_READINESS.md). The proposed initial transaction value is capped at 0.01 GEN (or a lower approved amount); transaction fees are separate, freshly estimated for each call and require signer review. A two-member governance path and compatible IC recipient are prerequisites. Unknown child results stop the run; no blind retry, EOA payout, administrator override or keeper signing is permitted.

## Prerequisites before any deployment request

1. Obtain the supported causal settlement receipt capability for EOA transfers, or exclude EOA payout from production scope and demonstrate the existing IC-recipient path live.
2. Install/identify the supported pinned StudioNet deployment CLI/SDK and validate nonfinancial deploy/read and exact fee-estimation formats against chain ID `0xf22f`.
3. Independently review source/artifact hashes, constructor values, two-member bootstrap, quorum/timelock settings, mandate reserve/exposure, agreement terms, pause authority, evidence policy and the incident/recovery process.
4. Obtain an independent contract/security review and a rehearsed stop/recovery procedure for failed or unknown value children.
5. Only after those results are concrete, obtain explicit approval for deployment and separately for each GEN-moving operation.

**Final verdict: NO-GO.** Local regressions make the audited branch safer, but the open High findings prevent a deployment or production settlement claim. Keep `main` unchanged.
