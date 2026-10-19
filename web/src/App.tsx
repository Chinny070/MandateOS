import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";
import {
  formatUtcTimestamp,
  formatWei,
  canAcknowledgeEoaPayout,
  connectedWalletMatches,
  mapEoaSettlementState,
  mapRecipientAcknowledgment,
  mapTransactionState,
  serialize,
} from "./models";

type QueryResult = { ok: true; value: unknown } | { ok: false; error: string };
type DashboardData = Record<string, QueryResult>;
type KeeperReport = {
  chain_id: string;
  generated_at?: string;
  watches: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
  transaction_edges?: Array<Record<string, unknown>>;
  audit_events?: Array<Record<string, unknown>>;
  spending_authority?: boolean;
  automatic_retry?: boolean;
};
type IndexedProposal = { id: string; kind: string; status: string; votesFor: string; votesAgainst: string };
type IndexedProject = { id: string; vault: string };
type IndexedActivity = { kind: string; id: string; status: string };

type Handles = {
  mandateAddress: string;
  vaultAddress: string;
  projectId: string;
  memberAddress: string;
  proposalId: string;
  allocationId: string;
  refundId: string;
  milestoneId: string;
  paymentId: string;
  repaymentId: string;
  distributionId: string;
  revenuePeriodId: string;
  transactionId: string;
};

const emptyHandles: Handles = {
  mandateAddress: import.meta.env.VITE_MANDATE_OS_ADDRESS ?? "",
  vaultAddress: import.meta.env.VITE_PROJECT_VAULT_ADDRESS ?? "",
  projectId: import.meta.env.VITE_PROJECT_ID ?? "",
  memberAddress: "",
  proposalId: "",
  allocationId: "",
  refundId: "",
  milestoneId: "",
  paymentId: "",
  repaymentId: "",
  distributionId: "",
  revenuePeriodId: "",
  transactionId: "",
};

const STORAGE_KEY = "mandateos.query-handles.v1";
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;

declare global {
  interface Window {
    ethereum?: {
      request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}

function initialHandles(): Handles {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { ...emptyHandles, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch {
    return emptyHandles;
  }
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function readable(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (value === null || value === undefined || value === "") return "Not recorded";
  return typeof value === "object" ? serialize(value) : String(value);
}

function rowsFor(value: unknown, labels?: string[]): Array<[string, string]> {
  const tuple = asArray(value);
  if (tuple) {
    return tuple.map((item, index) => {
      const label = labels?.[index] ?? `Field ${index + 1}`;
      if (/\(UTC\)/i.test(label)) return [label, formatUtcTimestamp(item)];
      if (/\(wei\)/i.test(label)) return [label, `${readable(item)} wei · ${formatWei(item)}`];
      return [label, readable(item)];
    });
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, readable(item)]);
  }
  return [["Onchain value", readable(value)]];
}

function DataPanel({
  title,
  detail,
  result,
  labels,
}: {
  title: string;
  detail?: string;
  result?: QueryResult;
  labels?: string[];
}) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          {detail && <p>{detail}</p>}
        </div>
        <span className={`query-tag ${result?.ok ? "tag-live" : "tag-muted"}`}>
          {result?.ok ? "RPC read" : "Unavailable"}
        </span>
      </div>
      {!result ? (
        <p className="empty-state">Add the relevant contract address or record ID to inspect onchain state.</p>
      ) : result.ok ? (
        <dl className="data-list">
          {rowsFor(result.value, labels).map(([label, value]) => (
            <div className="data-row" key={label}>
              <dt>{label}</dt><dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="unavailable">Read failed: {result.error}</p>
      )}
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="section-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export function App() {
  const [handles, setHandles] = useState<Handles>(initialHandles);
  const [wallet, setWallet] = useState("");
  const [walletChainId, setWalletChainId] = useState("");
  const [acknowledgmentSubmitting, setAcknowledgmentSubmitting] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData>({});
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [transaction, setTransaction] = useState<Record<string, unknown> | null>(null);
  const [triggeredIds, setTriggeredIds] = useState<string[]>([]);
  const [keeperReport, setKeeperReport] = useState<KeeperReport | null>(null);
  const [reportError, setReportError] = useState("");
  const [proposalIndex, setProposalIndex] = useState<IndexedProposal[]>([]);
  const [projectIndex, setProjectIndex] = useState<IndexedProject[]>([]);
  const [vaultActivity, setVaultActivity] = useState<IndexedActivity[]>([]);
  const [indexError, setIndexError] = useState("");
  const refreshGeneration = useRef(0);

  const readClient = useMemo(() => createClient({ chain: studionet }), []);
  const effectiveMemberAddress = handles.memberAddress || wallet;
  const discoveredVault = dashboard.registeredVault?.ok ? String(dashboard.registeredVault.value) : "";
  const effectiveVault = handles.vaultAddress || (ADDRESS.test(discoveredVault) ? discoveredVault : "");

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const handleChain = (chain: unknown) => setWalletChainId(String(chain ?? "").toLowerCase());
    const handleAccounts = (accounts: unknown) => {
      setWallet(Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "");
    };
    void provider.request({ method: "eth_chainId" }).then(handleChain).catch(() => setWalletChainId(""));
    void provider.request({ method: "eth_accounts" }).then(handleAccounts).catch(() => setWallet(""));
    provider.on?.("chainChanged", handleChain);
    provider.on?.("accountsChanged", handleAccounts);
    return () => {
      provider.removeListener?.("chainChanged", handleChain);
      provider.removeListener?.("accountsChanged", handleAccounts);
    };
  }, []);

  function update<K extends keyof Handles>(key: K, value: Handles[K]) {
    if (key !== "transactionId") {
      // A value read for the previous address/ID must never be presented as
      // the current record or used to authorize a wallet write.
      refreshGeneration.current += 1;
      setDashboard({});
      setProjectIndex([]);
      setProposalIndex([]);
      setVaultActivity([]);
      setIndexError("");
      setRefreshing(false);
    }
    setHandles((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function query(
    data: DashboardData,
    key: string,
    contract: string,
    functionName: string,
    args: unknown[] = [],
  ) {
    if (!ADDRESS.test(contract)) return;
    try {
      const value = await readClient.readContract({
        address: contract as `0x${string}`,
        functionName,
        args,
        transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
      } as never);
      data[key] = { ok: true, value };
    } catch (error) {
      data[key] = { ok: false, error: error instanceof Error ? error.message : "RPC read failed" };
    }
  }

  async function readLatest(contract: string, functionName: string, args: unknown[] = []): Promise<unknown> {
    return readClient.readContract({
      address: contract as `0x${string}`,
      functionName,
      args,
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    } as never);
  }

  async function readIndex(contract: string, countMethod: string, idMethod: string, limit = 30): Promise<string[]> {
    const count = BigInt(String(await readLatest(contract, countMethod)));
    const first = count > BigInt(limit) ? count - BigInt(limit) : 0n;
    const indices: bigint[] = [];
    for (let index = first; index < count; index += 1n) indices.push(index);
    const ids = await Promise.all(indices.map((index) => readLatest(contract, idMethod, [index]).then(String)));
    return ids.filter(Boolean).reverse();
  }

  async function refresh() {
    const generation = ++refreshGeneration.current;
    setRefreshing(true);
    setMessage("");
    const next: DashboardData = {};
    const mandate = handles.mandateAddress.trim();
    const project = handles.projectId.trim();
    try {
      if (!ADDRESS.test(mandate)) {
        if (generation === refreshGeneration.current) {
          setMessage("Enter a MandateOS Core address to read StudioNet state.");
          setDashboard({});
        }
        return;
      }
      const coreReads: Promise<void>[] = [
        query(next, "treasury", mandate, "get_treasury_summary"),
        query(next, "mandate", mandate, "get_mandate_summary"),
      ];
      if (effectiveMemberAddress && ADDRESS.test(effectiveMemberAddress)) {
        coreReads.push(query(next, "member", mandate, "get_member_weight", [effectiveMemberAddress]));
      }
      if (handles.proposalId.trim()) {
        coreReads.push(query(next, "proposal", mandate, "get_proposal_summary", [handles.proposalId.trim()]));
        coreReads.push(query(next, "proposalTiming", mandate, "get_proposal_timing", [handles.proposalId.trim()]));
      }
      if (handles.allocationId.trim()) {
        coreReads.push(query(next, "allocation", mandate, "get_allocation_details", [handles.allocationId.trim()]));
        coreReads.push(query(next, "allocationStatus", mandate, "get_allocation_status", [handles.allocationId.trim()]));
        coreReads.push(query(next, "fundingStatus", mandate, "get_funding_status", [handles.allocationId.trim()]));
      }
      if (handles.refundId.trim()) {
        coreReads.push(query(next, "treasuryRefund", mandate, "get_refund_status", [handles.refundId.trim()]));
      }
      if (project) {
        coreReads.push(query(next, "registeredVault", mandate, "get_vault_address", [project]));
        coreReads.push(query(next, "evidence", mandate, "get_evidence_receipt", [project]));
      }
      await Promise.all(coreReads);
      if (generation !== refreshGeneration.current) return;

      let indexErrorMessage = "";
      if (typeof next.registeredVault?.ok !== "undefined" || ADDRESS.test(mandate)) {
        try {
          const [projectIds, proposalIds] = await Promise.all([
            readIndex(mandate, "get_registered_project_count", "get_registered_project_id_at"),
            readIndex(mandate, "get_proposal_count", "get_proposal_id_at"),
          ]);
          const [projects, proposals] = await Promise.all([
            Promise.all(projectIds.map(async (id) => ({ id, vault: String(await readLatest(mandate, "get_vault_address", [id])) }))),
            Promise.all(proposalIds.map(async (id) => {
              const summary = asArray(await readLatest(mandate, "get_proposal_summary", [id])) ?? [];
              return { id, kind: String(summary[0] ?? "UNKNOWN"), status: String(summary[1] ?? "UNKNOWN"), votesFor: String(summary[2] ?? "0"), votesAgainst: String(summary[3] ?? "0") };
            })),
          ]);
          if (generation !== refreshGeneration.current) return;
          setProjectIndex(projects);
          setProposalIndex(proposals);
        } catch (error) {
          if (generation !== refreshGeneration.current) return;
          indexErrorMessage = error instanceof Error ? error.message : "Contract indexes could not be read.";
          setProjectIndex([]);
          setProposalIndex([]);
        }
      }

      const vault = handles.vaultAddress.trim() || (ADDRESS.test(String(next.registeredVault?.ok ? next.registeredVault.value : ""))
        ? String(next.registeredVault?.ok ? next.registeredVault.value : "")
        : "");
      if (ADDRESS.test(vault)) {
        const vaultReads: Promise<void>[] = [
          query(next, "vaultBalance", vault, "get_balance_wei"),
          query(next, "refundAvailable", vault, "get_refund_available_wei"),
          query(next, "refundReserved", vault, "get_refund_reserved_wei"),
          query(next, "agreement", vault, "get_agreement_summary"),
          query(next, "distributionAvailable", vault, "get_distribution_available"),
          query(next, "default", vault, "get_default_status"),
          query(next, "defaultChallenge", vault, "get_default_challenge_ends_at"),
          query(next, "canClose", vault, "can_close_agreement"),
        ];
        if (handles.milestoneId.trim()) {
          vaultReads.push(query(next, "milestone", vault, "get_milestone_summary", [handles.milestoneId.trim()]));
          vaultReads.push(query(next, "milestoneEvidence", vault, "get_milestone_evidence", [handles.milestoneId.trim()]));
          vaultReads.push(query(next, "milestoneDispute", vault, "get_milestone_dispute_ends_at", [handles.milestoneId.trim()]));
        }
        if (handles.paymentId.trim()) {
          vaultReads.push(query(next, "payout", vault, "get_payout_details", [handles.paymentId.trim()]));
          vaultReads.push(query(next, "payoutAcknowledgment", vault, "get_eoa_payout_acknowledgment", [handles.paymentId.trim()]));
        }
        if (handles.repaymentId.trim()) {
          vaultReads.push(query(next, "repayment", vault, "get_repayment_status", [handles.repaymentId.trim()]));
        }
        if (handles.distributionId.trim()) {
          vaultReads.push(query(next, "distribution", vault, "get_distribution_amounts", [handles.distributionId.trim()]));
          vaultReads.push(query(next, "distributionStatus", vault, "get_distribution_status", [handles.distributionId.trim()]));
        }
        if (handles.refundId.trim()) {
          vaultReads.push(query(next, "vaultRefund", vault, "get_refund_status", [handles.refundId.trim()]));
        }
        if (handles.revenuePeriodId.trim()) {
          vaultReads.push(query(next, "revenue", vault, "get_revenue_period", [handles.revenuePeriodId.trim()]));
        }
        await Promise.all(vaultReads);
        if (generation !== refreshGeneration.current) return;
        try {
          const indexSpecs = [
            ["milestone", "get_milestone_count", "get_milestone_id_at"],
            ["payout", "get_payout_count", "get_payout_id_at"],
            ["refund", "get_refund_count", "get_refund_id_at"],
            ["repayment", "get_repayment_count", "get_repayment_id_at"],
            ["distribution", "get_distribution_count", "get_distribution_id_at"],
            ["revenue", "get_revenue_period_count", "get_revenue_period_id_at"],
          ];
          const entries = await Promise.all(indexSpecs.map(async ([kind, countMethod, idMethod]) => {
            const ids = await readIndex(vault, countMethod, idMethod, 20);
            return Promise.all(ids.map(async (id) => {
              const method = kind === "milestone" ? "get_milestone_summary"
                : kind === "payout" ? "get_payout_details"
                  : kind === "revenue" ? "get_revenue_period"
                    : "get_" + kind + "_status";
              const raw = asArray(await readLatest(vault, method, [id]));
              const status = kind === "revenue" ? (raw ? "REPORTED / RECEIVED" : "RECORDED") : String(raw?.[0] ?? "RECORDED");
              return { kind, id, status };
            }));
          }));
          if (generation !== refreshGeneration.current) return;
          setVaultActivity(entries.flat());
        } catch (error) {
          if (generation !== refreshGeneration.current) return;
          indexErrorMessage = [indexErrorMessage, error instanceof Error ? error.message : "Vault indexes could not be read."].filter(Boolean).join(" · ");
          setVaultActivity([]);
        }
      }
      if (generation !== refreshGeneration.current) return;
      setIndexError(indexErrorMessage);
      setDashboard(next);
      setMessage("Read latest finalized contract state from StudioNet. No writes were submitted.");
    } finally {
      if (generation === refreshGeneration.current) setRefreshing(false);
    }
  }

  async function requireCurrentStudioNetWallet(): Promise<string> {
    if (!window.ethereum || !wallet) throw new Error("Connect a StudioNet wallet first.");
    const [chainValue, accounts] = await Promise.all([
      window.ethereum.request({ method: "eth_chainId" }),
      window.ethereum.request({ method: "eth_accounts" }),
    ]);
    const chain = String(chainValue ?? "").toLowerCase();
    setWalletChainId(chain);
    if (chain !== "0xf22f") throw new Error("Switch the wallet to StudioNet (chain ID 61999) before signing.");
    if (!connectedWalletMatches(wallet, chain, accounts)) {
      setWallet(Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "");
      throw new Error("The active wallet changed or disconnected. Reconnect before signing.");
    }
    return wallet;
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) throw new Error("No browser wallet provider was found.");
      const chain = String(await window.ethereum.request({ method: "eth_chainId" })).toLowerCase();
      if (chain !== "0xf22f") throw new Error("Switch the wallet to StudioNet (chain ID 61999), then reconnect.");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || !ADDRESS.test(accounts[0])) {
        throw new Error("The wallet did not return an account address.");
      }
      setWallet(accounts[0]);
      setWalletChainId(chain);
      setMessage("Wallet connected on StudioNet. The dashboard has not submitted a transaction.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet connection failed.");
    }
  }

  async function acknowledgeEoaPayout() {
    const payout = dashboard.payout?.ok ? asArray(dashboard.payout.value) : null;
    const acknowledgment = dashboard.payoutAcknowledgment?.ok ? dashboard.payoutAcknowledgment.value : null;
    try {
      if (!window.ethereum || !effectiveVault || !handles.paymentId.trim()) {
        throw new Error("A connected wallet, ProjectVault and payment ID are required.");
      }
      if (!canAcknowledgeEoaPayout(wallet, walletChainId, handles.paymentId.trim(), effectiveVault, payout, acknowledgment)) {
        throw new Error("The connected StudioNet account must match the unacknowledged EOA beneficiary.");
      }
      const account = await requireCurrentStudioNetWallet();
      if (account.toLowerCase() !== String(payout?.[2] ?? "").toLowerCase()) {
        throw new Error("The connected wallet no longer matches the authorized payment beneficiary.");
      }

      const amountWei = BigInt(String(payout?.[3] ?? "0"));
      setAcknowledgmentSubmitting(true);
      const writer: any = createClient({
        chain: studionet,
        account: account as `0x${string}`,
        provider: window.ethereum,
      });
      const call = {
        account: account as `0x${string}`,
        address: effectiveVault as `0x${string}`,
        functionName: "acknowledge_eoa_payout_received",
        args: [handles.paymentId.trim(), amountWei],
      };
      const estimate = await writer.estimateTransactionFeesForWrite(call);
      const txId = String(await writer.writeContract({
        ...call,
        fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
      }));
      update("transactionId", txId);
      setMessage(`Acknowledgment submitted for ${formatWei(amountWei)}. Your signature attests that this exact GEN amount reached your wallet; it does not verify settlement. Waiting for finalization.`);

      if (!HASH.test(txId)) throw new Error("Wallet returned an invalid transaction ID; inspect the wallet activity manually.");
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const tx = await readClient.getTransaction({ hash: txId } as never);
        const state = mapTransactionState(tx as any);
        setTransaction(tx as unknown as Record<string, unknown>);
        if (state === "FINALIZED_SUCCESS") {
          setTriggeredIds([]);
          await refresh();
          const finalizedRecord = await readLatest(effectiveVault, "get_eoa_payout_acknowledgment", [handles.paymentId.trim()]);
          setDashboard((current) => ({ ...current, payoutAcknowledgment: { ok: true, value: finalizedRecord } }));
          const finalAcknowledgment = mapRecipientAcknowledgment(finalizedRecord);
          setMessage(finalAcknowledgment.status === "RECIPIENT_ACKNOWLEDGED"
            ? "Finalized recipient acknowledgment read from ProjectVault. The payout remains independently UNVERIFIED and its reservation is unchanged."
            : "The wallet transaction finalized, but the expected acknowledgment record was not found in latest-final ProjectVault state.");
          return;
        }
        if (state === "FINALIZED_FAILED" || state === "CANCELED") {
          setMessage(`Acknowledgment transaction ended as ${state.replaceAll("_", " ")}. The payout settlement remains unverified.`);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
      setMessage("Acknowledgment transaction is still not finalized. Refresh or inspect its receipt later; no payout or reservation state was changed by this dashboard.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recipient acknowledgment failed.");
    } finally {
      setAcknowledgmentSubmitting(false);
    }
  }

  async function vote(support: boolean) {
    try {
      if (!window.ethereum || !wallet) throw new Error("Connect a StudioNet wallet first.");
      if (!ADDRESS.test(handles.mandateAddress) || !handles.proposalId.trim()) {
        throw new Error("A MandateOS address and proposal ID are required.");
      }
      const account = await requireCurrentStudioNetWallet();
      const writer: any = createClient({
        chain: studionet,
        account: account as `0x${string}`,
        provider: window.ethereum,
      });
      const call = {
        account: account as `0x${string}`,
        address: handles.mandateAddress as `0x${string}`,
        functionName: "vote",
        args: [handles.proposalId.trim(), support],
      };
      const estimate = await writer.estimateTransactionFeesForWrite(call);
      const txId = await writer.writeContract({
        ...call,
        fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
      });
      update("transactionId", String(txId));
      setMessage(`Vote transaction submitted: ${txId}. Submission is not confirmation; inspect its final status below.`);
      await inspectTransaction(String(txId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Vote submission failed.");
    }
  }

  async function submitMemberCall(functionName: string, args: unknown[], description: string) {
    try {
      if (!window.ethereum || !wallet) throw new Error("Connect a StudioNet wallet first.");
      if (!ADDRESS.test(handles.mandateAddress)) throw new Error("A MandateOS Core address is required.");
      const account = await requireCurrentStudioNetWallet();
      const writer: any = createClient({ chain: studionet, account: account as `0x${string}`, provider: window.ethereum });
      const call = { account: account as `0x${string}`, address: handles.mandateAddress as `0x${string}`, functionName, args };
      const estimate = await writer.estimateTransactionFeesForWrite(call);
      const txId = await writer.writeContract({ ...call, fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } });
      update("transactionId", String(txId));
      setMessage(`${description} submitted: ${txId}. Submission is not confirmation; inspect final status below.`);
      await inspectTransaction(String(txId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${description} failed.`);
    }
  }

  async function submitVaultMemberCall(functionName: string, args: unknown[], description: string) {
    try {
      if (!ADDRESS.test(effectiveVault)) throw new Error("A ProjectVault address is required.");
      const account = await requireCurrentStudioNetWallet();
      const writer: any = createClient({ chain: studionet, account: account as `0x${string}`, provider: window.ethereum });
      const call = { account: account as `0x${string}`, address: effectiveVault as `0x${string}`, functionName, args };
      const estimate = await writer.estimateTransactionFeesForWrite(call);
      const txId = await writer.writeContract({ ...call, fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } });
      update("transactionId", String(txId));
      setMessage(`${description} submitted directly to ProjectVault: ${txId}. The onchain challenge is atomic with this transaction; inspect its finalized result below.`);
      await inspectTransaction(String(txId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${description} failed.`);
    }
  }

  async function proposeMilestone(form: HTMLFormElement) {
    const data = new FormData(form);
    const proposalId = String(data.get("proposalId") ?? "").trim();
    const projectId = String(data.get("projectId") ?? "").trim();
    const milestoneId = String(data.get("milestoneId") ?? "").trim();
    const amount = String(data.get("amount") ?? "").trim();
    const criteria = String(data.get("criteria") ?? "").trim();
    if (!proposalId || !projectId || !milestoneId || !/^[1-9]\d*$/.test(amount) || !criteria) {
      setMessage("Enter a unique proposal ID, registered project, milestone ID, positive amount in wei and criteria.");
      return;
    }
    await submitMemberCall("propose_vault_milestone", [proposalId, projectId, milestoneId, BigInt(amount), criteria], "Milestone proposal");
    update("proposalId", proposalId);
    update("projectId", projectId);
    update("milestoneId", milestoneId);
  }

  async function challengeMilestone(form: HTMLFormElement) {
    const data = new FormData(form);
    const projectId = String(data.get("projectId") ?? "").trim();
    const milestoneId = String(data.get("milestoneId") ?? "").trim();
    const digest = String(data.get("digest") ?? "").trim();
    if (!projectId || !milestoneId || !digest) {
      setMessage("Enter the project ID, milestone ID and your evidence digest.");
      return;
    }
    await submitVaultMemberCall("challenge_milestone", [milestoneId, wallet, digest], "Milestone challenge");
    update("projectId", projectId);
    update("milestoneId", milestoneId);
  }

  function selectIndexedActivity(item: IndexedActivity) {
    if (item.kind === "milestone") update("milestoneId", item.id);
    else if (item.kind === "payout") update("paymentId", item.id);
    else if (item.kind === "refund") update("refundId", item.id);
    else if (item.kind === "repayment") update("repaymentId", item.id);
    else if (item.kind === "distribution") update("distributionId", item.id);
    else if (item.kind === "revenue") update("revenuePeriodId", item.id);
    setMessage(`Selected ${item.kind} ${item.id}. Refresh onchain state to load its details.`);
  }

  async function inspectTransaction(txId = handles.transactionId.trim()) {
    setTransaction(null);
    setTriggeredIds([]);
    if (!HASH.test(txId)) {
      setMessage("Enter a 32-byte GenLayer transaction ID to inspect it.");
      return;
    }
    try {
      const [tx, ids] = await Promise.all([
        readClient.getTransaction({ hash: txId } as never),
        readClient.getTriggeredTransactionIds({ hash: txId } as never),
      ]);
      setTransaction(tx as unknown as Record<string, unknown>);
      setTriggeredIds(ids.map(String));
      update("transactionId", txId);
      setMessage("Transaction receipt loaded. Triggered IDs are the SDK’s internal-message child links; they do not prove EOA payout settlement.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Transaction receipt could not be loaded.");
    }
  }

  async function importKeeperReport(file?: File) {
    setKeeperReport(null);
    setReportError("");
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as KeeperReport;
      if (parsed.chain_id !== "0xf22f" || !Array.isArray(parsed.watches) || !Array.isArray(parsed.alerts)) {
        throw new Error("The file is not a StudioNet MandateOS keeper report.");
      }
      setKeeperReport(parsed);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Keeper report could not be parsed.");
    }
  }

  const treasuryLabels = [
    "Live treasury balance (wei)", "Spendable after allocation reservations (wei)",
    "Reserved allocations (wei)", "Pending transfer audit total (wei)",
    "Principal received from vaults (wei)", "Realized returns received from vaults (wei)",
  ];
  const mandateLabels = [
    "Mandate version", "Maximum project exposure (basis points)", "Minimum liquid reserve (basis points)",
    "Maximum single allocation (wei)", "Allocation challenge window (seconds)", "Evidence freshness limit (seconds)",
  ];
  const evidenceLabels = [
    "Validator assessment", "Source URL", "Source host", "DAO eligibility criteria", "Content SHA-256",
    "Publication date claim", "Assessment reason", "Material facts", "Assessed at (UTC)",
    "Fresh until (UTC)", "Mandate version", "Receipt version",
  ];
  const agreementLabels = [
    "Agreement ID", "Allocation ID", "Financing model", "Mandate version", "Principal cap (wei)",
    "Due time (UTC)", "Grace period (seconds)", "Installment count", "Installment interval (seconds)",
    "Challenge window (seconds)", "Evidence freshness (seconds)", "Revenue share (basis points)",
    "Outstanding principal (wei)", "Principal recovered (wei)", "Realized return (wei)",
    "Repayment GEN received (wei)", "Agreement state", "Operator address", "Beneficiary address", "Beneficiary mode",
  ];
  const proposalLabels = ["Proposal type", "Proposal state", "Votes for (weight)", "Votes against (weight)", "Snapshot total weight"];
  const payoutLabels = ["Contract payout state", "Beneficiary mode", "Fixed destination", "Payment amount (wei)", "Queued at (UTC)"];
  const vault = effectiveVault;
  const payoutRecord = dashboard.payout?.ok ? asArray(dashboard.payout.value) : null;
  const acknowledgmentRecord = dashboard.payoutAcknowledgment?.ok
    ? mapRecipientAcknowledgment(dashboard.payoutAcknowledgment.value)
    : mapRecipientAcknowledgment(null);
  const canAcknowledgePayout = canAcknowledgeEoaPayout(
    wallet, walletChainId, handles.paymentId.trim(), effectiveVault, payoutRecord,
    dashboard.payoutAcknowledgment?.ok ? dashboard.payoutAcknowledgment.value : null,
  );
  const eoaStatus = mapEoaSettlementState(String(payoutRecord?.[0] ?? ""));
  const keeperAcknowledgments = keeperReport?.audit_events?.filter(
    (event) => String(event.event_type ?? "") === "BENEFICIARY_ATTESTATION",
  ) ?? [];
  const transactionState = mapTransactionState(transaction as any);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="MandateOS home">
          <span className="brand-mark">M</span>
          <span>Mandate<span className="brand-light">OS</span></span>
        </a>
        <div className="network-badge"><span className="network-dot" /> StudioNet <b>61999</b></div>
        <div className="top-actions">
          <span className="readonly-label">Read-only data</span>
          <button className="button button-outline" onClick={connectWallet}>
            {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect wallet"}
          </button>
        </div>
      </header>

      <main id="top" className="main-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">Treasury operations · StudioNet only</div>
            <h1>Capital with <em>clear rules.</em></h1>
            <p>Governance, vault financing and transaction evidence in one view. Every balance and status below is read from contract state or identified as unavailable.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={refresh} disabled={refreshing}>
                {refreshing ? "Reading StudioNet…" : "Refresh onchain state"}
              </button>
              <span className="data-source-note">Latest finalized state</span>
            </div>
            {message && <div className="inline-message" role="status">{message}</div>}
          </div>
          <div className="hero-side-card">
            <div className="card-label">Network verification</div>
            <div className="verified-mark"><span>✓</span> Chain ID 61999</div>
            <div className="endpoint">https://studio.genlayer.com/api</div>
            <div className="hero-divider" />
            <div className="card-label">Settlement policy</div>
            <p>Queued messages and sender balance changes are not settlement proof. Unlinked EOA transfers stay unverified.</p>
          </div>
        </section>

        <details className="config-card" open={!handles.mandateAddress}>
          <summary><span>Connection handles</span><small>Query references only · never a financial source of truth</small></summary>
          <div className="fields-grid">
            <Field label="MandateOS Core address" value={handles.mandateAddress} onChange={(v) => update("mandateAddress", v)} placeholder="0x…" />
            <Field label="ProjectVault address (optional if project ID resolves)" value={handles.vaultAddress} onChange={(v) => update("vaultAddress", v)} placeholder="0x…" />
            <Field label="Project ID" value={handles.projectId} onChange={(v) => update("projectId", v)} placeholder="Contract project identifier" />
            <Field label="Member address" value={handles.memberAddress} onChange={(v) => update("memberAddress", v)} placeholder={wallet || "0x…"} />
            <Field label="Governance proposal ID" value={handles.proposalId} onChange={(v) => update("proposalId", v)} placeholder="Proposal identifier" />
            <Field label="Allocation ID" value={handles.allocationId} onChange={(v) => update("allocationId", v)} placeholder="Allocation identifier" />
            <Field label="Refund ID" value={handles.refundId} onChange={(v) => update("refundId", v)} placeholder="Refund identifier" />
            <Field label="Milestone ID" value={handles.milestoneId} onChange={(v) => update("milestoneId", v)} placeholder="Milestone identifier" />
            <Field label="Payout ID" value={handles.paymentId} onChange={(v) => update("paymentId", v)} placeholder="Payment identifier" />
            <Field label="Repayment ID" value={handles.repaymentId} onChange={(v) => update("repaymentId", v)} placeholder="Repayment identifier" />
            <Field label="Distribution ID" value={handles.distributionId} onChange={(v) => update("distributionId", v)} placeholder="Distribution identifier" />
            <Field label="Revenue period ID" value={handles.revenuePeriodId} onChange={(v) => update("revenuePeriodId", v)} placeholder="Period identifier" />
          </div>
          <p className="config-footnote">These identifiers are stored in this browser for convenience. The contract and StudioNet RPC remain the source of financial and governance data. The dashboard discovers the latest 30 proposals and projects and latest 20 records per vault category through bounded contract views.</p>
        </details>

        <section className="dashboard-section" id="treasury">
          <SectionHeading eyebrow="01 · Treasury" title="Available capital" text="Contract balances and encumbrances are read directly from MandateOS Core." />
          <div className="two-column">
            <DataPanel title="Treasury balance & reserves" detail="Native GEN · exact wei values from contract storage" result={dashboard.treasury} labels={treasuryLabels} />
            <DataPanel title="Versioned investment mandate" detail="Exposure, reserve, allocation and evidence limits" result={dashboard.mandate} labels={mandateLabels} />
          </div>
        </section>

        <section className="dashboard-section" id="governance">
          <SectionHeading eyebrow="02 · Governance" title="Member decisions" text="Read snapshotted proposal state and vote through your own StudioNet wallet." />
          <div className="two-column">
            <DataPanel title="Member voting weight" detail={effectiveMemberAddress || "Enter a member or connect a wallet"} result={dashboard.member} labels={["Onchain voting weight"]} />
            <DataPanel title="Proposal & voting snapshot" detail={handles.proposalId || "Enter a proposal ID"} result={dashboard.proposal} labels={proposalLabels} />
          </div>
          <div className="two-column section-space">
            <DataPanel title="Proposal deadlines" result={dashboard.proposalTiming} labels={["Voting ends (UTC)", "Execution available after (UTC)", "Execution expires at (UTC)"]} />
            <article className="panel vote-panel">
              <div className="panel-heading"><div><h3>Cast your vote</h3><p>MandateOS verifies membership, snapshot weight and deadline.</p></div><span className="query-tag tag-muted">Wallet required</span></div>
              <p className="empty-state">Connect a wallet on chain 61999 and load a proposal. Your wallet signs the vote directly; the dashboard never stores keys.</p>
              <div className="button-row">
                <button className="button button-primary" disabled={!wallet || !handles.proposalId.trim()} onClick={() => vote(true)}>Vote for</button>
                <button className="button button-outline" disabled={!wallet || !handles.proposalId.trim()} onClick={() => vote(false)}>Vote against</button>
              </div>
            </article>
          </div>
          <div className="two-column section-space">
            <article className="panel discovery-panel">
              <div className="panel-heading"><div><h3>Recent proposals</h3><p>Newest records from the Core contract index.</p></div><span className="query-tag tag-muted">{proposalIndex.length} loaded</span></div>
              {indexError && <p className="unavailable">Index read issue: {indexError}</p>}
              {proposalIndex.length ? <div className="discovery-list">{proposalIndex.map((item) => <button className="discovery-row" key={item.id} onClick={() => { update("proposalId", item.id); setMessage(`Selected proposal ${item.id}. Refresh onchain state to load full details.`); }}><code>{item.id}</code><span>{item.kind}</span><span className="state-pill">{item.status}</span></button>)}</div> : <p className="empty-state">No indexed proposals returned. Refresh after entering a Core address.</p>}
            </article>
            <article className="panel discovery-panel">
              <div className="panel-heading"><div><h3>Registered projects</h3><p>Project IDs and their registered vault addresses.</p></div><span className="query-tag tag-muted">{projectIndex.length} loaded</span></div>
              {projectIndex.length ? <div className="discovery-list">{projectIndex.map((item) => <button className="discovery-row project-row" key={item.id} onClick={() => { update("projectId", item.id); update("vaultAddress", item.vault); setMessage(`Selected project ${item.id}. Refresh onchain state to load its evidence and vault.`); }}><code>{item.id}</code><span>{item.vault || "Vault unavailable"}</span></button>)}</div> : <p className="empty-state">No registered project index entries returned.</p>}
            </article>
          </div>
        </section>

        <section className="dashboard-section" id="projects">
          <SectionHeading eyebrow="03 · Projects & evidence" title="Eligibility with provenance" text="Review the current validator assessment, original source and freshness window." />
          <div className="two-column">
            <DataPanel title="Registered ProjectVault" detail={handles.projectId || "Project ID required"} result={dashboard.registeredVault} labels={["Registered vault address"]} />
            <DataPanel title="Current evidence receipt" detail="Historical receipts are not enumerated by the current contract view." result={dashboard.evidence} labels={evidenceLabels} />
          </div>
          {dashboard.evidence?.ok && Array.isArray(dashboard.evidence.value) && (
            <div className="notice notice-info">The publication date is a source claim. The assessment time is the contract transaction timestamp; neither is a settlement timestamp.</div>
          )}
        </section>

        <section className="dashboard-section" id="vault">
          <SectionHeading eyebrow="04 · ProjectVault" title="Financing & milestones" text="Agreement obligations, milestone evidence and repayment state from the registered vault." />
          {vault && <div className="address-strip"><span>Vault being queried</span><code>{vault}</code></div>}
          <div className="two-column">
            <DataPanel title="Agreement terms & principal" detail="Received, recovered and realized values are kept distinct" result={dashboard.agreement} labels={agreementLabels} />
            <DataPanel title="Vault balance and distributable funds" result={dashboard.vaultBalance} labels={["Vault native balance (wei)"]} />
          </div>
          <div className="two-column section-space">
            <DataPanel title="Milestone assessment & challenge" result={dashboard.milestone} labels={["Milestone state", "Amount (wei)", "Agreed criteria"]} />
            <DataPanel title="Milestone evidence receipt" result={dashboard.milestoneEvidence} labels={["Source URL", "Source host", "Content SHA-256", "Assessment reason", "Assessed at (UTC)", "Fresh until (UTC)", "Mandate version", "Evidence version"]} />
          </div>
          <div className="two-column section-space">
            <DataPanel title="Milestone challenge deadline" result={dashboard.milestoneDispute} labels={["Dispute window ends (UTC)"]} />
            <DataPanel title="Default dispute" result={dashboard.default} labels={["Default state"]} />
          </div>
          <div className="two-column section-space">
            <article className="panel workflow-panel">
              <div className="panel-heading"><div><h3>Propose a milestone</h3><p>Creates a governance proposal. It does not configure or fund the vault until the DAO approves and executes it.</p></div><span className="query-tag tag-muted">Member signature</span></div>
              <form className="workflow-form" onSubmit={(event) => { event.preventDefault(); void proposeMilestone(event.currentTarget); }}>
                <label className="field"><span>Proposal ID</span><input name="proposalId" required /></label>
                <label className="field"><span>Project ID</span><input name="projectId" required defaultValue={handles.projectId} /></label>
                <label className="field"><span>Milestone ID</span><input name="milestoneId" required /></label>
                <label className="field"><span>Amount (wei)</span><input name="amount" inputMode="numeric" pattern="[1-9][0-9]*" required /></label>
                <label className="field workflow-wide"><span>Milestone criteria</span><textarea name="criteria" maxLength={1000} required /></label>
                <button className="button button-primary" disabled={!wallet}>Sign milestone proposal</button>
              </form>
              <p className="config-footnote">The amount is entered in wei. Confirm the contract and terms in your wallet before signing.</p>
            </article>
            <article className="panel workflow-panel">
              <div className="panel-heading"><div><h3>Challenge a milestone</h3><p>Your digest is a challenge reference, not an independent AI assessment.</p></div><span className="query-tag tag-muted">Member signature</span></div>
              <form className="workflow-form" onSubmit={(event) => { event.preventDefault(); void challengeMilestone(event.currentTarget); }}>
                <label className="field"><span>Project ID</span><input name="projectId" required defaultValue={handles.projectId} /></label>
                <label className="field"><span>Milestone ID</span><input name="milestoneId" required defaultValue={handles.milestoneId} /></label>
                <label className="field workflow-wide"><span>Evidence digest or reference</span><input name="digest" required /></label>
                <button className="button button-outline" disabled={!wallet}>Sign challenge</button>
              </form>
            </article>
          </div>
        </section>

        <section className="dashboard-section" id="payments">
          <SectionHeading eyebrow="05 · Payments & recovery" title="Money movement evidence" text="A contract status, receipt, child link and actual balances are separate evidence fields." />
          <div className="two-column">
            <DataPanel title="Milestone payout record" detail="Destination and amount are immutable per payment ID" result={dashboard.payout} labels={payoutLabels} />
            <article className="panel settlement-panel">
              <div className="panel-heading"><div><h3>Independent settlement</h3><p>EOA beneficiary verification</p></div><span className="query-tag tag-risk">{eoaStatus}</span></div>
              <p>The supported SDK child-ID API reads internal IC message events. It does not expose a parent-linked child receipt for the EOA external value transfer.</p>
              <p className="risk-note">A beneficiary acknowledgment is an attestation, not independent settlement proof. No keeper or administrator can mark an EOA payment successful.</p>
            </article>
          </div>
          <article className="panel recipient-ack-panel section-space">
            <div className="panel-heading"><div><h3>Recipient payment confirmation</h3><p>Wallet-signed beneficiary attestation for this immutable EOA payment.</p></div><span className={`query-tag ${acknowledgmentRecord.status === "RECIPIENT_ACKNOWLEDGED" ? "tag-live" : "tag-muted"}`}>{acknowledgmentRecord.status.replaceAll("_", " ")}</span></div>
            {payoutRecord ? (
              <>
                <div className="two-column compact-grid">
                  <DataPanel title="Payment intent" result={{ ok: true, value: {
                    "Project ID": acknowledgmentRecord.projectId || "Unavailable",
                    "ProjectVault address": effectiveVault || acknowledgmentRecord.projectVault,
                    "Payment ID": handles.paymentId,
                    "Expected receiving wallet": String(payoutRecord[2] ?? ""),
                    "Exact amount": `${String(payoutRecord[3] ?? "0")} wei · ${formatWei(payoutRecord[3])}`,
                    "Current payout status": String(payoutRecord[0] ?? "UNKNOWN"),
                  } }} />
                  <DataPanel title="Recipient acknowledgment record" detail="This is the beneficiary's onchain statement, not a transfer receipt." result={dashboard.payoutAcknowledgment} labels={["Acknowledgment status", "ProjectVault address", "Project ID", "Payment ID", "Expected beneficiary", "Acknowledged amount (wei)", "Wallet signer", "Acknowledged at (UTC)"]} />
                </div>
                <div className="ack-action-row">
                  <p className="notice notice-warning">By signing, you attest that <b>{formatWei(payoutRecord[3])}</b> for payment <code>{handles.paymentId || "(select a payment)"}</code> actually reached your wallet at <code>{String(payoutRecord[2] ?? "unknown")}</code>. This statement does not independently verify settlement and does not release the payout reservation.</p>
                  <button className="button button-primary" disabled={!canAcknowledgePayout || acknowledgmentSubmitting} onClick={() => void acknowledgeEoaPayout()}>
                    {acknowledgmentSubmitting ? "Waiting for finalization…" : "Confirm GEN Received"}
                  </button>
                </div>
                <div className="ack-status-pair">
                  <span>Recipient acknowledged receipt: <b>{acknowledgmentRecord.status === "RECIPIENT_ACKNOWLEDGED" ? "Yes" : "No"}</b></span>
                  <span>Independently verified settlement: <b>{eoaStatus}</b></span>
                </div>
                {!canAcknowledgePayout && acknowledgmentRecord.status !== "RECIPIENT_ACKNOWLEDGED" && (
                  <p className="config-footnote">Confirmation requires an initiated EOA payout, an unacknowledged record, the exact beneficiary wallet, and StudioNet chain ID 61999.</p>
                )}
              </>
            ) : <p className="empty-state">Select a payout record and refresh the latest-final ProjectVault state to review its beneficiary and amount.</p>}
          </article>
          <div className="three-column section-space">
            <DataPanel title="Refund state" result={dashboard.treasuryRefund} labels={["MandateOS refund state"]} />
            <DataPanel title="Vault refund capacity" result={dashboard.refundAvailable} labels={["Refundable GEN (wei)"]} />
            <DataPanel title="Reserved for refunds" result={dashboard.refundReserved} labels={["Refund reservation (wei)"]} />
          </div>
          <div className="three-column section-space">
            <DataPanel title="Repayment receipt" result={dashboard.repayment} labels={["Repayment state"]} />
            <DataPanel title="Governed return distribution" result={dashboard.distribution} labels={["Principal amount (wei)", "Realized return (wei)", "Total (wei)"]} />
            <DataPanel title="Distribution status & availability" result={dashboard.distributionStatus} labels={["Distribution state"]} />
          </div>
          <div className="three-column section-space">
            <DataPanel title="Actually received, available to distribute" result={dashboard.distributionAvailable} labels={["Principal received (wei)", "Realized return received (wei)"]} />
            <DataPanel title="Revenue report vs deposit" detail="Reported income is not native GEN received" result={dashboard.revenue} labels={["Reported revenue (wei)", "GEN received (wei)"]} />
            <DataPanel title="Agreement closure guard" result={dashboard.canClose} labels={["Can close under vault obligations"]} />
          </div>
        </section>

        <section className="dashboard-section" id="vault-activity">
          <SectionHeading eyebrow="05 · Vault index" title="Agreements and cashflow records" text="Select an indexed record, then refresh to read its latest finalized contract state." />
          <article className="panel discovery-panel">
            <div className="panel-heading"><div><h3>Recent vault activity</h3><p>Milestones, payouts, refunds, repayments, distributions and revenue reports.</p></div><span className="query-tag tag-muted">{vaultActivity.length} loaded</span></div>
            {vaultActivity.length ? <div className="discovery-list">{vaultActivity.map((item) => <button className="discovery-row" key={`${item.kind}:${item.id}`} onClick={() => selectIndexedActivity(item)}><span>{item.kind}</span><code>{item.id}</code><span className="state-pill">{item.status}</span></button>)}</div> : <p className="empty-state">No vault index entries returned. Set or discover a registered vault, then refresh.</p>}
          </article>
        </section>

        <section className="dashboard-section" id="activity">
          <SectionHeading eyebrow="06 · Reconciliation & audit" title="Transaction history and keeper alerts" text="Inspect a known GenLayer transaction or import a durable local keeper report." />
          <article className="panel transaction-panel">
            <div className="panel-heading"><div><h3>GenLayer transaction receipt</h3><p>Submission, finalization and execution are shown separately.</p></div>{transaction && <span className="query-tag tag-live">{transactionState.replaceAll("_", " ")}</span>}</div>
            <div className="transaction-search">
              <Field label="GenLayer transaction ID" value={handles.transactionId} onChange={(v) => update("transactionId", v)} placeholder="0x + 64 hex characters" />
              <button className="button button-outline" onClick={() => inspectTransaction()} disabled={!handles.transactionId.trim()}>Inspect receipt</button>
            </div>
            {transaction ? (
              <div className="two-column compact-grid">
                <DataPanel title="Stored GenLayer receipt" result={{ ok: true, value: {
                  id: transaction.txId ?? transaction.hash,
                  status: transaction.statusName ?? transaction.status_name ?? transaction.status,
                  execution: transaction.txExecutionResultName ?? transaction.tx_execution_result_name ?? transaction.txExecutionResult,
                  recipient: transaction.recipient,
                  timestamps: transaction.timestamps,
                } }} />
                <DataPanel title="Triggered internal-message IDs" detail="SDK returns IDs created by internal message processing events." result={{ ok: true, value: triggeredIds.length ? triggeredIds : "No internal child IDs returned" }} />
              </div>
            ) : <p className="empty-state">No transaction receipt loaded. The dashboard does not invent transaction history.</p>}
          </article>
          <article className="panel keeper-panel section-space">
            <div className="panel-heading"><div><h3>Keeper alert archive</h3><p>Import the JSON report produced by <code>python -m keeper.cli</code>.</p></div><span className="query-tag tag-muted">Local report · unsigned</span></div>
            <label className="file-picker">Select keeper report JSON<input type="file" accept="application/json,.json" onChange={(event) => void importKeeperReport(event.target.files?.[0])} /></label>
            {reportError && <p className="unavailable">{reportError}</p>}
            {keeperReport ? (
              <>
                <div className="notice notice-warning">This local JSON report is useful for operations but is not cryptographically signed or independently authenticated by the dashboard.</div>
                <div className="report-summary">{keeperReport.watches.length} tracked transactions · {keeperReport.alerts.length} alerts · generated {keeperReport.generated_at ?? "time unavailable"}</div>
                <div className="report-list">
                  {keeperReport.watches.map((item, index) => (
                    <button className="report-row report-row-button" key={`${String(item.tx_id)}-${index}`} onClick={() => void inspectTransaction(String(item.tx_id ?? ""))}>
                      <code>{String(item.tx_id ?? "transaction ID unavailable")}</code>
                      <span className={`state-pill state-${String(item.state ?? "unknown").toLowerCase()}`}>{String(item.state ?? "UNKNOWN")}</span>
                      <span>{String(item.transfer_id ?? "transfer ID unavailable")}</span>
                    </button>
                  ))}
                </div>
                <div className="report-list">
                  {keeperReport.alerts.map((item, index) => (
                    <div className="report-row alert-row" key={`${String(item.alert_key)}-${index}`}>
                      <b>{String(item.severity ?? "ALERT")}</b>
                      <span>{String(item.state ?? "UNKNOWN")}</span>
                      <span>{String(item.message ?? "No alert detail")}</span>
                    </div>
                  ))}
                </div>
                {keeperAcknowledgments.length > 0 && (
                  <div className="section-space">
                    <div className="notice notice-warning">Beneficiary acknowledgments are wallet attestations. They do not verify external GEN settlement; EOA payout state remains UNKNOWN or VALUE_AT_RISK.</div>
                    <div className="report-list">
                      {keeperAcknowledgments.map((item, index) => (
                        <div className="report-row alert-row" key={`${String(item.event_id)}-ack-${index}`}>
                          <b>Beneficiary attestation</b>
                          <span>{String(item.state ?? "UNKNOWN")}</span>
                          <code>{String(item.reason ?? "No attestation details")}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <p className="empty-state">No keeper report imported. No sample alerts or balances are shown.</p>}
          </article>
        </section>

        <footer className="footer">
          <div><b>MandateOS</b><span>Governed capital. Verifiable outcomes.</span></div>
          <span>StudioNet only · chain ID 61999 · no backend key custody</span>
        </footer>
      </main>
    </div>
  );
}

export const displayHelpers = { rowsFor, formatWei, formatUtcTimestamp };
