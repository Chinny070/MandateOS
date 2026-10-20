// Exact-call EVM fee preflight. A fake EIP-1193 provider throws at the final
// eth_sendTransaction boundary; this script has no signer and cannot submit.
import { createClient } from "../web/node_modules/genlayer-js/dist/index.js";
import { studionet } from "../web/node_modules/genlayer-js/dist/chains/index.js";

const founder = "0xaffe15eec45b68835cc9e5b4ab85dd5deae8e70b";
const core = "0x32698630D6144882Bd0c1D5B00C74348c53ea58B";
const rabby = "0x1Af111b06E6f6A05Bd41572A016318f1356aF85c";
const proposalId = "member-add-rabby-1af111b06e6f6a05-20261020-01";
const rabbyAsString = Buffer.from(rabby.slice(2), "hex").toString("base64");
let captured;
const fakeProvider = {
  request: async ({ method, params }) => {
    if (method !== "eth_sendTransaction") throw new Error(`Unexpected provider method ${method}`);
    captured = params?.[0];
    throw new Error("DRY_RUN_STOP_BEFORE_WALLET_OR_BROADCAST");
  },
};
const client = createClient({ chain: studionet, account: founder, provider: fakeProvider });
try {
  await client.writeContract({
    address: core,
    functionName: "propose_member_add",
    args: [proposalId, rabbyAsString],
    value: 0n,
  });
} catch (error) {
  if (!String(error?.message ?? error).includes("DRY_RUN_STOP_BEFORE_WALLET_OR_BROADCAST")) throw error;
}
if (!captured) throw new Error("The SDK did not reach the dry-run interception point; exact calldata and fee cannot be quoted.");
if (String(captured.from).toLowerCase() !== founder || String(captured.to).toLowerCase() !== "0xb7278a61aa25c888815afc32ad3cc52ff24fe575") {
  throw new Error("SDK transaction sender/target mismatch; no fee quote is valid.");
}
if (String(captured.chainId).toLowerCase() !== "0xf22f" || BigInt(captured.value ?? "0x0") !== 0n) {
  throw new Error("SDK transaction has unexpected chain or value.");
}
const [chainId, estimateResult, priceResult] = await Promise.all([
  client.request({ method: "eth_chainId", params: [] }),
  client.request({ method: "eth_estimateGas", params: [{
    from: captured.from,
    to: captured.to,
    data: captured.data,
    value: captured.value ?? "0x0",
  }] }),
  client.request({ method: "eth_gasPrice", params: [] }),
]);
if (String(chainId).toLowerCase() !== "0xf22f") throw new Error(`RPC chain mismatch: ${String(chainId)}.`);
const gasLimit = BigInt(captured.gas);
const estimatedGas = BigInt(estimateResult);
const gasPriceWei = BigInt(priceResult);
if (estimatedGas <= 0n || gasLimit < estimatedGas) throw new Error("Exact transaction gas limit is below the current RPC estimate.");
const maximumFeeWei = gasLimit * gasPriceWei;
console.log(JSON.stringify({
  observedAt: new Date().toISOString(),
  sdk: "genlayer-js@1.1.8",
  chainId,
  method: "propose_member_add",
  core,
  proposalId,
  member: rabby,
  valueWei: "0",
  gasEstimate: estimatedGas.toString(),
  transactionGasLimit: gasLimit.toString(),
  currentGasPriceWei: gasPriceWei.toString(),
  maximumEvmFeeCommitmentWei: maximumFeeWei.toString(),
  maximumEvmFeeCommitmentGen: `${maximumFeeWei / 10n ** 18n}.${(maximumFeeWei % 10n ** 18n).toString().padStart(18, "0")}`,
  transactionHash: null,
  broadcast: false,
  note: "Read-only quote from the exact stable-SDK calldata. Requote before signing; this does not reserve cumulative budget and no transaction was sent.",
}, null, 2));
