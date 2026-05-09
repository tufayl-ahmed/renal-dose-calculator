import { mkdir, writeFile } from "node:fs/promises";
import { calculateCockcroftGault, calculateEgfrCkdEpi2021 } from "../src/renal.js";
import { draftRenalDoseRules } from "../src/data/renalRules/index.js";
import { normalizeAssistPayload } from "../src/llmDoseAssist.js";

const DEFAULT_BASE_URL = "https://renal-dose-calculator.pages.dev";
const REPORT_DIR = new URL("../docs/testing/generated/", import.meta.url);
const INTERNAL_TOKEN_PATTERN = /\b(?:review_source|dose_found|no_renal_adjustment|not_found)\b/i;
const UNRESOLVED_DOSE_PATTERN =
  /\b(?:one-half|half|the)?\s*recommended dose\b|\busual recommended dose\b|\brecommended dose or/i;

const profiles = [
  { age: 45, sex: "male", creatinine: 0.9, weight: 78, height: 174 },
  { age: 52, sex: "female", creatinine: 1.0, weight: 62, height: 160 },
  { age: 64, sex: "male", creatinine: 1.4, weight: 82, height: 172 },
  { age: 71, sex: "female", creatinine: 1.5, weight: 58, height: 156 },
  { age: 76, sex: "male", creatinine: 1.8, weight: 70, height: 168 },
  { age: 68, sex: "female", creatinine: 2.0, weight: 66, height: 162 },
  { age: 80, sex: "male", creatinine: 2.4, weight: 76, height: 170 },
  { age: 83, sex: "female", creatinine: 2.2, weight: 52, height: 152 },
  { age: 58, sex: "male", creatinine: 3.0, weight: 92, height: 178 },
  { age: 73, sex: "female", creatinine: 3.1, weight: 70, height: 158 },
  { age: 61, sex: "male", creatinine: 4.2, weight: 64, height: 166 },
  { age: 88, sex: "female", creatinine: 2.8, weight: 45, height: 150 },
  { age: 39, sex: "male", creatinine: 1.2, weight: 110, height: 182 },
  { age: 67, sex: "female", creatinine: 0.8, weight: 88, height: 165 },
  { age: 55, sex: "male", creatinine: 2.2, weight: 55, height: 165 },
  { age: 79, sex: "female", creatinine: 1.1, weight: 50, height: 154 },
];

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || DEFAULT_BASE_URL;
const limit = Number.isFinite(args.limit) ? args.limit : 200;
const concurrency = Number.isFinite(args.concurrency) ? args.concurrency : 4;

const seeds = buildSeeds(draftRenalDoseRules).slice(0, limit);
const cases = seeds.map(buildCase);
const startedAt = new Date();
const results = await runCases(cases, { baseUrl, concurrency });
const finishedAt = new Date();

await mkdir(REPORT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonPath = new URL(`live-api-qa-200-${stamp}.json`, REPORT_DIR);
const mdPath = new URL(`live-api-qa-200-${stamp}.md`, REPORT_DIR);
const summary = summarize(results);

await writeFile(
  jsonPath,
  JSON.stringify(
    {
      baseUrl,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationSeconds: Math.round((finishedAt - startedAt) / 1000),
      summary,
      results,
    },
    null,
    2
  )
);
await writeFile(mdPath, renderMarkdown({ baseUrl, startedAt, finishedAt, summary, results }));

console.log(
  JSON.stringify(
    {
      baseUrl,
      total: results.length,
      summary,
      jsonPath: filePath(jsonPath),
      mdPath: filePath(mdPath),
      topIssues: results
        .filter((result) => result.verdict === "issue")
        .slice(0, 25)
        .map((result) => ({
          index: result.index,
          drug: result.drug,
          route: result.route,
          title: result.title,
          issues: result.issues,
          sourceMode: result.sourceMode,
          status: result.resultStatus,
        })),
    },
    null,
    2
  )
);

function buildSeeds(rules) {
  const seen = new Set();
  const seeds = [];
  for (const rule of rules) {
    const searchTerm = compact(rule.searchTerm || rule.drugName);
    const key = searchTerm.toLowerCase();
    if (!searchTerm || seen.has(key)) {
      continue;
    }
    seen.add(key);
    seeds.push({
      drugName: compact(rule.drugName),
      searchTerm,
      aliases: rule.aliases || [],
      routes: Array.isArray(rule.routes) ? rule.routes : ["ALL"],
      sourceUrl: rule.sourceUrl || "",
      confidence: rule.confidence || "",
    });
  }
  return seeds;
}

function buildCase(seed, index) {
  const profile = profiles[index % profiles.length];
  const values = {
    ...profile,
    drug: seed.searchTerm,
    route: chooseRoute(seed.routes, index),
  };
  const egfr = calculateEgfrCkdEpi2021(values);
  const crcl = calculateCockcroftGault(values);
  return {
    index: index + 1,
    seed,
    payload: {
      drug: seed.searchTerm,
      normalizedDrug: {
        original: seed.searchTerm,
        searchTerm: seed.searchTerm,
        displayName: seed.drugName,
        source: "qa-seed",
        changed: normalizeKey(seed.searchTerm) !== normalizeKey(seed.drugName),
      },
      route: values.route,
      crcl,
      egfr,
      age: profile.age,
      sex: profile.sex,
      creatinine: profile.creatinine,
      weight: profile.weight,
      height: profile.height,
      dialysis: "none",
      indication: "any",
      formulation: "any",
    },
  };
}

async function runCases(testCases, options) {
  const queue = [...testCases];
  const results = [];
  const workers = Array.from({ length: options.concurrency }, async () => {
    while (queue.length) {
      const testCase = queue.shift();
      const result = await runCase(testCase, options.baseUrl);
      results[testCase.index - 1] = result;
      console.log(`${result.index}/${testCases.length} ${result.verdict.toUpperCase()} ${result.drug} ${result.route}`);
    }
  });
  await Promise.all(workers);
  return results.filter(Boolean);
}

async function runCase(testCase, baseUrl) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/renal-dose/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testCase.payload),
    });

    if (!response.ok) {
      return classify({
        testCase,
        durationMs: Date.now() - startedAt,
        data: null,
        error: `HTTP ${response.status}`,
      });
    }

    const data = await response.json();
    const normalized = normalizeAssistPayload(data, testCase.payload);
    return classify({
      testCase,
      durationMs: Date.now() - startedAt,
      data,
      normalized,
      error: "",
    });
  } catch (error) {
    return classify({
      testCase,
      durationMs: Date.now() - startedAt,
      data: null,
      error: error?.message || String(error),
    });
  }
}

function classify({ testCase, durationMs, data, normalized, error }) {
  const guidance = normalized?.guidance || {};
  const result = normalized?.result || data?.result || {};
  const label = data?.label || {};
  const issues = [];
  const warnings = [];
  const reviews = [];
  const displayText = compact(
    [
      guidance.title,
      guidance.badge,
      guidance.crclBand,
      guidance.drugName,
      guidance.dose,
      guidance.interval,
      guidance.indicationNote,
      result.dose,
      result.frequency,
      result.dialysisNote,
      ...(result.importantCautions || []),
    ].join(" ")
  );

  if (error) {
    issues.push(error);
  }
  if (result.status === "not_found" || data?.sourceMode === "not-found") {
    issues.push("drug label not found");
  }
  if (data?.sourceMode === "route-not-found") {
    issues.push("selected route not found");
  }
  if (data?.sourceMode === "error") {
    issues.push("backend returned error fallback");
  }
  if (data?.sourceMode === "free-quota-guard") {
    warnings.push("free AI quota guard returned source review");
  }
  if (INTERNAL_TOKEN_PATTERN.test(displayText)) {
    issues.push("raw internal status token exposed");
  }
  if (UNRESOLVED_DOSE_PATTERN.test(displayText)) {
    issues.push("unresolved recommended-dose phrase exposed");
  }
  if (/AI renal band did not match/i.test(displayText)) {
    warnings.push("AI renal band mismatch was caught");
  }
  if (/AI dose\/frequency was not specific enough/i.test(displayText)) {
    warnings.push("AI dose/frequency rejected as vague");
  }
  if (displayText.length > 900) {
    issues.push("dose guidance text too long");
  }
  if (result.status === "review_source") {
    reviews.push("clinical source review required");
  }
  if (result.status === "no_renal_adjustment" && isVagueNoAdjustmentResult(result)) {
    reviews.push("source-summary no-adjustment output");
  }

  const labelMismatch = detectLabelMismatch(testCase.seed.searchTerm, label);
  if (labelMismatch) {
    warnings.push(labelMismatch);
  }

  return {
    index: testCase.index,
    drug: testCase.payload.drug,
    route: testCase.payload.route,
    age: testCase.payload.age,
    sex: testCase.payload.sex,
    scr: testCase.payload.creatinine,
    weight: testCase.payload.weight,
    egfr: testCase.payload.egfr,
    crcl: testCase.payload.crcl,
    sourceMode: data?.sourceMode || "",
    modelUsed: data?.modelUsed || "",
    title: guidance.drugName || result.drugName || label.title || "",
    labelGeneric: label.genericName || "",
    labelBrand: label.brandName || "",
    resultStatus: result.status || "",
    reviewLevel: guidance.reviewLevel || "",
    dose: guidance.dose || result.dose || "",
    frequency: guidance.interval || result.frequency || "",
    note: guidance.indicationNote || result.dialysisNote || "",
    sourceUrl: normalized?.sourceUrl || data?.sourceUrl || result.sourceUrl || "",
    durationMs,
    validationStatus: classifyValidationStatus({ issues, warnings, reviews, result }),
    verdict: issues.length ? "issue" : warnings.length ? "warn" : reviews.length ? "review" : "pass",
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)],
    reviews: [...new Set(reviews)],
  };
}

function classifyValidationStatus({ issues, warnings, reviews, result }) {
  if (issues.length) {
    return "technical-fail";
  }
  if (warnings.length) {
    return "parser-or-ai-review";
  }
  if (reviews.length) {
    return "clinical-review";
  }
  if (result.status === "dose_found" || result.status === "no_renal_adjustment") {
    return "source-matched";
  }
  return "not-classified";
}

function isVagueNoAdjustmentResult(result) {
  const text = compact(`${result.dose || ""} ${result.frequency || ""}`);
  return /found in supplied label text|verify DailyMed source/i.test(text);
}

function detectLabelMismatch(searchTerm, label) {
  if (!label || label.status !== "found") {
    return "";
  }
  const queryToken = normalizeKey(searchTerm).slice(0, 7);
  if (!queryToken || queryToken.length < 4) {
    return "";
  }

  const labelText = normalizeKey([label.title, label.genericName, label.brandName].filter(Boolean).join(" "));
  if (labelText.includes(queryToken)) {
    return "";
  }

  return `possible label mismatch for ${searchTerm}`;
}

function summarize(results) {
  const counts = results.reduce(
    (acc, result) => {
      acc[result.verdict] += 1;
      acc.total += 1;
      acc.sourceModes[result.sourceMode || "unknown"] = (acc.sourceModes[result.sourceMode || "unknown"] || 0) + 1;
      return acc;
    },
    { total: 0, pass: 0, review: 0, warn: 0, issue: 0, sourceModes: {} }
  );

  const issueKinds = {};
  const warningKinds = {};
  const reviewKinds = {};
  for (const result of results) {
    for (const issue of result.issues) {
      issueKinds[issue] = (issueKinds[issue] || 0) + 1;
    }
    for (const warning of result.warnings) {
      warningKinds[warning] = (warningKinds[warning] || 0) + 1;
    }
    for (const review of result.reviews || []) {
      reviewKinds[review] = (reviewKinds[review] || 0) + 1;
    }
  }
  return { ...counts, issueKinds, warningKinds, reviewKinds };
}

function renderMarkdown({ baseUrl, startedAt, finishedAt, summary, results }) {
  const issueRows = results.filter((result) => result.verdict === "issue");
  const warnRows = results.filter((result) => result.verdict === "warn");
  const reviewRows = results.filter((result) => result.verdict === "review");
  const allRows = results.map((result) =>
    [
      result.index,
      result.drug,
      result.route,
      result.egfr,
      result.crcl,
      result.verdict,
      result.sourceMode,
      result.resultStatus,
      result.validationStatus,
      result.title,
      [...result.issues, ...result.warnings, ...(result.reviews || [])].join("; "),
    ]
      .map(escapeCell)
      .join(" | ")
  );

  return `# Live API QA - 200 Common Drug Pass

Date: ${startedAt.toISOString().slice(0, 10)}

Target: ${baseUrl}

Started: ${startedAt.toISOString()}  
Finished: ${finishedAt.toISOString()}

## Summary

- Total cases: ${summary.total}
- Pass: ${summary.pass}
- Review: ${summary.review}
- Warn: ${summary.warn}
- Issue: ${summary.issue}

## Issue Kinds

${renderCounts(summary.issueKinds)}

## Warning Kinds

${renderCounts(summary.warningKinds)}

## Review Kinds

${renderCounts(summary.reviewKinds)}

## Issue Cases

${renderCaseBullets(issueRows)}

## Warning Cases

${renderCaseBullets(warnRows.slice(0, 80))}

## Review Cases

${renderCaseBullets(reviewRows.slice(0, 80))}

## Full Case Table

| # | Drug | Route | eGFR | CrCl | Verdict | Source mode | Status | Validation status | Matched title | Notes |
|---:|---|---|---:|---:|---|---|---|---|---|---|
${allRows.map((row) => `| ${row} |`).join("\n")}
`;
}

function renderCounts(counts) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([label, count]) => `- ${label}: ${count}`).join("\n") : "- None";
}

function renderCaseBullets(rows) {
  return rows.length
    ? rows
        .map(
          (row) =>
            `- #${row.index} ${row.drug} (${row.route}, CrCl ${row.crcl}): ${[
              ...row.issues,
              ...row.warnings,
              ...(row.reviews || []),
            ].join("; ")}`
        )
        .join("\n")
    : "- None";
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (const rawArg of rawArgs) {
    const [key, value = ""] = rawArg.replace(/^--/, "").split("=");
    if (key === "base-url") {
      parsed.baseUrl = value;
    } else if (key === "limit") {
      parsed.limit = Number(value);
    } else if (key === "concurrency") {
      parsed.concurrency = Number(value);
    }
  }
  return parsed;
}

function chooseRoute(routes, index) {
  const normalized = routes.map((route) => String(route || "").toUpperCase());
  if (normalized.includes("ORAL") && normalized.includes("IV")) {
    return index % 2 === 0 ? "ORAL" : "IV";
  }
  if (normalized.includes("ORAL")) {
    return "ORAL";
  }
  if (normalized.includes("IV")) {
    return "IV";
  }
  return "ALL";
}

function escapeCell(value) {
  return compact(value).replace(/\|/g, "\\|");
}

function normalizeKey(value) {
  return compact(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function filePath(url) {
  return decodeURIComponent(url.pathname);
}
