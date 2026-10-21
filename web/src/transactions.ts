export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_HEX = "0xf22f";
export const STUDIONET_RPC = "https://studio.genlayer.com/api";
export const STUDIONET_CONSENSUS_ADDRESS = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575";

export type Eip1193Request = { method: string; params?: unknown[] };
export type Eip1193Provider = {
  request: (request: Eip1193Request) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};
export type StudioNetFeeQuote = {
  gasLimit: bigint;
  gasPriceWei: bigint;
  maximumFeeWei: bigint;
  valueWei: bigint;
};
export type StudioNetFeeApproval = (quote: StudioNetFeeQuote) => boolean | Promise<boolean>;

export const STUDIONET_ADD_CHAIN = {
  chainId: STUDIONET_CHAIN_HEX,
  chainName: "GenLayer StudioNet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: [STUDIONET_RPC],
  blockExplorerUrls: ["https://genlayer-explorer.vercel.app"],
};

function walletErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  const code = candidate.code ?? candidate.cause?.code;
  return typeof code === "number" ? code : undefined;
}

/** Connects only after a user click; network add/switch never opens a signing request. */
export async function connectStudioNetWallet(provider: Eip1193Provider): Promise<{ account: string; chainId: string }> {
  let chainId = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (chainId !== STUDIONET_CHAIN_HEX) {
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIONET_CHAIN_HEX }] });
    } catch (error) {
      if (walletErrorCode(error) !== 4902) throw new Error("Wallet could not switch to StudioNet. Select chain ID 61999 in Rabby and reconnect.");
      await provider.request({ method: "wallet_addEthereumChain", params: [STUDIONET_ADD_CHAIN] });
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIONET_CHAIN_HEX }] });
    }
    chainId = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  }
  if (chainId !== STUDIONET_CHAIN_HEX) throw new Error("Wallet did not switch to StudioNet (chain ID 61999).");
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(accounts[0])) {
    throw new Error("Wallet did not provide a valid account address.");
  }
  const [finalChain, finalAccounts] = await Promise.all([
    provider.request({ method: "eth_chainId" }),
    provider.request({ method: "eth_accounts" }),
  ]);
  if (String(finalChain).toLowerCase() !== STUDIONET_CHAIN_HEX || !Array.isArray(finalAccounts) ||
      typeof finalAccounts[0] !== "string" || finalAccounts[0].toLowerCase() !== accounts[0].toLowerCase()) {
    throw new Error("Wallet account or network changed during connection. Reconnect and review the active account.");
  }
  return { account: accounts[0], chainId: STUDIONET_CHAIN_HEX };
}

/** Synchronous guard used by the UI to reject repeated clicks before any await. */
export function createSingleSubmissionGuard() {
  let active = false;
  return {
    tryBegin(): boolean {
      if (active) return false;
      active = true;
      return true;
    },
    finish(): void { active = false; },
  };
}

type RpcResponse = { result?: unknown; error?: { message?: string; code?: number } };
type TransactionRequest = Record<string, unknown> & {
  from?: string;
  to?: string;
  data?: string;
  gas?: string | number | bigint;
  gasPrice?: string | number | bigint;
  value?: string | number | bigint;
  chainId?: string | number | bigint;
};

let rpcId = 0;

function parseQuantity(value: unknown, name: string): bigint {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && (/^0x[0-9a-f]+$/i.test(value) || /^\d+$/.test(value))) return BigInt(value);
  throw new Error(`StudioNet returned an invalid ${name}.`);
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(STUDIONET_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`StudioNet ${method} failed with HTTP ${response.status}.`);
  const body = await response.json() as RpcResponse;
  if (body.error) throw new Error(`StudioNet ${method} failed (${body.error.code ?? "RPC"}): ${body.error.message ?? "unknown RPC error"}`);
  if (body.result === undefined || body.result === null) throw new Error(`StudioNet ${method} returned no result.`);
  return body.result;
}

function assertCurrentWallet(chainId: unknown, accounts: unknown, account: string): void {
  if (String(chainId).toLowerCase() !== STUDIONET_CHAIN_HEX) {
    throw new Error(`Wallet must be connected to StudioNet (chain ID ${STUDIONET_CHAIN_ID}).`);
  }
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || accounts[0].toLowerCase() !== account.toLowerCase()) {
    throw new Error("The active wallet account changed before submission; reconnect and review the transaction.");
  }
}

/**
 * Wraps an injected wallet for the legacy StudioNet write path. GenLayerJS 1.1.8
 * can silently fall back to 200,000 gas if its estimate fails, so this provider
 * independently re-estimates the exact EVM request and asks the user to accept
 * the maximum fee before it forwards eth_sendTransaction to the wallet popup.
 */
export function createStudioNetFeeGuard(
  provider: Eip1193Provider,
  account: string,
  approveFee: StudioNetFeeApproval,
): Eip1193Provider {
  if (!/^0x[0-9a-fA-F]{40}$/.test(account)) throw new Error("A valid connected wallet account is required.");
  return {
    request: async (request) => {
      if (request.method !== "eth_sendTransaction") return provider.request(request);
      const transaction = request.params?.[0] as TransactionRequest | undefined;
      if (!transaction || typeof transaction !== "object") throw new Error("Wallet transaction is missing.");

      const [walletChain, accounts, rpcChain] = await Promise.all([
        provider.request({ method: "eth_chainId" }),
        provider.request({ method: "eth_accounts" }),
        rpc("eth_chainId", []),
      ]);
      assertCurrentWallet(walletChain, accounts, account);
      if (String(rpcChain).toLowerCase() !== STUDIONET_CHAIN_HEX) throw new Error("StudioNet RPC chain identity mismatch; no wallet popup opened.");
      if (typeof transaction.from !== "string" || transaction.from.toLowerCase() !== account.toLowerCase()) {
        throw new Error("Transaction sender does not match the connected account.");
      }
      if (typeof transaction.chainId !== "string" && typeof transaction.chainId !== "number" && typeof transaction.chainId !== "bigint") {
        throw new Error("Transaction omitted its StudioNet chain ID.");
      }
      if (parseQuantity(transaction.chainId, "transaction chain ID") !== BigInt(STUDIONET_CHAIN_ID)) {
        throw new Error("Transaction chain ID is not StudioNet.");
      }
      if (typeof transaction.to !== "string" || transaction.to.toLowerCase() !== STUDIONET_CONSENSUS_ADDRESS.toLowerCase()) {
        throw new Error("Transaction target is not the StudioNet consensus contract.");
      }
      if (typeof transaction.data !== "string" || !/^0x[0-9a-f]*$/i.test(transaction.data)) throw new Error("Transaction calldata is missing or malformed.");
      const valueWei = parseQuantity(transaction.value ?? "0x0", "transaction value");
      if (valueWei !== 0n) throw new Error("Native GEN value transfers are disabled in this dashboard write path until separately authorized and fee-budgeted.");

      const gasLimit = parseQuantity(transaction.gas, "gas limit");
      const gasPriceWei = parseQuantity(transaction.gasPrice, "gas price");
      if (gasLimit <= 0n) throw new Error("Transaction gas limit must be positive.");
      const estimatedGas = parseQuantity(await rpc("eth_estimateGas", [{
        from: account,
        to: transaction.to,
        data: transaction.data,
        value: "0x0",
      }]), "gas estimate");
      if (estimatedGas <= 0n || gasLimit < estimatedGas) throw new Error("The transaction gas limit is below the current StudioNet estimate.");
      const currentGasPrice = parseQuantity(await rpc("eth_gasPrice", []), "gas price quote");
      if (currentGasPrice !== gasPriceWei) throw new Error("StudioNet gas price changed during preflight; refresh and retry only after reviewing a new fee quote.");

      const quote = { gasLimit, gasPriceWei, maximumFeeWei: gasLimit * gasPriceWei, valueWei };
      if (!await approveFee(quote)) throw new Error("Transaction cancelled before opening the wallet popup.");

      // Check again after the confirmation UI, because the account/network may
      // have changed while the user was reviewing the fee.
      const [finalChain, finalAccounts] = await Promise.all([
        provider.request({ method: "eth_chainId" }),
        provider.request({ method: "eth_accounts" }),
      ]);
      assertCurrentWallet(finalChain, finalAccounts, account);
      return provider.request(request);
    },
  };
}

/** Submit through the stable StudioNet-compatible GenLayerJS write API. */
export async function submitStudioNetWrite(
  writer: { chain?: { id?: number }; writeContract: (call: Record<string, unknown>) => Promise<unknown> },
  call: Record<string, unknown>,
): Promise<unknown> {
  if (writer.chain?.id !== STUDIONET_CHAIN_ID) {
    throw new Error(`Writes require StudioNet chain ID ${STUDIONET_CHAIN_ID}.`);
  }
  return writer.writeContract(call);
}

export function formatFeeWei(value: bigint): string {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} GEN`;
}
