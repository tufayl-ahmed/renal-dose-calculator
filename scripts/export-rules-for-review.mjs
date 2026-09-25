// Exports every curated renal-dose record to a CSV for clinician review.
//
//   npm run rules:export            -> docs/curation/rule-review.csv
//
// Open the CSV in Excel/Numbers/Google Sheets, check each record against its
// DailyMed link, then fill in the last four columns:
//   decision     "verified" to approve, "retired" to hide it, blank to skip
//   reviewer     your name as it should appear in the app
//   review_date  YYYY-MM-DD
//   notes        anything that needs fixing (records with notes but no
//                decision are left as draft)
// and import it with `npm run rules:import -- path/to/file.csv`.
import { mkdir, writeFile } from "node:fs/promises";
import { curatedRecordId, getRecordVerification, listCuratedRecords } from "../src/curatedDoseRules.js";
import { toCsv } from "./lib/csv.mjs";

const output = process.argv[2] || "docs/curation/rule-review.csv";

const header = [
  "id",
  "drug",
  "routes",
  "label_rules",
  "structured_rules",
  "notes_from_extraction",
  "dailymed_url",
  "current_status",
  "current_reviewer",
  "decision",
  "reviewer",
  "review_date",
  "notes",
];

const rows = listCuratedRecords().map((record) => {
  const verification = getRecordVerification(record);
  return [
    curatedRecordId(record),
    record.drugName,
    record.routes.join(", "),
    record.rules.map((rule) => `${formatBand(rule)}: ${formatVariants(rule.variants)}`).join("\n"),
    (record.structured?.rules || [])
      .map((rule) => `${formatBand(rule)} [${contextLabel(rule)}]: ${rule.dose} ${rule.interval}`)
      .join("\n"),
    record.indicationNote,
    record.sourceUrl,
    verification.status,
    verification.verifiedBy,
    "",
    "",
    "",
    "",
  ];
});

await mkdir(new URL("../docs/curation/", import.meta.url), { recursive: true });
await writeFile(output, `\uFEFF${toCsv([header, ...rows])}`);
console.log(`Wrote ${rows.length} records to ${output}`);

function formatBand(rule) {
  if (rule.type === "all") return "All values";
  if (rule.type === "gt") return `> ${rule.min}`;
  if (rule.type === "gte") return `>= ${rule.min}`;
  if (rule.type === "lt") return `< ${rule.max}`;
  return `${rule.min}-${rule.max}`;
}

function formatVariants(variants) {
  return variants
    .map((variant) => [variant.condition, `${variant.dose} ${variant.interval}`.trim()].filter(Boolean).join(": "))
    .join(" | ");
}

function contextLabel(rule) {
  return ["dialysis", "indication", "formulation"]
    .map((key) => (rule[key] && rule[key] !== "any" ? `${key}=${rule[key]}` : ""))
    .filter(Boolean)
    .join(", ") || "any";
}
