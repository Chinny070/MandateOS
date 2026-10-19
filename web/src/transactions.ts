export const STUDIONET_CHAIN_ID = 61999;

type FeeEstimate = {
  distribution: unknown;
  messageAllocations?: unknown[];
  feeValue: bigint;
};

export type FeeAwareWriter = {
  chain?: { id?: number };
  estimateTransactionFeesForWrite: (call: Record<string, unknown>) => Promise<FeeEstimate>;
  writeContract: (call: Record<string, unknown>) => Promise<unknown>;
};

/** Estimate and submit one write without dropping the SDK's child-message fee plan. */
export async function submitStudioNetWrite(
  writer: FeeAwareWriter,
  call: Record<string, unknown>,
): Promise<unknown> {
  if (writer.chain?.id !== STUDIONET_CHAIN_ID) {
    throw new Error(`Writes require StudioNet chain ID ${STUDIONET_CHAIN_ID}.`);
  }

  let estimate: FeeEstimate;
  try {
    estimate = await writer.estimateTransactionFeesForWrite(call);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.includes("sim_getFeeConfig") || detail.includes("-32601")) {
      throw new Error("StudioNet does not expose the fee-policy method required by this SDK. No transaction was submitted.");
    }
    throw error;
  }
  if (!estimate || typeof estimate.feeValue !== "bigint" || estimate.feeValue < 0n || !estimate.distribution) {
    throw new Error("The StudioNet fee estimate is incomplete; the transaction was not submitted.");
  }
  if (estimate.messageAllocations !== undefined && !Array.isArray(estimate.messageAllocations)) {
    throw new Error("The StudioNet message fee allocation is invalid; the transaction was not submitted.");
  }

  return writer.writeContract({
    ...call,
    fees: {
      distribution: estimate.distribution,
      messageAllocations: estimate.messageAllocations ?? [],
      feeValue: estimate.feeValue,
    },
  });
}
