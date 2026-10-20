import { createClient } from "../web/node_modules/genlayer-js/dist/index.js";
import { studionet } from "../web/node_modules/genlayer-js/dist/chains/index.js";
import { TransactionHashVariant } from "../web/node_modules/genlayer-js/dist/types/index.js";

const endpoint = "https://studio.genlayer.com/api";
const core = "0x32698630D6144882Bd0c1D5B00C74348c53ea58B";
const proposalId = "member-add-rabby-1af111b06e6f6a05-20261020-01";
const rabby = "0x1Af111b06E6f6A05Bd41572A016318f1356aF85c";
const founder = "0xaffe15eec45b68835cc9e5b4ab85dd5deae8e70b";
const asContractAddressString = (address) => Buffer.from(address.slice(2), "hex").toString("base64");

if (studionet.id !== 61999) throw new Error(`Pinned SDK chain mismatch: ${studionet.id}`);
const client = createClient({ chain: studionet, endpoint });
const chainId = await client.request({ method: "eth_chainId", params: [] });
if (String(chainId).toLowerCase() !== "0xf22f") throw new Error(`Unexpected StudioNet chain ID: ${String(chainId)}`);
const gasPrice = await client.request({ method: "eth_gasPrice", params: [] });
const proposalStatus = await client.readContract({
  address: core,
  functionName: "get_proposal_status",
  args: [proposalId],
  transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
});
const proposalCount = BigInt(await client.readContract({
  address: core,
  functionName: "get_proposal_count",
  args: [],
  transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
}));
const ids = [];
for (let i = 0n; i < proposalCount; i += 1n) {
  ids.push(await client.readContract({
    address: core,
    functionName: "get_proposal_id_at",
    args: [i],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  }));
}
const [founderWeight, rabbyWeight] = await Promise.all([
  client.readContract({ address: core, functionName: "get_member_weight", args: [asContractAddressString(founder)], transactionHashVariant: TransactionHashVariant.LATEST_FINAL }),
  client.readContract({ address: core, functionName: "get_member_weight", args: [asContractAddressString(rabby)], transactionHashVariant: TransactionHashVariant.LATEST_FINAL }),
]);
console.log(JSON.stringify({
  sdk: "genlayer-js@1.1.8 (StudioNet CLI-compatible)", chainId, gasPriceWei: String(gasPrice),
  readVariant: "LATEST_FINAL", core, proposalId,
  proposalIdUsed: ids.some((id) => id === proposalId), proposalStatus,
  proposalCount: String(proposalCount), founderWeight: String(founderWeight), rabbyWeight: String(rabbyWeight),
  feeScope: "eth_gasPrice is a current EVM gas-price observation only; transaction fee requires the exact eth_estimateGas request and is not a GenLayer message-fee estimate",
}, null, 2));
