# Live StudioNet proofs

**MandateOS Core and the first ProjectVault are deployed and independently checked on StudioNet (chain ID 61999).** Deployment was explicitly authorized on 2026-10-20 (Africa/Lagos), with a 10 GEN cumulative fee ceiling. No treasury deposit, project funding, governance write, payout, repayment, or GEN test transfer was authorized or performed.

## MandateOS deployment

| Item | MandateOS Core | ProjectVault |
|---|---|---|
| Contract address | `0x32698630D6144882Bd0c1D5B00C74348c53ea58B` | `0x03325B7EB2668CfF6bE3B2e9805d600bB9E1a2F4` |
| Deployment transaction | `0x8c5c53afc9e6f8958688df572e946dc8c3880133a388bf98640615e5fd1841a7` | `0xd42a4c5dcb6a25ba7909eb312239d21bc8c27ffa2ef4b3cd1c33e320b5931d39` |
| Constructor arguments | `[]` | `[0x32698630D6144882Bd0c1D5B00C74348c53ea58B, "mandateos-demo-001"]` |
| Local source SHA-256 | `a0cad2bdc2a7be57d5e80e4f681d5f0897708bcf8b6ace53a81480c2e849a5d4` | `2da278f14385feee0191dfd2ed9d8cfe0c29a03d5138aa638885f179f9be3c33` |
| GenLayer receipt | `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS` | `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS` |
| Validator result | 5 agree | 3 agree, 2 idle; finalized majority agreement |
| EVM receipt | status `0x1`; gas used `0x7a1200` (8,000,000); effective gas price `0x0` | status `0x1`; gas used `0x7a1200` (8,000,000); effective gas price `0x0` |
| Recorded EVM fee | `0 GEN` | `0 GEN` |

The GenLayer receipts returned the contract addresses shown above and decoded the constructors. The raw EVM receipts identify successful transactions to the StudioNet consensus entrypoint (`contractAddress` is null in those EVM receipts); contract addresses are verified from the finalized GenLayer deployment receipts. The script also checked the raw EVM receipt hash against each submitted transaction ID.

## Finalized state readbacks

- Core `get_balance_wei()` returned `0`; `get_treasury_summary()` returned `[0, 0, 0, 0, 0, 0]`.
- Core reports the deploying signer’s initial member weight as `1` and registered project count `0`.
- Core `get_vault_address("mandateos-demo-001")` is empty. This is expected: ProjectVault deployment does not register it, and no governance transaction was authorized.
- ProjectVault `get_parent_address()` returned the Core address above; `get_project_id()` returned `mandateos-demo-001`; `get_balance_wei()` returned `0`.
- Deployment receipts report `value_credited: false`. No GEN value was attached to either deployment.

## Budget and scope

- Cumulative fee ceiling: `10 GEN` (`10000000000000000000 wei`).
- Actual EVM deployment fees recorded: `0 GEN`; fee commitments: `0 GEN`; unknown fee liabilities: `0 GEN`; remaining ledger ceiling: `10 GEN`.
- The zero fee result is specific to these two receipts; it is not a future fee guarantee.
- First financial-test transfer ceiling remains `0.01 GEN`, separately authorized. Actual test value and committed test value are both zero.
- No DAO membership onboarding, vault registration, treasury funding, investment, payout, refund, repayment, or other governance/financial transaction was submitted.

## Other evidence and limitations

- StudioNet `eth_chainId` returned `0xf22f`; current `eth_gasPrice` returned `0x0` at preflight. These are time-specific read-only observations.
- SpecLock deployment and triggered-transfer receipts remain external reference evidence only. They do not establish MandateOS payout settlement.
- EOA payouts remain unverified and unsuitable for production until MandateOS independently reconciles a causal external transfer receipt. Do not retry uncertain transfers.
- Two-wallet DAO governance, live funding, validator-backed web evidence, IC-beneficiary payouts, refunds, repayments and keeper reconciliation have not been exercised.
- Local tests and GenVM lint are reported in `BUILD_STATUS.md`; they are not live settlement evidence.

## Repository evidence

- Deployment journal: `deployments/studionet-deployment-record.json`.
- Fee and value ledger: `deployments/studionet-budget.json`.
- Address configuration: `deployments/studionet.json`.
- `main` was not changed or merged.

## Read-only governance onboarding preflight

On 2026-10-20, read-only latest-final queries against the deployed Core reported proposal count `0`, candidate member-add ID `member-add-rabby-1af111b06e6f6a05-20261020-01` absent from the index and `UNKNOWN`, founder weight `1`, and Rabby weight `0`. The latest EVM block timestamp returned was `1792455328` (`2026-10-20T00:15:28Z`). These are state observations only; no proposal or vote transaction was submitted.

At `2026-10-20T00:15:28.923Z`, the exact stable GenLayerJS 1.1.8 `propose_member_add` call was run with a fake EIP-1193 provider that threw before wallet or broadcast. The StudioNet RPC returned chain `0xf22f`, `eth_estimateGas=500000`, transaction gas limit `500000`, `eth_gasPrice=0`, and therefore a current maximum EVM fee commitment of `0 GEN`; attached value was zero. No transaction hash was created. This fee quote must be repeated before a future signature; a zero current quote does not guarantee future transaction fees.

The proposed transaction is `MandateOS.propose_member_add("member-add-rabby-1af111b06e6f6a05-20261020-01", "GvERsG5vagW9QVcqAWMY8TVq+Fw=")`. The encoded string resolves to the exact Rabby address listed above. The candidate ID remains unused as of the read-only observation.

The 10 GEN cumulative ledger remains unchanged: actual fees `0`, committed fees `0`, unknown fee liabilities `0`, remaining `10 GEN`. No DAO treasury funding, project financing, payout, refund, repayment, or test transfer was performed. The read-only receipt and membership checks do not prove live wallet signing or validator consensus for any governance action.
