const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const safety = require("./deployment-safety.cjs");

function emptyBudget() {
  return {
    actual_fees_wei: "0",
    committed_fees_wei: "0",
    actual_test_value_wei: "0",
    committed_test_value_wei: "0",
    unknown_liabilities_wei: "0",
    unknown_fee_liabilities_wei: "0",
    unknown_test_value_liabilities_wei: "0",
  };
}

test("cumulative fee quotes reserve against the fixed 10 GEN ceiling", () => {
  const first = safety.reserveFeeQuote(emptyBudget(), 3n * 10n ** 18n);
  assert.equal(first.committed_fees_wei, (3n * 10n ** 18n).toString());
  assert.equal(first.remaining_wei, (7n * 10n ** 18n).toString());
  assert.equal(first.status, "COMMITTED_LIABILITIES");
  assert.throws(() => safety.reserveFeeQuote(first, 8n * 10n ** 18n), /ceiling/);
});

test("unknown fee outcome retains the entire quoted amount as a liability", () => {
  const reserved = safety.reserveFeeQuote(emptyBudget(), 500n);
  const unknown = safety.settleFeeReservation(reserved, 500n, null);
  assert.equal(unknown.committed_fees_wei, "0");
  assert.equal(unknown.unknown_liabilities_wei, "500");
  assert.equal(unknown.unknown_fee_liabilities_wei, "500");
  assert.equal(unknown.status, "REQUIRES_RECONCILIATION");
  assert.equal(unknown.remaining_wei, (safety.TOTAL_CEILING_WEI - 500n).toString());
  assert.throws(() => safety.settleFeeReservation(reserved, -1n), /Negative fee reservation/);
});

test("known fee settlement records actual expenditure and releases unused quote", () => {
  const reserved = safety.reserveFeeQuote(emptyBudget(), 500n);
  const settled = safety.settleFeeReservation(reserved, 500n, 320n);
  assert.equal(settled.actual_fees_wei, "320");
  assert.equal(settled.committed_fees_wei, "0");
  assert.equal(settled.status, "EXPENDITURE_RECORDED");
  assert.equal(settled.remaining_wei, (safety.TOTAL_CEILING_WEI - 320n).toString());
});

test("first financial verification reserves no more than 0.01 GEN in value", () => {
  const first = safety.reserveTestValue(emptyBudget(), safety.FIRST_TEST_VALUE_CEILING_WEI);
  assert.equal(first.committed_test_value_wei, safety.FIRST_TEST_VALUE_CEILING_WEI.toString());
  assert.throws(() => safety.reserveTestValue(first, 1n), /0.01 GEN/);
  const unknown = safety.settleTestValueReservation(first, safety.FIRST_TEST_VALUE_CEILING_WEI, null);
  assert.equal(unknown.committed_test_value_wei, "0");
  assert.equal(unknown.unknown_test_value_liabilities_wei, safety.FIRST_TEST_VALUE_CEILING_WEI.toString());
  assert.equal(unknown.unknown_liabilities_wei, safety.FIRST_TEST_VALUE_CEILING_WEI.toString());
  assert.throws(() => safety.settleTestValueReservation(first, 0n), /must be positive/);
});

test("budget ledger rejects malformed or overcommitted accounting", () => {
  assert.equal(safety.assertBudgetLedger(emptyBudget()), 0n);
  assert.throws(() => safety.assertBudgetLedger({ ...emptyBudget(), actual_fees_wei: "NaN" }), /Invalid GEN budget/);
  assert.throws(() => safety.assertBudgetLedger({
    ...emptyBudget(),
    actual_fees_wei: safety.TOTAL_CEILING_WEI.toString(),
    unknown_liabilities_wei: "1",
    unknown_fee_liabilities_wei: "1",
  }), /exceeds/);
  assert.throws(() => safety.assertBudgetLedger({ ...emptyBudget(), remaining_wei: "10" }), /does not reconcile/);
  assert.throws(() => safety.assertBudgetLedger({ ...emptyBudget(), unknown_fee_liabilities_wei: "-1" }), /Invalid GEN budget/);
  assert.throws(() => safety.assertBudgetLedger({ ...emptyBudget(), status: "SPENT" }), /status does not reconcile/);
});

test("exclusive budget lock rejects concurrent deployment writers", () => {
  const lockPath = path.join(__dirname, `.budget-lock-test-${process.pid}.lock`);
  const release = safety.acquireExclusiveLock(lockPath);
  try {
    assert.throws(() => safety.acquireExclusiveLock(lockPath), /EEXIST/);
    assert.equal(fs.existsSync(lockPath), true);
  } finally {
    release();
  }
  assert.equal(fs.existsSync(lockPath), false);
});

test("deployment recovery blocks prepared, pending, failed, and unknown attempts from replay", () => {
  for (const status of ["SUBMISSION_PREPARED", "SUBMITTED", "FINALIZED_FAILED", "OUTCOME_UNKNOWN"]) {
    assert.throws(() => safety.assertNoUnresolvedDeployment({ contracts: { core: { status } } }), /must be reconciled/);
  }
  assert.doesNotThrow(() => safety.assertNoUnresolvedDeployment({ contracts: { core: { status: "FINALIZED_SUCCESS" } } }));
  assert.doesNotThrow(() => safety.assertNoUnresolvedDeployment({ contracts: {} }));
});
