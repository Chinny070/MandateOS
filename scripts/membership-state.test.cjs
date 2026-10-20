const test = require("node:test");
const assert = require("node:assert/strict");
const { planMembershipAction } = require("./membership-state.cjs");
const deploymentEntrypoint = require("../deploy/01_studionet.js");

const base = {
  proposalIdUsed: false,
  founderWeight: 1n,
  memberWeight: 0n,
  votesFor: 0n,
  votesAgainst: 0n,
  chainTimestamp: 1000n,
  votingEndsAt: 2000n,
  executeAfter: 3000n,
  executeBy: 9000n,
};

test("plans one unique member-add proposal only from the expected latest-final bootstrap state", () => {
  assert.deepEqual(planMembershipAction({ ...base, status: "UNKNOWN" }), { action: "PROPOSE_MEMBER_ADD" });
  assert.equal(planMembershipAction({ ...base, status: "UNKNOWN", proposalIdUsed: true }).action, "STOP");
  assert.equal(planMembershipAction({ ...base, status: "UNKNOWN", founderWeight: 0n }).action, "STOP");
});

test("records founder YES once and waits on the actual onchain vote deadline", () => {
  assert.deepEqual(planMembershipAction({ ...base, status: "VOTING" }), { action: "FOUNDER_VOTE_YES" });
  assert.deepEqual(planMembershipAction({ ...base, status: "VOTING", votesFor: 1n }), {
    action: "WAIT_VOTING_DEADLINE", at: "2000",
  });
  assert.deepEqual(planMembershipAction({ ...base, status: "VOTING", votesFor: 1n, chainTimestamp: 2000n }), {
    action: "FINALIZE_MEMBER_ADD",
  });
  assert.equal(planMembershipAction({ ...base, status: "VOTING", votesAgainst: 1n }).action, "STOP");
});

test("executes only inside the onchain timelock window", () => {
  assert.deepEqual(planMembershipAction({ ...base, status: "TIMELOCKED", chainTimestamp: 2999n }), {
    action: "WAIT_EXECUTION_TIMELOCK", at: "3000",
  });
  assert.equal(planMembershipAction({ ...base, status: "TIMELOCKED", chainTimestamp: 3000n }).action, "EXECUTE_MEMBER_ADD");
  assert.equal(planMembershipAction({ ...base, status: "TIMELOCKED", chainTimestamp: 9001n }).action, "STOP");
});

test("confirms Rabby membership only after executed proposal state", () => {
  assert.deepEqual(planMembershipAction({ ...base, status: "EXECUTED", memberWeight: 1n }), {
    action: "MEMBER_ADD_VERIFIED",
  });
  assert.equal(planMembershipAction({ ...base, status: "EXECUTED" }).action, "STOP");
});

test("membership CLI dispatch rejects missing approval/cap before any deployment or write call", async () => {
  const previousApproval = process.env.MANDATEOS_MEMBERSHIP_APPROVED;
  const previousCap = process.env.MANDATEOS_MEMBERSHIP_MAX_FEE_WEI;
  delete process.env.MANDATEOS_MEMBERSHIP_MAX_FEE_WEI;
  const deployContract = () => assert.fail("deployment must not be reached");
  const cli = { deployContract };
  try {
    process.env.MANDATEOS_MEMBERSHIP_APPROVED = "not-approved";
    await assert.rejects(deploymentEntrypoint(cli), /token is invalid/);
    process.env.MANDATEOS_MEMBERSHIP_APPROVED = "I_AUTHORIZE_MANDATEOS_MEMBER_ONBOARDING_STEP";
    await assert.rejects(deploymentEntrypoint(cli), /exact user-authorized per-transaction max fee/);
  } finally {
    if (previousApproval === undefined) delete process.env.MANDATEOS_MEMBERSHIP_APPROVED;
    else process.env.MANDATEOS_MEMBERSHIP_APPROVED = previousApproval;
    if (previousCap === undefined) delete process.env.MANDATEOS_MEMBERSHIP_MAX_FEE_WEI;
    else process.env.MANDATEOS_MEMBERSHIP_MAX_FEE_WEI = previousCap;
  }
});
