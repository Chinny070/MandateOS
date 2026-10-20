const fs = require("node:fs");
const path = require("node:path");
const safety = require("./deployment-safety.cjs");
const deployment = require("../deploy/cli-deployment.cjs");
const { planMembershipAction } = require("./membership-state.cjs");

const ROOT = path.resolve(__dirname, "..");
const CORE = "0x32698630D6144882Bd0c1D5B00C74348c53ea58B";
const FOUNDER = "0xaffe15eec45b68835cc9e5b4ab85dd5deae8e70b";
const RABBY = "0x1Af111b06E6f6A05Bd41572A016318f1356aF85c";
const PROJECT_ID = "mandateos-demo-001";
const PROPOSAL_ID = "member-add-rabby-1af111b06e6f6a05-20261020-01";
const RPC = "https://studio.genlayer.com/api";
const APPROVAL = "I_AUTHORIZE_MANDATEOS_MEMBER_ONBOARDING_STEP";
const JOURNAL_PATH = path.join(ROOT, "deployments", "member-onboarding-journal.json");
const BUDGET_PATH = path.join(ROOT, "deployments", "studionet-budget.json");

function isoNow() { return new Date().toISOString(); }
function asContractAddressString(address) { return Buffer.from(address.slice(2), "hex").toString("base64"); }
function quantity(value, field) {
  if (typeof value === "bigint" && value >= 0n) return value;
  if ((typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
      || (typeof value === "string" && (/^0x[0-9a-f]+$/i.test(value) || /^\d+$/.test(value)))) return BigInt(value);
  throw new Error(`Malformed StudioNet ${field}.`);
}
function readJournal() {
  return safety.readJson(JOURNAL_PATH, {
    schema_version: 1,
    status: "NOT_STARTED",
    core_address: CORE,
    project_id: PROJECT_ID,
    proposal_id: PROPOSAL_ID,
    founder: FOUNDER,
    member: RABBY,
    transactions: [],
    note: "Prepared only. No transaction has been submitted.",
  });
}
function saveJournal(journal) { safety.atomicWriteJson(JOURNAL_PATH, journal); }

async function reconcileSubmittedStep(cliClient, journal, budget, active) {
  if (!active.transaction_id || !/^0x[0-9a-f]{64}$/i.test(active.transaction_id)) {
    throw new Error("A prior signing attempt has no recorded transaction hash. Do not retry; reconcile CLI/wallet transaction history manually first.");
  }
  const hash = active.transaction_id;
  const receipt = await cliClient.waitForTransactionReceipt({ hash, status: "FINALIZED", interval: 5000, retries: 240, fullTransaction: true });
  const evmReceipt = await cliClient.request({ method: "eth_getTransactionReceipt", params: [hash] });
  const actualFee = deployment.actualEvmFeeWei(evmReceipt, hash);
  const cap = BigInt(active.user_fee_cap_wei);
  if (actualFee > cap) throw new Error("Recorded transaction fee exceeds its authorized cap; preserve the record and stop.");

  if (budget.last_settled_transaction_id !== hash) {
    if (budget.pending_transaction_id !== hash || BigInt(budget.committed_fees_wei) < cap) {
      throw new Error("Fee ledger does not contain the matching pending reservation; stop for accounting reconciliation.");
    }
    budget = safety.settleFeeReservation(budget, cap, actualFee);
    budget.last_settled_transaction_id = hash;
    safety.atomicWriteJson(BUDGET_PATH, budget);
  }
  const successful = deployment.successfulFinalizedDeployment(receipt);
  const record = journal.transactions.find((item) => item.stage === active.stage && item.transaction_id === hash);
  if (!record) throw new Error("Journal transaction row does not match the active hash; stop for manual reconciliation.");
  Object.assign(record, {
    status: successful ? "FINALIZED_SUCCESS" : "FINALIZED_FAILED",
    final_status: receipt?.status_name ?? receipt?.statusName ?? "FINALIZED",
    result_name: receipt?.result_name ?? receipt?.resultName ?? "UNKNOWN",
    evm_receipt_status: evmReceipt.status,
    gas_used: String(evmReceipt.gasUsed),
    effective_gas_price_wei: String(evmReceipt.effectiveGasPrice),
    actual_fee_wei: actualFee.toString(),
    reconciled_at: isoNow(),
  });
  journal.active_transaction = null;
  journal.status = successful ? "STEP_FINALIZED_RECONCILED" : "STOPPED_FINALIZED_FAILED";
  saveJournal(journal);
  if (!successful) throw new Error("The same transaction finalized without majority agreement and leader success. Fee reconciled; no retry is permitted.");
  console.log(JSON.stringify({ stage: active.stage, transactionHash: hash, status: record.status, actualFeeWei: actualFee.toString(), next: "Re-run after finalized-state readback; no new transaction was submitted by this reconciliation." }, null, 2));
}

async function runMembershipStep(cliClient) {
  if (process.env.MANDATEOS_MEMBERSHIP_APPROVED !== APPROVAL) {
    throw new Error("This one-step workflow requires separate explicit user authorization. No transaction submitted.");
  }
  const approvedMaxFee = process.env.MANDATEOS_MEMBERSHIP_MAX_FEE_WEI;
  if (!/^\d+$/.test(String(approvedMaxFee ?? ""))) throw new Error("Set the exact user-authorized per-transaction max fee in wei; no default is applied.");
  const maxFeeWei = BigInt(approvedMaxFee);

  const branch = require("node:child_process").execFileSync("git", ["branch", "--show-current"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (branch !== "codex/onchain-governance") throw new Error(`Refusing member onboarding from branch ${branch}.`);
  const dirty = require("node:child_process").execFileSync("git", ["status", "--porcelain", "--", ".", ":(exclude)deployments/studionet-budget.json", ":(exclude)deployments/member-onboarding-journal.json"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (dirty) throw new Error("Refusing to use the CLI signer from a dirty worktree.");
  if (cliClient?.chain?.id !== 61999 || String(await cliClient.request({ method: "eth_chainId", params: [] })).toLowerCase() !== "0xf22f") {
    throw new Error("The CLI signer client is not on StudioNet chain 61999.");
  }
  const account = cliClient.account;
  if (!account || account.type !== "local" || typeof account.signTransaction !== "function") {
    throw new Error("The GenLayer CLI did not provide its unlocked local signer. No key material is read or displayed.");
  }
  if (account.address.toLowerCase() !== FOUNDER.toLowerCase()) throw new Error("The active CLI signer does not match the deployed founder member.");

  const releaseBudgetLock = safety.acquireExclusiveLock(path.join(ROOT, "deployments", "studionet-budget.lock"));
  try {
  let journal = readJournal();
  let budget = safety.readJson(BUDGET_PATH, null);
  let activeStage;
  let signatureCount = 0;
  let estimateFailed = false;
  const originalSign = account.signTransaction.bind(account);
  const originalEstimate = cliClient.estimateTransactionGas?.bind(cliClient);
  if (typeof originalEstimate !== "function") throw new Error("Installed StudioNet SDK has no gas estimator.");

  const read = async (functionName, args = []) => cliClient.readContract({
    address: CORE,
    functionName,
    args,
    transactionHashVariant: "latest-final",
  });
  const proposalCount = BigInt(await read("get_proposal_count"));
  const proposalIds = [];
  for (let i = 0n; i < proposalCount; i += 1n) proposalIds.push(await read("get_proposal_id_at", [i]));
  const [chainBlock, statusValue, summaryValue, timingValue, founderWeightValue, memberWeightValue] = await Promise.all([
    cliClient.request({ method: "eth_getBlockByNumber", params: ["latest", false] }),
    read("get_proposal_status", [PROPOSAL_ID]),
    read("get_proposal_summary", [PROPOSAL_ID]),
    read("get_proposal_timing", [PROPOSAL_ID]),
    read("get_member_weight", [asContractAddressString(FOUNDER)]),
    read("get_member_weight", [asContractAddressString(RABBY)]),
  ]);
  const status = String(statusValue);
  const summary = Array.isArray(summaryValue) ? summaryValue : [];
  const timing = Array.isArray(timingValue) ? timingValue : [];
  const proposalKind = String(summary[0] ?? "UNKNOWN");
  const votesFor = BigInt(summary[2] ?? 0);
  const votesAgainst = BigInt(summary[3] ?? 0);
  const snapshotTotal = BigInt(summary[4] ?? 0);
  const chainTimestamp = quantity(chainBlock?.timestamp, "latest block timestamp");
  const votingEndsAt = BigInt(timing[0] ?? 0);
  const executeAfter = BigInt(timing[1] ?? 0);
  const executeBy = BigInt(timing[2] ?? 0);
  const founderWeight = BigInt(founderWeightValue);
  const memberWeight = BigInt(memberWeightValue);

  if (!budget || budget.ceiling_wei !== safety.TOTAL_CEILING_WEI.toString()) throw new Error("The 10 GEN cumulative budget ledger is unavailable or changed.");
  safety.assertBudgetLedger(budget);
  if (journal.active_transaction) {
    await reconcileSubmittedStep(cliClient, journal, budget, journal.active_transaction);
    return;
  }
  if (status !== "UNKNOWN" && proposalKind !== "MEMBER_ADD") throw new Error(`Candidate ID belongs to proposal kind ${proposalKind}; stop without writing.`);
  if (status === "VOTING" && snapshotTotal !== 1n) throw new Error(`Expected the one-founder member-add snapshot, observed total weight ${snapshotTotal}.`);
  if (status === "VOTING" && votesFor + votesAgainst > snapshotTotal) throw new Error("Vote totals exceed the proposal snapshot; stop for onchain state reconciliation.");

  const plan = planMembershipAction({
    status,
    proposalIdUsed: proposalIds.includes(PROPOSAL_ID),
    founderWeight,
    memberWeight,
    votesFor,
    votesAgainst,
    chainTimestamp,
    votingEndsAt,
    executeAfter,
    executeBy,
  });
  if (plan.action === "STOP") throw new Error(`${plan.reason}; no transaction submitted.`);
  if (plan.action === "WAIT_VOTING_DEADLINE" || plan.action === "WAIT_EXECUTION_TIMELOCK") {
    journal.status = plan.action;
    journal.required_chain_timestamp = plan.at;
    journal.latest_chain_timestamp = chainTimestamp.toString();
    saveJournal(journal);
    console.log(`No transaction submitted. Wait until the onchain timestamp reaches ${plan.at}.`);
    return;
  }
  if (plan.action === "MEMBER_ADD_VERIFIED") {
    journal.status = plan.action;
    journal.verified_at = isoNow();
    journal.rabby_member_weight = memberWeight.toString();
    journal.active_transaction = null;
    saveJournal(journal);
    console.log(JSON.stringify({ status: journal.status, rabby: RABBY, weight: "1", readVariant: "LATEST_FINAL" }, null, 2));
    return;
  }

  const steps = {
    PROPOSE_MEMBER_ADD: ["propose_member_add", [PROPOSAL_ID, asContractAddressString(RABBY)]],
    FOUNDER_VOTE_YES: ["vote", [PROPOSAL_ID, true]],
    FINALIZE_MEMBER_ADD: ["finalize_governance_proposal", [PROPOSAL_ID]],
    EXECUTE_MEMBER_ADD: ["execute_governance_proposal", [PROPOSAL_ID]],
  };
  const [functionName, args] = steps[plan.action] ?? [];
  if (!functionName) throw new Error(`Unsupported workflow action ${plan.action}; no transaction submitted.`);
  const stage = plan.action;

  const existing = journal.transactions.find((item) => item.stage === stage);
  if (existing) throw new Error(`Stage ${stage} is already journaled as ${existing.status}; do not replay it.`);
  const currentGasPrice = quantity(await cliClient.request({ method: "eth_gasPrice", params: [] }), "eth_gasPrice");
  journal.active_transaction = { stage, status: "PREPARING", prepared_at: isoNow(), user_fee_cap_wei: maxFeeWei.toString() };
  journal.status = stage;
  saveJournal(journal);

  cliClient.estimateTransactionGas = async (...estimateArgs) => {
    try { return await originalEstimate(...estimateArgs); }
    catch (error) { estimateFailed = true; throw error; }
  };
  account.signTransaction = async (request) => {
    if (estimateFailed) throw new Error("StudioNet gas estimation failed; refusing SDK fallback gas.");
    if (signatureCount !== 0) throw new Error("More than one signature was requested for this governance step; stop for reconciliation.");
    if (!activeStage || activeStage !== stage) throw new Error("Unexpected signing request outside the journaled stage.");
    if (String(request.to).toLowerCase() !== String(cliClient.chain.consensusMainContract?.address).toLowerCase()) {
      throw new Error("Refusing a signing request not addressed to StudioNet's consensus contract.");
    }
    if (BigInt(request.chainId) !== 61999n || BigInt(request.value ?? 0n) !== 0n) throw new Error("Wrong chain or unexpected GEN transfer value.");
    const actualMaxFee = BigInt(request.gas) * BigInt(request.gasPrice);
    if (actualMaxFee > maxFeeWei) throw new Error(`Current signed fee cap ${actualMaxFee} wei exceeds the user-authorized ${maxFeeWei} wei.`);
    if (BigInt(request.gasPrice) !== currentGasPrice) throw new Error("Gas price changed after fee preflight; stop and requote before signing.");
    budget = safety.reserveFeeQuote(budget, maxFeeWei);
    signatureCount += 1;
    activeStage = stage;
    journal.active_transaction = {
      stage,
      status: "SIGNING_PREPARED",
      prepared_at: journal.active_transaction.prepared_at,
      user_fee_cap_wei: maxFeeWei.toString(),
      signed_gas_limit: BigInt(request.gas).toString(),
      signed_gas_price_wei: BigInt(request.gasPrice).toString(),
      signed_fee_cap_wei: actualMaxFee.toString(),
    };
    journal.transactions.push({ ...journal.active_transaction });
    safety.atomicWriteJson(BUDGET_PATH, budget);
    saveJournal(journal);
    return originalSign(request);
  };

  activeStage = stage;
  journal.active_transaction = { ...journal.active_transaction, status: "SUBMISSION_IN_PROGRESS" };
  saveJournal(journal);
  let transactionHash;
  try {
    transactionHash = await cliClient.writeContract({
      address: CORE,
      functionName,
      args,
      value: 0n,
    });
  } catch (error) {
    const active = journal.transactions.find((item) => item.stage === stage);
    if (active) {
      active.status = "OUTCOME_UNKNOWN";
      active.error = String(error?.message ?? error).slice(0, 400);
      journal.active_transaction = { ...active };
      journal.status = "STOPPED_REQUIRES_RECONCILIATION";
      saveJournal(journal);
    } else {
      journal.active_transaction = null;
      journal.status = "PRE_SUBMISSION_BLOCKED";
      saveJournal(journal);
    }
    throw error;
  } finally {
    activeStage = null;
  }
  if (typeof transactionHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(transactionHash)) {
    journal.status = "STOPPED_REQUIRES_RECONCILIATION";
    journal.active_transaction = { ...journal.active_transaction, status: "OUTCOME_UNKNOWN" };
    saveJournal(journal);
    throw new Error("CLI SDK returned no valid transaction hash. Never retry this stage until reconciled.");
  }
  const activeRecord = journal.transactions.find((item) => item.stage === stage);
  activeRecord.transaction_id = transactionHash;
  activeRecord.status = "SUBMITTED";
  activeRecord.submitted_at = isoNow();
  journal.active_transaction = { ...activeRecord };
  budget.pending_transaction_id = transactionHash;
  safety.atomicWriteJson(BUDGET_PATH, budget);
  saveJournal(journal);

  let receipt;
  let feeSettled = false;
  try {
    receipt = await cliClient.waitForTransactionReceipt({ hash: transactionHash, status: "FINALIZED", interval: 5000, retries: 240, fullTransaction: true });
    const evmReceipt = await cliClient.request({ method: "eth_getTransactionReceipt", params: [transactionHash] });
    const actualFee = deployment.actualEvmFeeWei(evmReceipt, transactionHash);
    if (actualFee > maxFeeWei) throw new Error("Actual EVM fee exceeded the user-authorized fee cap.");
    budget = safety.settleFeeReservation(budget, maxFeeWei, actualFee);
    budget.last_settled_transaction_id = transactionHash;
    safety.atomicWriteJson(BUDGET_PATH, budget);
    feeSettled = true;
    Object.assign(activeRecord, {
      status: "FINALIZED",
      final_status: receipt?.status_name ?? receipt?.statusName ?? "FINALIZED",
      result_name: receipt?.result_name ?? receipt?.resultName ?? "MAJORITY_AGREE",
      transaction_execution: receipt?.txExecutionResultName ?? receipt?.execution_result ?? "SUCCESS",
      evm_receipt_status: evmReceipt.status,
      gas_used: String(evmReceipt.gasUsed),
      effective_gas_price_wei: String(evmReceipt.effectiveGasPrice),
      actual_fee_wei: actualFee.toString(),
      finalized_at: isoNow(),
    });
    if (!deployment.successfulFinalizedDeployment(receipt)) {
      activeRecord.status = "FINALIZED_FAILED";
      journal.active_transaction = null;
      journal.transactions = journal.transactions.map((item) => item.stage === stage ? activeRecord : item);
      journal.status = "STOPPED_FINALIZED_FAILED";
      saveJournal(journal);
      throw new Error("Transaction finalized without FINALIZED / MAJORITY_AGREE / leader SUCCESS.");
    }
    journal.active_transaction = null;
    journal.transactions = journal.transactions.map((item) => item.stage === stage ? activeRecord : item);
    journal.status = "STEP_FINALIZED";
    saveJournal(journal);
  } catch (error) {
    if (feeSettled) throw error;
    activeRecord.status = "OUTCOME_UNKNOWN";
    activeRecord.error = String(error?.message ?? error).slice(0, 400);
    journal.active_transaction = { ...activeRecord };
    journal.transactions = journal.transactions.map((item) => item.stage === stage ? activeRecord : item);
    journal.status = "STOPPED_REQUIRES_RECONCILIATION";
    saveJournal(journal);
    throw error;
  }

  // The next invocation re-reads finalized contract state and either advances
  // one stage, waits on the exact onchain deadline, or verifies completion.
  console.log(JSON.stringify({ stage, transactionHash, status: "FINALIZED_SUCCESS", actualFeeWei: String(budget.actual_fees_wei), next: "Re-run the read/finalized-state preflight before another stage." }, null, 2));
  } finally {
    releaseBudgetLock();
  }
}

module.exports = runMembershipStep;
