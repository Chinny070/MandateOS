// Reproduce the registration metadata commitment. Hashes canonical UTF-8 JSON
// with recursively sorted object keys, compact separators, and no trailing LF.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const path = new URL("../docs/evidence/mandateos-demo-001-registration.json", import.meta.url);
const input = JSON.parse(await readFile(path, "utf8"));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
const payload = JSON.stringify(canonical(input));
const digest = createHash("sha256").update(payload, "utf8").digest("hex");
console.log(JSON.stringify({
  file: "docs/evidence/mandateos-demo-001-registration.json",
  algorithm: "SHA-256",
  canonicalization: "recursive lexical object-key order; compact JSON; UTF-8; no trailing LF",
  byteLength: Buffer.byteLength(payload, "utf8"),
  digest: `sha256:${digest}`,
  meaning: "Integrity commitment to deployment/project identity metadata only; not eligibility evidence or a validator decision.",
}, null, 2));
