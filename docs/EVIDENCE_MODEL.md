# External evidence, timestamps, and validation

## Mandatory ingestion modes

1. `gl.nondet.web.get`: fetch static official disclosures and APIs.
2. `gl.nondet.web.render(url, mode='text')`: dynamic web page text extraction.
3. `gl.nondet.web.render(url, mode='html')`: inspect metadata, structured tables and references when useful.
4. `gl.nondet.web.render(url, mode='screenshot')`: visual evidence when text is insufficient; pass image bytes/outputs only via currently documented GenLayer image-processing interfaces.

All web calls belong in nondeterministic scopes and must be independently evaluated under a suitable Equivalence Principle. Do not use raw strict equality of entire dynamic news pages. Validate decision-bearing claims, structured fields, source identifiers and uncertainty. Avoid source poisoning and SSRF; source allowlisting / host validation and bounded URLs are essential.

## Evidence receipt schema (target)

`evidence_id`, `project_id`, `claim_type`, `source_url`, `source_host`, `source_type`, `fetched_at_transaction_timestamp`, `claimed_publication_timestamp`, `publication_time_confidence`, `expires_at`, `content_digest`, `snapshot_uri_and_digest`, `input_mandate_digest`, `assessment`, `assessment_reason`, `validator_outcome`, `transaction_reference`, `version`, `supersedes`.

Published time, retrieved/assessed time, and actual blockchain settlement time **must be different fields**. A date claimed by a third-party site is not blockchain-attested truth. Compute deterministic transaction-time with GenLayer's documented `datetime` support and test against deadline transitions.

## Evaluation output

Use narrow enums like `VERIFIED_ELIGIBLE`, `VERIFIED_INELIGIBLE`, `INSUFFICIENT`, `CONFLICTING`, `STALE`, `SOURCE_UNAVAILABLE`, and `REQUIRES_REVIEW`. Fail closed for new purchases/investment releases when *material* necessary evidence is inconclusive. Preserve all history with source/digest and explicit supersession.

Do not mistake the absence of negative news for proof of labor compliance. Allegations are not equivalent to final enforcement findings; the written mandate must specify the relevant evidentiary standard.

## Freshness

Different source categories require different policies: market data may need much shorter freshness than public filings; project physical milestones must be judged against evidence that applies to the agreed delivery period. A keeper may request a refresh but never fabricate sources or claim validators agreed without final receipts. Store important rendered snapshots durably and verify digest integrity.

## Required attacks to test

Prompt injection inside web content; lookalike official domains; redirect/localhost/metadata SSRF; long pages and malformed HTML; inaccessible dynamic renderers; changing content between validators; forged publication timestamps; irrelevant namesakes; contradictory statements; screenshots with misleading overlays; missing website; overconfident classification; replayed or stale evidence; malicious project owner submitting a self-attestation.

## Current contract implementation

MandateOS now requires a DAO-approved HTTPS source URL and bounded DAO-approved eligibility criteria before `refresh_project_evidence` can fetch it. The contract binds the prompt to the registered project ID and those criteria, uses `gl.nondet.web.get` inside `gl.eq_principle.prompt_comparative`, bounds source bodies to 16,000 bytes, hashes the fetched bytes with SHA-256, and asks validators to compare eligibility, publication-date claims, reason and material facts. Prompt content is embedded as a JSON-encoded untrusted string. The stored receipt distinguishes member-submitted registration digest from validator-assessed status and includes source URL/host, criteria, content digest, claimed publication date, assessment UTC timestamp, freshness expiry, mandate version and assessment version. Inconclusive assessment is persisted as non-eligible and blocks allocation evaluation and funding.

This implementation does not yet archive the source body, verify publication dates cryptographically, inspect redirect destinations, or execute in the current Direct Mode runner. Domain validation blocks userinfo, local suffixes, obvious IP literals and non-HTTPS URLs, but is not a substitute for a protocol-level redirect/DNS rebinding defense. StudioNet consensus remains unverified. Validators can agree on an `INCONCLUSIVE` receipt; disagreement or materially different evidence prevents the assessment transaction from finalizing.
