const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const sourceRoot = path.resolve(__dirname, "..");
const addressCore = "0x0123456789abcdef0123456789abcdef01234567";
const addressVault = "0xabcdef0123456789abcdef0123456789abcdef01";
const consensus = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575";

function makeFixtureRepo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mandateos-cli-deploy-fixture-"));
  const realRoot = fs.realpathSync(root);
  assert.equal(path.dirname(realRoot), fs.realpathSync(os.tmpdir()), "fixture must stay directly inside the OS temp directory");
  t.after(() => {
    const resolved = fs.realpathSync(root);
    if (path.dirname(resolved) !== fs.realpathSync(os.tmpdir()) || !path.basename(resolved).startsWith("mandateos-cli-deploy-fixture-")) {
      throw new Error("Refusing to remove a path outside this test's isolated temp fixture.");
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  });

  for (const relative of ["deploy/01_studionet.js", "deploy/cli-deployment.cjs", "scripts/deployment-safety.cjs"]) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, relative), target);
  }
  for (const relative of ["contracts/mandate_os.py", "contracts/project_vault.py"]) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `# deterministic source fixture: ${relative}\n`);
  }
  fs.mkdirSync(path.join(root, "deployments"), { recursive: true });
  fs.writeFileSync(path.join(root, "deployments/studionet-budget.json"), `${JSON.stringify({
    schema_version: 1,
    currency: "GEN",
    ceiling_wei: "10000000000000000000",
    actual_fees_wei: "0",
    committed_fees_wei: "0",
    actual_test_value_wei: "0",
    committed_test_value_wei: "0",
    unknown_liabilities_wei: "0",
    unknown_fee_liabilities_wei: "0",
    unknown_test_value_liabilities_wei: "0",
    first_test_value_ceiling_wei: "10000000000000000",
    pending_fee_quote_wei: null,
    pending_transaction_id: null,
    remaining_wei: "10000000000000000000",
    status: "PREPARED_NO_SPEND",
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "deployments/studionet-deployment-record.json"), `${JSON.stringify({
    schema_version: 1, status: "PREPARED_NOT_AUTHORIZED", contracts: {}, source_hashes: {},
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "deployments/studionet.json"), "{}\n");
  execFileSync("git", ["init", "--initial-branch=codex/onchain-governance"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Deployment Fixture"], { cwd: root });
  execFileSync("git", ["config", "user.email", "fixture@example.invalid"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "deployment runner fixture"], { cwd: root, stdio: "ignore" });
  return root;
}

function mockCliClient({ estimatorFails = false } = {}) {
  const deployments = [];
  const signed = [];
  const client = {
    account: {
      type: "local",
      address: "0x9999999999999999999999999999999999999999",
      async signTransaction(request) { signed.push(request); return "0xmock-signature"; },
    },
    chain: { consensusMainContract: { address: consensus } },
    async request({ method, params }) {
      if (method === "eth_chainId") return "0xf22f";
      if (method === "eth_gasPrice") return "0x2";
      if (method === "eth_getTransactionReceipt") return {
        transactionHash: params[0], status: "0x1", gasUsed: "0x10", effectiveGasPrice: "0x2",
      };
      throw new Error(`Unexpected fixture RPC method: ${method}`);
    },
    async estimateTransactionGas() {
      if (estimatorFails) throw new Error("fixture gas estimation error");
      return 100000n;
    },
    async deployContract(params) {
      const index = deployments.length;
      deployments.push(params);
      try { await this.estimateTransactionGas({}); }
      catch { /* Simulate the installed SDK's fallback to 200,000 gas. */ }
      await this.account.signTransaction({
        chainId: 61999,
        gas: estimatorFails ? 200000n : 100000n,
        gasPrice: 2n,
        to: consensus,
        value: 0n,
      });
      return `0x${String(index + 1).padStart(64, "0")}`;
    },
    async waitForTransactionReceipt({ hash, status, fullTransaction }) {
      assert.equal(status, "FINALIZED");
      assert.equal(fullTransaction, true);
      const index = deployments.findIndex((_, i) => hash === `0x${String(i + 1).padStart(64, "0")}`);
      return {
        status: 7,
        result: 6,
        data: { contract_address: index === 0 ? addressCore : addressVault },
        consensus_data: { leader_receipt: [{ mode: "leader", execution_result: "SUCCESS" }] },
      };
    },
  };
  return { client, deployments, signed };
}

test("CLI script runner journals Core then Vault and preserves constructor strings without signing real transactions", async (t) => {
  const root = makeFixtureRepo(t);
  const priorApproval = process.env.MANDATEOS_DEPLOYMENT_APPROVED;
  const priorProjectId = process.env.MANDATEOS_PROJECT_ID;
  process.env.MANDATEOS_DEPLOYMENT_APPROVED = "I_APPROVE_MANDATEOS_STUDIONET_DEPLOYMENT";
  process.env.MANDATEOS_PROJECT_ID = "00123";
  t.after(() => {
    if (priorApproval === undefined) delete process.env.MANDATEOS_DEPLOYMENT_APPROVED;
    else process.env.MANDATEOS_DEPLOYMENT_APPROVED = priorApproval;
    if (priorProjectId === undefined) delete process.env.MANDATEOS_PROJECT_ID;
    else process.env.MANDATEOS_PROJECT_ID = priorProjectId;
  });

  const { client, deployments, signed } = mockCliClient();
  const run = require(path.join(root, "deploy/01_studionet.js"));
  await run(client);

  assert.deepEqual(deployments.map((entry) => entry.args), [[], [addressCore, "00123"]]);
  assert.equal(typeof deployments[1].args[1], "string");
  assert.equal(signed.length, 2);
  const record = JSON.parse(fs.readFileSync(path.join(root, "deployments/studionet-deployment-record.json"), "utf8"));
  assert.equal(record.status, "DEPLOYED_VERIFIED");
  assert.equal(record.contracts.core.status, "FINALIZED_SUCCESS");
  assert.equal(record.contracts.vault.status, "FINALIZED_SUCCESS");
  assert.equal(record.contracts.core.actual_evm_fee_wei, "32");
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "deployments/studionet-budget.json"), "utf8")).actual_fees_wei, "64");
});

test("deployment runner refuses the installed SDK's gas-estimation fallback before signing", async (t) => {
  const root = makeFixtureRepo(t);
  const priorApproval = process.env.MANDATEOS_DEPLOYMENT_APPROVED;
  const priorProjectId = process.env.MANDATEOS_PROJECT_ID;
  process.env.MANDATEOS_DEPLOYMENT_APPROVED = "I_APPROVE_MANDATEOS_STUDIONET_DEPLOYMENT";
  process.env.MANDATEOS_PROJECT_ID = "project-1";
  t.after(() => {
    if (priorApproval === undefined) delete process.env.MANDATEOS_DEPLOYMENT_APPROVED;
    else process.env.MANDATEOS_DEPLOYMENT_APPROVED = priorApproval;
    if (priorProjectId === undefined) delete process.env.MANDATEOS_PROJECT_ID;
    else process.env.MANDATEOS_PROJECT_ID = priorProjectId;
  });

  const { client, signed, deployments } = mockCliClient({ estimatorFails: true });
  const run = require(path.join(root, "deploy/01_studionet.js"));
  await assert.rejects(run(client), /gas estimation failed/i);
  assert.equal(deployments.length, 1);
  assert.equal(signed.length, 0);
  const record = JSON.parse(fs.readFileSync(path.join(root, "deployments/studionet-deployment-record.json"), "utf8"));
  assert.equal(record.contracts.core.status, "PRE_SUBMISSION_BLOCKED");
  assert.equal(record.status, "PRECHECK_BLOCKED");
});
