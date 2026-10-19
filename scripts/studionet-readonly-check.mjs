import { createClient } from "../web/node_modules/genlayer-js/dist/index.js";
import { studionet } from "../web/node_modules/genlayer-js/dist/chains/index.js";

const endpoint = "https://studio.genlayer.com/api";
if (studionet.id !== 61999) throw new Error(`Pinned SDK chain mismatch: ${studionet.id}`);
const client = createClient({ chain: studionet, endpoint });
const chainId = await client.request({ method: "eth_chainId", params: [] });
if (String(chainId).toLowerCase() !== "0xf22f") throw new Error(`Unexpected StudioNet chain ID: ${String(chainId)}`);
try {
  const feePolicy = await client.getCurrentFeePolicy();
  if (!feePolicy || typeof feePolicy.enabled !== "boolean") throw new Error("GenLayerJS returned an incomplete fee policy.");
  console.log(JSON.stringify({ sdk: "genlayer-js@2.0.0-rc.1", chainId, feePolicyReadable: true, feePolicyEnabled: feePolicy.enabled }));
} catch (error) {
  console.log(JSON.stringify({
    sdk: "genlayer-js@2.0.0-rc.1",
    chainId,
    feePolicyReadable: false,
    feePolicyError: String(error?.shortMessage ?? error?.message ?? error).split("\n")[0],
  }));
  process.exitCode = 1;
}
