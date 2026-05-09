import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const QA_DIR = new URL("../docs/testing/generated/", import.meta.url);
const OUT_DIR = new URL("../docs/clinical-validation/", import.meta.url);
const DEFAULT_JSON_PATTERN = /^live-api-qa-200-.*\.json$/;

const reportUrl = await resolveReportUrl(process.argv[2]);
const report = JSON.parse(await readFile(reportUrl, "utf8"));
const rows = (report.results || []).map(toValidationRow);
const summary = summarize(rows);

await mkdir(OUT_DIR, { recursive: true });
const csvUrl = new URL("renal-dose-validation.csv", OUT_DIR);
const mdUrl = new URL("renal-dose-validation.md", OUT_DIR);
const jsonUrl = new URL("validation-summary.json", OUT_DIR);

await writeFile(csvUrl, renderCsv(rows));
await writeFile(mdUrl, renderMarkdown({ report, rows, summary }));
await writeFile(jsonUrl, JSON.stringify({ sourceReport: filePath(reportUrl), summary }, null, 2));

console.log(
  JSON.stringify(
    {
      sourceReport: filePath(reportUrl),
      total: rows.length,
      summary,
      csvPath: filePath(csvUrl),
      mdPath: filePath(mdUrl),
      jsonPath: filePath(jsonUrl),
    },
    null,
    2
  )
);

async function resolveReportUrl(rawPath) {
  if (rawPath) {
    return pathToFileURL(resolve(rawPath));
  }

  const names = (await readdir(QA_DIR))
    .filter((name) => DEFAULT_JSON_PATTERN.test(name))
    .sort();
  if (!names.length) {
    throw new Error("No live QA JSON reports found. Run scripts/qa-live-200.mjs first.");
  }
  return new URL(names.at(-1), QA_DIR);
}

function toValidationRow(result) {
  const validationStatus = result.validationStatus || inferValidationStatus(result);
  return {
    priority: priorityFor(validationStatus),
    validationStatus,
    drug: result.drug || "",
    matchedLabel: result.title || "",
    route: result.route || "",
    age: result.age || "",
    sex: result.sex || "",
    scrMgDl: result.scr || "",
    weightKg: result.weight || "",
    egfr: result.egfr || "",
    crcl: result.crcl || "",
    resultStatus: result.resultStatus || "",
    reviewLevel: result.reviewLevel || "",
    doseOrAction: result.dose || "",
    frequencyOrInstruction: result.frequency || "",
    note: result.note || "",
    sourceMode: result.sourceMode || "",
    sourceUrl: result.sourceUrl || "",
    findings: [...(result.issues || []), ...(result.warnings || []), ...(result.reviews || [])].join("; "),
    nextAction: nextActionFor(validationStatus),
  };
}

function inferValidationStatus(result) {
  if (result.verdict === "issue") {
    return "technical-fail";
  }
  if (result.verdict === "warn") {
    return "parser-or-ai-review";
  }
  if (result.resultStatus === "no_renal_adjustment") {
    return "source-summary";
  }
  if (result.verdict === "review" || result.resultStatus === "review_source") {
    return "clinical-review";
  }
  if (result.resultStatus === "dose_found") {
    return "source-matched";
  }
  return "not-classified";
}

function priorityFor(status) {
  if (status === "technical-fail") {
    return "P0";
  }
  if (status === "parser-or-ai-review") {
    return "P1";
  }
  if (status === "clinical-review") {
    return "P2";
  }
  if (status === "source-summary") {
    return "P3";
  }
  return "P4";
}

function nextActionFor(status) {
  if (status === "technical-fail") {
    return "Fix app lookup or route behavior before release.";
  }
  if (status === "parser-or-ai-review") {
    return "Improve parser or add source-backed deterministic rule.";
  }
  if (status === "clinical-review") {
    return "Clinician should verify label and decide whether a clean rule is appropriate.";
  }
  if (status === "source-summary") {
    return "Verify no-adjustment language against current label.";
  }
  if (status === "source-matched") {
    return "Spot-check source before marking clinically verified.";
  }
  return "Review manually.";
}

function summarize(rows) {
  const byStatus = {};
  const byPriority = {};
  const byRoute = {};
  for (const row of rows) {
    byStatus[row.validationStatus] = (byStatus[row.validationStatus] || 0) + 1;
    byPriority[row.priority] = (byPriority[row.priority] || 0) + 1;
    byRoute[row.route || "unknown"] = (byRoute[row.route || "unknown"] || 0) + 1;
  }
  return { byStatus, byPriority, byRoute };
}

function renderCsv(rows) {
  const columns = [
    "priority",
    "validationStatus",
    "drug",
    "matchedLabel",
    "route",
    "age",
    "sex",
    "scrMgDl",
    "weightKg",
    "egfr",
    "crcl",
    "resultStatus",
    "reviewLevel",
    "doseOrAction",
    "frequencyOrInstruction",
    "note",
    "sourceMode",
    "sourceUrl",
    "findings",
    "nextAction",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n");
}

function renderMarkdown({ report, rows, summary }) {
  const tableRows = rows
    .map((row) =>
      [
        row.priority,
        row.validationStatus,
        row.drug,
        row.route,
        row.egfr,
        row.crcl,
        row.doseOrAction,
        row.frequencyOrInstruction,
        row.findings,
        row.sourceUrl,
      ]
        .map(markdownCell)
        .join(" | ")
    )
    .map((row) => `| ${row} |`)
    .join("\n");

  return `# Clinical Validation Table

Source QA report: ${filePath(reportUrl)}

Target: ${report.baseUrl || "unknown"}

Generated: ${new Date().toISOString()}

This is a validation worklist, not a prescribing reference. Each row must be source-checked before being marked clinically verified.

## Summary

${renderCounts("Validation status", summary.byStatus)}

${renderCounts("Priority", summary.byPriority)}

## Priority Meaning

- P0: technical failure to fix before release
- P1: parser or AI output needs engineering review
- P2: clinically important source-review backlog
- P3: no-adjustment/source-summary row needs spot verification
- P4: source-matched output needs routine spot verification

## Validation Rows

| Priority | Status | Drug | Route | eGFR | CrCl | Dose/action | Frequency/instruction | Findings | Source |
|---|---|---|---|---:|---:|---|---|---|---|
${tableRows}
`;
}

function renderCounts(title, counts) {
  const lines = Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `- ${label}: ${count}`)
    .join("\n");
  return `### ${title}\n\n${lines || "- None"}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim();
}

function filePath(url) {
  return decodeURIComponent(url.pathname);
}
