import { describe, expect, it } from "vitest";
import {
  canAcknowledgeEoaPayout,
  connectedWalletMatches,
  formatUtcTimestamp,
  formatWei,
  mapEoaSettlementState,
  mapRecipientAcknowledgment,
  mapTransactionState,
} from "./models";

describe("onchain state mapping", () => {
  it("requires both finalized status and successful execution", () => {
    expect(mapTransactionState({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" }))
      .toBe("FINALIZED_SUCCESS");
    expect(mapTransactionState({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" }))
      .toBe("FINALIZED_FAILED");
    expect(mapTransactionState({ statusName: "FINALIZED" })).toBe("FINALIZED_EXECUTION_UNKNOWN");
  });

  it("maps the stable GenLayerJS snake_case transaction receipt fields", () => {
    expect(mapTransactionState({ status_name: "FINALIZED", tx_execution_result_name: "FINISHED_WITH_RETURN" }))
      .toBe("FINALIZED_SUCCESS");
    expect(mapTransactionState({ status_name: "FINALIZED", tx_execution_result_name: "FINISHED_WITH_ERROR" }))
      .toBe("FINALIZED_FAILED");
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

  it("maps beneficiary acknowledgment as a distinct attestation", () => {
    const record = mapRecipientAcknowledgment([
      "RECIPIENT_ACKNOWLEDGED", "0xvault", "project-a", "payment-1",
      "0xbeneficiary", 1000000000000000000n, "0xbeneficiary", 1760000000n,
    ]);
    expect(record).toMatchObject({
      status: "RECIPIENT_ACKNOWLEDGED",
      projectVault: "0xvault",
      projectId: "project-a",
      paymentId: "payment-1",
      amountWei: "1000000000000000000",
      signer: "0xbeneficiary",
      acknowledgedAt: "1760000000",
    });
    expect(mapEoaSettlementState("PENDING")).toBe("UNVERIFIED");
  });

  it("enables acknowledgment only for the exact EOA recipient on StudioNet before acknowledgment", () => {
    const payout = ["PENDING", "EOA", "0xBeneficiary", 25n, 1760000000n];
    const notAcknowledged = ["NOT_ACKNOWLEDGED", "0xVault", "project-a", "payment-1", "0xBeneficiary", 25n, "", 0n];
    const canAck = (wallet: string, chain: string, id: string, payoutState = payout, ack = notAcknowledged) =>
      canAcknowledgeEoaPayout(wallet, chain, id, "0xVault", payoutState, ack);
    expect(canAck("0xbENEFICIARY", "0xf22f", "payment-1")).toBe(true);
    expect(canAck("0xother", "0xf22f", "payment-1")).toBe(false);
    expect(canAck("0xBeneficiary", "0x1", "payment-1")).toBe(false);
    expect(canAck("0xBeneficiary", "0xf22f", "different-payment")).toBe(false);
    expect(canAck("0xBeneficiary", "0xf22f", "payment-1", ["VERIFIED", ...payout.slice(1)])).toBe(false);
    expect(canAck("0xBeneficiary", "0xf22f", "payment-1", payout, ["RECIPIENT_ACKNOWLEDGED", ...notAcknowledged.slice(1)])).toBe(false);
    expect(canAck("0xBeneficiary", "0xf22f", "payment-1", ["PENDING", "IC", "0xBeneficiary", 25n])).toBe(false);
  });

  it("rejects writes after disconnect, account switch, or network change", () => {
    const beneficiary = `0x${"a".repeat(40)}`;
    const sameAccountDifferentCase = `0x${"A".repeat(40)}`;
    const other = `0x${"b".repeat(40)}`;
    expect(connectedWalletMatches(beneficiary, "0xf22f", [sameAccountDifferentCase])).toBe(true);
    expect(connectedWalletMatches(beneficiary, "0xf22f", [])).toBe(false);
    expect(connectedWalletMatches(beneficiary, "0x1", [beneficiary])).toBe(false);
    expect(connectedWalletMatches(beneficiary, "0xf22f", [other])).toBe(false);
  });

  it("formats wei and transaction timestamps without floating point", () => {
    expect(formatWei("1234567890000000001")).toBe("1.234567890000000001 GEN");
    expect(formatWei("1000000000000000000")).toBe("1 GEN");
    expect(formatUtcTimestamp("0")).toBe("Not recorded");
    expect(formatUtcTimestamp("1760000000")).toMatch(/ UTC$/);
  });
});
