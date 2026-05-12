import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { calculateCockcroftGault, calculateEgfrCkdEpi2021 } from "../src/renal.js";
import { isSystemicAutocompleteCandidate } from "../src/drugAutocomplete.js";
import { DRUG_AUTOCOMPLETE_ITEMS } from "../src/drugAutocompleteData.js";
import { normalizeAssistPayload } from "../src/llmDoseAssist.js";

const DEFAULT_BASE_URL = "https://renal-dose-calculator.pages.dev";
const REPORT_DIR = new URL("../docs/testing/generated/", import.meta.url);
const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const INTERNAL_TOKEN_PATTERN = /\b(?:review_source|dose_found|no_renal_adjustment|not_found)\b/i;
const UNRESOLVED_DOSE_PATTERN =
  /\b(?:one-half|half|the)?\s*recommended dose\b|\busual recommended dose\b|\brecommended dose or\b/i;
const CHAOTIC_TEXT_PATTERN = /\b(?:undefined|null|nan|\[object object\]|<script|<\/?[a-z][\s\S]*?>)\b/i;
const VAGUE_CLEAN_DOSE_PATTERN =
  /\b(?:adjust(?:\s+the)?\s+(?:dose|dosage)|dose adjustment|dosage adjustment|see prescribing information|see label|as directed|use usual dose)\b/i;
const DOSE_UNIT_PATTERN = /\b\d+(?:\.\d+)?\s*(?:mg|g|gram|grams|mcg|units?|iu|meq|mmol|ml|%)\b/i;
const FREQUENCY_PATTERN = /\b(?:every\s+\d+\s+hours?|q\s*\d+\s*h|once daily|twice daily|three times daily|four times daily|daily|weekly|after dialysis|following dialysis|bid|tid|qid|q24h|q12h|q8h|q6h|q48h|q72h)\b/i;
const REVIEW_ACTION_PATTERN =
  /\b(?:review|verify|monitor|auc|level|levels|not established|not recommended|contraindicated|avoid|do not use|do not initiate|source|specialist|clinical context|indication-specific|dialysis-specific)\b/i;

const profiles = [
  {
    key: "normal-adult",
    description: "normal renal function",
    age: 42,
    sex: "male",
    creatinine: 0.9,
    weight: 78,
    height: 174,
    route: "ORAL",
  },
  {
    key: "moderate-renal-iv",
    description: "moderate renal impairment",
    age: 68,
    sex: "female",
    creatinine: 1.7,
    weight: 64,
    height: 160,
    route: "IV",
  },
  {
    key: "severe-renal-oral",
    description: "severe renal impairment",
    age: 76,
    sex: "male",
    creatinine: 2.8,
    weight: 70,
    height: 168,
    route: "ORAL",
  },
  {
    key: "very-severe-renal-iv",
    description: "very severe renal impairment",
    age: 84,
    sex: "female",
    creatinine: 3.6,
    weight: 52,
    height: 154,
    route: "IV",
  },
];

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || DEFAULT_BASE_URL;
const concurrency = Number.isFinite(args.concurrency) ? args.concurrency : 3;
const delayMs = Number.isFinite(args.delayMs) ? args.delayMs : 0;
const maxDrugs = Number.isFinite(args.limit) ? args.limit : Infinity;
const profileCount = Number.isFinite(args.profiles) ? Math.max(1, Math.min(args.profiles, profiles.length)) : profiles.length;
const selectedProfiles = profiles.slice(0, profileCount);
const searchableDrugs = buildSearchableDrugs().slice(0, maxDrugs);
const cases = buildCases(searchableDrugs, selectedProfiles);
const startedAt = new Date();

console.log(
  JSON.stringify(
    {
      baseUrl,
      searchableDrugs: searchableDrugs.length,
      profilesPerDrug: selectedProfiles.length,
      totalCases: cases.length,
      concurrency,
      delayMs,
    },
    null,
    2
  )
);

const results = await runCases(cases, { baseUrl, concurrency, delayMs });
const finishedAt = new Date();
const summary = summarize(results);

await mkdir(REPORT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonPath = new URL(`autocomplete-full-qa-${stamp}.json`, REPORT_DIR);
const mdPath = new URL(`autocomplete-full-qa-${stamp}.md`, REPORT_DIR);
const latestJsonPath = new URL("autocomplete-full-qa-latest.json", REPORT_DIR);
const latestMdPath = new URL("autocomplete-full-qa-latest.md", REPORT_DIR);

const payload = {
  baseUrl,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationSeconds: Math.round((finishedAt - startedAt) / 1000),
  searchableDrugs: searchableDrugs.length,
  profiles: selectedProfiles.map((profile) => profileSummary(profile)),
  totalCases: results.length,
  summary,
  results,
};

await writeFile(jsonPath, JSON.stringify(payload, null, 2));
await writeFile(latestJsonPath, JSON.stringify(payload, null, 2));
const markdown = renderMarkdown(payload);
await writeFile(mdPath, markdown);
await writeFile(latestMdPath, markdown);

console.log(
  JSON.stringify(
    {
      baseUrl,
      searchableDrugs: searchableDrugs.length,
      profilesPerDrug: selectedProfiles.length,
      totalCases: results.length,
      summary,
      delayMs,
      jsonPath: filePath(jsonPath),
      mdPath: filePath(mdPath),
      latestJsonPath: filePath(latestJsonPath),
      latestMdPath: filePath(latestMdPath),
      topIssues: results
        .filter((result) => result.verdict === "issue")
        .slice(0, 25)
        .map((result) => pickCase(result)),
      topWarnings: results
        .filter((result) => result.verdict === "warn")
        .slice(0, 25)
        .map((result) => pickCase(result)),
    },
    null,
    2
  )
);

function buildSearchableDrugs() {
  const seen = new Set();
  const drugs = [];
  for (const item of DRUG_AUTOCOMPLETE_ITEMS) {
    if (!isSystemicAutocompleteCandidate(item)) {
      continue;
    }
    const name = compact(item.name);
    const key = normalizeKey(name);
    if (!name || seen.has(key)) {
      continue;
    }
    seen.add(key);
    drugs.push({
      name,
      source: item.source || "",
      count: item.count || 0,
    });
  }
  return drugs;
}

function buildCases(drugs, activeProfiles) {
  const built = [];
  for (const drug of drugs) {
    for (const profile of activeProfiles) {
      const values = {
        ...profile,
        drug: drug.name,
      };
      const egfr = calculateEgfrCkdEpi2021(values);
      const crcl = calculateCockcroftGault(values);
      built.push({
        index: built.length + 1,
        drug,
        profile: profileSummary(profile),
        payload: {
          drug: drug.name,
          normalizedDrug: {
            original: drug.name,
            searchTerm: drug.name,
            displayName: drug.name,
            source: "full-autocomplete-qa",
            changed: false,
          },
          route: profile.route,
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
      });
    }
  }
  return built;
}

async function runCases(testCases, options) {
  const queue = [...testCases];
  const results = [];
  let completed = 0;
  const workers = Array.from({ length: options.concurrency }, async () => {
    while (queue.length) {
      const testCase = queue.shift();
      const result = await runCase(testCase, options.baseUrl);
      results[testCase.index - 1] = result;
      completed += 1;
      if (completed % 50 === 0 || result.verdict === "issue") {
        console.log(
          `${completed}/${testCases.length} ${result.verdict.toUpperCase()} ${result.drug} ${result.route} ${result.profileKey}`
        );
      }
      if (options.delayMs) {
        await sleep(options.delayMs);
      }
    }
  });
  await Promise.all(workers);
  return results.filter(Boolean);
}

async function runCase(testCase, liveBaseUrl) {
  const startedAt = Date.now();
  try {
    const response = await fetchAssistWithRetry(`${liveBaseUrl}/api/renal-dose/assist`, testCase.payload);
    if (!response.ok) {
      return classify({
        testCase,
        durationMs: Date.now() - startedAt,
        data: null,
        normalized: null,
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
      normalized: null,
      error: error?.message || String(error),
    });
  }
}

async function fetchAssistWithRetry(url, payload) {
  const attempts = 8;
  let lastResponse = null;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!TRANSIENT_HTTP_STATUSES.has(response.status) || attempt === attempts) {
        response.recoveredAfterRetry = attempt > 1;
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        throw error;
      }
    }
    await sleep(1200 * attempt);
  }
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError || new Error("Request failed.");
}

function classify({ testCase, durationMs, data, normalized, error }) {
  const guidance = normalized?.guidance || {};
  const result = normalized?.result || data?.result || {};
  const label = data?.label || {};
  const displayText = compact(
    [
      guidance.title,
      guidance.badge,
      guidance.crclBand,
      guidance.drugName,
      guidance.dose,
      guidance.interval,
      guidance.indicationNote,
      result.drugName,
      result.route,
      result.renalBand,
      result.dose,
      result.frequency,
      result.dialysisNote,
      ...(result.importantCautions || []),
    ].join(" ")
  );

  const issues = [];
  const warnings = [];
  const reviews = [];
  const observations = [];
  const sourceMode = data?.sourceMode || "";
  const routeUnavailable = sourceMode === "route-not-found";
  const resultStatus = result.status || "";
  const sourceUrl = normalized?.sourceUrl || data?.sourceUrl || result.sourceUrl || "";
  const title = guidance.drugName || result.drugName || label.title || "";

  if (error) {
    issues.push(error);
  }
  if (!routeUnavailable && (resultStatus === "not_found" || sourceMode === "not-found")) {
    issues.push("drug label not found despite autocomplete candidate");
  }
  if (sourceMode === "error") {
    issues.push("backend returned error fallback");
  }
  if (INTERNAL_TOKEN_PATTERN.test(displayText)) {
    issues.push("raw internal status token exposed");
  }
  if (UNRESOLVED_DOSE_PATTERN.test(displayText)) {
    issues.push("unresolved recommended-dose phrase exposed");
  }
  if (CHAOTIC_TEXT_PATTERN.test(displayText)) {
    issues.push("chaotic/internal text exposed");
  }
  if (resultStatus === "dose_found" && VAGUE_CLEAN_DOSE_PATTERN.test(`${result.dose || ""} ${result.frequency || ""}`)) {
    issues.push("vague clean dose/action displayed as dose_found");
  }
  if (resultStatus === "dose_found" && (!result.dose || !result.frequency)) {
    issues.push("dose_found missing dose or frequency");
  }
  if (resultStatus === "review_source" && looksLikeConcreteRegimen(result) && !REVIEW_ACTION_PATTERN.test(displayText)) {
    issues.push("review_source displays a fake clean regimen");
  }
  if (displayText.length > 900) {
    issues.push("dose guidance text too long");
  }
  if ([result.dose, result.frequency, result.dialysisNote, guidance.dose, guidance.interval, guidance.indicationNote].some((field) => compact(field).length > 360)) {
    issues.push("single guidance field too long");
  }
  if (!routeUnavailable && isDoseBearingStatus(resultStatus) && !sourceUrl && !error) {
    warnings.push("source link missing");
  }
  if (!routeUnavailable && isDoseBearingStatus(resultStatus) && sourceUrl && !/^https:\/\/dailymed\.nlm\.nih\.gov\//i.test(sourceUrl)) {
    warnings.push("source link is not DailyMed");
  }
  const routeMismatch = detectRouteMismatch(testCase.payload.route, result.route, sourceMode, resultStatus);
  if (routeMismatch) {
    issues.push(routeMismatch);
  }
  if (/AI renal band did not match/i.test(displayText)) {
    warnings.push("AI renal band mismatch was caught");
  }
  if (/AI dose\/frequency was not specific enough/i.test(displayText)) {
    warnings.push("AI dose/frequency rejected as vague");
  }
  if (/could not be fully verified/i.test(displayText)) {
    warnings.push("source verification caution shown");
  }
  if (sourceMode === "free-quota-guard") {
    warnings.push("free AI quota guard returned source review");
  }
  if (routeUnavailable) {
    observations.push("route unavailable handled safely");
  }
  if (resultStatus === "review_source") {
    reviews.push("clinical source review required");
  }
  if (resultStatus === "no_renal_adjustment" && /verify DailyMed|found in supplied label text/i.test(displayText)) {
    reviews.push("source-summary no-adjustment output");
  }
  const mismatch = detectLabelMismatch(testCase.drug.name, label);
  if (mismatch) {
    warnings.push(mismatch);
  }

  return {
    index: testCase.index,
    drug: testCase.drug.name,
    route: testCase.payload.route,
    profileKey: testCase.profile.key,
    profileDescription: testCase.profile.description,
    age: testCase.payload.age,
    sex: testCase.payload.sex,
    scr: testCase.payload.creatinine,
    weight: testCase.payload.weight,
    egfr: testCase.payload.egfr,
    crcl: testCase.payload.crcl,
    verdict: issues.length ? "issue" : warnings.length ? "warn" : reviews.length ? "review" : "pass",
    sourceMode,
    resultStatus,
    reviewLevel: guidance.reviewLevel || "",
    title,
    labelGeneric: label.genericName || "",
    labelBrand: label.brandName || "",
    dose: guidance.dose || result.dose || "",
    frequency: guidance.interval || result.frequency || "",
    note: guidance.indicationNote || result.dialysisNote || "",
    sourceUrl,
    durationMs,
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)],
    reviews: [...new Set(reviews)],
    observations: [...new Set(observations)],
  };
}

function summarize(results) {
  const summary = {
    total: results.length,
    pass: 0,
    review: 0,
    warn: 0,
    issue: 0,
    byRoute: {},
    byProfile: {},
    sourceModes: {},
    statuses: {},
    issueKinds: {},
    warningKinds: {},
    reviewKinds: {},
    observationKinds: {},
    affectedIssueDrugs: 0,
    affectedWarningDrugs: 0,
    affectedReviewDrugs: 0,
  };
  const issueDrugs = new Set();
  const warningDrugs = new Set();
  const reviewDrugs = new Set();

  for (const result of results) {
    summary[result.verdict] += 1;
    increment(summary.byRoute, result.route);
    increment(summary.byProfile, result.profileKey);
    increment(summary.sourceModes, result.sourceMode || "unknown");
    increment(summary.statuses, result.resultStatus || "unknown");
    if (result.verdict === "issue") {
      issueDrugs.add(result.drug);
    }
    if (result.verdict === "warn") {
      warningDrugs.add(result.drug);
    }
    if (result.verdict === "review") {
      reviewDrugs.add(result.drug);
    }
    for (const issue of result.issues) {
      increment(summary.issueKinds, issue);
    }
    for (const warning of result.warnings) {
      increment(summary.warningKinds, warning);
    }
    for (const review of result.reviews) {
      increment(summary.reviewKinds, review);
    }
    for (const observation of result.observations) {
      increment(summary.observationKinds, observation);
    }
  }

  summary.affectedIssueDrugs = issueDrugs.size;
  summary.affectedWarningDrugs = warningDrugs.size;
  summary.affectedReviewDrugs = reviewDrugs.size;
  return summary;
}

function renderMarkdown(data) {
  const issueRows = data.results.filter((result) => result.verdict === "issue");
  const warnRows = data.results.filter((result) => result.verdict === "warn");
  const reviewRows = data.results.filter((result) => result.verdict === "review");
  const routeUnavailableRows = data.results.filter((result) => result.observations.includes("route unavailable handled safely"));
  const topIssueDrugs = groupByDrug(issueRows).slice(0, 80);
  const topWarnDrugs = groupByDrug(warnRows).slice(0, 80);

  return `# Full Autocomplete Drug QA Sweep

Date: ${data.startedAt.slice(0, 10)}

Target: ${data.baseUrl}

Searchable autocomplete drugs tested: ${data.searchableDrugs}

Profiles per drug: ${data.profiles.length}

Total cases: ${data.totalCases}

Started: ${data.startedAt}  
Finished: ${data.finishedAt}  
Duration: ${data.durationSeconds} seconds

## Patient Profiles

${data.profiles
  .map(
    (profile) =>
      `- ${profile.key}: ${profile.description}, ${profile.route}, age ${profile.age}, ${profile.sex}, SCr ${profile.creatinine} mg/dL, weight ${profile.weight} kg`
  )
  .join("\n")}

## Summary

- Pass: ${data.summary.pass}
- Review: ${data.summary.review}
- Warn: ${data.summary.warn}
- Issue: ${data.summary.issue}
- Drugs with any issue: ${data.summary.affectedIssueDrugs}
- Drugs with any warning: ${data.summary.affectedWarningDrugs}
- Drugs with any review: ${data.summary.affectedReviewDrugs}
- Safe route-unavailable responses: ${data.summary.observationKinds["route unavailable handled safely"] || 0}

## Source Modes

${renderCounts(data.summary.sourceModes)}

## Statuses

${renderCounts(data.summary.statuses)}

## Issue Kinds

${renderCounts(data.summary.issueKinds)}

## Warning Kinds

${renderCounts(data.summary.warningKinds)}

## Review Kinds

${renderCounts(data.summary.reviewKinds)}

## Drugs With Issues

${renderGroupedDrugs(topIssueDrugs)}

## Drugs With Warnings

${renderGroupedDrugs(topWarnDrugs)}

## Issue Cases

${renderCaseBullets(issueRows.slice(0, 200))}

## Warning Cases

${renderCaseBullets(warnRows.slice(0, 200))}

## Review Cases

${renderCaseBullets(reviewRows.slice(0, 200))}

## Route-Unavailable Safety Sample

These are expected safe responses when an autocomplete drug does not have a DailyMed/openFDA label for the selected route.

${renderCaseBullets(routeUnavailableRows.slice(0, 80), { includeObservations: true })}

## Full Case Table

| # | Drug | Route | Profile | eGFR | CrCl | Verdict | Source mode | Status | Matched title | Dose | Frequency | Notes |
|---:|---|---|---|---:|---:|---|---|---|---|---|---|---|
${data.results
  .map(
    (result) =>
      `| ${[
        result.index,
        result.drug,
        result.route,
        result.profileKey,
        result.egfr,
        result.crcl,
        result.verdict,
        result.sourceMode,
        result.resultStatus,
        result.title,
        result.dose,
        result.frequency,
        [...result.issues, ...result.warnings, ...result.reviews, ...result.observations].join("; "),
      ]
        .map(escapeCell)
        .join(" | ")} |`
  )
  .join("\n")}
`;
}

function renderGroupedDrugs(groups) {
  return groups.length
    ? groups.map((group) => `- ${group.drug}: ${group.count} case(s); ${group.reasons.join("; ")}`).join("\n")
    : "- None";
}

function groupByDrug(rows) {
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.drug) || { drug: row.drug, count: 0, reasons: new Set() };
    group.count += 1;
    for (const reason of [...row.issues, ...row.warnings]) {
      group.reasons.add(reason);
    }
    groups.set(row.drug, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, reasons: [...group.reasons] }))
    .sort((a, b) => b.count - a.count || a.drug.localeCompare(b.drug));
}

function renderCaseBullets(rows, options = {}) {
  return rows.length
    ? rows
        .map((row) => {
          const notes = [
            ...row.issues,
            ...row.warnings,
            ...row.reviews,
            ...(options.includeObservations ? row.observations : []),
          ].join("; ");
          return `- #${row.index} ${row.drug} (${row.route}, ${row.profileKey}, CrCl ${row.crcl}): ${notes || row.resultStatus}`;
        })
        .join("\n")
    : "- None";
}

function renderCounts(counts) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([label, count]) => `- ${label}: ${count}`).join("\n") : "- None";
}

function profileSummary(profile) {
  return {
    key: profile.key,
    description: profile.description,
    age: profile.age,
    sex: profile.sex,
    creatinine: profile.creatinine,
    weight: profile.weight,
    height: profile.height,
    route: profile.route,
  };
}

function pickCase(result) {
  return {
    index: result.index,
    drug: result.drug,
    route: result.route,
    profile: result.profileKey,
    crcl: result.crcl,
    sourceMode: result.sourceMode,
    status: result.resultStatus,
    issues: result.issues,
    warnings: result.warnings,
  };
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

function isDoseBearingStatus(status) {
  return status === "dose_found" || status === "no_renal_adjustment" || status === "review_source";
}

function looksLikeConcreteRegimen(result) {
  const text = compact(`${result.dose || ""} ${result.frequency || ""}`);
  return DOSE_UNIT_PATTERN.test(text) && FREQUENCY_PATTERN.test(text);
}

function detectRouteMismatch(selectedRoute, resultRoute, sourceMode, resultStatus) {
  if (
    sourceMode === "route-not-found" ||
    sourceMode === "free-quota-guard" ||
    sourceMode === "error" ||
    (resultStatus !== "dose_found" && resultStatus !== "no_renal_adjustment")
  ) {
    return "";
  }
  const selected = String(selectedRoute || "").toUpperCase();
  const text = compact(resultRoute).toLowerCase();
  if (selected === "IV" && text && !/\b(?:iv|intravenous)\b/i.test(text)) {
    return "selected IV route not reflected in dose result";
  }
  if (selected === "ORAL" && text && !/\b(?:oral|by mouth)\b/i.test(text)) {
    return "selected oral route not reflected in dose result";
  }
  return "";
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
    } else if (key === "delay-ms" || key === "delay") {
      parsed.delayMs = Number(value);
    } else if (key === "profiles") {
      parsed.profiles = Number(value);
    }
  }
  return parsed;
}

function increment(target, key) {
  const safeKey = key || "unknown";
  target[safeKey] = (target[safeKey] || 0) + 1;
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return compact(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function filePath(url) {
  return fileURLToPath(url);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
