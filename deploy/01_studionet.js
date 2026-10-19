const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const safety = require("../scripts/deployment-safety.cjs");

const ROOT = path.resolve(__dirname, "..");
const RPC = "https://studio.genlayer.com/api";
const CHAIN_ID = 61999;
const APPROVAL_PHRASE = "I_APPROVE_MANDATEOS_STUDIONET_DEPLOYMENT";
const CORE_SOURCE = path.join(ROOT, "contracts", "mandate_os.py");
const VAULT_SOURCE = path.join(ROOT, "contracts", "project_vault.py");
const BUDGET_PATH = path.join(ROOT, "deployments", "studionet-budget.json");
const RECORD_PATH = path.join(ROOT, "deployments", "studionet-deployment-record.json");
const FEE_PROFILE_PATH = path.join(ROOT, "deployments", "studionet-fee-profile.json");
const CONFIG_PATH = path.join(ROOT, "deployments", "studionet.json");

function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function isoNow() { return new Date().toISOString(); }
function addressFrom(receipt) {
  const candidates = [receipt?.data?.contract_address, receipt?.txDataDecoded?.contractAddress, receipt?.contractAddress];
  return candidates.find((value) => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)) ?? null;
}
function actualFeeFrom(receipt) {
  const data = receipt?.data ?? {};
  const candidates = [
    data.fee_accounting?.paid_fee_value,
    data.feeAccounting?.paid_fee_value,
    data.fee_accounting?.primary_fee_spent,
    data.feeAccounting?.primary_fee_spent,
    data.paid_fee_value,
  ];
  for (const value of candidates) {
    if (typeof value === "bigint" && value >= 0n) return value;
    if ((typeof value === "string" && /^\d+$/.test(value)) || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)) return BigInt(value);
  }
  return null;
}
module.exports = async function deployMandateOS(cliClient) {
  let releaseBudgetLock = null;
  const record = safety.readJson(RECORD_PATH, {
    schema_version: 1,
    status: "PREPARED_NOT_AUTHORIZED",
    network: "StudioNet",
    chain_id: CHAIN_ID,
    rpc_url: RPC,
    created_at: isoNow(),
    contracts: {},
    source_hashes: {},
    notes: ["Preparation record only. No transaction has been submitted."],
  });

  try {
    if (process.env.MANDATEOS_DEPLOYMENT_APPROVED !== APPROVAL_PHRASE) {
      throw new Error("Deployment requires the user's separate explicit approval and the documented one-time approval environment gate.");
    }
    if (process.env.MANDATEOS_PROJECT_ID === undefined || !process.env.MANDATEOS_PROJECT_ID.trim() || process.env.MANDATEOS_PROJECT_ID.length > 96) {
      throw new Error("Set the exact governance project ID for the ProjectVault constructor; no project ID is invented here.");
    }
    const account = cliClient?.account;
    if (!account || typeof account !== "object" || !/^0x[0-9a-fA-F]{40}$/.test(account.address ?? "")) {
      throw new Error("The GenLayer CLI did not provide its securely configured active account. No key material is read or displayed by this script.");
    }
    releaseBudgetLock = safety.acquireExclusiveLock(path.join(ROOT, "deployments", "studionet-budget.lock"));

    const probe = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    if (!probe.ok) throw new Error(`StudioNet read-only chain check returned HTTP ${probe.status}.`);
    const chainReply = await probe.json();
    if (chainReply?.error || String(chainReply?.result).toLowerCase() !== "0xf22f") {
      throw new Error(`StudioNet chain identity check failed (expected 0xf22f, received ${String(chainReply?.result)}).`);
    }

    const { createClient, isSuccessful } = await import("../web/node_modules/genlayer-js/dist/index.js");
    const { studionet } = await import("../web/node_modules/genlayer-js/dist/chains/index.js");
    if (studionet.id !== CHAIN_ID) throw new Error(`Pinned GenLayerJS StudioNet chain ID mismatch: ${studionet.id}.`);
    const client = createClient({ chain: studionet, endpoint: RPC, account });
    const feePolicy = await client.getCurrentFeePolicy();
    if (!feePolicy || feePolicy.enabled !== true) throw new Error("StudioNet fee policy is unavailable or disabled; deployment is blocked until fee treatment is verified.");
    const profile = safety.readJson(FEE_PROFILE_PATH, null);
    if (!profile || !["localnet", "studionet"].includes(profile.network) || !profile.deploy) {
      throw new Error("A reviewed fee profile measured on a compatible GenLayer v0.6 fee-reporting runtime is required at deployments/studionet-fee-profile.json.");
    }
    const provenance = profile.provenance;
    if (!provenance || provenance.mandate_os_sha256 !== sha256(CORE_SOURCE) || provenance.project_vault_sha256 !== sha256(VAULT_SOURCE)) {
      throw new Error("Fee profile provenance does not match the exact contract source files; regenerate and independently review it.");
    }
    let budget = safety.readJson(BUDGET_PATH, null);
    if (!budget || budget.ceiling_wei !== safety.TOTAL_CEILING_WEI.toString()) throw new Error("The fixed 10 GEN budget ledger is missing or has been modified.");
    safety.assertBudgetLedger(budget);
    safety.assertNoUnresolvedDeployment(record);

    record.status = "DEPLOYMENT_IN_PROGRESS";
    record.network = "StudioNet";
    record.chain_id = CHAIN_ID;
    record.rpc_url = RPC;
    record.source_hashes = { mandate_os_sha256: sha256(CORE_SOURCE), project_vault_sha256: sha256(VAULT_SOURCE) };
    record.fee_profile_sha256 = sha256(FEE_PROFILE_PATH);
    record.preparation_git_head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    record.genlayer_js_version = require("../web/node_modules/genlayer-js/package.json").version;
    record.started_at = isoNow();
    safety.atomicWriteJson(RECORD_PATH, record);

    const deployOne = async (name, sourcePath, args) => {
      if (record.contracts[name]?.status === "FINALIZED_SUCCESS") return record.contracts[name].contract_address;
      const code = fs.readFileSync(sourcePath, "utf8");
      const profileEntry = safety.feeOptionsFromProfile(profile.deploy, 1);
      const estimate = await client.estimateTransactionFees(profileEntry);
      if (!estimate || typeof estimate.feeValue !== "bigint" || estimate.feeValue < 0n) throw new Error(`No valid current fee estimate for ${name} deployment.`);

      budget = safety.reserveFeeQuote(budget, estimate.feeValue);
      safety.atomicWriteJson(BUDGET_PATH, budget);
      record.contracts[name] = safety.jsonSafe({
        status: "SUBMISSION_PREPARED",
        source_path: path.relative(ROOT, sourcePath).replaceAll("\\", "/"),
        source_sha256: sha256(sourcePath),
        constructor_args: args,
        fee_quote_wei: estimate.feeValue.toString(),
        fee_distribution: estimate.distribution,
        submitted_at: isoNow(),
      });
      safety.atomicWriteJson(RECORD_PATH, record);

      const hash = await client.deployContract({ code, args, fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } });
      record.contracts[name].transaction_id = hash;
      record.contracts[name].status = "SUBMITTED";
      budget.pending_transaction_id = hash;
      safety.atomicWriteJson(BUDGET_PATH, budget);
      safety.atomicWriteJson(RECORD_PATH, record);

      let receipt;
      try { receipt = await client.waitForFinalization({ hash, interval: 5000, retries: 240, fullTransaction: true }); }
      catch (error) {
        record.contracts[name].status = "OUTCOME_UNKNOWN";
        record.contracts[name].reconciliation_note = "Finalization wait ended without a verified result. Do not redeploy or retry; inspect the same transaction ID.";
        safety.atomicWriteJson(RECORD_PATH, record);
        throw error;
      }
      record.contracts[name].final_status = receipt?.statusName ?? null;
      record.contracts[name].execution_result = receipt?.txExecutionResultName ?? null;
      budget = safety.settleFeeReservation(budget, estimate.feeValue, actualFeeFrom(receipt));
      budget.last_settled_transaction_id = hash;
      budget.last_fee_receipt_observation = actualFeeFrom(receipt) === null ? "UNKNOWN_FULL_QUOTE_RETAINED" : "ACTUAL_PAID_FEE_RECORDED";
      safety.atomicWriteJson(BUDGET_PATH, budget);
      if (!isSuccessful(receipt)) {
        record.contracts[name].status = "FINALIZED_FAILED";
        safety.atomicWriteJson(RECORD_PATH, record);
        throw new Error(`${name} transaction finalized without successful execution; stop and do not retry.`);
      }
      const address = addressFrom(receipt);
      if (!address) {
        record.contracts[name].status = "OUTCOME_UNKNOWN";
        record.contracts[name].reconciliation_note = "Finalized execution succeeded but its deployed address was absent; do not redeploy.";
        safety.atomicWriteJson(RECORD_PATH, record);
        throw new Error(`Cannot independently read the deployed ${name} address from the finalized receipt.`);
      }
      record.contracts[name].contract_address = address;
      record.contracts[name].status = "FINALIZED_SUCCESS";
      record.contracts[name].finalized_at = isoNow();
      safety.atomicWriteJson(RECORD_PATH, record);
      return address;
    };

    const coreAddress = await deployOne("core", CORE_SOURCE, []);
    const vaultAddress = await deployOne("vault", VAULT_SOURCE, [coreAddress, process.env.MANDATEOS_PROJECT_ID]);
    record.status = "DEPLOYED_VERIFIED";
    record.completed_at = isoNow();
    record.project_id = process.env.MANDATEOS_PROJECT_ID;
    safety.atomicWriteJson(RECORD_PATH, record);
    const deployment = safety.readJson(CONFIG_PATH, {});
    deployment.mandate_os_address = coreAddress;
    deployment.project_vault_addresses = { ...(deployment.project_vault_addresses ?? {}), [process.env.MANDATEOS_PROJECT_ID]: vaultAddress };
    deployment.deploy_transaction_ids = [record.contracts.core.transaction_id, record.contracts.vault.transaction_id];
    deployment.status = "DEPLOYED_ADDRESSES_VERIFIED";
    safety.atomicWriteJson(CONFIG_PATH, deployment);
  } catch (error) {
    record.status = record.contracts && Object.values(record.contracts).some((item) => ["SUBMITTED", "OUTCOME_UNKNOWN", "FINALIZED_FAILED", "SUBMISSION_PREPARED"].includes(item.status))
      ? "STOPPED_REQUIRES_RECONCILIATION"
      : "PRECHECK_BLOCKED";
    record.last_error = String(error?.message ?? error).slice(0, 500);
    record.updated_at = isoNow();
    safety.atomicWriteJson(RECORD_PATH, record);
    console.error(`MandateOS deployment halted: ${record.last_error}`);
    throw error;
  } finally {
    if (releaseBudgetLock) releaseBudgetLock();
  }
};
