function planMembershipAction({
  status,
  proposalIdUsed,
  founderWeight,
  memberWeight,
  votesFor,
  votesAgainst,
  chainTimestamp,
  votingEndsAt,
  executeAfter,
  executeBy,
}) {
  const values = Object.fromEntries(Object.entries({ founderWeight, memberWeight, votesFor, votesAgainst, chainTimestamp, votingEndsAt, executeAfter, executeBy })
    .map(([key, value]) => [key, BigInt(value)]));
  if (status === "UNKNOWN") {
    if (proposalIdUsed) return { action: "STOP", reason: "proposal ID is indexed despite UNKNOWN status" };
    if (values.founderWeight !== 1n || values.memberWeight !== 0n) return { action: "STOP", reason: "membership weights do not match expected pre-onboarding state" };
    return { action: "PROPOSE_MEMBER_ADD" };
  }
  if (status === "VOTING") {
    if (values.memberWeight !== 0n) return { action: "STOP", reason: "member weight changed before proposal execution" };
    if (values.votesAgainst > 0n) return { action: "STOP", reason: "founder no vote is already recorded" };
    if (values.votesFor === 0n) return { action: "FOUNDER_VOTE_YES" };
    if (values.chainTimestamp < values.votingEndsAt) return { action: "WAIT_VOTING_DEADLINE", at: values.votingEndsAt.toString() };
    return { action: "FINALIZE_MEMBER_ADD" };
  }
  if (status === "TIMELOCKED") {
    if (values.chainTimestamp < values.executeAfter) return { action: "WAIT_EXECUTION_TIMELOCK", at: values.executeAfter.toString() };
    if (values.chainTimestamp > values.executeBy) return { action: "STOP", reason: "execution window expired" };
    return { action: "EXECUTE_MEMBER_ADD" };
  }
  if (status === "EXECUTED") {
    return values.memberWeight === 1n
      ? { action: "MEMBER_ADD_VERIFIED" }
      : { action: "STOP", reason: `execution observed but member weight is ${values.memberWeight}` };
  }
  return { action: "STOP", reason: `unexpected proposal status ${status}` };
}

module.exports = { planMembershipAction };
