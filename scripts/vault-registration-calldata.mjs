// Reproduce GenLayerJS 1.1.8 calldata offline; the fake provider never broadcasts.
import { createClient } from "../web/node_modules/genlayer-js/dist/index.js";
import { studionet } from "../web/node_modules/genlayer-js/dist/chains/index.js";

export async function captureVaultRegistrationCalldata({ core, proposalId, projectId, vaultArgument, capWei, digest }) {
  let captured;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    let result;
    if (request.method === "eth_chainId") result = "0xf22f";
    else if (request.method === "eth_getTransactionCount") result = "0x0";
    else if (request.method === "eth_estimateGas") result = "0x7a120";
    else if (request.method === "eth_gasPrice") result = "0x0";
    else if (request.method === "eth_sendTransaction") { captured = request.params?.[0]; result = `0x${"1".repeat(64)}`; }
    else throw new Error(`Unexpected method in offline calldata reproduction: ${request.method}`);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = createClient({ chain: studionet, account: "0xaffe15eec45b68835cc9e5b4ab85dd5deae8e70b" });
  try {
    await client.writeContract({ address: core, functionName: "propose_vault_registration", args: [proposalId, projectId, vaultArgument, capWei, digest], value: 0n });
  } finally { globalThis.fetch = originalFetch; }
  if (!captured || typeof captured.data !== "string" || !/^0x[0-9a-f]+$/i.test(captured.data)) {
    throw new Error("The pinned SDK did not produce valid proposal calldata at the dry-run interception point.");
  }
  if (String(captured.to).toLowerCase() !== studionet.consensusMainContract.address.toLowerCase() || BigInt(captured.value ?? "0x0") !== 0n) {
    throw new Error("Offline SDK calldata reproduction has the wrong consensus destination or value.");
  }
  return captured.data.toLowerCase();
}
