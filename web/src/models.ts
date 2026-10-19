export type TransactionLike = {
  statusName?: string | number;
  status_name?: string | number;
  status?: string | number;
  txExecutionResultName?: string | number;
  tx_execution_result_name?: string | number;
  txExecutionResult?: string | number;
  tx_execution_result?: string | number;
};

export type UiTransactionState =
  | "FINALIZED_SUCCESS"
  | "FINALIZED_FAILED"
  | "FINALIZED_EXECUTION_UNKNOWN"
  | "ACCEPTED"
  | "PENDING"
  | "CANCELED"
  | "UNKNOWN";

const normalized = (value: unknown): string => String(value ?? "").toUpperCase().replaceAll(" ", "_");

export function mapTransactionState(tx: TransactionLike | null | undefined): UiTransactionState {
  if (!tx) return "UNKNOWN";
  const status = normalized(tx.statusName ?? tx.status_name ?? tx.status);
  const execution = normalized(
    tx.txExecutionResultName ?? tx.tx_execution_result_name ?? tx.txExecutionResult ?? tx.tx_execution_result,
  );
  if (["CANCELED", "CANCELLED", "8"].includes(status)) return "CANCELED";
  if (["FINALIZED", "7"].includes(status)) {
    if (["FINISHED_WITH_RETURN", "FINISHEDWITHRETURN", "1"].includes(execution)) return "FINALIZED_SUCCESS";
    if (["FINISHED_WITH_ERROR", "FINISHEDWITHERROR", "2", "TIMEOUT", "3"].includes(execution)) {
      return "FINALIZED_FAILED";
    }
    return "FINALIZED_EXECUTION_UNKNOWN";
  }
  if (["ACCEPTED", "5"].includes(status)) return "ACCEPTED";
  if (["PENDING", "PROCESSING", "ACTIVATED", "1", "2", "3", "4"].includes(status)) return "PENDING";
  return "UNKNOWN";
}

export function mapEoaSettlementState(contractState: string | null | undefined): string {
  const state = normalized(contractState);
  if (["VALUE_AT_RISK", "CHILD_FAILED", "PARENT_FAILED"].includes(state)) return state;
  // The supported GenLayer triggered-transaction API covers internal messages,
  // so an EOA payment cannot be promoted by contract state alone.
  return "UNVERIFIED";
}

export type RecipientAcknowledgment = {
  status: string;
  projectVault: string;
  projectId: string;
  paymentId: string;
  beneficiary: string;
  amountWei: string;
  signer: string;
  acknowledgedAt: string;
};

export function mapRecipientAcknowledgment(value: unknown): RecipientAcknowledgment {
  if (!Array.isArray(value) || value.length < 8) {
    return {
      status: "UNKNOWN", projectVault: "", projectId: "", paymentId: "",
      beneficiary: "", amountWei: "0", signer: "", acknowledgedAt: "0",
    };
  }
  return {
    status: String(value[0] ?? "UNKNOWN"),
    projectVault: String(value[1] ?? ""),
    projectId: String(value[2] ?? ""),
    paymentId: String(value[3] ?? ""),
    beneficiary: String(value[4] ?? ""),
    amountWei: String(value[5] ?? "0"),
    signer: String(value[6] ?? ""),
    acknowledgedAt: String(value[7] ?? "0"),
  };
}

export function canAcknowledgeEoaPayout(
  wallet: string,
  chainId: string,
  paymentId: string,
  vaultAddress: string,
  payout: unknown,
  acknowledgment: unknown,
): boolean {
  if (!wallet || !paymentId || !vaultAddress || chainId.toLowerCase() !== "0xf22f" || !Array.isArray(payout) || payout.length < 4) return false;
  const payoutState = normalized(payout[0]);
  if (normalized(payout[1]) !== "EOA" || !["PENDING", "VALUE_AT_RISK"].includes(payoutState)) return false;
  const details = mapRecipientAcknowledgment(acknowledgment);
  let amount: bigint;
  try {
    amount = BigInt(String(payout[3] ?? "0"));
  } catch {
    return false;
  }
  return wallet.toLowerCase() === String(payout[2]).toLowerCase()
    && amount > 0n
    && details.projectVault.toLowerCase() === vaultAddress.toLowerCase()
    && details.paymentId === paymentId
    && details.beneficiary.toLowerCase() === String(payout[2]).toLowerCase()
    && details.amountWei === amount.toString()
    && details.status === "NOT_ACKNOWLEDGED";
}

export function formatWei(value: unknown): string {
  let amount: bigint;
  try {
    amount = typeof value === "bigint" ? value : BigInt(String(value ?? "0"));
  } catch {
    return "Unavailable";
  }
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const whole = absolute / 10n ** 18n;
  const fractional = (absolute % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${sign}${whole.toString()}${fractional ? `.${fractional}` : ""} GEN`;
}

export function formatUtcTimestamp(value: unknown): string {
  let seconds: number;
  try {
    seconds = Number(BigInt(String(value ?? "0")));
  } catch {
    return "Unavailable";
  }
  if (!Number.isFinite(seconds) || seconds <= 0) return "Not recorded";
  return new Date(seconds * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => (typeof entry === "bigint" ? entry.toString() : entry), 2);
}
