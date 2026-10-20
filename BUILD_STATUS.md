# MandateOS build and deployment status — 2026-10-20

- **Branch:** `codex/onchain-governance`
- **Deployment source commit:** `b7bb8bc252cc4528bf67c3ac04c4dfbafcb9684f`
- **Deployment status:** Core and one ProjectVault are deployed and finalized on StudioNet.
- **Verified live scope:** Core and ProjectVault deployment, one separately authorized MEMBER_ADD proposal, and one separately authorized founder YES vote. No investment, payout, refund, repayment, or test GEN transfer.
- **Production verdict:** **NO-GO**. Deployment does not establish financial-cycle, governance, evidence, settlement, or production readiness.

## Deployed contracts

- **MandateOS Core:** `0x32698630D6144882Bd0c1D5B00C74348c53ea58B`; transaction `0x8c5c53afc9e6f8958688df572e946dc8c3880133a388bf98640615e5fd1841a7`; `FINALIZED / MAJORITY_AGREE / leader SUCCESS`.
- **ProjectVault** for `mandateos-demo-001`: `0x03325B7EB2668CfF6bE3B2e9805d600bB9E1a2F4`; transaction `0xd42a4c5dcb6a25ba7909eb312239d21bc8c27ffa2ef4b3cd1c33e320b5931d39`; `FINALIZED / MAJORITY_AGREE / leader SUCCESS`.
- Constructor arguments: Core `[]`; ProjectVault `[Core address, "mandateos-demo-001"]`.
- SHA-256: Core `a0cad2bdc2a7be57d5e80e4f681d5f0897708bcf8b6ace53a81480c2e849a5d4`; ProjectVault `2da278f14385feee0191dfd2ed9d8cfe0c29a03d5138aa638885f179f9be3c33`.
- Both raw EVM receipts: status `0x1`, gas used `8,000,000`, effective gas price `0`; recorded EVM fee `0 GEN` each. Total actual EVM fees `0 GEN`, committed fees `0`, unknown fee liabilities `0`; full `10 GEN` ceiling remains in the ledger. This is the observed fee for these transactions, not a guarantee for later activity.
- Finalized readbacks: Core treasury/balance zero; initial deployer weight `1`; no registered projects. ProjectVault points to the Core, reports the exact project ID, and has zero balance. The vault is not registered in Core; registration requires governance.

See [LIVE_PROOFS.md](LIVE_PROOFS.md) and the deployment journal for transaction evidence and readbacks.

## Verification on the deployment commit

- `python -m compileall -q contracts reference keeper tests` — passed.
- `python -m pytest -q` — **116 passed**.
- `python -m pytest tests/direct -q` — **39 passed**.
- `genvm-lint check contracts/mandate_os.py` — passed; 3 lint checks; 58 methods (20 views, 38 writes).
- `genvm-lint check contracts/project_vault.py` — passed; 3 lint checks; 64 methods (35 views, 29 writes).
- `cd web; npm test -- --run` — **12 passed**; `npm run typecheck` — passed; `npm run build` — passed. Vite emitted a non-blocking large-chunk warning.
- `node --check deploy/01_studionet.js` and `node --check deploy/cli-deployment.cjs` — passed.
- `node --test scripts/deployment-runner.test.cjs scripts/cli-deployment.test.cjs scripts/deployment-safety.test.cjs` — **13 passed**.
- PowerShell parser and clean-tree preflight regression check — passed. A prior actual preflight exposed a null `.Trim()` bug; it was fixed in commit `b7bb8bc` and pushed before deployment. The failed preflight stopped before signer or transaction activity.
- StudioNet preflight: `eth_chainId=0xf22f`, `eth_gasPrice=0x0`; CLI `0.39.1`, bundled GenLayerJS `1.1.8`, active network `studionet`, configured signer alias `my-studionet-wallet`.
- Linter's latest-version lookup encountered Windows `WinError 10013`; cached GenVM lint and semantic validation completed successfully. This host restriction is not evidence of a StudioNet outage.

## Remaining blockers and next actions

1. The Rabby MEMBER_ADD proposal is in `VOTING` with one founder YES vote. Wait for its actual onchain deadline, then separately authorize finalization, wait the execution timelock, and separately authorize execution. Rabby currently has weight `0`.
2. Core currently has no registered vault. Register it through finalized governance before financing.
3. Two-wallet governance, treasury deposits/funding, evidence evaluation, IC-recipient payout, repayments, refunds and keeper reconciliation still need controlled live testing and separate approvals.
4. EOA payouts remain unverified and must not be used for production settlement. No automatic retry or reservation release is allowed for uncertain transfers.
5. The former GenLayerJS 2 RC `sim_getFeeConfig` dependency is removed from dashboard writes. Current unit-tested zero-value writes recheck the exact EVM gas estimate and gas price before wallet approval. Live Rabby writes and child-message fee allocation remain unverified.

The first financial test remains capped at `0.01 GEN` and requires its own explicit authorization. No branch merge occurred; `main` remains unchanged.

## Membership onboarding preparation (from `c5f1bcfddd20063cef46fea8c3deeda1b6f5b3ae`)

- **Onchain preflight:** read-only latest-final queries on StudioNet returned proposal count `0`, candidate `member-add-rabby-1af111b06e6f6a05-20261020-01` unused/status `UNKNOWN`, founder weight `1`, Rabby weight `0`; latest EVM block timestamp `1792455328` (`2026-10-20T00:15:28Z`).
- **Governance settings from deployed source:** quorum/approval `6666` bps, voting `86400` seconds, execution delay `86400` seconds, execution window `604800` seconds. Deployed source hash matches the recorded source; these values have no public getter or setter.
- **Exact read-only member-add fee quote:** at `2026-10-20T00:15:28.923Z`, GenLayerJS `1.1.8`, exact `propose_member_add` calldata, gas estimate/limit `500000`, current `eth_gasPrice=0 wei`, maximum EVM fee commitment `0 GEN`, attached value `0`. A fake provider stopped before wallet/broadcast. The quote is time-sensitive and the signer route rechecks it before signing.
- **Preparation and live update:** dashboard pins stable `genlayer-js@1.1.8`; its provider guard fails closed on RPC/estimate errors and checks account, chain, destination, fee quote and zero transfer value before opening a wallet popup. Read-only planner: `scripts/membership-onboarding-status.mjs`. One-step resumable CLI signer workflow: `scripts/member-onboarding-cli.cjs`; deployment runner dispatch is gated by an explicit per-step membership approval token. The live proposal and vote are documented below; this preparation history records that no wallet was unlocked or governance write attempted at that earlier point.
- **Subsequent vault registration:** target vault and project are fixed, but `cap_wei` and a supported evidence digest are not supplied. Two active members are not enough by themselves: the two-member snapshot requires both distinct members to vote YES to reach quorum and approval.
- **Verification on this preparation worktree:** `python -m compileall -q contracts reference keeper tests` — passed; `python -m pytest -q` — **116 passed**; `python -m pytest tests/direct -q` — **39 passed**; both `genvm-lint check` commands — passed (3 checks each); dashboard `npm test` — **15 passed**, `npm run typecheck` — passed, `npm run build` — passed (Vite large-chunk advisory); CLI/deployment/membership Node tests — **18 passed**; onboarding scripts `node --check` — passed. Linter latest-version lookup still emits a blocked `WinError 10013` warning but uses cached GenVM and completes both lint validations.
- `git diff --check` — passed. `npm install` audit reported **0 vulnerabilities**. No contract sources or deployed bytecode were modified. Local tests do not establish a live Rabby signature or validator-backed governance.

## Live MEMBER_ADD proposal and founder vote — 2026-10-20

- **Network/Core:** StudioNet chain `61999`; Core `0x32698630D6144882Bd0c1D5B00C74348c53ea58B`.
- **Proposal:** `member-add-rabby-1af111b06e6f6a05-20261020-01` for Rabby `0x1Af111b06E6f6A05Bd41572A016318f1356aF85c`.
- **Proposal transaction:** `0xc1e14ac8f3019cb5996b03f1d4e443b787c2f69cf4f7ecb0c473f3c3907b4264`; `FINALIZED / MAJORITY_AGREE / leader SUCCESS`; EVM status `0x1`; actual fee `0 GEN`.
- **Founder YES transaction:** `0x623fcedd7df12e20710e5857760d8b07d995fa527ad16bd7689b0a20efe85558`; `FINALIZED / MAJORITY_AGREE / leader SUCCESS`; EVM status `0x1`, gas used `0x7a1200`, effective gas price `0x0`, actual fee `0 GEN`.
- **Latest-final state:** proposal `VOTING`; votes for `1`, against `0`; snapshot weight `1`; voting deadline `1792562587`; latest chain timestamp `1792478535`; founder weight `1`; Rabby weight `0` until proposal execution.
- **Budget:** actual fees `0`, committed fees `0`, unknown fee liabilities `0`, remaining cumulative ceiling `10 GEN`; no test value transferred.
- **Next step:** wait until the latest chain timestamp reaches the onchain voting deadline. Finalization and execution require their own explicit authorization. No other governance or financial transaction was submitted.
