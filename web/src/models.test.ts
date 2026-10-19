import { describe, expect, it } from "vitest";
import { formatUtcTimestamp, formatWei, mapEoaSettlementState, mapTransactionState } from "./models";

describe("onchain state mapping", () => {
  it("requires both finalized status and successful execution", () => {
    expect(mapTransactionState({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" }))
      .toBe("FINALIZED_SUCCESS");
    expect(mapTransactionState({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" }))
      .toBe("FINALIZED_FAILED");
    expect(mapTransactionState({ statusName: "FINALIZED" })).toBe("FINALIZED_EXECUTION_UNKNOWN");
  });

  it("does not equate accepted or unknown receipts with completed execution", () => {
    expect(mapTransactionState({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" }))
      .toBe("ACCEPTED");
    expect(mapTransactionState({ statusName: "LeaderRevealing" })).toBe("UNKNOWN");
    expect(mapTransactionState(null)).toBe("UNKNOWN");
  });

  it("keeps EOA settlement unverified without an external parent-linked proof source", () => {
    expect(mapEoaSettlementState("PENDING")).toBe("UNVERIFIED");
    expect(mapEoaSettlementState("VERIFIED")).toBe("UNVERIFIED");
    expect(mapEoaSettlementState("VALUE_AT_RISK")).toBe("VALUE_AT_RISK");
  });

  it("formats wei and transaction timestamps without floating point", () => {
    expect(formatWei("1234567890000000001")).toBe("1.234567890000000001 GEN");
    expect(formatWei("1000000000000000000")).toBe("1 GEN");
    expect(formatUtcTimestamp("0")).toBe("Not recorded");
    expect(formatUtcTimestamp("1760000000")).toMatch(/ UTC$/);
  });
});
