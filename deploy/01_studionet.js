const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const safety = require("../scripts/deployment-safety.cjs");
const deployment = require("./cli-deployment.cjs");

const ROOT = path.resolve(__dirname, "..");
const RPC = "https://studio.genlayer.com/api";
const CHAIN_ID = 61999;
const APPROVAL_PHRASE = "I_APPROVE_MANDATEOS_STUDIONET_DEPLOYMENT";
const MEMBERSHIP_APPROVAL = "I_AUTHORIZE_MANDATEOS_MEMBER_ONBOARDING_STEP";
const CORE_SOURCE = path.join(ROOT, "contracts", "mandate_os.py");
const VAULT_SOURCE = path.join(ROOT, "contracts", "project_vault.py");
const BUDGET_PATH = path.join(ROOT, "deployments", "studionet-budget.json");
const RECORD_PATH = path.join(ROOT, "deployments", "studionet-deployment-record.json");
const CONFIG_PATH = path.join(ROOT, "deployments", "studionet.json");

function sha256(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function isoNow() { return new Date().toISOString(); }
function rpcQuantity(value, field) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) throw new Error(`StudioNet ${field} response is malformed.`);
  return BigInt(value);
}
function writeRecord(record) { safety.atomicWriteJson(RECORD_PATH, record); }

module.exports = async function deployMandateOS(cliClient) {
  if (process.env.MANDATEOS_MEMBERSHIP_APPROVED !== undefined) {
    if (process.env.MANDATEOS_MEMBERSHIP_APPROVED !== MEMBERSHIP_APPROVAL) {
      throw new Error("Membership workflow approval token is invalid; no deployment or governance transaction was submitted.");
    }
    // Explicit mode dispatch: this path calls only the governed membership
    // workflow and returns before any deployment source is loaded.
    return require("../scripts/member-onboarding-cli.cjs")(cliClient);
  }

  let releaseBudgetLock = null;
  let budget = null;
  const record = safety.readJson(RECORD_PATH, {
    schema_version: 2,
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
      throw new Error("Deployment requires separate explicit user approval and the documented one-time approval environment gate.");
    }
    const projectId = process.env.MANDATEOS_PROJECT_ID;
    if (typeof projectId !== "string" || !projectId.trim() || projectId.length > 96) {
      throw new Error("Set the exact approved ProjectVault project ID; no project ID is invented.");
    }
    const account = cliClient?.account;
    if (!account || account.type !== "local" || typeof account.signTransaction !== "function"
        || !/^0x[0-9a-fA-F]{40}$/.test(account.address ?? "")) {
      throw new Error("The GenLayer CLI did not provide its unlocked local signer. No key material is read or displayed by this script.");
    }
    const chainId = await cliClient.request({ method: "eth_chainId", params: [] });
    if (String(chainId).toLowerCase() !== "0xf22f") throw new Error(`StudioNet chain identity failed: expected 0xf22f, got ${String(chainId)}.`);
    const gasPriceResponse = await cliClient.request({ method: "eth_gasPrice", params: [] });
    const currentGasPriceWei = rpcQuantity(gasPriceResponse, "eth_gasPrice");

    const currentHead = require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    const branch = require("node:child_process").execFileSync("git", ["branch", "--show-current"], { cwd: ROOT, encoding: "utf8" }).trim();
    if (branch !== "codex/onchain-governance") throw new Error(`Refusing deployment from branch ${branch}.`);
    if (require("node:child_process").execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim()) {
      throw new Error("Refusing deployment from a dirty working tree.");
    }
    releaseBudgetLock = safety.acquireExclusiveLock(path.join(ROOT, "deployments", "studionet-budget.lock"));
    budget = safety.readJson(BUDGET_PATH, null);
    if (!budget || budget.ceiling_wei !== deployment.TOTAL_CEILING_WEI.toString()) {
      throw new Error("The fixed 10 GEN cumulative budget ledger is missing or modified.");
    }
    safety.assertBudgetLedger(budget);
    safety.assertNoUnresolvedDeployment(record);
    record.status = "DEPLOYMENT_IN_PROGRESS";
    record.network = "StudioNet";
    record.chain_id = CHAIN_ID;
    record.rpc_url = RPC;
    record.cli_version = "0.39.1";
    record.cli_genlayer_js_version = "1.1.8";
    record.fee_model = "Legacy CLI EVM gas; exact signed gas-limit × gas-price cap plus finalized EVM-receipt reconciliation. No v0.6 fee-profile fields are sent.";
    record.current_gas_price_wei = currentGasPriceWei.toString();
    record.preparation_git_head = currentHead;
    record.project_id = projectId;
    record.source_hashes = { mandate_os_sha256: sha256(CORE_SOURCE), project_vault_sha256: sha256(VAULT_SOURCE) };
    record.started_at = isoNow();
    writeRecord(record);

    let activeStage = null;
    let estimationFailed = false;
    const originalEstimate = cliClient.estimateTransactionGas?.bind(cliClient);
    if (typeof originalEstimate !== "function") throw new Error("Installed GenLayerJS client has no transaction gas estimator.");
    cliClient.estimateTransactionGas = async (...args) => {
      try { return await originalEstimate(...args); }
      catch (error) { estimationFailed = true; throw error; }
    };
    const originalSign = account.signTransaction.bind(account);
    const guardedSign = async (request) => {
      if (estimationFailed) throw new Error("CLI gas estimation failed; refusing its built-in 200,000 gas fallback.");
      if (!activeStage) throw new Error("Unexpected signing request outside a journaled deployment stage.");
      const consensusAddress = cliClient.chain?.consensusMainContract?.address;
      if (!consensusAddress || String(request.to).toLowerCase() !== consensusAddress.toLowerCase()) {
        throw new Error("Deployment signer request is not addressed to StudioNet's configured consensus contract.");
      }
      if (request.value !== undefined && BigInt(request.value) !== 0n) {
        throw new Error("Contract deployment must not transfer GEN value.");
      }
      const cap = deployment.legacyEvmFeeCapWei(request);
      const stage = record.contracts[activeStage];
      if (stage.fee_cap_wei !== undefined) throw new Error("More than one deployment signature appeared for a stage; stop for reconciliation.");
      budget = safety.reserveFeeQuote(budget, cap);
      stage.gas_limit = BigInt(request.gas).toString();
      stage.gas_price_wei = BigInt(request.gasPrice).toString();
      stage.fee_cap_wei = cap.toString();
      stage.status = "SIGNING_PREPARED";
      safety.atomicWriteJson(BUDGET_PATH, budget);
      writeRecord(record);
      return originalSign(request);
    };
    account.signTransaction = guardedSign;
    if (account.signTransaction !== guardedSign) throw new Error("Could not install the per-transaction GEN budget guard on the CLI signer.");

    const deployOne = async (name, sourcePath, args) => {
      if (record.contracts[name]?.status === "FINALIZED_SUCCESS") return record.contracts[name].contract_address;
      const stage = {
        status: "SUBMISSION_PREPARED",
        source_path: path.relative(ROOT, sourcePath).replaceAll("\\", "/"),
        source_sha256: sha256(sourcePath),
        constructor_args: args,
        fee_model: "EVM gas cap only; see LIVE_PROOFS.md for the observed zero-gas-price reference and its limits.",
        prepared_at: isoNow(),
      };
      record.contracts[name] = stage;
      writeRecord(record);
      activeStage = name;
      estimationFailed = false;
      const code = fs.readFileSync(sourcePath, "utf8");
      let hash;
      try {
        hash = await cliClient.deployContract({ code, args, leaderOnly: false });
      } catch (error) {
        stage.status = stage.fee_cap_wei === undefined ? "PRE_SUBMISSION_BLOCKED" : "OUTCOME_UNKNOWN";
        stage.error = String(error?.message ?? error).slice(0, 400);
        writeRecord(record);
        throw error;
      } finally {
        activeStage = null;
      }
      if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        stage.status = "OUTCOME_UNKNOWN";
        stage.reconciliation_note = "CLI returned no valid transaction hash after the signing path; inspect signer and network history before any retry.";
        writeRecord(record);
        throw new Error(`${name} deployment transaction identifier is unavailable; no retry is permitted.`);
      }
      stage.transaction_id = hash;
      stage.status = "SUBMITTED";
      stage.submitted_at = isoNow();
      budget.pending_transaction_id = hash;
      safety.atomicWriteJson(BUDGET_PATH, budget);
      writeRecord(record);

      let receipt;
      try {
        receipt = await cliClient.waitForTransactionReceipt({
          hash, status: "FINALIZED", interval: 5000, retries: 240, fullTransaction: true,
        });
      } catch (error) {
        stage.status = "OUTCOME_UNKNOWN";
        stage.reconciliation_note = "Finality wait ended without a verified receipt. Inspect this exact transaction ID; do not redeploy or retry.";
        stage.error = String(error?.message ?? error).slice(0, 400);
        writeRecord(record);
        throw error;
      }
      stage.final_status = receipt?.status_name ?? receipt?.statusName ?? (Number(receipt?.status) === 7 ? "FINALIZED" : String(receipt?.status ?? "UNKNOWN"));
      stage.result_name = receipt?.result_name ?? receipt?.resultName ?? (Number(receipt?.result) === 6 ? "MAJORITY_AGREE" : String(receipt?.result ?? "UNKNOWN"));
      const leaderReceipts = receipt?.consensus_data?.leader_receipt ?? receipt?.consensusData?.leaderReceipt;
      const leaderReceiptList = Array.isArray(leaderReceipts) ? leaderReceipts : leaderReceipts ? [leaderReceipts] : [];
      const leaderReceipt = leaderReceiptList.find((item) => item?.mode === "leader") ?? leaderReceiptList[0];
      stage.execution_result = receipt?.txExecutionResultName ?? receipt?.execution_result ?? leaderReceipt?.execution_result ?? null;
      stage.finalized_at = isoNow();
      if (stage.final_status !== "FINALIZED") {
        stage.status = "OUTCOME_UNKNOWN";
        writeRecord(record);
        throw new Error(`${name} has not reached FINALIZED; stop and reconcile the same transaction.`);
      }

      let actualFee = null;
      try {
        const evmReceipt = await cliClient.request({ method: "eth_getTransactionReceipt", params: [hash] });
        actualFee = deployment.actualEvmFeeWei(evmReceipt, hash);
        if (stage.fee_cap_wei === undefined) throw new Error("Signed fee cap is missing from the journal.");
        if (actualFee > BigInt(stage.fee_cap_wei)) throw new Error("Actual EVM gas fee exceeds the recorded signing cap.");
        stage.evm_receipt_status = evmReceipt.status;
        stage.evm_gas_used = String(evmReceipt.gasUsed);
        stage.evm_effective_gas_price_wei = String(evmReceipt.effectiveGasPrice);
        stage.actual_evm_fee_wei = actualFee.toString();
      } catch (error) {
        if (stage.fee_cap_wei !== undefined) {
          budget = safety.settleFeeReservation(budget, BigInt(stage.fee_cap_wei), null);
          stage.fee_observation = "UNKNOWN_FEE_CAP_RETAINED_AS_LIABILITY";
          safety.atomicWriteJson(BUDGET_PATH, budget);
        }
        stage.status = "OUTCOME_UNKNOWN";
        stage.reconciliation_note = "Finalized GenLayer receipt exists, but EVM fee receipt is incomplete or mismatched; preserve the cap as unknown liability.";
        stage.error = String(error?.message ?? error).slice(0, 400);
        writeRecord(record);
        throw error;
      }
      budget = safety.settleFeeReservation(budget, BigInt(stage.fee_cap_wei), actualFee);
      budget.last_settled_transaction_id = hash;
      stage.fee_observation = "ACTUAL_EVM_GAS_FEE_RECONCILED";
      safety.atomicWriteJson(BUDGET_PATH, budget);

      if (!deployment.successfulFinalizedDeployment(receipt)) {
        stage.status = stage.execution_result === "ERROR" ? "FINALIZED_FAILED" : "OUTCOME_UNKNOWN";
        writeRecord(record);
        throw new Error(`${name} receipt is not FINALIZED / MAJORITY_AGREE / SUCCESS; stop without retry.`);
      }
      const address = deployment.deployedAddress(receipt);
      if (!address) {
        stage.status = "OUTCOME_UNKNOWN";
        stage.reconciliation_note = "Successful finalized receipt omitted a contract address; do not deploy a replacement.";
        writeRecord(record);
        throw new Error(`${name} deployed address is absent from the finalized receipt.`);
      }
      stage.contract_address = address;
      stage.status = "FINALIZED_SUCCESS";
      writeRecord(record);
      return address;
    };

    const coreAddress = await deployOne("core", CORE_SOURCE, deployment.constructorArgs("core"));
    const vaultAddress = await deployOne("vault", VAULT_SOURCE, deployment.constructorArgs("vault", { coreAddress, projectId }));
    record.status = "DEPLOYED_VERIFIED";
    record.completed_at = isoNow();
    writeRecord(record);

    const deploymentConfig = safety.readJson(CONFIG_PATH, {});
    deploymentConfig.mandate_os_address = coreAddress;
    deploymentConfig.project_vault_addresses = { ...(deploymentConfig.project_vault_addresses ?? {}), [projectId]: vaultAddress };
    deploymentConfig.deploy_transaction_ids = [record.contracts.core.transaction_id, record.contracts.vault.transaction_id];
    deploymentConfig.status = "DEPLOYED_ADDRESSES_VERIFIED";
    safety.atomicWriteJson(CONFIG_PATH, deploymentConfig);
  } catch (error) {
    record.status = record.contracts && Object.values(record.contracts).some((item) => [
      "SIGNING_PREPARED", "SUBMITTED", "OUTCOME_UNKNOWN", "FINALIZED_FAILED", "SUBMISSION_PREPARED",
    ].includes(item.status)) ? "STOPPED_REQUIRES_RECONCILIATION" : "PRECHECK_BLOCKED";
    record.last_error = String(error?.message ?? error).slice(0, 500);
    record.updated_at = isoNow();
    writeRecord(record);
    console.error(`MandateOS deployment halted: ${record.last_error}`);
    throw error;
  } finally {
    if (releaseBudgetLock) releaseBudgetLock();
  }
};
