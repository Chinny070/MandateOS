# Decisions before V1 production release

Defaults for the illustrative testing mandate, **not policy adopted by DAO**:
- Funding instrument: REPAYABLE first; GRANT and REVENUE_SHARE after first full cycle succeeds.
- Asset: GEN only on StudioNet. No ERC-20 trading, DEX, Solidity or Bradbury.
- Single project concentration: 20% of defined GEN-denominated base.
- Liquid reserve: 15%.
- Application-level allocation and milestone challenge windows: 24 hours in demonstration configuration. Contract-clock is UTC transaction timestamp, no wall-time dependency.
- Evidence source precedence: verified official regulator/filing for law/compliance; project self-reports are claims, not independently sufficient.
- Upgrades: no single-key unlimited upgrader in a capital-bearing V1; decide governed/timelocked upgrade versus frozen deploy, confirm with tests.
- Owner roles: no actor may be sole funder, proposer, auditor and challenger in the final live test.

Before public use the DAO must formally specify member set, voting weights, quorum, governance delay, ethical-violation standard, concentration denominator, reserve denominator, late-payment terms, default remedies, collateral (if any), business/jurisdiction compliance and eligible recipient verification. Do not silently hardcode these as production policy.
