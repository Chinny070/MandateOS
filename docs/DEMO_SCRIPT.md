# Reviewer demo script — read-only, truthful states

Estimated time: 5–7 minutes. Do not connect a wallet or open a signing request during the recorded demo. Start the dashboard with the actual deployed Core and ProjectVault addresses in `.env.local` and project ID `mandateos-demo-001`, then click **Refresh onchain state**. Confirm the page reports StudioNet and the contract RPC reads succeed before recording. If RPC reads fail, stop and label the screen unavailable; do not insert fixtures.

## 1. What the system protects (45 seconds)

Explain that MandateOS separates governed policy from evidence evaluation and financial custody. The Core holds governance and treasury accounting; each ProjectVault binds one project and tracks escrow obligations. External sources and AI judgments do not authorize release by themselves.

## 2. Show deployed contracts and actual balances (60 seconds)

Open **Treasury**. Show Core balance and summary values as read from latest-final state. Expected current value is zero. State that no treasury deposit or project-funding test has happened. Open **Registered projects** and show there are none yet; the ProjectVault deployment is not the same as Core registration.

Open the vault/accounting section and show the vault address, project ID, and current zero balance from the deployed vault. Do not describe it as funded.

## 3. Show governance and onchain timing (90 seconds)

Select proposal `member-add-rabby-1af111b06e6f6a05-20261020-01`, refresh, and show its latest-final `TIMELOCKED` state, one YES, zero NO, and its onchain `executeAfter`/`executeBy`. At the latest read, execution opens at **2026-10-22 07:27:56 Africa/Lagos**; re-read on demo day and show current chain time before describing whether it is executable. Rabby member weight is currently zero until that proposal is separately authorized and executed.

Explain that the active policy requires quorum and approval based on membership snapshots. Once there are two equal members and 6666-bps quorum/approval, both distinct members must vote YES for a two-member proposal to pass. Do not claim the Rabby wallet has signed or is currently an active voter until latest-final state confirms it.

## 4. Show evidence boundaries and registration preparation (90 seconds)

Open [the registration metadata package](evidence/mandateos-demo-001-registration.json) and reproduce its hash with `node scripts/registration-evidence-digest.mjs`. Explain that it binds deployed project identity metadata only, with zero external claims and status `NOT_ASSESSED`. It does not pass eligibility. Show the owner-approved parameter values (0.001 GEN cap and exact digest) as offchain proposal parameters only: they are not in onchain state, and parameter approval did not authorize any governance transaction or transfer.

Explain the future evidence flow: governance-approved HTTPS source and criteria, validator-comparable assessment, timestamp/freshness receipt, fail-closed treatment when inconclusive, then a separate allocation governance sequence. No live project eligibility assessment has been completed.

## 5. Show settlement safeguards (60 seconds)

Open a known payout only if a real onchain record exists. Current deployment has none, so leave the payment ID blank and state no payout has occurred. Explain that a beneficiary acknowledgment is an attestation and EOA settlement remains unverified unless a causal external transfer receipt is available. No automatic retry or reservation release occurs for uncertain transfers.

## 6. Close with evidence labels (30 seconds)

Summarize: deployments and three member-add governance transactions are **VERIFIED LIVE**; software checks are **TESTED LOCALLY**; Rabby-specific popup compatibility, vault registration, deposits, funding, validator evidence results, payouts, refunds and repayments are **NOT YET VERIFIED LIVE**. Direct reviewers to [LIVE_PROOFS.md](../LIVE_PROOFS.md), [BUILD_STATUS.md](../BUILD_STATUS.md), and [REVIEWER_SUBMISSION.md](REVIEWER_SUBMISSION.md).

## Screenshot-ready views

Use the real-data dashboard with no sample fixture mode. Recommended captures are: (1) zero treasury plus mandate panel; (2) the actual timelocked member proposal and deadline; (3) project index showing no registered project; (4) the vault's actual zero balance; (5) payout panel showing no payment record or unavailable data. Include the application header's StudioNet chain label and the read-status message. Do not create an image of a hypothetical successful registration, transfer, eligibility assessment, or payout.
