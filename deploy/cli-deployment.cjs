const TOTAL_CEILING_WEI = 10n * 10n ** 18n;

function constructorArgs(contractName, { coreAddress, projectId } = {}) {
  if (contractName === "core") return [];
  if (contractName !== "vault") throw new Error(`Unknown contract stage: ${contractName}`);
  if (typeof coreAddress !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(coreAddress)) {
    throw new Error("ProjectVault constructor requires the finalized MandateOS Core address as a string.");
  }
  if (typeof projectId !== "string" || !projectId.trim() || projectId.length > 96) {
    throw new Error("ProjectVault constructor requires the exact project ID as a string.");
  }
  return [coreAddress, projectId];
}

function legacyEvmFeeCapWei({ gas, gasPrice, chainId }) {
  if (chainId === undefined || BigInt(chainId) !== 61999n) throw new Error("Refusing to sign a transaction for a non-StudioNet chain.");
  if (gas === undefined || gas === null || gasPrice === undefined || gasPrice === null) {
    throw new Error("Legacy CLI signer request omitted gas or gasPrice; fee cap cannot be enforced.");
  }
  const gasLimit = BigInt(gas);
  const price = BigInt(gasPrice);
  if (gasLimit <= 0n || price < 0n) throw new Error("Invalid gas limit or gas price in signer request.");
  const feeCap = gasLimit * price;
  if (feeCap > TOTAL_CEILING_WEI) throw new Error("Single deployment fee cap exceeds the fixed cumulative 10 GEN ceiling.");
  return feeCap;
}

function parseQuantity(value, field) {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && (/^0x[0-9a-f]+$/i.test(value) || /^\d+$/.test(value))) return BigInt(value);
  throw new Error(`Finalized EVM receipt has no valid ${field}.`);
}

function actualEvmFeeWei(receipt, transactionHash) {
  if (!receipt || typeof receipt !== "object") throw new Error("Finalized transaction has no independently readable EVM receipt.");
  if (String(receipt.transactionHash ?? "").toLowerCase() !== transactionHash.toLowerCase()) {
    throw new Error("EVM receipt transaction hash does not match the submitted transaction.");
  }
  if (parseQuantity(receipt.status, "status") !== 1n) throw new Error("EVM transaction receipt is not successful.");
  return parseQuantity(receipt.gasUsed, "gasUsed") * parseQuantity(receipt.effectiveGasPrice, "effectiveGasPrice");
}

function successfulFinalizedDeployment(receipt) {
  const finalized = receipt?.status_name === "FINALIZED" || receipt?.statusName === "FINALIZED"
    || Number(receipt?.status) === 7; // GenLayer CLI 0.39.1 / genlayer-js 1.1.8 TransactionStatus.FINALIZED.
  const majorityAgree = receipt?.result_name === "MAJORITY_AGREE" || receipt?.resultName === "MAJORITY_AGREE"
    || Number(receipt?.result) === 6; // TransactionResult.MAJORITY_AGREE in the pinned CLI toolchain.
  const rawLeaderReceipts = receipt?.consensus_data?.leader_receipt ?? receipt?.consensusData?.leaderReceipt;
  const leaderReceipts = Array.isArray(rawLeaderReceipts) ? rawLeaderReceipts
    : rawLeaderReceipts && typeof rawLeaderReceipts === "object" ? [rawLeaderReceipts] : [];
  const leader = leaderReceipts.find((entry) => entry?.mode === "leader") ?? leaderReceipts[0];
  const executionSucceeded = receipt?.txExecutionResultName === "SUCCESS"
    || receipt?.execution_result === "SUCCESS"
    || leader?.execution_result === "SUCCESS";
  return finalized && majorityAgree && executionSucceeded;
}

function deployedAddress(receipt) {
  const candidates = [receipt?.data?.contract_address, receipt?.txDataDecoded?.contractAddress, receipt?.contractAddress];
  return candidates.find((value) => typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)) ?? null;
}

module.exports = {
  TOTAL_CEILING_WEI,
  constructorArgs,
  legacyEvmFeeCapWei,
  actualEvmFeeWei,
  successfulFinalizedDeployment,
  deployedAddress,
};
