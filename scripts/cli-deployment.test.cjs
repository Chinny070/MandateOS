const test = require("node:test");
const assert = require("node:assert/strict");
const deployment = require("../deploy/cli-deployment.cjs");

test("constructor values preserve the zero-argument Core and ProjectVault string types", () => {
  assert.deepEqual(deployment.constructorArgs("core"), []);
  assert.deepEqual(deployment.constructorArgs("vault", {
    coreAddress: "0x0123456789abcdef0123456789abcdef01234567",
    projectId: "00123",
  }), ["0x0123456789abcdef0123456789abcdef01234567", "00123"]);
  assert.equal(typeof deployment.constructorArgs("vault", {
    coreAddress: "0x0123456789abcdef0123456789abcdef01234567", projectId: "123",
  })[1], "string");
  assert.throws(() => deployment.constructorArgs("unknown"), /Unknown contract stage/);
  assert.throws(() => deployment.constructorArgs("vault", { coreAddress: "0x123", projectId: "x" }), /Core address/);
  assert.throws(() => deployment.constructorArgs("vault", { coreAddress: "0x0123456789abcdef0123456789abcdef01234567", projectId: 123 }), /project ID as a string/);
});

test("legacy CLI transaction fee cap uses the exact signed StudioNet gas and price", () => {
  assert.equal(deployment.legacyEvmFeeCapWei({ chainId: 61999, gas: 8_000_000n, gasPrice: 0n }), 0n);
  assert.equal(deployment.legacyEvmFeeCapWei({ chainId: 61999n, gas: 21000n, gasPrice: 3n }), 63000n);
  assert.throws(() => deployment.legacyEvmFeeCapWei({ chainId: 777, gas: 21000n, gasPrice: 1n }), /non-StudioNet/);
  assert.throws(() => deployment.legacyEvmFeeCapWei({ chainId: 61999, gas: 21000n }), /omitted gas or gasPrice/);
  assert.throws(() => deployment.legacyEvmFeeCapWei({ chainId: 61999, gas: 0n, gasPrice: 1n }), /Invalid gas/);
});

test("EVM receipt costs require matching hash, successful status and actual fee fields", () => {
  const hash = `0x${"a".repeat(64)}`;
  assert.equal(deployment.actualEvmFeeWei({
    transactionHash: hash, status: "0x1", gasUsed: "0x7a1200", effectiveGasPrice: "0x0",
  }, hash), 0n);
  assert.equal(deployment.actualEvmFeeWei({
    transactionHash: hash, status: 1, gasUsed: "0x5208", effectiveGasPrice: "0x3",
  }, hash), 63000n);
  assert.throws(() => deployment.actualEvmFeeWei({ transactionHash: hash, status: "0x0", gasUsed: "0x1", effectiveGasPrice: "0x1" }, hash), /not successful/);
  assert.throws(() => deployment.actualEvmFeeWei({ transactionHash: `0x${"b".repeat(64)}`, status: "0x1", gasUsed: "0x1", effectiveGasPrice: "0x1" }, hash), /does not match/);
  assert.throws(() => deployment.actualEvmFeeWei({ transactionHash: hash, status: "0x1", gasUsed: "0x1" }, hash), /effectiveGasPrice/);
});

test("legacy StudioNet receipt requires finalized majority and successful leader execution", () => {
  const receipt = {
    status: 7,
    result: 6,
    consensus_data: { leader_receipt: [{ mode: "leader", execution_result: "SUCCESS" }] },
  };
  assert.equal(deployment.successfulFinalizedDeployment(receipt), true);
  assert.equal(deployment.successfulFinalizedDeployment({ ...receipt, status: 5 }), false);
  assert.equal(deployment.successfulFinalizedDeployment({ ...receipt, result: 5 }), false);
  assert.equal(deployment.successfulFinalizedDeployment({
    status: 7, result: 6, consensus_data: { leader_receipt: [{ mode: "leader", execution_result: "ERROR" }] },
  }), false);
  assert.equal(deployment.deployedAddress({ data: { contract_address: "0x0123456789abcdef0123456789abcdef01234567" } }), "0x0123456789abcdef0123456789abcdef01234567");
});
