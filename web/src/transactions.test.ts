import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createStudioNetFeeGuard,
  formatFeeWei,
  submitStudioNetWrite,
  STUDIONET_CONSENSUS_ADDRESS,
  type Eip1193Provider,
} from "./transactions";

const ACCOUNT = "0xaffe15eec45b68835cc9e5b4ab85dd5deae8e70b";
const TX = {
  from: ACCOUNT,
  to: STUDIONET_CONSENSUS_ADDRESS,
  data: "0x1234",
  gas: "0xc350",
  gasPrice: "0x0",
  value: "0x0",
  chainId: "0xf22f",
};

function mockedFetch(overrides: Record<string, unknown> = {}) {
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)) as { method: string };
    const values: Record<string, unknown> = {
      eth_chainId: "0xf22f",
      eth_estimateGas: "0x7530",
      eth_gasPrice: "0x0",
      ...overrides,
    };
    const result = values[payload.method];
    if (result instanceof Error) return new Response(JSON.stringify({ error: { code: -1, message: result.message } }), { status: 200 });
    return new Response(JSON.stringify({ result }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function walletProvider(overrides: { chain?: string; accounts?: string[] } = {}) {
  const request = vi.fn(async ({ method }: { method: string }) => {
    if (method === "eth_chainId") return overrides.chain ?? "0xf22f";
    if (method === "eth_accounts") return overrides.accounts ?? [ACCOUNT];
    if (method === "eth_sendTransaction") return `0x${"a".repeat(64)}`;
    throw new Error(`Unexpected provider method ${method}`);
  });
  return { provider: { request } as Eip1193Provider, request };
}

afterEach(() => vi.unstubAllGlobals());

describe("StudioNet stable SDK wallet-write guard", () => {
  it("re-estimates the exact legacy request and asks before forwarding to Rabby", async () => {
    const fetchMock = mockedFetch();
    const wallet = walletProvider();
    const approve = vi.fn().mockReturnValue(true);
    const guard = createStudioNetFeeGuard(wallet.provider, ACCOUNT, approve);
    const result = await guard.request({ method: "eth_sendTransaction", params: [TX] });

    expect(result).toBe(`0x${"a".repeat(64)}`);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).method)).toEqual([
      "eth_chainId", "eth_estimateGas", "eth_gasPrice",
    ]);
    expect(approve).toHaveBeenCalledWith({ gasLimit: 50000n, gasPriceWei: 0n, maximumFeeWei: 0n, valueWei: 0n });
    expect(wallet.request.mock.calls.filter(([request]) => request.method === "eth_sendTransaction")).toHaveLength(1);
  });

  it("does not open the wallet when the connected account or network is wrong", async () => {
    mockedFetch();
    const wrongAccount = walletProvider({ accounts: ["0x1111111111111111111111111111111111111111"] });
    const approval = vi.fn().mockReturnValue(true);
    const accountGuard = createStudioNetFeeGuard(wrongAccount.provider, ACCOUNT, approval);
    await expect(accountGuard.request({ method: "eth_sendTransaction", params: [TX] })).rejects.toThrow("active wallet account changed");
    expect(approval).not.toHaveBeenCalled();
    expect(wrongAccount.request.mock.calls.some(([request]) => request.method === "eth_sendTransaction")).toBe(false);

    const wrongChain = walletProvider({ chain: "0x1" });
    const chainGuard = createStudioNetFeeGuard(wrongChain.provider, ACCOUNT, approval);
    await expect(chainGuard.request({ method: "eth_sendTransaction", params: [TX] })).rejects.toThrow("StudioNet");
    expect(wrongChain.request.mock.calls.some(([request]) => request.method === "eth_sendTransaction")).toBe(false);
  });

  it("rechecks account and chain after fee confirmation", async () => {
    mockedFetch();
    let chainReads = 0;
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_chainId") return ++chainReads === 1 ? "0xf22f" : "0x1";
      if (method === "eth_accounts") return [ACCOUNT];
      if (method === "eth_sendTransaction") return `0x${"a".repeat(64)}`;
      throw new Error(`Unexpected provider method ${method}`);
    });
    const guard = createStudioNetFeeGuard({ request }, ACCOUNT, vi.fn().mockReturnValue(true));
    await expect(guard.request({ method: "eth_sendTransaction", params: [TX] })).rejects.toThrow("StudioNet");
    expect(request.mock.calls.some(([arg]) => arg.method === "eth_sendTransaction")).toBe(false);
  });

  it("fails closed on RPC, unsupported estimate, insufficient gas or changed fee quote", async () => {
    for (const overrides of [
      { eth_estimateGas: new Error("unavailable") },
      { eth_estimateGas: "0x186a1" },
      { eth_gasPrice: "0x1" },
      { eth_chainId: "0x1" },
    ]) {
      mockedFetch(overrides);
      const wallet = walletProvider();
      const approval = vi.fn().mockReturnValue(true);
      const guard = createStudioNetFeeGuard(wallet.provider, ACCOUNT, approval);
      await expect(guard.request({ method: "eth_sendTransaction", params: [TX] })).rejects.toThrow();
      expect(approval).not.toHaveBeenCalled();
      expect(wallet.request.mock.calls.some(([request]) => request.method === "eth_sendTransaction")).toBe(false);
    }
  });

  it("blocks native GEN value, malformed targets and user-cancelled fee commitments", async () => {
    mockedFetch();
    const wallet = walletProvider();
    const guard = createStudioNetFeeGuard(wallet.provider, ACCOUNT, vi.fn().mockReturnValue(true));
    await expect(guard.request({ method: "eth_sendTransaction", params: [{ ...TX, value: "0x1" }] }))
      .rejects.toThrow("value transfers are disabled");
    await expect(guard.request({ method: "eth_sendTransaction", params: [{ ...TX, to: ACCOUNT }] }))
      .rejects.toThrow("consensus contract");

    const cancel = createStudioNetFeeGuard(wallet.provider, ACCOUNT, vi.fn().mockReturnValue(false));
    await expect(cancel.request({ method: "eth_sendTransaction", params: [TX] })).rejects.toThrow("cancelled");
    expect(wallet.request.mock.calls.some(([request]) => request.method === "eth_sendTransaction")).toBe(false);
  });

  it("does not submit a writer configured for another chain", async () => {
    const writeContract = vi.fn();
    await expect(submitStudioNetWrite({ chain: { id: 61997 }, writeContract }, {})).rejects.toThrow("require StudioNet");
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("formats a fee commitment without floating point rounding", () => {
    expect(formatFeeWei(1_234_000_000_000_000_000n)).toBe("1.234 GEN");
    expect(formatFeeWei(0n)).toBe("0 GEN");
  });
});
