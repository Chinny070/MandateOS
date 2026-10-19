const fs = require("node:fs");
const path = require("node:path");

const GEN = 10n ** 18n;
const TOTAL_CEILING_WEI = 10n * GEN;
const FIRST_TEST_VALUE_CEILING_WEI = 10n ** 16n;

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

function acquireExclusiveLock(lockPath) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const fd = fs.openSync(lockPath, "wx", 0o600);
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }));
  fs.closeSync(fd);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    fs.unlinkSync(lockPath);
  };
}

function jsonSafe(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  return value;
}

function reserveFeeQuote(budget, feeValueWei, transactionId = null) {
  const fee = BigInt(feeValueWei);
  if (fee < 0n) throw new Error("Negative fee quote refused.");
  const spent = BigInt(budget.actual_fees_wei);
  const committed = BigInt(budget.committed_fees_wei);
  const valueSpent = BigInt(budget.actual_test_value_wei);
  const valueCommitted = BigInt(budget.committed_test_value_wei);
  const unknown = BigInt(budget.unknown_liabilities_wei);
  const nextCommitted = committed + fee;
  const total = spent + nextCommitted + valueSpent + valueCommitted + unknown;
  if (total > TOTAL_CEILING_WEI) throw new Error("Cumulative GEN budget ceiling exceeded; no transaction submitted.");
  return recalculateBudget({ ...budget, committed_fees_wei: nextCommitted.toString(), pending_fee_quote_wei: fee.toString(), pending_transaction_id: transactionId });
}

function settleFeeReservation(budget, feeValueWei, actualPaidWei = null) {
  const quote = BigInt(feeValueWei);
  if (quote < 0n) throw new Error("Negative fee reservation cannot be settled.");
  const committed = BigInt(budget.committed_fees_wei);
  if (quote > committed) throw new Error("Fee receipt exceeds the recorded committed fee reservation.");
  const next = { ...budget, committed_fees_wei: (committed - quote).toString(), pending_fee_quote_wei: null, pending_transaction_id: null };
  if (actualPaidWei === null || actualPaidWei === undefined) {
    next.unknown_fee_liabilities_wei = (BigInt(next.unknown_fee_liabilities_wei ?? next.unknown_liabilities_wei ?? "0") + quote).toString();
  } else {
    const paid = BigInt(actualPaidWei);
    if (paid < 0n || paid > quote) throw new Error("Reported fee expenditure is outside the reserved quote.");
    next.actual_fees_wei = (BigInt(next.actual_fees_wei) + paid).toString();
  }
  return recalculateBudget(next);
}

function reserveTestValue(budget, valueWei) {
  const value = BigInt(valueWei);
  if (value <= 0n) throw new Error("Test transfer value must be positive.");
  const testValueTotal = BigInt(budget.actual_test_value_wei) + BigInt(budget.committed_test_value_wei)
    + BigInt(budget.unknown_test_value_liabilities_wei ?? "0") + value;
  if (testValueTotal > FIRST_TEST_VALUE_CEILING_WEI) throw new Error("First financial verification exceeds its 0.01 GEN value ceiling.");
  const total = BigInt(budget.actual_fees_wei) + BigInt(budget.committed_fees_wei) + testValueTotal + BigInt(budget.unknown_liabilities_wei);
  if (total > TOTAL_CEILING_WEI) throw new Error("Cumulative GEN budget ceiling exceeded.");
  return recalculateBudget({ ...budget, committed_test_value_wei: (BigInt(budget.committed_test_value_wei) + value).toString() });
}

function settleTestValueReservation(budget, reservedWei, actualValueWei = null) {
  const reserved = BigInt(reservedWei);
  if (reserved <= 0n) throw new Error("Test-value reservation must be positive.");
  const committed = BigInt(budget.committed_test_value_wei);
  if (reserved > committed) throw new Error("Test-value receipt exceeds the recorded reservation.");
  const next = { ...budget, committed_test_value_wei: (committed - reserved).toString() };
  if (actualValueWei === null || actualValueWei === undefined) {
    next.unknown_test_value_liabilities_wei = (BigInt(next.unknown_test_value_liabilities_wei ?? "0") + reserved).toString();
  } else {
    const actual = BigInt(actualValueWei);
    if (actual < 0n || actual > reserved) throw new Error("Actual test transfer exceeds its reserved amount.");
    next.actual_test_value_wei = (BigInt(next.actual_test_value_wei) + actual).toString();
  }
  const totalValue = BigInt(next.actual_test_value_wei) + BigInt(next.committed_test_value_wei);
  const unknownValue = BigInt(next.unknown_test_value_liabilities_wei ?? "0");
  if (totalValue + unknownValue > FIRST_TEST_VALUE_CEILING_WEI) throw new Error("First financial verification value and unknown value liabilities exceed 0.01 GEN.");
  return recalculateBudget(next);
}

function recalculateBudget(budget) {
  if (budget.unknown_fee_liabilities_wei !== undefined || budget.unknown_test_value_liabilities_wei !== undefined) {
    budget.unknown_liabilities_wei = (BigInt(budget.unknown_fee_liabilities_wei ?? "0") + BigInt(budget.unknown_test_value_liabilities_wei ?? "0")).toString();
  }
  const total = ["actual_fees_wei", "committed_fees_wei", "actual_test_value_wei", "committed_test_value_wei", "unknown_liabilities_wei"]
    .reduce((sum, key) => sum + BigInt(budget[key]), 0n);
  if (total > TOTAL_CEILING_WEI) throw new Error("Cumulative GEN budget ceiling exceeded.");
  const hasActual = BigInt(budget.actual_fees_wei) + BigInt(budget.actual_test_value_wei) > 0n;
  const hasCommitted = BigInt(budget.committed_fees_wei) + BigInt(budget.committed_test_value_wei) > 0n;
  const status = BigInt(budget.unknown_liabilities_wei) > 0n ? "REQUIRES_RECONCILIATION"
    : hasCommitted ? "COMMITTED_LIABILITIES"
      : hasActual ? "EXPENDITURE_RECORDED" : "PREPARED_NO_SPEND";
  return { ...budget, status, remaining_wei: (TOTAL_CEILING_WEI - total).toString() };
}

function assertBudgetLedger(budget) {
  const keys = ["actual_fees_wei", "committed_fees_wei", "actual_test_value_wei", "committed_test_value_wei", "unknown_liabilities_wei"];
  for (const key of keys) if (!/^\d+$/.test(String(budget?.[key] ?? ""))) throw new Error(`Invalid GEN budget ledger field: ${key}`);
  const total = keys.reduce((sum, key) => sum + BigInt(budget[key]), 0n);
  if (budget.unknown_fee_liabilities_wei !== undefined || budget.unknown_test_value_liabilities_wei !== undefined) {
    for (const key of ["unknown_fee_liabilities_wei", "unknown_test_value_liabilities_wei"]) {
      if (budget[key] !== undefined && !/^\d+$/.test(String(budget[key]))) throw new Error(`Invalid GEN budget ledger field: ${key}`);
    }
    const unknownSplit = BigInt(budget.unknown_fee_liabilities_wei ?? "0") + BigInt(budget.unknown_test_value_liabilities_wei ?? "0");
    if (unknownSplit !== BigInt(budget.unknown_liabilities_wei)) throw new Error("Unknown-liability categories do not reconcile to the total.");
  }
  if (budget.pending_fee_quote_wei !== undefined && budget.pending_fee_quote_wei !== null
      && !/^\d+$/.test(String(budget.pending_fee_quote_wei))) throw new Error("Invalid pending fee quote in budget ledger.");
  if (budget.pending_fee_quote_wei !== undefined && budget.pending_fee_quote_wei !== null
      && BigInt(budget.pending_fee_quote_wei) > BigInt(budget.committed_fees_wei)) throw new Error("Pending fee quote exceeds committed fees.");
  if (total > TOTAL_CEILING_WEI) throw new Error("Cumulative GEN budget ledger exceeds its immutable 10 GEN ceiling.");
  if (budget.remaining_wei !== undefined && BigInt(budget.remaining_wei) !== TOTAL_CEILING_WEI - total) throw new Error("Remaining GEN budget does not reconcile to the ledger.");
  const hasActual = BigInt(budget.actual_fees_wei) + BigInt(budget.actual_test_value_wei) > 0n;
  const hasCommitted = BigInt(budget.committed_fees_wei) + BigInt(budget.committed_test_value_wei) > 0n;
  const expectedStatus = BigInt(budget.unknown_liabilities_wei) > 0n ? "REQUIRES_RECONCILIATION"
    : hasCommitted ? "COMMITTED_LIABILITIES"
      : hasActual ? "EXPENDITURE_RECORDED" : "PREPARED_NO_SPEND";
  if (budget.status !== undefined && budget.status !== expectedStatus) throw new Error("Budget status does not reconcile to recorded amounts.");
  return total;
}

function assertNoUnresolvedDeployment(record) {
  for (const name of ["core", "vault"]) {
    const stage = record?.contracts?.[name];
    if (stage && stage.status !== "FINALIZED_SUCCESS") {
      throw new Error(`${name} deployment status ${String(stage.status)} must be reconciled before any retry.`);
    }
  }
}

module.exports = { GEN, TOTAL_CEILING_WEI, FIRST_TEST_VALUE_CEILING_WEI, readJson, atomicWriteJson, acquireExclusiveLock, jsonSafe, reserveFeeQuote, settleFeeReservation, reserveTestValue, settleTestValueReservation, assertBudgetLedger, assertNoUnresolvedDeployment };
