# Start MandateOS in Codex

1. Unzip `MandateOS-Codex-Starter.zip` into your Codex workspace.
2. Open that folder as the project root in Codex.
3. Paste the instruction below:

> Read `AGENTS.md`, `CODEX_MASTER_PROMPT.md`, `BUILD_STATUS.md` and all files under `docs/`. Then inspect and improve the entire repository, implementing Gate 0 and Gate 1 first and continuing through the defined gates only when evidence supports progress. Do not return only a plan. StudioNet only, chain ID 61999. Never claim a live GEN transfer without verified parent/child receipts and balances. Keep `BUILD_STATUS.md` current, run the actual tests, and push verified changes to `https://github.com/Chinny070/MandateOS` on `main` when permitted, without force-pushing or overwriting any existing work.

4. Set up Python 3.12+ and the compatible GenLayer testing tools. Never put wallet seed phrases into agent prompts, code or chat messages.
5. Authorized GitHub destination: **https://github.com/Chinny070/MandateOS** (`main`). The remote was publicly observed empty when this handoff was prepared; Codex must check its actual state again before the first push. Do not force-push if that changes.

The starter is **lab-only**. Actual live network proof requires Codex network access, suitable wallet funding, deployed contract state and transaction receipts.
