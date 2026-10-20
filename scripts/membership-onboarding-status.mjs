// Read-only, resumable planner for the first DAO-member proposal. This script
// never imports a signer and never submits a transaction.
import { createClient } from "../web/node_modules/genlayer-js/dist/index.js";
import { studionet } from "../web/node_modules/genlayer-js/dist/chains/index.js";
import { TransactionHashVariant } from "../web/node_modules/genlayer-js/dist/types/index.js";

const RPC = "https://studio.genlayer.com/api";
const CORE = "0x32698630D6144882Bd0c1D5B00C74348c53ea58B";
const FOUNDER = "0xaffe15eec45b68835cc9e5b4ab85dd5deae8e70b";
const RABBY = "0x1Af111b06E6f6A05Bd41572A016318f1356aF85c";
const PROPOSAL_ID = "member-add-rabby-1af111b06e6f6a05-20261020-01";
const FINAL = TransactionHashVariant.LATEST_FINAL;
const addressAsContractString = (address) => Buffer.from(address.slice(2), "hex").toString("base64");

if (studionet.id !== 61999) throw new Error(`Expected StudioNet SDK chain 61999; got ${studionet.id}.`);
const client = createClient({ chain: studionet, endpoint: RPC });
const chainId = String(await client.request({ method: "eth_chainId", params: [] })).toLowerCase();
if (chainId !== "0xf22f") throw new Error(`RPC is not StudioNet (chain ID ${chainId}). No transaction is submitted.`);

const read = (functionName, args = []) => client.readContract({
  address: CORE,
  functionName,
  args,
  transactionHashVariant: FINAL,
});
const [countValue, statusValue, summaryValue, timingValue, founderWeightValue, rabbyWeightValue, latestBlock] = await Promise.all([
  read("get_proposal_count"),
  read("get_proposal_status", [PROPOSAL_ID]),
  read("get_proposal_summary", [PROPOSAL_ID]),
  read("get_proposal_timing", [PROPOSAL_ID]),
  read("get_member_weight", [addressAsContractString(FOUNDER)]),
  read("get_member_weight", [addressAsContractString(RABBY)]),
  client.request({ method: "eth_getBlockByNumber", params: ["latest", false] }),
]);

const count = BigInt(countValue);
const proposalIds = [];
for (let i = 0n; i < count; i += 1n) proposalIds.push(await read("get_proposal_id_at", [i]));
const idUsed = proposalIds.includes(PROPOSAL_ID);
const status = String(statusValue);
const summary = Array.isArray(summaryValue) ? summaryValue : [];
const timing = Array.isArray(timingValue) ? timingValue : [];
const votesFor = BigInt(summary[2] ?? 0);
const votesAgainst = BigInt(summary[3] ?? 0);
const votingEndsAt = BigInt(timing[0] ?? 0);
const executeAfter = BigInt(timing[1] ?? 0);
const executeBy = BigInt(timing[2] ?? 0);
const chainTimestamp = BigInt(latestBlock?.timestamp ?? 0);
const founderWeight = BigInt(founderWeightValue);
const rabbyWeight = BigInt(rabbyWeightValue);

let nextAction;
if (rabbyWeight > 0n || status === "EXECUTED") {
  nextAction = rabbyWeight === 1n ? "MEMBER_ADDED_VERIFIED" : `STOP: member proposal is ${status} but Rabby voting weight is ${rabbyWeight}.`;
} else if (status === "UNKNOWN") {
  if (idUsed) nextAction = "STOP: proposal ID appears in the proposal index despite UNKNOWN status; reconcile latest-final reads before any write.";
  else if (founderWeight !== 1n) nextAction = `STOP: expected founder weight 1, observed ${founderWeight}.`;
  else nextAction = "PROPOSE_MEMBER_ADD_READY: use only the explicit-approval, fee-capped one-step CLI runner; this planner does not emit or execute a raw write command.";
} else if (status === "VOTING") {
  if (votesFor > 0n) {
    nextAction = chainTimestamp < votingEndsAt
      ? `WAIT: founder YES is recorded; wait until latest chain timestamp reaches votingEndsAt=${votingEndsAt}.`
      : `FINALIZE: latest chain timestamp ${chainTimestamp} has reached votingEndsAt=${votingEndsAt}; the contract still enforces its own deadline.`;
  } else if (votesAgainst > 0n) {
    nextAction = "STOP: a vote is already recorded but YES is not; inspect proposal and votes before taking another action.";
  } else {
    nextAction = "FOUNDER_VOTE_YES_READY: use only the explicit-approval, fee-capped one-step CLI runner; no raw write command is emitted.";
  }
} else if (status === "TIMELOCKED") {
  if (chainTimestamp < executeAfter) nextAction = `WAIT: execution timelock ends at onchain executeAfter=${executeAfter}; latest chain timestamp=${chainTimestamp}.`;
  else if (chainTimestamp > executeBy) nextAction = `STOP: execution window expired at ${executeBy}; do not execute.`;
  else nextAction = "EXECUTE_MEMBER_ADD_READY: use only the explicit-approval, fee-capped one-step CLI runner; no raw write command is emitted.";
} else if (status === "EXECUTED") {
  nextAction = rabbyWeight === 1n ? "MEMBER_ADDED_VERIFIED" : `READ_AGAIN: status EXECUTED; current Rabby weight=${rabbyWeight}.`;
} else {
  nextAction = `STOP: latest-final proposal status is ${status}; reconcile before proceeding.`;
}

console.log(JSON.stringify({
  mode: "READ_ONLY_PLANNER",
  chainId,
  readVariant: "LATEST_FINAL",
  core: CORE,
  proposalId: PROPOSAL_ID,
  proposalIdUsed: idUsed,
  proposalStatus: status,
  proposalKind: String(summary[0] ?? "UNKNOWN"),
  votesFor: String(votesFor),
  votesAgainst: String(votesAgainst),
  snapshotWeight: String(summary[4] ?? "0"),
  founderWeight: String(founderWeight),
  rabbyWeight: String(rabbyWeight),
  votingEndsAt: String(votingEndsAt),
  executeAfter: String(executeAfter),
  executeBy: String(executeBy),
  latestChainTimestamp: String(chainTimestamp),
  nextAction,
  safety: "This planner has no signer and cannot write. Re-run after every finalized stage; if a submitted tx has unknown outcome, reconcile its actual tx hash and latest-final state before issuing another CLI write.",
}, null, 2));
