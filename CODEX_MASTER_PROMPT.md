# Codex Implementation Handoff — MandateOS

You are taking over an intentionally **incomplete, lab-only** GenLayer repository, `MandateOS`. **Do not return only a plan or a checklist.** Inspect the entire unzipped repository first, perform implementation and test work in its existing folder, and leave the project demonstrably more complete. Preserve the architecture and the financial safety requirements. Work in explicit verified gates, report remaining blockers accurately, and do not claim the whole project is finished until all mandatory gates pass.

**Authorized GitHub destination: https://github.com/Chinny070/MandateOS** (owner `Chinny070`, repository `MandateOS`, target branch `main`). This destination was supplied by the user. Before pushing, verify repository identity, branch state and remote permissions. If the remote is empty, initialize/push a coherent `main` branch. If it contains commits by the time you work, fetch and reconcile them first. Never force-push or overwrite user work. Commit and push completed, actually tested milestones when credentials/network permit; if access is blocked, preserve local commits and report the blocker and commands to resume.

## Absolute product boundary

MandateOS is an **all-StudioNet GenLayer Intelligent Contract application**, not a Solidity or ERC-20 trading system. StudioNet expected chain ID `61999`, RPC `https://studio.genlayer.com/api`, native token `GEN`. No Bradbury, no separate EVM chain, no DEX, no fake token prices, no simulated “investment profits” on a real-data UI. Do not treat offchain investment contracts as automatically enforced onchain.

MandateOS combines:

1. **MandateOS Core**: GEN custody; DAO member governance and voting; versioned investment mandates; evidence-based project eligibility; registered vaults and beneficiary allowlists; portfolio/risk accounting; challengeable allocation decisions; asynchronous transfer accounting; reporting, security controls and immutable audit receipts.
2. **Reusable ProjectVault**: separate GenLayer IC per funded project; authenticated payable funding; locked GEN; grant, repayable-financing and revenue-share agreements; milestone submissions/independent assessment; challenge windows; partial, capped releases; default and refund logic; actual repayments and distributions; solvency and audit receipts.
3. **Evidence and Web Engine**: native `gl.nondet.web.get`, `gl.nondet.web.render` in text/html/screenshot modes; external filing/news/project disclosures; authentic publication vs onchain transaction timestamps; source reliability tiers; archived snapshots and cryptographic content commitments; bounded validator-verifiable classification; material uncertainty fails closed; scheduled freshness checks; onchain audit references.
4. **Governance and Appeals**: member registry, votes/quorum, proposal deadlines/timelocks, mandate versioning, upgrade controls, transaction-specific allocations and milestone/default/refund challenges, bounded appeals, permissionless expiry and emergency policy.
5. **Risk and financial accounting**: treasury liquid GEN, reserved commitments, vault-held GEN, disbursed principal, overdue repayment claims, collected principal, realized returns, impairments and failed/unresolved message value; exposure concentration includes pending and funded positions; reserve checks on actual unencumbered funds; no double counting of internal transfers or repayments.
6. **Keeper and independent reconciler**: external noncustodial service triggers allowed permissionless maintenance, tracks accepted/finalized/failed parent and child tx, checks actual onchain balances and destination state, archives receipts and raises unknown/lost-value alerts. No arbitrary privileged spending key.
7. **Real-data frontend**: React + TypeScript + Vite + compatible GenLayerJS; wallet connection; member governance, proposal, vault, milestones, appeal, evidence provenance, timestamp, repayments, transactions and portfolio risk screens. Responsive on mobile; no mocked protocol telemetry or fabricated histories.
8. **Security, tests and delivery**: static linter, unit/Direct Mode, validator consensus, end-to-end live StudioNet and negative/fuzz/invariant checks, deployment artifacts, receipts, source digest and reproducible guides.

The user's core design principle: **govern the mandate, not every transaction**. DAO members vote on the rules and exceptions; eligible decisions progress by policy and finality; members can challenge a particular allocation/payment rather than voting on each one.

## Read and compare the starting files

Read `README.md`, `AGENTS.md`, `BUILD_STATUS.md`, `docs/{ARCHITECTURE,FINANCIAL_MODEL,EVIDENCE_MODEL,STATES,TEST_MATRIX,DECISIONS}.md`, and every existing contract/test file. `contracts/mandate_os.py` and `contracts/project_vault.py` are *LAB-ONLY* proof scaffolds. Their administrator-only funding methods are **not acceptable final investment authorization**. The local reference model (`reference/risk_model.py`) is not an onchain risk check. There are no StudioNet proofs yet.

Review primary official docs before selecting SDK/CLI versions:
- https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers
- https://docs.genlayer.com/developers/intelligent-contracts/features/messages
- https://docs.genlayer.com/developers/intelligent-contracts/features/interacting-with-intelligent-contracts
- https://docs.genlayer.com/developers/intelligent-contracts/features/web-access
- https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context
- https://docs.genlayer.com/developers/intelligent-contracts/storage
- https://docs.genlayer.com/developers/intelligent-contracts/testing
- https://docs.genlayer.com/api-references/genlayer-test/direct
- https://docs.genlayer.com/developers/intelligent-contracts/features/upgradability

A critical GenLayer fact: `other.emit(value=amount, on='finalized').payable_method(...)` queues a **child transaction after parent finalization**, and a failed value-carrying child transaction is not automatically refunded. Only the immediate caller (`gl.message.sender_address`) authenticates the other IC. Use native u256 wei; `1 GEN = 10**18 wei`. Do not call a transfer settled until child success, recipient state and accounting are independently reconciled.

## Implement in stages, with concrete outputs and tests

### Gate 0 — Environment and baseline

1. Identify OS/Python/Node/GenLayer CLI SDK versions and compatible GenVM dependency tag. Pin versions in reproducible manifests. Do not conflate `studioDevnet` preview (may use another chain ID) with StudioNet 61999.
2. Run Python syntax, `genvm-lint`, local `pytest`, Direct Mode. If the runner cannot load, fix tool/environment root cause instead of modifying contract semantics or calling tests passed.
3. Probe target RPC / expected chain ID before any write. If RPC responds 403, times out or reports wrong ID, stop chain writes, record diagnostic and continue local work without fake deployment.
4. Review and harden both prototype contract interfaces, GenLayer storage annotations, authentication, payable mechanics, and GEN balance checks. Verify `TreeMap`/`DynArray` and date APIs against *installed* version.

### Gate 1 — Proven native GEN custody and round trip

1. Implement controlled test funding: EOA payable deposit -> MandateOS balance -> finalized IC-to-IC value-bearing funding -> ProjectVault authenticated receive -> settlement verification -> approved refund -> finalized reverse value transfer -> MandateOS authenticated receive.
2. Record uniquely scoped transfer IDs; guard against replays, unauthenticated callers, incorrect project/vault mapping, overfunding, inaccurate value or insufficient balance.
3. Use an explicit `PENDING / CHILD_SUCCESS / CHILD_FAILED / UNKNOWN / VALUE_AT_RISK / VERIFIED` transfer ledger and an independent offchain reconciler reading parent/child receipt IDs. **Never retry unknown child transfers automatically.**
4. Make the treasury and vault money invariant tests survive parent success with failed child, accepted-not-finalized, multiple funding requests, duplicate receiving call and partial returns.
5. Deploy two actual ICs to StudioNet **only if accessible**, fund via faucet GEN, save real transaction IDs and before/after balances for successful and failed paths. Do not make up hashes or claim funds reached a vault because `emit()` returned.

### Gate 2 — DAO mandates and risk enforcement

Replace single-administrator money authority with explicit and tested governance. Add members, voting weights/quorum, proposal expiry, versioned/immutable mandates, delayed and auditable governance changes. Separate emergency stop from unrestricted spending or upgrade access. Implement project registration/identity/beneficiary binding; deterministic caps and reserves. Cover pending commitments, vault-held funds and unpaid principal in exposure limits. Mark policy version on every evaluation and authorization. Allow new allocation only after eligible, validator-backed assessment and application challenge window. Deny stale evidence and unresolved challenges. Separate proposed, authorized and verified funded states. No operator, keeper or single deployer bypass.

### Gate 3 — Real web evidence, timestamps and GenLayer consensus

Integrate real `gl.nondet.web.get()` and `gl.nondet.web.render(..., mode='text'|'html'|'screenshot')` where runtime supports them. Run inside nondeterministic functions; use an Equivalence Principle that checks decision-bearing facts and tolerates reasonable HTML variation while remaining strict about material claims. Avoid strict full-page equality for volatile news pages. Provide independent validator tests with changing source content, manipulated results, missing sources and malicious page instructions. Validate allowed domains, bounded request sizes, redirects and SSRF risks. Record source URL, claimed publication date, UTC chain-transaction assessment timestamp, freshness expiry, SHA-256 evidence commitment, snapshot reference, assessment version, mandate digest, structured eligibility result, and final transaction record. Publication time and assessment time are not interchangeable. The keeper only triggers refresh; the contract evaluates validity. Screenshot support must be proven live or marked blocked.

### Gate 4 — Full ProjectVault agreements and disputes

Support grant, repayable and revenue-sharing agreement modes with immutable or explicitly governed terms. Implement independently evaluated milestone evidence, bounded rebuttal/challenge windows, deadlines, releases with unique payment IDs, allowlisted recipients, partial payouts, refundable *undistributed* GEN, repayment/payable deposits, waterfall accounting, grace/overdue/default and re-evaluation, revenue distributions of GEN actually received, application appeals, expiry, cancellation and closure. No promise of forced collection from an external wallet. Use permissionless but authenticated-by-state deadline handling, `on='finalized'` for money messages, full child receipt verification and safe recovery states. Challenge must freeze only relevant unresolved payments unless a project-wide risk rule applies. Keep challenge cycles finite.

### Gate 5 — Keeper, dashboard and multi-vault live demonstrations

Noncustodial keeper with scheduling for real-source reviews, repayment deadlines, challenge expiry, ongoing reconciliation and alerts, idempotent handlers and backoff; key has no unilateral spending authority. Frontend uses live wallet and actual `genlayer-js` calls, no fake metrics, no wallet private keys on the server, displays finalization and child-settlement state. Support mobile 375px. Prove at least two separate project vaults and multiple members/operators, one eligible and one rejected project, challenged allocation, denied milestone and accepted milestone, partial GEN payout, remaining GEN refund, GEN repayment, treasury distribution and accurate rollup.

### Gate 6 — Audit and release

Run regression, adversarial/protocol-level and invariant tests (risk, balance, double spend, parent/child failure, source spoofing, prompt injection, stale info, wrong caller, data corruption, timing edge cases, reentrancy/replay where relevant). Do not ignore linter failure, runner import errors, real consensus mismatches or unsupported API calls. Document security model, emergency recovery constraints, key roles, fees/resource caps, upgrades, operational runbook and financing limitations. Keep code hashes, actual transactions, addresses and account balance snapshots. Preserve honest `PASS/PARTIAL/BLOCKED/FAIL` gates.

## Non-negotiable details easy to miss

- Challenge each trade and milestone specifically; no mandatory vote per payment.
- Distinguish native GenLayer consensus appeals from application-level member objections.
- Separate proposed investments, commitments, escrowed GEN, principal advanced, revenue due, paid returns and realized losses.
- Holding native GEN is not proof of ERC-20 token holdings, securities ownership or a guaranteed investment return.
- Source freshness, screenshot rendering, source provenance, onchain timestamps, and archived content digests are first-class features.
- Preserve historical mandate/evidence versions and reproducible validator decision conditions.
- Child tx may fail *after* parent finalized; tracking only parent `FINALIZED` is not enough.
- No permissionless method may accidentally become a withdrawal method.
- No sweeping 'admin rescue all funds' bypass and no uncontrolled single-key contract upgraders.
- Multiple roles/wallets and independent project operators in live tests; no hardcoded dummy receipts.
- StudioNet is a hosted development environment with simulated GEN; not economic returns or real investment custody.

## Reporting format and deliverables

Work in the repository: actually implement code, tests, scripts, documentation, frontend and any required keeper. Commit coherent milestones locally. Keep `BUILD_STATUS.md` updated after each gate. Return:

1. Exact files changed and git commit IDs.
2. Versions, lint/test commands and authentic pass/fail counts (unit vs Direct Mode vs StudioNet separately).
3. Current MandateOS and ProjectVault addresses, code hashes, receipt links and balance proofs **only if actually deployed**.
4. Tests for unauthorized transfer, concentration limit, challenged release, duplicate settlement, failed child transaction and real evidence rendering.
5. Every remaining limitation; one of PASS / PARTIAL / BLOCKED / FAIL per gate.
6. GitHub push status and verified remote branch/commit at `https://github.com/Chinny070/MandateOS`; never claim a push without confirming the resulting remote SHA.

If a live dependency blocks progress, do as much independent, verified work as possible and stop short of false claims. Never substitute mock source pages, fixture balances or synthesized JSON transaction receipts for the required live StudioNet evidence.

**Begin now by inspecting repository files and tooling, implementing fixes and tests for Gate 0 and Gate 1, and continue through subsequent gates when actual results allow. Do not merely restate this plan.**
