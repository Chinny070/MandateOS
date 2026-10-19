# Codex agent instructions for this repository

Read `CODEX_MASTER_PROMPT.md`, `BUILD_STATUS.md`, `docs/ARCHITECTURE.md`, `docs/FINANCIAL_MODEL.md`, `docs/EVIDENCE_MODEL.md`, and `docs/TEST_MATRIX.md` first.

1. StudioNet only (chain ID 61999); never switch to Bradbury, Solidity, EVM DEX, ERC-20 or mock balances to fake success.
2. Initial `contracts/*.py` are LAB-ONLY, single-admin Gate 1 probes. Their apparent ability to transfer funds is NOT authorization to release capital in final product.
3. Do real implementation work, tests, then live proofs; never report a plan as implementation or a submitted transaction as a completed settlement.
4. Fix GenVM compatibility problems against installed pinned SDK and official docs; do not change core security/economic semantics to bypass failures.
5. Do not introduce broad administrator withdrawal powers, contract-wide trusted-operator fallbacks or automatic resend of uncertain child fund transfers.
6. Keeper and frontend have NO independent spending authority; sources are untrusted; governance requires member approval and delay.
7. Keep every gate report honest: PASS / PARTIAL / BLOCKED / FAIL, supporting commands, logs, hashes, addresses, source hash and balance evidence.
8. Authorized destination is `https://github.com/Chinny070/MandateOS` on `main`. Fetch before pushing if populated; never force push, overwrite remote changes or reveal wallet keys. If authentication or network access fails, commit locally and state that the push is blocked.
