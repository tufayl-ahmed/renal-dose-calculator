// Imports clinician decisions from a reviewed CSV (see export-rules-for-review.mjs)
// into src/data/renalRules/verifications.js.
//
//   npm run rules:import -- docs/curation/rule-review.csv
//
// Only rows with decision "verified" or "retired" plus a reviewer and an ISO
// review_date are imported. Existing verifications are kept unless the CSV
// has a new decision for the same record.
import { readFile, writeFile } from "node:fs/promises";
import { curatedRecordId, listCuratedRecords } from "../src/curatedDoseRules.js";
import { RULE_VERIFICATIONS } from "../src/data/renalRules/verifications.js";
import { parseCsv, rowsToObjects } from "./lib/csv.mjs";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run rules:import -- <reviewed.csv>");
  process.exit(1);
}

const knownIds = new Set(listCuratedRecords().map(curatedRecordId));
const rows = rowsToObjects(parseCsv(await readFile(input, "utf8")));
const next = { ...RULE_VERIFICATIONS };
const problems = [];
let imported = 0;

for (const row of rows) {
  const decision = row.decision.toLowerCase();
  if (!decision) {
    continue;
  }
  if (!["verified", "retired"].includes(decision)) {
    problems.push(`${row.id}: decision must be "verified" or "retired", got "${row.decision}"`);
    continue;
  }
  if (!knownIds.has(row.id)) {
    problems.push(`${row.id}: no curated record with this id`);
    continue;
  }
  if (!row.reviewer) {
    problems.push(`${row.id}: reviewer is required`);
    continue;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.review_date)) {
    problems.push(`${row.id}: review_date must be YYYY-MM-DD`);
    continue;
  }
  next[row.id] = {
    status: decision,
    verifiedBy: row.reviewer,
    verifiedOn: row.review_date,
    ...(row.notes ? { notes: row.notes } : {}),
  };
  imported += 1;
}

if (problems.length) {
  console.error(`Not imported:\n  ${problems.join("\n  ")}`);
}

const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
const source = await readFile(new URL("../src/data/renalRules/verifications.js", import.meta.url), "utf8");
const preamble = source.slice(0, source.indexOf("export const RULE_VERIFICATIONS"));
await writeFile(
  new URL("../src/data/renalRules/verifications.js", import.meta.url),
  `${preamble}export const RULE_VERIFICATIONS = ${JSON.stringify(sorted, null, 2)};\n`
);
console.log(`Imported ${imported} decision(s); ${Object.keys(sorted).length} record(s) now have a clinician decision.`);
process.exitCode = problems.length ? 1 : 0;
