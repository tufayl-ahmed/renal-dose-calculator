import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { labelCuratedRules } from "../src/data/renalRules/label-curated.js";
import { extractClaims, findClaim, normalizeLabelText } from "../scripts/lib/labelClaims.mjs";

// Offline replay of `npm run rules:verify-text`: every numeric claim in a
// label-curated record must have been found in the cited label when the
// fixture was written. A new or edited record whose numbers are not in its
// label fails here until the audit is re-run (with network) and triaged.
const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/label-claims.json", import.meta.url)));
const EXCEPTIONS = JSON.parse(
  readFileSync(new URL("../docs/curation/label-text-audit-exceptions.json", import.meta.url))
);

test("every label-curated number was found in its cited label", () => {
  const problems = [];
  for (const record of labelCuratedRules) {
    if (EXCEPTIONS[`${record.drugName}|${record.routes.join("/")}`]) {
      continue;
    }
    const setId = record.sourceUrl.match(/setid=([\w-]+)/i)?.[1];
    const found = new Set(FIXTURE[setId] || []);
    const missing = extractClaims(record).filter((claim) => !found.has(claim.key));
    if (missing.length) {
      problems.push(`${record.drugName} [${record.routes}]: ${missing.map((claim) => claim.label).join(", ")}`);
    }
  }
  assert.deepEqual(problems, [], "re-run `npm run rules:verify-text -- --write-fixture` and triage");
});

const LABEL = normalizeLabelText(
  "In patients with severe renal impairment (creatinine clearance 15 – 29 mL/min), the recommended " +
    "starting dosage is 5 mg once daily. Hemodialysis patients: 250 mg every 48 hours. Reduce the dose by 50%."
);

function record(rules) {
  return { drugName: "Example", routes: ["ORAL"], rules };
}

test("the check finds numbers the label states", () => {
  const claims = extractClaims(
    record([
      { type: "gte", min: 30, max: Infinity, variants: [{ condition: "Adult", dose: "Usual", interval: "" }] },
      {
        type: "range",
        min: 15,
        max: 29.99,
        variants: [{ condition: "CrCl 15-29", dose: "5 mg", interval: "once daily" }],
      },
      { type: "lt", min: 0, max: 15, variants: [{ condition: "HD", dose: "250 mg", interval: "every 48 hours" }] },
    ])
  );
  assert.deepEqual(
    claims.filter((claim) => !findClaim(LABEL, claim)).map((claim) => claim.label),
    []
  );
});

test("the check catches a wrong amount, threshold or interval", () => {
  const wrong = extractClaims(
    record([
      {
        type: "range",
        min: 20,
        max: 34.99,
        variants: [{ condition: "CrCl 20-34", dose: "7.5 mg", interval: "every 36 hours" }],
      },
    ])
  );
  assert.deepEqual(
    wrong.filter((claim) => !findClaim(LABEL, claim)).map((claim) => claim.label),
    ["threshold 20", "threshold 35", "7.5 mg", "every 36 hours"]
  );
});

test("clearance units and thousands separators are not mistaken for amounts", () => {
  const claims = extractClaims(
    record([
      {
        type: "all",
        min: 0,
        max: Infinity,
        variants: [{ condition: "Any", dose: "1,000 mg", interval: "CrCl < 15 mL/min" }],
      },
    ])
  );
  assert.deepEqual(
    claims.map((claim) => claim.key),
    ["a:1000mg"]
  );
});
