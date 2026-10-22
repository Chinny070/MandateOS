// One-transaction, fail-closed VAULT_REGISTER proposal workflow.
const path = require("node:path");
const crypto = require("node:crypto");
const safety = require("./deployment-safety.cjs");
const deployment = require("../deploy/cli-deployment.cjs");

const ROOT = path.resolve(__dirname, "..");
const CORE = "0x32698630D6144882Bd0c1D5B00C74348c53ea58B";
const VAULT = "0x03325B7EB2668CfF6bE3B2e9805d600bB9E1a2F4";
const FOUNDER = "0xaffe15eec45b68835cc9e5b4ab85dd5deae8e70b";
const PROJECT_ID = "mandateos-demo-001";
const PROPOSAL_ID = "vault-register-mandateos-demo-001-20261022-01";
const DIGEST = "sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4";
const CAP_WEI = 1000000000000000n;
const RPC = "https://studio.genlayer.com/api";
const APPROVAL = "I_AUTHORIZE_MANDATEOS_VAULT_REGISTRATION_STEP";
const JOURNAL_PATH = path.join(ROOT, "deployments", "vault-registration-journal.json");
const BUDGET_PATH = path.join(ROOT, "deployments", "studionet-budget.json");

function isoNow() { return new Date().toISOString(); }
function addressString(address) { return Buffer.from(address.slice(2), "hex").toString("base64"); }
function quantity(value, name) {
  if (typeof value === "bigint" && value >= 0n) return value;
  if ((typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
      || (typeof value === "string" && (/^0x[0-9a-f]+$/i.test(value) || /^\d+$/.test(value)))) return BigInt(value);
  throw new Error(`Malformed StudioNet ${name}.`);
}
function sortRecursively(value) {
  if (Array.isArray(value)) return value.map(sortRecursively);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortRecursively(value[key])]));
  return value;
}
function assertAuthorizedTransactionRequest(request, { consensusAddress, expectedCalldata, maxFeeWei, expectedGasPrice }) {
  if (String(request?.to).toLowerCase() !== String(consensusAddress).toLowerCase()
      || BigInt(request?.chainId) !== 61999n || BigInt(request?.value ?? 0n) !== 0n
      || String(request?.account?.address ?? "").toLowerCase() !== FOUNDER
      || String(request?.data ?? "").toLowerCase() !== expectedCalldata) {
    throw new Error("Signed transaction calldata, signer, destination, network, or GEN value differs from authorization.");
  }
  const gas = quantity(request.gas, "signed gas limit");
  const gasPrice = quantity(request.gasPrice, "signed gas price");
  const feeCap = gas * gasPrice;
  if (feeCap > BigInt(maxFeeWei) || gasPrice !== BigInt(expectedGasPrice)) throw new Error("Signed maximum fee exceeds zero GEN or gas price changed after preflight.");
  return { gas, gasPrice, feeCap };
}
function assertApprovedParameters() {
  const approval = safety.readJson(path.join(ROOT, "deployments", "registration-parameter-approval.json"), null);
  const evidence = safety.readJson(path.join(ROOT, "docs", "evidence", `${PROJECT_ID}-registration.json`), null);
  if (!approval || approval.status !== "PARAMETERS_APPROVED_ONLY" || approval.project_id !== PROJECT_ID
      || approval.project_cap_wei !== CAP_WEI.toString() || approval.metadata_digest !== DIGEST) {
    throw new Error("Stored parameter approval differs from the exact authorized proposal inputs.");
  }
  if (!evidence || evidence.project?.id !== PROJECT_ID || evidence.contracts?.core?.address?.toLowerCase() !== CORE.toLowerCase()
      || evidence.contracts?.project_vault?.address?.toLowerCase() !== VAULT.toLowerCase()
      || evidence.contracts?.project_vault?.constructor_project_id !== PROJECT_ID
      || evidence.eligibility?.status !== "NOT_ASSESSED" || evidence.eligibility?.external_claims?.length !== 0) {
    throw new Error("Registration evidence package does not match deployed identity or claims eligibility.");
  }
  const actual = `sha256:${crypto.createHash("sha256").update(JSON.stringify(sortRecursively(evidence)), "utf8").digest("hex")}`;
  if (actual !== DIGEST) throw new Error("Reproduced registration metadata digest differs from the authorized digest.");
  return actual;
}
function readJournal() {
  return safety.readJson(JOURNAL_PATH, {
    schema_version: 1, status: "NOT_STARTED", network: "StudioNet", chain_id: 61999,
    core_address: CORE, project_id: PROJECT_ID, project_vault: VAULT, proposal_id: PROPOSAL_ID,
    transactions: [], active_transaction: null,
    note: "One VAULT_REGISTER proposal transaction only; no vote, finalization, execution, deposit, or transfer is authorized.",
  });
}
function saveJournal(value) { safety.atomicWriteJson(JOURNAL_PATH, value); }

module.exports = async function runVaultRegistration(cliClient) {
  if (process.env.MANDATEOS_VAULT_REGISTRATION_APPROVED !== APPROVAL) throw new Error("A separate proposal transaction authorization is required.");
  if (process.env.MANDATEOS_VAULT_REGISTRATION_MAX_FEE_WEI !== "0") throw new Error("This authorization permits exactly zero transaction fee; no default or positive cap is accepted.");
  const branch = require("node:child_process").execFileSync("git", ["branch", "--show-current"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (branch !== "codex/onchain-governance") throw new Error(`Refusing vault registration from branch ${branch}.`);
  const dirty = require("node:child_process").execFileSync("git", ["status", "--porcelain", "--", ".", ":(exclude)deployments/studionet-budget.json", ":(exclude)deployments/vault-registration-journal.json"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (dirty) throw new Error("Refusing to use the CLI signer from a dirty worktree.");
  if (cliClient?.chain?.id !== 61999 || String(await cliClient.request({ method: "eth_chainId", params: [] })).toLowerCase() !== "0xf22f") throw new Error("CLI signer is not connected to StudioNet chain 61999.");
  const account = cliClient.account;
  if (!account || account.type !== "local" || typeof account.signTransaction !== "function" || account.address?.toLowerCase() !== FOUNDER) throw new Error("The configured local signer does not match the registered founder.");
  const digest = assertApprovedParameters();
  const releaseLock = safety.acquireExclusiveLock(path.join(ROOT, "deployments", "studionet-budget.lock"));
  try {
    const journal = readJournal();
    let budget = safety.readJson(BUDGET_PATH, null);
    if (!budget || budget.ceiling_wei !== safety.TOTAL_CEILING_WEI.toString()) throw new Error("The cumulative 10 GEN budget ledger is missing or changed.");
    safety.assertBudgetLedger(budget);
    if (journal.active_transaction || journal.transactions.some((entry) => entry.stage === "PROPOSE_VAULT_REGISTER")) throw new Error("Proposal stage is already journaled; reconcile it and never replay.");
    const read = (functionName, args = []) => cliClient.readContract({ address: CORE, functionName, args, transactionHashVariant: "latest-final" });
    const count = BigInt(await read("get_proposal_count"));
    const ids = [];
    for (let i = 0n; i < count; i += 1n) ids.push(String(await read("get_proposal_id_at", [i])));
    const [founderWeight, rabbyWeight, registeredVault, parentAddress, vaultProjectId, latestBlock] = await Promise.all([
      read("get_member_weight", [addressString(FOUNDER)]),
      read("get_member_weight", [addressString("0x1Af111b06E6f6A05Bd41572A016318f1356aF85c")]),
      read("get_vault_address", [PROJECT_ID]),
      cliClient.readContract({ address: VAULT, functionName: "get_parent_address", args: [], transactionHashVariant: "latest-final" }),
      cliClient.readContract({ address: VAULT, functionName: "get_project_id", args: [], transactionHashVariant: "latest-final" }),
      cliClient.request({ method: "eth_getBlockByNumber", params: ["latest", false] }),
    ]);
    if (BigInt(founderWeight) !== 1n || BigInt(rabbyWeight) !== 1n) throw new Error("Latest-final DAO membership weights are not founder=1 and Rabby=1.");
    if (ids.includes(PROPOSAL_ID) || String(await read("get_proposal_status", [PROPOSAL_ID])) !== "UNKNOWN") throw new Error("Proposal ID is already used or its status is not UNKNOWN.");
    if (String(registeredVault) !== "") throw new Error("Project is already registered to a vault; do not create a competing registration.");
    if (String(parentAddress).toLowerCase() !== CORE.toLowerCase() || String(vaultProjectId) !== PROJECT_ID) throw new Error("Deployed ProjectVault parent/project readback does not match approved values.");
    quantity(latestBlock?.timestamp, "latest block timestamp");
    if (digest !== DIGEST) throw new Error("Metadata digest changed after preflight.");
    const currentGasPrice = quantity(await cliClient.request({ method: "eth_gasPrice", params: [] }), "eth_gasPrice");
    const args = [PROPOSAL_ID, PROJECT_ID, addressString(VAULT), CAP_WEI, DIGEST];
    const calldataModule = await import("./vault-registration-calldata.mjs");
    const expectedCalldata = await calldataModule.captureVaultRegistrationCalldata({
      core: CORE, proposalId: PROPOSAL_ID, projectId: PROJECT_ID,
      vaultArgument: addressString(VAULT), capWei: CAP_WEI, digest: DIGEST,
    });
    const originalEstimate = cliClient.estimateTransactionGas?.bind(cliClient);
    if (!originalEstimate) throw new Error("Installed CLI has no supported transaction gas estimator.");
    let estimateFailed = false;
    cliClient.estimateTransactionGas = async (...args) => { try { return await originalEstimate(...args); } catch (error) { estimateFailed = true; throw error; } };
    const originalSign = account.signTransaction.bind(account);
    let signatureCount = 0;
    let signingAllowed = false;
    const stage = "PROPOSE_VAULT_REGISTER";
    const prepared = {
      stage, status: "PREPARING", prepared_at: isoNow(), user_fee_cap_wei: "0",
      proposal_id: PROPOSAL_ID, project_id: PROJECT_ID, vault_address: VAULT,
      cap_wei: CAP_WEI.toString(), evidence_digest: DIGEST,
      membership_snapshot_expected: "2", observed_founder_weight: "1", observed_rabby_weight: "1",
      read_variant: "LATEST_FINAL", network: "StudioNet", chain_id: 61999,
    };
    journal.active_transaction = prepared; journal.status = "PROPOSAL_PREPARED"; saveJournal(journal);
    cliClient.estimateTransactionGas = async (request) => {
      try {
        const gas = await originalEstimate(request);
        if (estimateFailed) throw new Error("Gas estimation failed; SDK fallback is refused.");
        return gas;
      } catch (error) { estimateFailed = true; throw error; }
    };
    account.signTransaction = async (request) => {
      if (estimateFailed || !signingAllowed || signatureCount !== 0) throw new Error("Unexpected or unestimated signature request; refusing to sign.");
      const consensus = String(cliClient.chain.consensusMainContract?.address ?? "").toLowerCase();
      const { gas, gasPrice, feeCap } = assertAuthorizedTransactionRequest(request, {
        consensusAddress: consensus, expectedCalldata, maxFeeWei: 0n, expectedGasPrice: currentGasPrice,
      });
      if (feeCap !== 0n) throw new Error("This proposal authorization requires an exact zero GEN signed fee commitment.");
      signatureCount += 1;
      prepared.status = "SIGNING_PREPARED"; prepared.signed_gas_limit = gas.toString();
      prepared.signed_gas_price_wei = gasPrice.toString(); prepared.signed_fee_cap_wei = feeCap.toString();
      budget = safety.reserveFeeQuote(budget, feeCap);
      journal.transactions.push({ ...prepared }); journal.active_transaction = { ...prepared }; saveJournal(journal);
      safety.atomicWriteJson(BUDGET_PATH, budget);
      return originalSign(request);
    };
    try {
      signingAllowed = true;
      journal.active_transaction = { ...prepared, status: "SUBMISSION_IN_PROGRESS" }; saveJournal(journal);
      const hash = await cliClient.writeContract({ address: CORE, functionName: "propose_vault_registration", args, value: 0n });
      if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash)) {
        prepared.status = "OUTCOME_UNKNOWN"; journal.active_transaction = prepared; journal.status = "STOPPED_REQUIRES_RECONCILIATION"; saveJournal(journal);
        throw new Error("CLI returned no valid transaction hash; never retry until reconciled.");
      }
      const record = journal.transactions.find((entry) => entry.stage === stage);
      Object.assign(record, { transaction_id: hash, status: "SUBMITTED", submitted_at: isoNow() });
      budget.pending_transaction_id = hash;
      safety.atomicWriteJson(BUDGET_PATH, budget);
      journal.active_transaction = { ...record }; journal.status = "SUBMITTED"; saveJournal(journal);
      const receipt = await cliClient.waitForTransactionReceipt({ hash, status: "FINALIZED", interval: 5000, retries: 240, fullTransaction: true });
      const evmReceipt = await cliClient.request({ method: "eth_getTransactionReceipt", params: [hash] });
      const actualFee = deployment.actualEvmFeeWei(evmReceipt, hash);
      if (actualFee !== 0n || String(evmReceipt?.status).toLowerCase() !== "0x1" || !deployment.successfulFinalizedDeployment(receipt)) throw new Error("Final receipt failed success checks or the actual fee exceeds zero GEN.");
      budget = safety.settleFeeReservation(budget, 0n, actualFee);
      budget.last_settled_transaction_id = hash;
      safety.atomicWriteJson(BUDGET_PATH, budget);
      Object.assign(record, {
        status: "FINALIZED_SUCCESS", final_status: receipt?.status_name ?? receipt?.statusName ?? "FINALIZED",
        result_name: receipt?.result_name ?? receipt?.resultName ?? "MAJORITY_AGREE",
        transaction_execution: receipt?.txExecutionResultName ?? receipt?.execution_result ?? "SUCCESS",
        evm_receipt_status: evmReceipt.status, gas_used: String(evmReceipt.gasUsed),
        effective_gas_price_wei: String(evmReceipt.effectiveGasPrice), actual_fee_wei: "0", finalized_at: isoNow(),
      });
      journal.transactions = journal.transactions.map((entry) => entry.stage === stage ? record : entry);
      journal.active_transaction = null; journal.status = "PROPOSAL_FINALIZED";
      // This is observational readback only: the proposal remains unvoted.
      const [status, summary, timing] = await Promise.all([
        read("get_proposal_status", [PROPOSAL_ID]), read("get_proposal_summary", [PROPOSAL_ID]), read("get_proposal_timing", [PROPOSAL_ID]),
      ]);
      const summaryArray = Array.isArray(summary) ? summary : [];
      const timingArray = Array.isArray(timing) ? timing : [];
      if (String(status) !== "VOTING" || String(summaryArray[0]) !== "VAULT_REGISTER"
          || String(summaryArray[1]) !== "VOTING" || BigInt(summaryArray[2] ?? 0) !== 0n
          || BigInt(summaryArray[3] ?? 0) !== 0n || BigInt(summaryArray[4] ?? 0) !== 2n) {
        throw new Error("Proposal finalized, but latest-final proposal kind/status/vote snapshot did not match expected values; stop for reconciliation.");
      }
      journal.latest_final_readback = {
        observed_at_utc: isoNow(), proposal_status: String(status), proposal_kind: String(summaryArray[0]),
        votes_for: String(summaryArray[2]), votes_against: String(summaryArray[3]), membership_snapshot_total: String(summaryArray[4]),
        voting_ends_at: String(timingArray[0] ?? "0"), execute_after: String(timingArray[1] ?? "0"), execute_by: String(timingArray[2] ?? "0"),
        founder_weight: "1", rabby_weight: "1", project_id: PROJECT_ID, project_vault: VAULT,
        cap_wei: CAP_WEI.toString(), evidence_digest: DIGEST, read_variant: "LATEST_FINAL",
      };
      saveJournal(journal);
      console.log(JSON.stringify({ stage, transactionHash: hash, status: "FINALIZED_SUCCESS", actualFeeWei: "0", proposalStatus: String(status), votingEndsAt: String(timingArray[0] ?? "0"), membershipSnapshotTotal: String(summaryArray[4]), next: "Wait for actual deadline; each member must vote from their own wallet." }, null, 2));
    } catch (error) {
      const record = journal.transactions.find((entry) => entry.stage === stage);
      if (record && !["FINALIZED_SUCCESS"].includes(record.status)) {
        record.status = "OUTCOME_UNKNOWN"; record.error = String(error?.message ?? error).slice(0, 400);
        journal.transactions = journal.transactions.map((entry) => entry.stage === stage ? record : entry);
        journal.active_transaction = { ...record }; journal.status = "STOPPED_REQUIRES_RECONCILIATION"; saveJournal(journal);
      } else if (!record) {
        journal.active_transaction = null; journal.status = "PRE_SUBMISSION_BLOCKED"; saveJournal(journal);
      }
      throw error;
    }
  } finally { releaseLock(); }
};

module.exports.assertApprovedParameters = assertApprovedParameters;
module.exports.assertAuthorizedTransactionRequest = assertAuthorizedTransactionRequest;
module.exports.proposalArguments = () => [PROPOSAL_ID, PROJECT_ID, addressString(VAULT), CAP_WEI, DIGEST];
module.exports.constants = { CORE, VAULT, FOUNDER, PROJECT_ID, PROPOSAL_ID, DIGEST, CAP_WEI, RPC };
