// Read-only latest-final status collector for the Saturday reviewer preparation.
// No signer, wallet provider, or write method is imported or called.
import { createClient } from "../web/node_modules/genlayer-js/dist/index.js";
import { studionet } from "../web/node_modules/genlayer-js/dist/chains/index.js";
import { TransactionHashVariant } from "../web/node_modules/genlayer-js/dist/types/index.js";

const RPC = "https://studio.genlayer.com/api";
const CORE = "0x32698630D6144882Bd0c1D5B00C74348c53ea58B";
const VAULT = "0x03325B7EB2668CfF6bE3B2e9805d600bB9E1a2F4";
const PROJECT_ID = "mandateos-demo-001";
const FOUNDER = "0xaffe15eec45b68835cc9e5b4ab85dd5deae8e70b";
const RABBY = "0x1Af111b06E6f6A05Bd41572A016318f1356aF85c";
const MEMBER_PROPOSAL = "member-add-rabby-1af111b06e6f6a05-20261020-01";
const REGISTRATION_PROPOSAL = "vault-register-mandateos-demo-001-20261022-01";
const FINAL = TransactionHashVariant.LATEST_FINAL;
const asContractString = (address) => Buffer.from(address.slice(2), "hex").toString("base64");

if (studionet.id !== 61999) throw new Error(`SDK network mismatch: ${studionet.id}`);
const client = createClient({ chain: studionet, endpoint: RPC });
const chainId = String(await client.request({ method: "eth_chainId", params: [] })).toLowerCase();
if (chainId !== "0xf22f") throw new Error(`RPC chain mismatch: ${chainId}; no write methods are available in this script.`);
const block = await client.request({ method: "eth_getBlockByNumber", params: ["latest", false] });
const read = (address, functionName, args = []) => client.readContract({
  address, functionName, args, transactionHashVariant: FINAL,
});
const [proposalStatus, proposalSummary, proposalTiming, registrationProposalStatus, proposalCount, founderWeight, rabbyWeight, treasury, mandate,
  registeredVault, projectCount, vaultParent, vaultProject, vaultBalance] = await Promise.all([
  read(CORE, "get_proposal_status", [MEMBER_PROPOSAL]),
  read(CORE, "get_proposal_summary", [MEMBER_PROPOSAL]),
  read(CORE, "get_proposal_timing", [MEMBER_PROPOSAL]),
  read(CORE, "get_proposal_status", [REGISTRATION_PROPOSAL]),
  read(CORE, "get_proposal_count"),
  read(CORE, "get_member_weight", [asContractString(FOUNDER)]),
  read(CORE, "get_member_weight", [asContractString(RABBY)]),
  read(CORE, "get_treasury_summary"),
  read(CORE, "get_mandate_summary"),
  read(CORE, "get_vault_address", [PROJECT_ID]),
  read(CORE, "get_registered_project_count"),
  read(VAULT, "get_parent_address"),
  read(VAULT, "get_project_id"),
  read(VAULT, "get_balance_wei"),
]);
const proposalIds = await Promise.all(Array.from({ length: Number(proposalCount) }, (_, index) => read(CORE, "get_proposal_id_at", [BigInt(index)])));
console.log(JSON.stringify({
  mode: "READ_ONLY_LATEST_FINAL",
  observedAtUtc: new Date().toISOString(),
  chainId,
  latestChainTimestamp: String(block?.timestamp ?? "unknown"),
  core: CORE,
  vault: VAULT,
  projectId: PROJECT_ID,
  memberProposal: {
    id: MEMBER_PROPOSAL,
    status: String(proposalStatus),
    summary: Array.isArray(proposalSummary) ? proposalSummary.map(String) : String(proposalSummary),
    timing: Array.isArray(proposalTiming) ? proposalTiming.map(String) : String(proposalTiming),
    founderWeight: String(founderWeight),
    rabbyWeight: String(rabbyWeight),
  },
  preparedRegistration: {
    proposalId: REGISTRATION_PROPOSAL,
    latestFinalStatus: String(registrationProposalStatus),
    indexedAlready: proposalIds.includes(REGISTRATION_PROPOSAL),
    note: "Candidate ID is only eligible for use if it remains absent from the proposal index immediately before proposal submission.",
  },
  treasurySummary: Array.isArray(treasury) ? treasury.map(String) : String(treasury),
  mandateSummary: Array.isArray(mandate) ? mandate.map(String) : String(mandate),
  registration: {
    registeredProjectCount: String(projectCount),
    coreRegisteredVaultForProject: String(registeredVault),
    vaultParent: String(vaultParent),
    vaultProjectId: String(vaultProject),
    vaultBalanceWei: String(vaultBalance),
    note: "This deployed Core exposes no cap_for_project getter. Cap must be verified from finalized registration proposal/receipt, not claimed as a direct state readback.",
  },
  safety: "Read-only script. No signer or write path imported.",
}, null, 2));
