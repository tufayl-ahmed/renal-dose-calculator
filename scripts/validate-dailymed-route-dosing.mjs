import { mkdir, writeFile } from "node:fs/promises";
import { calculateCockcroftGault, calculateEgfrCkdEpi2021 } from "../src/renal.js";
import { DRUG_AUTOCOMPLETE_ITEMS } from "../src/drugAutocompleteData.js";
import { deriveRenalDoseGuidance } from "../src/doseGuidance.js";
import { normalizeAssistPayload } from "../src/llmDoseAssist.js";
import { validateAssistResponse } from "../src/llmDoseAssistCore.js";
import { buildOpenFdaSearches, lookupDrugLabel } from "../functions/api/renal-dose/assist.js";

const DEFAULT_BASE_URL = "https://renal-dose-calculator.pages.dev";
const REPORT_DIR = new URL("../docs/testing/generated/", import.meta.url);
const SUMMARY_DIR = new URL("../docs/clinical-validation/", import.meta.url);
const CASE_COUNT = 100;
const SEED = 20260510;
const TARGET_BY_ROUTE = { ORAL: 50, IV: 50 };
const OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json";
const ROUTES = ["ORAL", "IV"];
const MAX_PREFLIGHT_CANDIDATES = 950;
const MAX_PREFLIGHT_SEARCHES_PER_ROUTE = 5;
const PREFLIGHT_CONCURRENCY = 3;
const CASE_CONCURRENCY = 4;

const EXCLUDED_DRUG_PATTERN =
  /\b(?:topical|cream|ointment|gel|lotion|foam|shampoo|patch|transdermal|ophthalmic|otic|nasal|inhalation|vaginal|rectal|enema|suppositor|rinse|mouthwash|toothpaste|fluoride|irrigation|oxygen|nitrogen|carbon dioxide|extract|allergen|antigen|pollen|leaf|root|flower|skin|homeopathic|technetium|diagnostic|device|citrate bag|zinc oxide|calcium carbonate|citric acid|sodium citrate|phosphate|vitamin|mineral)\b/i;
const INTERNAL_TOKEN_PATTERN = /\b(?:review_source|dose_found|no_renal_adjustment|not_found)\b/i;
const UNRESOLVED_DOSE_PATTERN =
  /\b(?:one-half|half|the)?\s*recommended dose\b|\busual recommended dose\b|\brecommended dose or\b/i;
const RENAL_KEYWORD_PATTERN =
  /\b(?:renal|kidney|creatinine clearance|crcl|clcr|hemodialysis|dialysis|peritoneal|esrd|glomerular filtration|gfr)\b/i;
const NO_ADJUSTMENT_PATTERN =
  /\b(?:no\s+(?:renal\s+)?(?:dosage?|dose)\s+adjustment(?:\s+of\s+[\w\s-]+?)?\s+(?:is\s+)?(?:necessary|required|recommended|needed)|(?:dosage?|dose)\s+adjustment\s+(?:is\s+)?not\s+(?:necessary|required|recommended|needed)|no\s+adjustment\s+(?:is\s+)?(?:necessary|required|recommended|needed))\b/i;
const RENAL_TABLE_PATTERN =
  /\b(?:creatinine clearance|crcl|clcr)\b[\s\S]{0,180}\b(?:[<>≥≤]?\s*\d+\s*(?:-|to|<|mL\/min)|hemodialysis|peritoneal dialysis)\b[\s\S]{0,260}\b(?:mg|g|mcg|units?|q\s*\d+\s*h|every\s+\d+\s+hours?|no\s+dosage\s+adjustment|dose|dosage)\b/i;

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || DEFAULT_BASE_URL;
const caseCount = Number.isFinite(args.limit) ? args.limit : CASE_COUNT;
const startedAt = new Date();

console.log(`Building route-specific eligible pool for ${caseCount} IV/Oral cases...`);
const eligiblePool = await buildEligiblePool({
  targetByRoute: TARGET_BY_ROUTE,
  maxCandidates: Number.isFinite(args.maxCandidates) ? args.maxCandidates : MAX_PREFLIGHT_CANDIDATES,
});
const selectedCases = buildCasesFromPool(eligiblePool, caseCount);

console.log(`Running ${selectedCases.length} web-app dose guidance validations against ${baseUrl}...`);
const results = await runCases(selectedCases, { baseUrl, concurrency: CASE_CONCURRENCY });
const finishedAt = new Date();
const summary = summarize(results, eligiblePool);

await mkdir(REPORT_DIR, { recursive: true });
await mkdir(SUMMARY_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonUrl = new URL(`dailymed-route-dose-validation-${stamp}.json`, REPORT_DIR);
const mdUrl = new URL(`dailymed-route-dose-validation-${stamp}.md`, REPORT_DIR);
const latestJsonUrl = new URL("dailymed-route-dose-validation-latest.json", REPORT_DIR);
const latestMdUrl = new URL("dailymed-route-dose-validation-latest.md", REPORT_DIR);
const summaryUrl = new URL("dailymed-route-dose-validation.md", SUMMARY_DIR);

const payload = {
  baseUrl,
  seed: SEED,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationSeconds: Math.round((finishedAt - startedAt) / 1000),
  units: {
    age: "years",
    sex: "male/female",
    creatinine: "mg/dL",
    weight: "kg",
    route: "IV or Oral only",
  },
  sampling: {
    requestedCases: caseCount,
    selectedCases: selectedCases.length,
    eligiblePoolSize: eligiblePool.length,
    routeTargets: TARGET_BY_ROUTE,
    seed: SEED,
    excludedPattern: String(EXCLUDED_DRUG_PATTERN),
  },
  summary,
  results,
};

const markdown = renderMarkdown(payload, { includeFullRows: true });
const summaryMarkdown = renderMarkdown(payload, { includeFullRows: false });
await writeFile(jsonUrl, JSON.stringify(payload, null, 2));
await writeFile(mdUrl, markdown);
await writeFile(latestJsonUrl, JSON.stringify(payload, null, 2));
await writeFile(latestMdUrl, markdown);
await writeFile(summaryUrl, summaryMarkdown);

console.log(
  JSON.stringify(
    {
      baseUrl,
      total: results.length,
      summary,
      jsonPath: filePath(jsonUrl),
      mdPath: filePath(mdUrl),
      latestJsonPath: filePath(latestJsonUrl),
      latestMdPath: filePath(latestMdUrl),
      summaryPath: filePath(summaryUrl),
    },
    null,
    2
  )
);

async function buildEligiblePool({ targetByRoute, maxCandidates }) {
  const random = mulberry32(SEED + 17);
  const candidates = shuffle(
    DRUG_AUTOCOMPLETE_ITEMS.filter((item) => item?.name && !EXCLUDED_DRUG_PATTERN.test(item.name)),
    random
  ).slice(0, maxCandidates);

  const accepted = [];
  const acceptedByRoute = { ORAL: 0, IV: 0 };
  const queue = candidates.flatMap((item, index) => {
    const firstRoute = index % 2 === 0 ? "ORAL" : "IV";
    return [
      { drug: item.name, route: firstRoute },
      { drug: item.name, route: firstRoute === "ORAL" ? "IV" : "ORAL" },
    ];
  });

  await runQueue(queue, PREFLIGHT_CONCURRENCY, async (candidate) => {
    if (acceptedByRoute[candidate.route] >= targetByRoute[candidate.route]) {
      return;
    }
    const preflight = await probeRouteSpecificLabel(candidate);
    if (!preflight.ok) {
      return;
    }
    accepted.push(preflight);
    acceptedByRoute[candidate.route] += 1;
  });

  for (const route of ROUTES) {
    if (acceptedByRoute[route] < Math.min(targetByRoute[route], Math.floor(caseCount / 2))) {
      throw new Error(`Could not build enough ${route} route-specific DailyMed/openFDA candidates.`);
    }
  }

  return accepted;
}

async function probeRouteSpecificLabel({ drug, route }) {
  const searches = buildOpenFdaSearches(drug, route).slice(0, MAX_PREFLIGHT_SEARCHES_PER_ROUTE);
  for (const search of searches) {
    const data = await fetchOpenFdaSearch(search, 10);
    const label = (data.results || [])
      .filter(isHumanPrescriptionLabel)
      .filter((candidate) => routeMatchesOpenFdaRoute(candidate, route))
      .filter((candidate) => drugLooksMatched(drug, candidate))
      .filter((candidate) => !isExcludedRawLabel(candidate))
      .sort((a, b) => scoreRawLabel(b, drug, route) - scoreRawLabel(a, drug, route))[0];

    if (label) {
      const evidence = getRouteEvidence(label);
      const setId = readOpenFdaArray(label, "spl_set_id")[0] || label.set_id || "";
      return {
        ok: true,
        drug,
        route,
        genericName: readOpenFdaArray(label, "generic_name")[0] || "",
        brandName: readOpenFdaArray(label, "brand_name")[0] || "",
        productType: readOpenFdaArray(label, "product_type")[0] || "",
        dosageForm: readOpenFdaArray(label, "dosage_form")[0] || "",
        effectiveTime: readOpenFdaArray(label, "effective_time")[0] || label.effective_time || "",
        setId,
        sourceUrl: setId
          ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`
          : "",
        routeEvidence: evidence,
      };
    }
  }

  return { ok: false, drug, route };
}

function buildCasesFromPool(pool, count) {
  const random = mulberry32(SEED + 31);
  const byRoute = {
    ORAL: shuffle(pool.filter((item) => item.route === "ORAL"), random),
    IV: shuffle(pool.filter((item) => item.route === "IV"), random),
  };
  const targets = {
    ORAL: Math.min(TARGET_BY_ROUTE.ORAL, Math.floor(count / 2)),
    IV: Math.min(TARGET_BY_ROUTE.IV, count - Math.min(TARGET_BY_ROUTE.ORAL, Math.floor(count / 2))),
  };
  const selected = [...byRoute.ORAL.slice(0, targets.ORAL), ...byRoute.IV.slice(0, targets.IV)];
  return shuffle(selected, random).slice(0, count).map((seed, index) => {
    const patient = randomPatient(random, index);
    const values = { ...patient, drug: seed.drug, route: seed.route };
    return {
      index: index + 1,
      seed,
      patient,
      payload: {
        drug: seed.drug,
        normalizedDrug: {
          original: seed.drug,
          searchTerm: seed.drug,
          displayName: seed.drug,
          source: "route-validation-seed",
          changed: false,
        },
        route: seed.route,
        crcl: calculateCockcroftGault(values),
        egfr: calculateEgfrCkdEpi2021(values),
        age: patient.age,
        sex: patient.sex,
        creatinine: patient.creatinine,
        weight: patient.weight,
        height: null,
        dialysis: "none",
        indication: "any",
        formulation: "any",
      },
    };
  });
}

async function runCases(cases, options) {
  const results = [];
  await runQueue(cases, options.concurrency, async (testCase) => {
    const result = await runCase(testCase, options.baseUrl);
    results[testCase.index - 1] = result;
    console.log(
      `${result.index}/${cases.length} ${result.route} ${result.verdict.toUpperCase()} ${result.drug} CrCl ${result.crcl}`
    );
  });
  return results.filter(Boolean);
}

async function runCase(testCase, baseUrl) {
  const started = Date.now();
  const app = await fetchAppAssist(testCase.payload, baseUrl);
  const normalized = app.data ? normalizeAssistPayload(app.data, testCase.payload) : null;
  const result = normalized?.result || app.data?.result || {};
  const appLabel = app.data?.label || {};
  const appSourceText = compactText(
    app.data?.sourceText ||
      (app.data?.sourceSections || []).map((section) => `${section.heading}: ${section.text}`).join("\n\n")
  );
  const rawLabel = await fetchRawLabelForAppResponse(app.data, testCase);
  const routeEvidence = rawLabel ? getRouteEvidence(rawLabel) : [];
  const routeOk = rawLabel ? routeMatches(rawLabel, testCase.payload.route) : false;
  const drugOk = rawLabel ? drugLooksMatched(testCase.payload.drug, rawLabel) : false;
  const localLabel = await lookupDrugLabel({ drug: testCase.payload.drug, route: testCase.payload.route });
  const deterministicGuidance =
    localLabel.status === "found"
      ? deriveRenalDoseGuidance({ label: localLabel, crcl: testCase.payload.crcl, route: testCase.payload.route })
      : null;
  const sourceText = compactText(
    appSourceText ||
      (localLabel.sections || [])
        .map((section) => `${section.heading}: ${section.fullText || section.text || ""}`)
        .join("\n\n")
  );

  const validation = validateResultAgainstSource({
    testCase,
    app,
    normalized,
    result,
    appLabel,
    rawLabel,
    localLabel,
    deterministicGuidance,
    sourceText,
    routeOk,
    drugOk,
  });

  return {
    index: testCase.index,
    drug: testCase.payload.drug,
    route: testCase.payload.route,
    age: testCase.payload.age,
    sex: testCase.payload.sex,
    scrMgDl: testCase.payload.creatinine,
    weightKg: testCase.payload.weight,
    egfr: testCase.payload.egfr,
    crcl: testCase.payload.crcl,
    verdict: validation.verdict,
    validationStatus: validation.status,
    appStatus: result.status || "",
    sourceMode: app.data?.sourceMode || "",
    appDose: result.dose || normalized?.guidance?.dose || "",
    appFrequency: result.frequency || normalized?.guidance?.interval || "",
    appRenalBand: result.renalBand || "",
    appCautions: result.importantCautions || [],
    matchedTitle: appLabel.title || result.drugName || "",
    matchedGeneric: appLabel.genericName || readOpenFdaArray(rawLabel, "generic_name")[0] || "",
    matchedBrand: appLabel.brandName || readOpenFdaArray(rawLabel, "brand_name")[0] || "",
    productType: appLabel.productType || readOpenFdaArray(rawLabel, "product_type").join("; "),
    dosageForm: readOpenFdaArray(rawLabel, "dosage_form").join("; "),
    routeEvidence: routeEvidence.slice(0, 8),
    sourceUrl: normalized?.sourceUrl || app.data?.sourceUrl || result.sourceUrl || appLabel.sourceUrl || testCase.seed.sourceUrl || "",
    dailyMedSetId: appLabel.setId || result.sourceSetId || testCase.seed.setId || "",
    deterministicGuidanceStatus: deterministicGuidance?.status || "",
    deterministicRecommendation: deterministicGuidance?.recommendation || "",
    deterministicBand: deterministicGuidance?.crclBand || "",
    sourceHasRenalText: RENAL_KEYWORD_PATTERN.test(sourceText),
    sourceHasRenalTable: RENAL_TABLE_PATTERN.test(sourceText),
    sourceHasNoAdjustmentText: NO_ADJUSTMENT_PATTERN.test(sourceText),
    sourceSupport: validation.sourceSupport,
    issues: validation.issues,
    warnings: validation.warnings,
    reviews: validation.reviews,
    durationMs: Date.now() - started,
  };
}

async function fetchAppAssist(payload, baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/renal-dose/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { ok: false, data: null, error: `HTTP ${response.status}` };
    }
    return { ok: true, data: await response.json(), error: "" };
  } catch (error) {
    return { ok: false, data: null, error: error?.message || String(error) };
  }
}

function validateResultAgainstSource({
  testCase,
  app,
  result,
  appLabel,
  localLabel,
  deterministicGuidance,
  sourceText,
  routeOk,
  drugOk,
}) {
  const issues = [];
  const warnings = [];
  const reviews = [];
  let sourceSupport = "not-checked";

  const userVisibleText = compactText(
    [
      result.dose,
      result.frequency,
      result.renalBand,
      result.dialysisNote,
      ...(result.importantCautions || []),
    ].join(" ")
  );
  const displayText = compactText(
    [
      result.status,
      userVisibleText,
    ].join(" ")
  );

  if (!app.ok) {
    issues.push(app.error || "app endpoint failed");
  }
  if (!app.data?.result) {
    issues.push("app returned no dose result");
  }
  if (app.data?.sourceMode === "not-found" || result.status === "not_found") {
    issues.push("app did not find a DailyMed/openFDA label");
  }
  if (app.data?.sourceMode === "route-not-found") {
    issues.push(`app did not find a ${testCase.payload.route} route label`);
  }
  if (!routeOk) {
    issues.push(`matched DailyMed/openFDA label did not confirm ${testCase.payload.route} route/form`);
  }
  if (!drugOk) {
    issues.push("matched label drug name did not resemble requested drug");
  }
  if (INTERNAL_TOKEN_PATTERN.test(userVisibleText)) {
    issues.push("raw internal status token exposed in dose guidance");
  }
  if (UNRESOLVED_DOSE_PATTERN.test(userVisibleText)) {
    issues.push("unresolved recommended-dose phrase exposed");
  }
  if (displayText.length > 900) {
    issues.push("dose guidance text too long for minimal clinical output");
  }
  if (result.status === "dose_found" && (!compactText(result.dose) || !compactText(result.frequency))) {
    issues.push("dose_found result did not include both dose and frequency/action");
  }

  if (localLabel.status === "found" && appLabel.setId && localLabel.setId && appLabel.setId !== localLabel.setId) {
    warnings.push("live app label setId differed from local lookup setId");
  }

  if (deterministicGuidance?.status === "matched") {
    const appCombined = normalizeForEvidence(`${result.dose || ""} ${result.frequency || ""}`);
    const deterministicCombined = normalizeForEvidence(deterministicGuidance.recommendation || "");
    const tableDoseTokens = importantDoseTokens(deterministicCombined);
    const missingTokens = tableDoseTokens.filter((token) => !appCombined.includes(token));
    if (result.status === "no_renal_adjustment" && isNoAdjustmentEquivalent(deterministicGuidance.recommendation)) {
      sourceSupport = "deterministic-table-supported";
    } else if (result.status !== "dose_found") {
      issues.push("DailyMed renal table matched this CrCl, but app did not return dose_found");
    } else if (missingTokens.length > 2) {
      issues.push("app dose/frequency did not agree with deterministic DailyMed table parse");
    } else {
      sourceSupport = "deterministic-table-supported";
    }
  }

  const validated = validateAssistResponse(result, sourceText, {
    drugName: appLabel.title || result.drugName || testCase.payload.drug,
    route: testCase.payload.route,
    renalBand: result.renalBand || `CrCl ${formatNumber(testCase.payload.crcl)} mL/min`,
    crcl: testCase.payload.crcl,
    egfr: testCase.payload.egfr,
    sourceSetId: appLabel.setId || result.sourceSetId || "",
    sourceUrl: appLabel.sourceUrl || result.sourceUrl || "",
  });

  if (result.status === "dose_found") {
    const support = sourceSupportsDoseResult({ result, sourceText });
    if (support.supported) {
      sourceSupport = sourceSupport === "not-checked" ? support.reason : sourceSupport;
    } else if (sourceSupport === "not-checked") {
      reviews.push(support.reason);
      sourceSupport = "needs-source-review";
    }
  }

  if (result.status === "no_renal_adjustment") {
    if (sourceSupport === "deterministic-table-supported") {
      // No-op: table row explicitly says no adjustment/usual regimen for this renal band.
    } else if (NO_ADJUSTMENT_PATTERN.test(sourceText)) {
      sourceSupport = "source-no-adjustment-text";
    } else if (/\b(?:>\s*50|greater than\s+50)\s+(?:see\s+)?usual\s+dosage\b/i.test(sourceText)) {
      sourceSupport = "source-usual-dosage-row";
    } else if (RENAL_TABLE_PATTERN.test(sourceText)) {
      reviews.push("renal table-like source text present; no-adjustment summary needs manual review");
      sourceSupport = "renal-table-no-adjustment-review";
    } else if (!RENAL_KEYWORD_PATTERN.test(sourceText)) {
      sourceSupport = "no-renal-text-in-label-sections";
    } else {
      reviews.push("renal source text present but no-adjustment summary needs manual review");
      sourceSupport = "renal-text-no-adjustment-review";
    }
  }

  if (result.status === "review_source") {
    reviews.push("app asked user to review DailyMed source");
    sourceSupport = sourceSupport === "not-checked" ? "source-review-returned" : sourceSupport;
  }

  if (validated.status === "review_source" && result.status === "dose_found") {
    reviews.push(`validator downgraded dose_found result: ${validated.frequency}`);
  }

  if (/could not be fully verified|verify DailyMed/i.test((result.importantCautions || []).join(" "))) {
    reviews.push("app caution says the summary could not be fully verified against source text");
  }

  const uniqueIssues = [...new Set(issues)];
  const uniqueWarnings = [...new Set(warnings)];
  const uniqueReviews = [...new Set(reviews)];
  const verdict = uniqueIssues.length
    ? uniqueIssues.some((issue) => /route/i.test(issue))
      ? "route_fail"
      : uniqueIssues.some((issue) => /label|drug name/i.test(issue))
        ? "label_fail"
        : "dose_fail"
    : uniqueReviews.length
      ? "source_review"
      : uniqueWarnings.length
        ? "source_review"
        : "pass";

  return {
    verdict,
    status: verdictToStatus(verdict),
    sourceSupport,
    issues: uniqueIssues,
    warnings: uniqueWarnings,
    reviews: uniqueReviews,
  };
}

function isNoAdjustmentEquivalent(value) {
  return /\b(?:no\s+dosage?\s+adjustment|no\s+renal\s+dose\s+adjustment|usual\s+(?:standard\s+)?(?:dosage|dose|regimen)|see\s+usual\s+dosage)\b/i.test(
    value || ""
  );
}

function sourceSupportsDoseResult({ result, sourceText }) {
  const source = normalizeForEvidence(sourceText);
  const dose = normalizeForEvidence(result.dose || "");
  const frequency = normalizeForEvidence(result.frequency || "");
  const combined = normalizeForEvidence(`${result.dose || ""} ${result.frequency || ""}`);

  if (/renal caution|dose reduction|restriction|avoid|contraindicat|not recommended|monitor/i.test(combined)) {
    return RENAL_KEYWORD_PATTERN.test(sourceText)
      ? { supported: true, reason: "renal-action-supported-by-renal-source-text" }
      : { supported: false, reason: "renal action returned but source text lacks renal wording" };
  }

  const tokens = importantDoseTokens(`${dose} ${frequency}`);
  if (!tokens.length) {
    return { supported: false, reason: "no concrete dose/frequency tokens to compare" };
  }
  const matched = tokens.filter((token) => source.includes(token));
  const required = Math.min(tokens.length, Math.max(2, Math.ceil(tokens.length * 0.55)));
  if (matched.length >= required) {
    return { supported: true, reason: "dose-frequency-tokens-found-in-source" };
  }
  return {
    supported: false,
    reason: `dose/frequency tokens not sufficiently found in source (${matched.length}/${tokens.length})`,
  };
}

async function fetchRawLabelForAppResponse(appData, testCase) {
  const setId = appData?.label?.setId || appData?.result?.sourceSetId || extractSetId(appData?.sourceUrl || "");
  if (setId) {
    const bySetId = await fetchOpenFdaBySetId(setId);
    if (bySetId) {
      return bySetId;
    }
  }

  const searches = buildOpenFdaSearches(testCase.payload.drug, testCase.payload.route).slice(0, MAX_PREFLIGHT_SEARCHES_PER_ROUTE);
  for (const search of searches) {
    const data = await fetchOpenFdaSearch(search, 10);
    const label = (data.results || [])
      .filter(isHumanPrescriptionLabel)
      .filter((candidate) => routeMatches(candidate, testCase.payload.route))
      .filter((candidate) => drugLooksMatched(testCase.payload.drug, candidate))
      .sort((a, b) => scoreRawLabel(b, testCase.payload.drug, testCase.payload.route) - scoreRawLabel(a, testCase.payload.drug, testCase.payload.route))[0];
    if (label) {
      return label;
    }
  }
  return null;
}

async function fetchOpenFdaBySetId(setId) {
  const searches = [`set_id:"${setId}"`, `openfda.spl_set_id:"${setId}"`];
  for (const search of searches) {
    const data = await fetchOpenFdaSearch(search, 1);
    if (Array.isArray(data.results) && data.results[0]) {
      return data.results[0];
    }
  }
  return null;
}

async function fetchOpenFdaSearch(search, limit) {
  const params = new URLSearchParams({ search, limit: String(limit) });
  const response = await fetch(`${OPENFDA_LABEL_URL}?${params.toString()}`);
  if (response.status === 404) {
    return { results: [] };
  }
  if (!response.ok) {
    throw new Error(`openFDA request failed: HTTP ${response.status}`);
  }
  return response.json();
}

async function runQueue(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function summarize(results, eligiblePool) {
  const verdicts = countBy(results, (row) => row.verdict);
  const routeCounts = countBy(results, (row) => row.route);
  const sourceModes = countBy(results, (row) => row.sourceMode || "unknown");
  const sourceSupport = countBy(results, (row) => row.sourceSupport || "unknown");
  const issueKinds = {};
  const warningKinds = {};
  const reviewKinds = {};
  for (const result of results) {
    for (const issue of result.issues || []) issueKinds[issue] = (issueKinds[issue] || 0) + 1;
    for (const warning of result.warnings || []) warningKinds[warning] = (warningKinds[warning] || 0) + 1;
    for (const review of result.reviews || []) reviewKinds[review] = (reviewKinds[review] || 0) + 1;
  }
  return {
    total: results.length,
    eligiblePool: eligiblePool.length,
    verdicts,
    routeCounts,
    sourceModes,
    sourceSupport,
    issueKinds,
    warningKinds,
    reviewKinds,
  };
}

function renderMarkdown(report, { includeFullRows }) {
  const issueRows = report.results.filter((row) => row.verdict !== "pass");
  const fullRows = report.results.map((row) =>
    [
      row.index,
      row.drug,
      row.route,
      row.crcl,
      row.egfr,
      row.verdict,
      row.sourceSupport,
      row.appDose,
      row.appFrequency,
      row.matchedGeneric || row.matchedTitle,
      row.dosageForm,
      row.sourceUrl,
      [...row.issues, ...row.warnings, ...row.reviews].join("; "),
    ]
      .map(markdownCell)
      .join(" | ")
  );

  return `# DailyMed Route-Specific Dose Guidance Validation

Generated: ${report.finishedAt.slice(0, 10)}

Target web app: ${report.baseUrl}

Cases: ${report.results.length} synthetic adult drug-route-patient sets.

Units: age in years, sex male/female, serum creatinine mg/dL, weight kg. Routes were restricted to IV or Oral only; no \`All routes\` cases were used.

## Source Basis

- App output came from the web app backend: \`POST /api/renal-dose/assist\`.
- Route/form and label evidence came from openFDA label data and DailyMed label links.
- Each case required route-specific DailyMed/openFDA evidence for the requested route before it entered the 100-case sample.

## Summary

${renderCounts("Verdicts", report.summary.verdicts)}

${renderCounts("Routes", report.summary.routeCounts)}

${renderCounts("Source modes", report.summary.sourceModes)}

${renderCounts("Source support", report.summary.sourceSupport)}

## Interpretation

- \`pass\`: drug and IV/Oral route were found in DailyMed/openFDA evidence, and the app result was supported by source text or deterministic table parsing.
- \`source_review\`: drug and route matched, but the label text or app output needs manual clinical review before calling it source-verified.
- \`route_fail\`: the matched source did not confirm the requested IV/Oral route/form.
- \`label_fail\`: no reliable matching DailyMed/openFDA label was found.
- \`dose_fail\`: a route-matched source was found, but the app dose/action conflicted with or was not supported by the source.

## Non-Pass Cases

${renderCaseBullets(issueRows)}

## Issue Kinds

${renderCounts("Issues", report.summary.issueKinds)}

## Review Kinds

${renderCounts("Reviews", report.summary.reviewKinds)}

## Reproduce

\`\`\`sh
npm run validation:dailymed:routes
\`\`\`

Detailed generated artifacts are written under \`docs/testing/generated/\`.

${includeFullRows ? `## Full Case Table

| # | Drug | Route | CrCl | eGFR | Verdict | Source support | App dose/action | App frequency/instruction | Matched source | Dosage form | DailyMed source | Notes |
|---:|---|---|---:|---:|---|---|---|---|---|---|---|---|
${fullRows.map((row) => `| ${row} |`).join("\n")}
` : ""}
`;
}

function renderCaseBullets(rows) {
  return rows.length
    ? rows
        .slice(0, 100)
        .map(
          (row) =>
            `- #${row.index} ${row.drug} ${row.route}, CrCl ${row.crcl}: ${row.verdict} - ${[
              ...row.issues,
              ...row.warnings,
              ...row.reviews,
            ].join("; ")}`
        )
        .join("\n")
    : "- None";
}

function renderCounts(title, counts) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  return `### ${title}\n\n${entries.length ? entries.map(([label, count]) => `- ${label}: ${count}`).join("\n") : "- None"}`;
}

function randomPatient(random, index) {
  const bands = [
    { age: [22, 45], scr: [0.6, 1.2], weight: [50, 100] },
    { age: [46, 70], scr: [1.1, 2.1], weight: [48, 120] },
    { age: [60, 90], scr: [1.8, 4.8], weight: [42, 105] },
    { age: [35, 85], scr: [2.5, 6], weight: [45, 150] },
  ];
  const band = bands[index % bands.length];
  return {
    age: randomInt(random, band.age[0], band.age[1]),
    sex: random() >= 0.5 ? "male" : "female",
    creatinine: roundTo(randomFloat(random, band.scr[0], band.scr[1]), random() >= 0.5 ? 1 : 2),
    weight: roundTo(randomFloat(random, band.weight[0], band.weight[1]), random() >= 0.6 ? 1 : 0),
  };
}

function routeMatches(label, route) {
  const evidence = getRouteEvidence(label).join(" ").toUpperCase();
  if (route === "IV") {
    return /\b(?:INTRAVENOUS|IV|I\.V\.)\b/.test(evidence);
  }
  if (route === "ORAL") {
    return /\b(?:ORAL|TABLET|TABLETS|CAPSULE|CAPSULES|SOLUTION|SUSPENSION|BY MOUTH)\b/.test(evidence);
  }
  return false;
}

function routeMatchesOpenFdaRoute(label, route) {
  const routes = readOpenFdaArray(label, "route").join(" ").toUpperCase();
  if (route === "IV") {
    return /\b(?:INTRAVENOUS|IV|I\.V\.)\b/.test(routes);
  }
  if (route === "ORAL") {
    return /\bORAL\b/.test(routes);
  }
  return false;
}

function isExcludedRawLabel(label) {
  const text = [
    ...readOpenFdaArray(label, "generic_name"),
    ...readOpenFdaArray(label, "brand_name"),
    ...readOpenFdaArray(label, "substance_name"),
    ...readOpenFdaArray(label, "route"),
    ...readOpenFdaArray(label, "dosage_form"),
    ...(Array.isArray(label.spl_product_data_elements) ? label.spl_product_data_elements : []),
  ].join(" ");
  return EXCLUDED_DRUG_PATTERN.test(text);
}

function getRouteEvidence(label = {}) {
  return [
    ...readOpenFdaArray(label, "route"),
    ...readOpenFdaArray(label, "dosage_form"),
    ...(Array.isArray(label.spl_product_data_elements) ? label.spl_product_data_elements : []),
    ...(Array.isArray(label.package_label_principal_display_panel) ? label.package_label_principal_display_panel : []),
  ]
    .filter(Boolean)
    .map(compactText);
}

function isHumanPrescriptionLabel(label) {
  const productTypes = readOpenFdaArray(label, "product_type").map((value) => value.toUpperCase());
  return productTypes.includes("HUMAN PRESCRIPTION DRUG");
}

function drugLooksMatched(drug, label) {
  const query = normalizeDrugName(drug);
  const names = [
    ...readOpenFdaArray(label, "generic_name"),
    ...readOpenFdaArray(label, "brand_name"),
    ...readOpenFdaArray(label, "substance_name"),
  ].map(normalizeDrugName);
  if (!query || !names.length) {
    return false;
  }
  const queryTokens = query.split(" ").filter((token) => token.length > 3 && token !== "and");
  return names.some((name) => name === query || name.startsWith(`${query} `) || queryTokens.every((token) => name.includes(token)));
}

function scoreRawLabel(label, drug, route) {
  const query = normalizeDrugName(drug);
  const genericNames = readOpenFdaArray(label, "generic_name").map(normalizeDrugName);
  const brandNames = readOpenFdaArray(label, "brand_name").map(normalizeDrugName);
  let score = 0;
  if (genericNames.includes(query)) score += 100;
  if (brandNames.includes(query)) score += 80;
  if (genericNames.some((name) => name.startsWith(`${query} `))) score += 40;
  if (routeMatches(label, route)) score += 60;
  if (readOpenFdaArray(label, "product_type").some((type) => type.toUpperCase() === "HUMAN PRESCRIPTION DRUG")) score += 20;
  return score;
}

function importantDoseTokens(text) {
  return [...new Set(normalizeForEvidence(text).match(/\b(?:\d+(?:\.\d+)?|mg|g|mcg|units|unit|daily|weekly|q\d+h|every|hours?|hour|dose|avoid|contraindicated|monitor|reduce|reduction|adjustment|recommended)\b/g) || [])].filter(
    (token) => !["dose", "every", "hour", "hours", "recommended"].includes(token)
  );
}

function readOpenFdaArray(label, key) {
  return Array.isArray(label?.openfda?.[key]) ? label.openfda[key] : [];
}

function normalizeDrugName(value) {
  return compactText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:hydrochloride|hcl|sodium|calcium|potassium|tablet|tablets|capsule|capsules|injection)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForEvidence(value) {
  return compactText(value)
    .toLowerCase()
    .replace(/q\s*(\d+)\s*h/g, "q$1h")
    .replace(/\bevery\s+(\d+)\s+hours?\b/g, "q$1h")
    .replace(/[^a-z0-9.%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSetId(url) {
  try {
    return new URL(url).searchParams.get("setid") || "";
  } catch {
    return "";
  }
}

function countBy(values, getter) {
  const counts = {};
  for (const value of values) {
    const key = getter(value);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomFloat(random, min, max) {
  return random() * (max - min) + min;
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}

function verdictToStatus(verdict) {
  return {
    pass: "source-verified",
    source_review: "manual-source-review",
    route_fail: "route-form-mismatch",
    label_fail: "label-mismatch",
    dose_fail: "dose-output-mismatch",
  }[verdict] || "unknown";
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (const rawArg of rawArgs) {
    const [key, value = ""] = rawArg.replace(/^--/, "").split("=");
    if (key === "base-url") parsed.baseUrl = value;
    if (key === "limit") parsed.limit = Number(value);
    if (key === "max-candidates") parsed.maxCandidates = Number(value);
  }
  return parsed;
}

function markdownCell(value) {
  return compactText(Array.isArray(value) ? value.join("; ") : value).replace(/\|/g, "\\|");
}

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function filePath(url) {
  return decodeURIComponent(url.pathname);
}
