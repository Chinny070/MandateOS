# Live StudioNet proofs

## VAULT_REGISTER proposal — 2026-10-22

The separately authorized proposal call was submitted once through the corrected GenLayer CLI workflow. StudioNet transaction **`0x5c4d7be9022b288f035db21f40cc69de6f662bbe2953fcbba8fd69a8933a8d36`** finalized with `MAJORITY_AGREE` and leader `SUCCESS`. The matching EVM receipt has status `0x1`, gas used `0x7a1200`, effective gas price `0x0`, and actual fee `0 wei` (`0 GEN`). Attached GEN was zero.

Latest-final reads at `2026-10-22T10:18:12.724Z` confirm kind `VAULT_REGISTER`, status `VOTING`, 0 YES / 0 NO, membership snapshot total 2, founder weight 1 and Rabby weight 1. The exact proposal timing is `votingEndsAt=1792750652` (**2026-10-23 10:17:32 UTC / 11:17:32 Africa/Lagos**); `executeAfter` and `executeBy` are zero until finalization. The call used project `mandateos-demo-001`, vault `0x03325B7EB2668CfF6bE3B2e9805d600bB9E1a2F4`, cap `1000000000000000` wei, and approved metadata digest `sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4`. The digest remains registration metadata only; eligibility is not assessed.

The budget ledger records zero actual and committed fees, zero unresolved liabilities, and `10 GEN` remaining. No vote, finalization, execution, treasury deposit, or GEN transfer occurred. Full transaction and readback record: `deployments/vault-registration-journal.json`.

## 2026-10-22 VAULT_REGISTER proposal workflow preparation

Correction to this preparation note: calldata is reproduced offline with pinned GenLayerJS 1.1.8 and compared byte-for-byte against the signer request. The offline fake RPC returns a dummy local hash and never accesses StudioNet or broadcasts. Current verification: 116 pytest; 25 Node script tests; 21 frontend tests; Python compileall; frontend typecheck/build; both GenVM lint checks passed (3 checks each) with the cached runner. New-runner lookup hit `WinError 10013`. These are local checks only.

The live proposal attempt subsequently reached the signer hook and was rejected before the underlying signer was called: GenLayer CLI's request uses `request.account.address`, while the first guard version expected `request.from`. The guard was corrected and regression-tested, but this execution stopped as required on the failed check. No signature, broadcast, transaction hash, receipt, or fee exists; the live proposal remains unsubmitted by this task. See `deployments/vault-registration-journal.json`. The current authorization was not reused after the failure.

Final local script verification after correcting the signer request-field guard: **26 Node tests passed**. The corrected guard was not exercised against a wallet signer or retried on StudioNet under the stopped authorization.

A safe one-step signer route was missing, so `scripts/vault-registration-cli.cjs` and a gated dispatch in `deploy/01_studionet.js` were added and tested. The route verifies StudioNet chain 61999, founder CLI signer, both latest-final member weights, unused proposal ID, unregistered project, ProjectVault's parent/project readbacks, and the canonical metadata digest against the parameter-only approval. It signs only the exact approved calldata with zero attached GEN and rejects any nonzero signed fee commitment. It journals before signature, permits at most one signature, waits for FINALIZED/MAJORITY_AGREE/leader SUCCESS, checks a matching successful EVM receipt and zero actual fee, then reads proposal status, membership snapshot, and actual timing. Any ambiguous result blocks replay. Local tests passed (116 pytest, 24 Node script tests, 21 frontend tests; compileall/typecheck/build passed). GenVM lint was unavailable in this current environment. **No registration proposal transaction is claimed here until independently read and verified on StudioNet.**

**MandateOS Core and the first ProjectVault are deployed and independently checked on StudioNet (chain ID 61999).** Deployment was explicitly authorized on 2026-10-20 (Africa/Lagos), with a 10 GEN cumulative fee ceiling. No treasury deposit, project funding, governance write, payout, repayment, or GEN test transfer was authorized or performed.

## MandateOS deployment

| Item | MandateOS Core | ProjectVault |
|---|---|---|
| Contract address | `0x32698630D6144882Bd0c1D5B00C74348c53ea58B` | `0x03325B7EB2668CfF6bE3B2e9805d600bB9E1a2F4` |
| Deployment transaction | `0x8c5c53afc9e6f8958688df572e946dc8c3880133a388bf98640615e5fd1841a7` | `0xd42a4c5dcb6a25ba7909eb312239d21bc8c27ffa2ef4b3cd1c33e320b5931d39` |
| Constructor arguments | `[]` | `[0x32698630D6144882Bd0c1D5B00C74348c53ea58B, "mandateos-demo-001"]` |
| Local source SHA-256 | `a0cad2bdc2a7be57d5e80e4f681d5f0897708bcf8b6ace53a81480c2e849a5d4` | `2da278f14385feee0191dfd2ed9d8cfe0c29a03d5138aa638885f179f9be3c33` |
| GenLayer receipt | `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS` | `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS` |
| Validator result | 5 agree | 3 agree, 2 idle; finalized majority agreement |
| EVM receipt | status `0x1`; gas used `0x7a1200` (8,000,000); effective gas price `0x0` | status `0x1`; gas used `0x7a1200` (8,000,000); effective gas price `0x0` |
| Recorded EVM fee | `0 GEN` | `0 GEN` |

The GenLayer receipts returned the contract addresses shown above and decoded the constructors. The raw EVM receipts identify successful transactions to the StudioNet consensus entrypoint (`contractAddress` is null in those EVM receipts); contract addresses are verified from the finalized GenLayer deployment receipts. The script also checked the raw EVM receipt hash against each submitted transaction ID.

## Finalized state readbacks

- Core `get_balance_wei()` returned `0`; `get_treasury_summary()` returned `[0, 0, 0, 0, 0, 0]`.
- Core reports the deploying signer’s initial member weight as `1` and registered project count `0`.
- Core `get_vault_address("mandateos-demo-001")` is empty. This is expected: ProjectVault deployment does not register it, and no governance transaction was authorized.
- ProjectVault `get_parent_address()` returned the Core address above; `get_project_id()` returned `mandateos-demo-001`; `get_balance_wei()` returned `0`.
- Deployment receipts report `value_credited: false`. No GEN value was attached to either deployment.

## Budget and scope

- Cumulative fee ceiling: `10 GEN` (`10000000000000000000 wei`).
- Actual EVM deployment fees recorded: `0 GEN`; fee commitments: `0 GEN`; unknown fee liabilities: `0 GEN`; remaining ledger ceiling: `10 GEN`.
- The zero fee result is specific to these two receipts; it is not a future fee guarantee.
- First financial-test transfer ceiling remains `0.01 GEN`, separately authorized. Actual test value and committed test value are both zero.
- At the time of the deployment-only authorization, no governance or financial transaction had been submitted. A later, separately authorized MEMBER_ADD proposal and founder vote are recorded below. No vault registration, treasury funding, investment, payout, refund, repayment, or GEN test transfer has been submitted.

## Other evidence and limitations

- StudioNet `eth_chainId` returned `0xf22f`; current `eth_gasPrice` returned `0x0` at preflight. These are time-specific read-only observations.
- SpecLock deployment and triggered-transfer receipts remain external reference evidence only. They do not establish MandateOS payout settlement.
- EOA payouts remain unverified and unsuitable for production until MandateOS independently reconciles a causal external transfer receipt. Do not retry uncertain transfers.
- Two-member DAO voting is now enabled by the verified Rabby membership execution. A Rabby-signed vote has not yet been tested. Live funding, validator-backed web evidence, IC-beneficiary payouts, refunds, repayments and keeper reconciliation have not been exercised.
- Local tests and GenVM lint are reported in `BUILD_STATUS.md`; they are not live settlement evidence.

## Repository evidence

- Deployment journal: `deployments/studionet-deployment-record.json`.
- Fee and value ledger: `deployments/studionet-budget.json`.
- Address configuration: `deployments/studionet.json`.
- `main` was not changed or merged.

## Read-only governance onboarding preflight

On 2026-10-20, read-only latest-final queries against the deployed Core reported proposal count `0`, candidate member-add ID `member-add-rabby-1af111b06e6f6a05-20261020-01` absent from the index and `UNKNOWN`, founder weight `1`, and Rabby weight `0`. The latest EVM block timestamp returned was `1792455328` (`2026-10-20T00:15:28Z`). These are state observations only; no proposal or vote transaction was submitted.

At `2026-10-20T00:15:28.923Z`, the exact stable GenLayerJS 1.1.8 `propose_member_add` call was run with a fake EIP-1193 provider that threw before wallet or broadcast. The StudioNet RPC returned chain `0xf22f`, `eth_estimateGas=500000`, transaction gas limit `500000`, `eth_gasPrice=0`, and therefore a current maximum EVM fee commitment of `0 GEN`; attached value was zero. No transaction hash was created. This fee quote must be repeated before a future signature; a zero current quote does not guarantee future transaction fees.

The proposed transaction is `MandateOS.propose_member_add("member-add-rabby-1af111b06e6f6a05-20261020-01", "GvERsG5vagW9QVcqAWMY8TVq+Fw=")`. The encoded string resolves to the exact Rabby address listed above. The candidate ID remains unused as of the read-only observation.

The 10 GEN cumulative ledger remains unchanged: actual fees `0`, committed fees `0`, unknown fee liabilities `0`, remaining `10 GEN`. No DAO treasury funding, project financing, payout, refund, repayment, or test transfer was performed. The read-only checks above do not prove live wallet signing or validator consensus; the actual governance actions and their receipts are recorded below.

## Separately authorized live member-add proposal and founder vote

The founder separately authorized one `propose_member_add` transaction and later one `vote(proposal_id, true)` transaction. Both were submitted through the gated GenLayer CLI workflow on StudioNet; no additional transaction was submitted.

| Stage | Transaction | Result | EVM receipt | Actual fee |
|---|---|---|---|---|
| `propose_member_add` | `0xc1e14ac8f3019cb5996b03f1d4e443b787c2f69cf4f7ecb0c473f3c3907b4264` | `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS` | status `0x1`; gas used `0x7a1200`; effective gas price `0x0` | `0 GEN` |
| founder `vote(..., true)` | `0x623fcedd7df12e20710e5857760d8b07d995fa527ad16bd7689b0a20efe85558` | `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS` | status `0x1`; gas used `0x7a1200`; effective gas price `0x0` | `0 GEN` |

The latest-final state read after the vote reported proposal ID `member-add-rabby-1af111b06e6f6a05-20261020-01`, kind `MEMBER_ADD`, status `VOTING`, votes for `1`, votes against `0`, voting deadline `1792562587`, founder weight `1`, and Rabby weight `0`. Latest chain timestamp at that historical read was `1792478535`, before the deadline. Finalization and execution were subsequently authorized and are recorded below.

The GenLayer receipt for the vote identifies the exact `vote` calldata, founder sender, Core recipient, `FINALIZED` status, `MAJORITY_AGREE`, and leader `SUCCESS`; the independent EVM receipt has status `0x1`, gas used `0x7a1200`, and effective gas price `0`. The budget ledger records these transactions, actual fees `0`, no pending or unknown liabilities, and `10 GEN` remaining. Zero fee is the observed result of these transactions, not a guarantee for future transactions.

## Separately authorized proposal finalization

The founder separately authorized exactly one `finalize_governance_proposal("member-add-rabby-1af111b06e6f6a05-20261020-01")` transaction. The CLI result and independent StudioNet receipt identify transaction `0xce45577d02ffa736a7ff0fbefd3f833289fb3544e223672eb75b31db1eb883e0` as `FINALIZED`, `MAJORITY_AGREE`, with leader execution `SUCCESS`. The EVM receipt has status `0x1`, gas used `0x7a1200`, effective gas price `0x0`, and actual fee `0 GEN`.

Latest-final readback reports proposal status `TIMELOCKED`, votes for `1`, against `0`, founder weight `1`, and Rabby weight `0`. Onchain `executeAfter=1792650476` is **2026-10-22 07:27:56 Africa/Lagos** (2026-10-22 06:27:56 UTC); this is the exact end of the 24-hour execution timelock. The onchain execution window closes at `executeBy=1793255276`, **2026-10-29 07:27:56 Africa/Lagos**. The readback's latest chain timestamp was `1792564201` (2026-10-21 06:30:01 UTC), before `executeAfter`. Rabby remains at weight `0`. Proposal execution, vault registration, and all financial transactions remain unsubmitted and require separate authorization.

## Saturday reviewer preparation read-only check — 2026-10-21

`node scripts/saturday-review-readonly.mjs` performed read-only latest-final StudioNet reads at `2026-10-21T07:13:29.863Z`. RPC returned chain ID `0xf22f`; latest chain block timestamp was `1792566806` (`2026-10-21 07:13:26 UTC`). The member proposal remained `TIMELOCKED`, with 1 YES / 0 NO, founder weight 1, and Rabby weight 0. The registration candidate `vault-register-mandateos-demo-001-20261022-01` returned status `UNKNOWN` and was absent from the indexed proposal IDs. This uniqueness observation is time-bound and must be repeated before any proposal.

The same reads returned Core treasury summary `[0,0,0,0,0,0]`, mandate `[version 1, max exposure 2000 bps, reserve 1500 bps, max single allocation 30 GEN, challenge window 86400 seconds, evidence freshness 604800 seconds]`, project count `0`, empty Core vault registration, ProjectVault parent equal to the Core, ProjectVault project ID `mandateos-demo-001`, and vault balance `0`. The deployed Core has no public view for `cap_for_project`; after registration, cap must be corroborated from the finalized proposal transaction/calldata and reported as not directly readable from the contract.

The owner approved preserving the project ID `mandateos-demo-001`, cap **0.001 GEN** (`1000000000000000` wei), and digest `sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4` on 2026-10-21. This is parameter approval only, not a transaction authorization; these values are not onchain. The approval record is `deployments/registration-parameter-approval.json`. The digest, prepared from `docs/evidence/mandateos-demo-001-registration.json`, commits deployment/project identity metadata only, has no external eligibility claims, and records `NOT_ASSESSED`; it is not a validator verdict. Any proposal still requires a separate explicit authorization, fresh state/uniqueness and calldata checks, and a current fee cap.

## Read-only refresh attempt — 2026-10-21 07:33 UTC

A fresh invocation of `node scripts/saturday-review-readonly.mjs` was attempted. It failed at `eth_chainId` with socket `EACCES` to StudioNet's Cloudflare endpoint from the current sandbox. No network-health conclusion can be drawn. The newest successful read remains the 07:13:29.863 UTC snapshot above; current state must be refreshed in an authorized network-capable environment before any governance action. No signer, transaction, or wallet was accessed.

The read-only command used is `node scripts/saturday-review-readonly.mjs`; its source imports no signer and contains no contract write method. No transactions, signatures, wallet unlocks, treasury deposits, GEN transfers, or deployment actions occurred during this check.

## Separately authorized Rabby membership execution — 2026-10-22

The owner authorized exactly one `execute_governance_proposal("member-add-rabby-1af111b06e6f6a05-20261020-01")` transaction with 0 attached GEN and a maximum fee of 0 GEN. The transaction is `0x90c256ce0e85cccf075337a9dbb19a8ead85b51fff5303934e8085134c2d6e6a` from the founder to MandateOS Core `0x32698630D6144882Bd0c1D5B00C74348c53ea58B`. StudioNet receipt reconciliation confirms `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS`, and five validator votes `agree`. The calldata decodes to the exact authorized method and proposal ID. The EVM receipt hash matches, status is `0x1`, gas used `0x7a1200`, effective gas price `0x0`, actual fee `0 wei` (`0 GEN`).

Latest-final Core reads at `2026-10-22T08:03:03.902Z` (latest chain timestamp `1792656172`, 08:02:52 UTC) confirm proposal status `EXECUTED`, kind `MEMBER_ADD`, 1 YES / 0 NO, founder weight `1`, and Rabby `0x1Af111b06E6f6A05Bd41572A016318f1356aF85c` weight `1`. The proposal timing remains `votingEndsAt=1792562587`, `executeAfter=1792650476`, `executeBy=1793255276`. The journal records this state and transaction. The fee ledger remains at actual fees `0`, committed fees `0`, unknown liabilities `0`, and `10 GEN` remaining. No further governance or financial transaction was submitted.
