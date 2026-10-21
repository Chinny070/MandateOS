const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");

const packagePath = path.join(__dirname, "..", "docs", "evidence", "mandateos-demo-001-registration.json");
const evidence = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const approvalPath = path.join(__dirname, "..", "deployments", "registration-parameter-approval.json");
const approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
function sortRecursively(value) {
  if (Array.isArray(value)) return value.map(sortRecursively);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortRecursively(value[key])]));
  }
  return value;
}

test("registration evidence metadata digest is deterministic and matches the prepared commitment", () => {
  const canonical = JSON.stringify(sortRecursively(evidence));
  const digest = `sha256:${crypto.createHash("sha256").update(canonical, "utf8").digest("hex")}`;
  assert.equal(digest, "sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4");
});

test("registration package contains identity metadata only and makes no eligibility claim", () => {
  assert.equal(evidence.project.id, "mandateos-demo-001");
  assert.equal(evidence.contracts.project_vault.address, "0x03325B7EB2668CfF6bE3B2e9805d600bB9E1a2F4");
  assert.equal(evidence.eligibility.status, "NOT_ASSESSED");
  assert.deepEqual(evidence.eligibility.external_claims, []);
});

test("owner approval preserves exact registration parameters without authorizing a transaction", () => {
  assert.equal(approval.status, "PARAMETERS_APPROVED_ONLY");
  assert.equal(approval.project_id, evidence.project.id);
  assert.equal(approval.project_cap_wei, "1000000000000000");
  assert.equal(approval.metadata_digest, "sha256:80a66dfa722a75e1403e66a8bdb816d3071e727dea522c330407842d82902bf4");
  assert.equal(approval.metadata_digest, `sha256:${crypto.createHash("sha256").update(JSON.stringify(sortRecursively(evidence)), "utf8").digest("hex")}`);
  assert.ok(approval.explicitly_not_authorized.includes("proposal submission"));
  assert.ok(approval.explicitly_not_authorized.includes("wallet unlock or signing"));
  assert.ok(approval.explicitly_not_authorized.includes("GEN transfer or deposit"));
  assert.ok(approval.explicitly_not_authorized.includes("governance vote, finalization, or execution"));
});
