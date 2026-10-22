const test = require("node:test");
const assert = require("node:assert/strict");
const workflow = require("./vault-registration-cli.cjs");
const entrypoint = require("../deploy/01_studionet.js");

test("approved vault registration metadata and encoded proposal arguments are exact", () => {
  assert.equal(workflow.assertApprovedParameters(), "sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4");
  assert.deepEqual(workflow.proposalArguments(), [
    "vault-register-mandateos-demo-001-20261022-01",
    "mandateos-demo-001",
    "AzJbfrJmjP9r47LpgF1gC7nhovQ=",
    1000000000000000n,
    "sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4",
  ]);
});

test("pinned GenLayerJS dry run derives exact calldata without broadcasting", async () => {
  const { captureVaultRegistrationCalldata } = await import("./vault-registration-calldata.mjs");
  const [proposalId, projectId, vaultArgument, capWei, digest] = workflow.proposalArguments();
  const calldata = await captureVaultRegistrationCalldata({
    core: workflow.constants.CORE, proposalId, projectId, vaultArgument, capWei, digest,
  });
  assert.match(calldata, /^0x[0-9a-f]+$/);
});

test("vault registration dispatcher refuses invalid authorization before deploy/write", async () => {
  const old = process.env.MANDATEOS_VAULT_REGISTRATION_APPROVED;
  const cli = { deployContract: () => assert.fail("deployment must not be reached") };
  try {
    process.env.MANDATEOS_VAULT_REGISTRATION_APPROVED = "no";
    await assert.rejects(entrypoint(cli), /approval token is invalid/);
  } finally {
    if (old === undefined) delete process.env.MANDATEOS_VAULT_REGISTRATION_APPROVED;
    else process.env.MANDATEOS_VAULT_REGISTRATION_APPROVED = old;
  }
});

test("vault registration dispatcher enters only its dedicated workflow", async () => {
  const oldApproval = process.env.MANDATEOS_VAULT_REGISTRATION_APPROVED;
  const oldFee = process.env.MANDATEOS_VAULT_REGISTRATION_MAX_FEE_WEI;
  try {
    process.env.MANDATEOS_VAULT_REGISTRATION_APPROVED = "I_AUTHORIZE_MANDATEOS_VAULT_REGISTRATION_STEP";
    delete process.env.MANDATEOS_VAULT_REGISTRATION_MAX_FEE_WEI;
    await assert.rejects(entrypoint({ deployContract: () => assert.fail("deployment must not be reached") }), /exactly zero transaction fee/);
  } finally {
    if (oldApproval === undefined) delete process.env.MANDATEOS_VAULT_REGISTRATION_APPROVED;
    else process.env.MANDATEOS_VAULT_REGISTRATION_APPROVED = oldApproval;
    if (oldFee === undefined) delete process.env.MANDATEOS_VAULT_REGISTRATION_MAX_FEE_WEI;
    else process.env.MANDATEOS_VAULT_REGISTRATION_MAX_FEE_WEI = oldFee;
  }
});
