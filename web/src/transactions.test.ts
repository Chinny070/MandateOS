import { describe, expect, it, vi } from "vitest";
import { submitStudioNetWrite, type FeeAwareWriter } from "./transactions";

function writer(overrides: Partial<FeeAwareWriter> = {}) {
  const estimateTransactionFeesForWrite = vi.fn().mockResolvedValue({
    distribution: { executionBudgetPerRound: 123n },
    messageAllocations: [{ messageType: 1, recipient: "0x0000000000000000000000000000000000000001", budget: 456n }],
    feeValue: 789n,
  });
  const writeContract = vi.fn().mockResolvedValue("0x" + "a".repeat(64));
  return {
    instance: { chain: { id: 61999 }, estimateTransactionFeesForWrite, writeContract, ...overrides } as FeeAwareWriter,
    estimateTransactionFeesForWrite,
    writeContract,
  };
}

describe("StudioNet fee-aware writes", () => {
  it("passes the exact estimated message allocations, distribution and fee value", async () => {
    const mock = writer();
    const call = { address: "0x0000000000000000000000000000000000000002", functionName: "fund" };
    await submitStudioNetWrite(mock.instance, call);
    expect(mock.estimateTransactionFeesForWrite).toHaveBeenCalledWith(call);
    expect(mock.writeContract).toHaveBeenCalledWith({ ...call, fees: {
      distribution: { executionBudgetPerRound: 123n },
      messageAllocations: [{ messageType: 1, recipient: "0x0000000000000000000000000000000000000001", budget: 456n }],
      feeValue: 789n,
    } });
  });

  it("fails before estimation or submission on another chain", async () => {
    const mock = writer({ chain: { id: 61997 } });
    await expect(submitStudioNetWrite(mock.instance, {})).rejects.toThrow("require StudioNet");
    expect(mock.estimateTransactionFeesForWrite).not.toHaveBeenCalled();
    expect(mock.writeContract).not.toHaveBeenCalled();
  });

  it("does not submit when estimation fails or omits required fee data", async () => {
    const failed = writer();
    failed.estimateTransactionFeesForWrite.mockRejectedValue(new Error("RPC unavailable"));
    await expect(submitStudioNetWrite(failed.instance, {})).rejects.toThrow("RPC unavailable");
    expect(failed.writeContract).not.toHaveBeenCalled();

    const incomplete = writer();
    incomplete.estimateTransactionFeesForWrite.mockResolvedValue({ feeValue: 1n } as never);
    await expect(submitStudioNetWrite(incomplete.instance, {})).rejects.toThrow("incomplete");
    expect(incomplete.writeContract).not.toHaveBeenCalled();
  });

  it("reports the StudioNet fee-policy incompatibility without submitting", async () => {
    const mock = writer();
    mock.estimateTransactionFeesForWrite.mockRejectedValue(new Error("Method not found: sim_getFeeConfig"));
    await expect(submitStudioNetWrite(mock.instance, {})).rejects.toThrow("StudioNet does not expose the fee-policy method");
    expect(mock.writeContract).not.toHaveBeenCalled();
  });

  it("includes an explicit empty allocation list for a no-message fee quote", async () => {
    const mock = writer();
    mock.estimateTransactionFeesForWrite.mockResolvedValue({ distribution: {}, feeValue: 0n });
    await submitStudioNetWrite(mock.instance, {});
    expect(mock.writeContract).toHaveBeenCalledWith({ fees: { distribution: {}, messageAllocations: [], feeValue: 0n } });
  });
});
