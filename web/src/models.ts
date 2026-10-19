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
