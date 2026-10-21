import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createStudioNetFeeGuard,
  addressToContractString,
  assertGovernanceVoteReady,
  connectStudioNetWallet,
  createSingleSubmissionGuard,
  formatFeeWei,
  submitStudioNetWrite,
  STUDIONET_CONSENSUS_ADDRESS,
  STUDIONET_ADD_CHAIN,
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
  it("requires a current member, open proposal and onchain time before opening a vote wallet request", () => {
    expect(() => assertGovernanceVoteReady("VOTING", 1n, 100n, 101n)).not.toThrow();
    expect(() => assertGovernanceVoteReady("TIMELOCKED", 1n, 100n, 101n)).toThrow("not in its onchain VOTING");
    expect(() => assertGovernanceVoteReady("VOTING", 0n, 100n, 101n)).toThrow("no active MandateOS voting weight");
    expect(() => assertGovernanceVoteReady("VOTING", 1n, 101n, 101n)).toThrow("reached the proposal voting deadline");
  });

  it("encodes wallet addresses for contract string parameters that construct GenLayer Address values", () => {
    expect(addressToContractString("0x1Af111b06E6f6A05Bd41572A016318f1356aF85c"))
      .toBe("GvERsG5vagW9QVcqAWMY8TVq+Fw=");
    expect(addressToContractString("0xaffe15eec45b68835cc9e5b4ab85dd5deae8e70b"))
      .toBe("r/4V7sRbaINcyeW0q4XdXero5ws=");
    expect(() => addressToContractString("0x1234")).toThrow("valid 20-byte wallet address");
  });

  it("switches a connected wallet to StudioNet before returning its account", async () => {
    let chain = "0x1";
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_chainId") return chain;
      if (method === "wallet_switchEthereumChain") { chain = "0xf22f"; return null; }
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ACCOUNT];
      throw new Error(`Unexpected provider method ${method}`);
    });
    await expect(connectStudioNetWallet({ request })).resolves.toEqual({ account: ACCOUNT, chainId: "0xf22f" });
    expect(request.mock.calls.map(([arg]) => arg.method)).toEqual([
      "eth_chainId", "wallet_switchEthereumChain", "eth_chainId", "eth_requestAccounts", "eth_chainId", "eth_accounts",
    ]);
  });

  it("adds StudioNet only when the wallet reports an unknown chain, then switches", async () => {
    let chain = "0x1";
    let added = false;
    const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === "eth_chainId") return chain;
      if (method === "wallet_switchEthereumChain") {
        if (!added) throw Object.assign(new Error("unknown chain"), { code: 4902 });
        chain = "0xf22f";
        return null;
      }
      if (method === "wallet_addEthereumChain") {
        expect((params?.[0] as typeof STUDIONET_ADD_CHAIN).chainId).toBe("0xf22f");
        added = true;
        return null;
      }
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ACCOUNT];
      throw new Error(`Unexpected provider method ${method}`);
    });
    await expect(connectStudioNetWallet({ request })).resolves.toMatchObject({ account: ACCOUNT, chainId: "0xf22f" });
    expect(request.mock.calls.map(([arg]) => arg.method)).toEqual([
      "eth_chainId", "wallet_switchEthereumChain", "wallet_addEthereumChain", "wallet_switchEthereumChain",
      "eth_chainId", "eth_requestAccounts", "eth_chainId", "eth_accounts",
    ]);
  });

  it("fails closed when chain switching is rejected or the active account changes", async () => {
    const rejected = { request: vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_chainId") return "0x1";
      if (method === "wallet_switchEthereumChain") throw Object.assign(new Error("rejected"), { code: 4001 });
      throw new Error(`Unexpected provider method ${method}`);
    }) };
    await expect(connectStudioNetWallet(rejected)).rejects.toThrow("could not switch");

    const changed = { request: vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_chainId") return "0xf22f";
      if (method === "eth_requestAccounts") return [ACCOUNT];
      if (method === "eth_accounts") return ["0x1111111111111111111111111111111111111111"];
      throw new Error(`Unexpected provider method ${method}`);
    }) };
    await expect(connectStudioNetWallet(changed)).rejects.toThrow("changed during connection");
  });

  it("prevents duplicate wallet writes while one submission is pending and releases after completion", () => {
    const guard = createSingleSubmissionGuard();
    expect(guard.tryBegin()).toBe(true);
    expect(guard.tryBegin()).toBe(false);
    guard.finish();
    expect(guard.tryBegin()).toBe(true);
    guard.finish();
    expect(guard.tryBegin()).toBe(true);
  });

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
