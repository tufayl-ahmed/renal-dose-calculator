// Exports every curated and auto-extracted renal-dose record to a CSV for
// clinician review (the same format the in-app review page exports).
//
//   npm run rules:export            -> docs/curation/rule-review.csv
//
// Open the CSV in Excel/Numbers/Google Sheets, check each record against its
// DailyMed link, then fill in the last four columns:
//   decision     "verified" to approve, "retired" to hide it, blank to skip
//   reviewer     your name as it should appear in the app
//   review_date  YYYY-MM-DD
//   notes        anything that needs fixing
// and import it with `npm run rules:import -- path/to/file.csv`.
import { mkdir, writeFile } from "node:fs/promises";
import {
  curatedRecordId,
  getRecordVerification,
  listCandidateRecords,
  listCuratedRecords,
} from "../src/curatedDoseRules.js";
import { toCsv } from "../src/csv.js";
import { recordToReviewRow, REVIEW_HEADER } from "../src/ruleReview.js";

const output = process.argv[2] || "docs/curation/rule-review.csv";

const rows = [...listCuratedRecords(), ...listCandidateRecords()].map((record) =>
  recordToReviewRow(record, { id: curatedRecordId(record), verification: getRecordVerification(record) })
);

await mkdir(new URL("../docs/curation/", import.meta.url), { recursive: true });
await writeFile(output, `\uFEFF${toCsv([REVIEW_HEADER, ...rows])}`);
console.log(`Wrote ${rows.length} records to ${output}`);
