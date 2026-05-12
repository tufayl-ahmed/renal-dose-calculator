import {
  buildLlmDosePrompt,
  createNoLabelAssistResult,
  parseAndValidateAssistResponse,
} from "../../../src/llmDoseAssistCore.js";
import { deriveRenalDoseGuidance } from "../../../src/doseGuidance.js";

const OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json";
const DAILYMED_DRUG_SEARCH_URL = "https://dailymed.nlm.nih.gov/dailymed/search.cfm";
const PRIMARY_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const FALLBACK_MODEL = "@cf/google/gemma-3-12b-it";
const DEFAULT_FREE_AI_DAILY_REQUEST_LIMIT = 200;
const ASSIST_CACHE_TTL_SECONDS = 60 * 60 * 24;
const LABEL_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const ASSIST_CACHE_VERSION = "v21-full-sweep-fixes";
const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const LABEL_FIELDS = [
  "renal_impairment",
  "dosage_and_administration",
  "dosage_forms_and_strengths",
  "use_in_specific_populations",
  "warnings",
  "warnings_and_cautions",
  "contraindications",
];

const RENAL_KEYWORDS = [
  "renal",
  "kidney",
  "creatinine clearance",
  "crcl",
  "clcr",
  "hemodialysis",
  "dialysis",
  "peritoneal",
  "esrd",
  "impairment",
];

export async function onRequestPost(context) {
  try {
    const requestBody = await context.request.json();
    const patient = sanitizePatient(requestBody);
    const lookupTerm = patient.normalizedDrug?.searchTerm || patient.drug;
    const label = await lookupDrugLabel({ drug: lookupTerm, route: patient.route });

    if (label.status === "route_not_found") {
      const missingLabelSpecial = buildMissingLabelSpecialResult(patient);
      if (missingLabelSpecial) {
        return jsonResponse(buildSpecialPayloadFromMissingLabel(missingLabelSpecial), 200);
      }
      const result = createRouteUnavailableAssistResult({
        drugName: patient.drug,
        route: patient.route,
        sourceUrl: label.sourceUrl,
        message: label.message,
      });
      return jsonResponse(
        {
          result,
          label,
          sourceSections: [],
          sourceText: "",
          sourceUrl: label.sourceUrl,
          sourceMode: "route-not-found",
        },
        200
      );
    }

    if (label.status !== "found") {
      const missingLabelSpecial = buildMissingLabelSpecialResult(patient);
      if (missingLabelSpecial) {
        return jsonResponse(buildSpecialPayloadFromMissingLabel(missingLabelSpecial), 200);
      }
      const result = createNoLabelAssistResult({
        drugName: patient.drug,
        route: patient.route,
        sourceUrl: label.sourceUrl,
      });
      return jsonResponse({ ...result, result, label, sourceMode: "not-found" }, 200);
    }

    const { messages, sourceText } = buildLlmDosePrompt({
      label,
      patient: {
        drug: patient.drug,
        normalizedDrug: patient.normalizedDrug,
        route: patient.route,
        crcl: patient.crcl,
        egfr: patient.egfr,
        dialysis: patient.dialysis,
        indication: patient.indication,
        formulation: patient.formulation,
      },
    });

    const assistCacheKey = buildAssistCacheKey({ patient, label });
    const parserResult = buildParserFallbackResult({ label, patient });
    const specialResult = buildSpecialDrugResult({ label, patient });
    if (specialResult) {
      const specialPayload = {
        result: specialResult,
        label: toPublicLabel(label),
        sourceSections: toPublicSections(label.sections),
        sourceText,
        sourceUrl: label.sourceUrl,
        sourceMode: "dailymed-special-review",
        modelUsed: "",
        freeMode: true,
        freeModeRemaining: null,
      };
      await writeJsonCache(assistCacheKey, specialPayload, ASSIST_CACHE_TTL_SECONDS);
      return jsonResponse(specialPayload, 200);
    }
    if (isCleanParserResult(parserResult)) {
      const parserPayload = {
        result: parserResult,
        label: toPublicLabel(label),
        sourceSections: toPublicSections(label.sections),
        sourceText,
        sourceUrl: label.sourceUrl,
        sourceMode: "dailymed-table-parser",
        modelUsed: "",
        freeMode: true,
        freeModeRemaining: null,
      };
      await writeJsonCache(assistCacheKey, parserPayload, ASSIST_CACHE_TTL_SECONDS);
      return jsonResponse(parserPayload, 200);
    }

    const cachedAssist = await readJsonCache(assistCacheKey);
    if (cachedAssist?.result) {
      return jsonResponse(
        {
          ...cachedAssist,
          label: toPublicLabel(label),
          sourceSections: toPublicSections(label.sections),
          sourceText,
          sourceUrl: label.sourceUrl,
          sourceMode: "cache",
        },
        200
      );
    }

    const quota = await reserveFreeAiCall(context.env);
    if (!quota.allowed) {
      const result = buildReviewSourceResult({
        patient,
        label,
        reason: quota.reason,
      });
      return jsonResponse(
        {
          result,
          label: toPublicLabel(label),
          sourceSections: toPublicSections(label.sections),
          sourceText,
          sourceUrl: label.sourceUrl,
          sourceMode: "free-quota-guard",
        },
        200
      );
    }

    const ai = await runWorkersAi(context.env, messages);
    const aiRaw = ai.raw;
    const aiResult = parseAndValidateAssistResponse(aiRaw, sourceText, {
      drugName: label.title,
      route: routeDisplayName(patient.route),
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      crcl: patient.crcl,
      egfr: patient.egfr,
      sourceSetId: label.setId,
      sourceUrl: label.sourceUrl,
    });
    const parserFallback = parserResult;
    const result = shouldUseParserFallback(aiResult, parserFallback) ? parserFallback : aiResult;
    const sourceMode = result === parserFallback
      ? "dailymed-table-parser-fallback"
      : ai.sourceMode || quota.sourceMode || (context.env?.AI ? "cloudflare-ai" : "no-ai-binding");

    const responsePayload = {
      result,
      label: toPublicLabel(label),
      sourceSections: toPublicSections(label.sections),
      sourceText,
      sourceUrl: label.sourceUrl,
      sourceMode,
      modelUsed: ai.modelUsed || "",
      freeMode: quota.freeMode,
      freeModeRemaining: quota.remaining,
    };
    await writeJsonCache(assistCacheKey, responsePayload, ASSIST_CACHE_TTL_SECONDS);
    return jsonResponse(responsePayload, 200);
  } catch (error) {
    return jsonResponse(
      {
        result: {
          status: "review_source",
          drugName: "Selected drug",
          route: "All routes",
          renalMetricUsed: "crcl",
          renalBand: "",
          dose: "Review DailyMed source",
          frequency: error?.message || "AI-assisted backend failed.",
          dialysisNote: "",
          importantCautions: [],
          sourceSetId: "",
          sourceUrl: "",
        },
        sourceMode: "error",
      },
      200
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function runWorkersAi(env, messages) {
  if (!env?.AI) {
    return {
      raw: JSON.stringify({
        status: "review_source",
        drugName: "Selected drug",
        route: "All routes",
        renalMetricUsed: "crcl",
        renalBand: "",
        dose: "Review DailyMed source",
        frequency: "Cloudflare Workers AI binding is not configured.",
        dialysisNote: "",
        importantCautions: [],
        sourceSetId: "",
        sourceUrl: "",
      }),
      modelUsed: "",
      sourceMode: "no-ai-binding",
    };
  }

  const schema = {
    type: "object",
    properties: {
      status: { type: "string" },
      drugName: { type: "string" },
      route: { type: "string" },
      renalMetricUsed: { type: "string" },
      renalBand: { type: "string" },
      dose: { type: "string" },
      frequency: { type: "string" },
      dialysisNote: { type: "string" },
      importantCautions: { type: "array", items: { type: "string" } },
      sourceSetId: { type: "string" },
      sourceUrl: { type: "string" },
    },
    required: [
      "status",
      "drugName",
      "route",
      "renalMetricUsed",
      "renalBand",
      "dose",
      "frequency",
      "dialysisNote",
      "importantCautions",
      "sourceSetId",
      "sourceUrl",
    ],
  };

  try {
    const primary = await env.AI.run(PRIMARY_MODEL, {
      messages,
      temperature: 0,
      max_tokens: 420,
      guided_json: schema,
    });
    return {
      raw: primary.response || primary,
      modelUsed: PRIMARY_MODEL,
      sourceMode: "cloudflare-ai-small-model",
    };
  } catch {
    const fallback = await env.AI.run(FALLBACK_MODEL, {
      messages,
      temperature: 0,
      max_tokens: 420,
    });
    return {
      raw: fallback.response || fallback,
      modelUsed: FALLBACK_MODEL,
      sourceMode: "cloudflare-ai-fallback-model",
    };
  }
}

export async function lookupDrugLabel({ drug, route }) {
  const data = await fetchOpenFdaLabels(drug, route);
  const matches = Array.isArray(data.results) ? data.results : [];
  const humanPrescriptionMatches = matches.filter(isHumanDrugLabel);
  const routeMatches = filterByRoute(humanPrescriptionMatches, route);
  const hasRouteFilter = route && route !== "ALL";
  if (hasRouteFilter && humanPrescriptionMatches.length && !routeMatches.length) {
    return {
      status: "route_not_found",
      title: drug,
      route: routeDisplayName(route),
      sourceUrl: buildDailyMedSearchUrl(drug),
      message: `No ${routeSentenceName(route)} human DailyMed label was found for ${drug}.`,
      sections: [],
    };
  }

  const label =
    chooseBestLabel(hasRouteFilter ? routeMatches : humanPrescriptionMatches, drug) ||
    (!hasRouteFilter ? chooseBestLabel(matches, drug) : null);

  if (!label) {
    return {
      status: "not_found",
      title: drug,
      sourceUrl: buildDailyMedSearchUrl(drug),
      sections: [],
    };
  }

  return normalizeLabel(label, route, drug);
}

async function fetchOpenFdaLabels(drug, route) {
  const searches = buildOpenFdaSearches(drug, route);
  const hasRouteFilter = route && route !== "ALL";
  let firstDataWithResults = null;
  for (const search of searches) {
    const params = new URLSearchParams({ search, limit: "25" });
    const url = `${OPENFDA_LABEL_URL}?${params.toString()}`;
    const cached = await readJsonCache(url);
    if (cached && Array.isArray(cached.results) && cached.results.length) {
      if (!firstDataWithResults) {
        firstDataWithResults = cached;
      }
      if (!hasRouteFilter || filterByRoute(cached.results.filter(isHumanDrugLabel), route).length) {
        return cached;
      }
      continue;
    }
    const response = await fetchWithRetry(url);
    if (response.status === 404) {
      continue;
    }
    if (!response.ok) {
      throw new Error("openFDA label lookup failed.");
    }
    const data = await response.json();
    if (Array.isArray(data.results) && data.results.length) {
      await writeJsonCache(url, data, LABEL_CACHE_TTL_SECONDS);
      if (!firstDataWithResults) {
        firstDataWithResults = data;
      }
      if (!hasRouteFilter || filterByRoute(data.results.filter(isHumanDrugLabel), route).length) {
        return data;
      }
    }
  }
  return firstDataWithResults || { results: [] };
}

async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  const attempts = retryOptions.attempts || 4;
  let lastResponse = null;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!TRANSIENT_HTTP_STATUSES.has(response.status) || attempt === attempts) {
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        throw error;
      }
    }
    await sleep((retryOptions.baseDelayMs || 350) * attempt);
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw lastError || new Error("Request failed.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildOpenFdaSearches(drug, route) {
  const routeClause = buildOpenFdaRouteClause(route);
  const terms = buildDrugSearchTerms(drug);
  const searches = [];
  for (const productType of ["prescription", "otc"]) {
    const builtSearches = terms.map((term) => ({
      exactSearch: buildOpenFdaExactSearch(term, productType),
      tokenSearch: buildOpenFdaTokenSearch(term, productType),
    }));

    for (const { exactSearch, tokenSearch } of builtSearches) {
      searches.push(
        routeClause && exactSearch ? `${exactSearch} AND ${routeClause}` : null,
        routeClause && tokenSearch ? `${tokenSearch} AND ${routeClause}` : null
      );
    }
    for (const { exactSearch, tokenSearch } of builtSearches) {
      searches.push(exactSearch, tokenSearch);
    }
  }
  return [...new Set(searches.filter(Boolean))];
}

function buildDrugSearchTerms(drug) {
  const corrected = correctCommonLookupTypo(drug);
  const doseStripped = stripDoseFormQualifiers(drug);
  const strengthStripped = stripStrengthSuffixes(drug);
  const correctedStrengthStripped = stripStrengthSuffixes(corrected);
  const phNormalized = normalizePhStrength(drug);
  return uniqueSearchTerms([
    drug,
    corrected,
    doseStripped,
    strengthStripped,
    correctedStrengthStripped,
    phNormalized,
    stripStrengthSuffixes(phNormalized),
  ]);
}

function buildOpenFdaRouteClause(route) {
  if (route === "IV") {
    return 'openfda.route:"INTRAVENOUS"';
  }
  if (route === "ORAL") {
    return 'openfda.route:"ORAL"';
  }
  return "";
}

function uniqueSearchTerms(terms) {
  const seen = new Set();
  return terms
    .map(compactText)
    .filter(Boolean)
    .filter((term) => {
      const key = normalizeNameForScore(term);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function stripDoseFormQualifiers(value) {
  return compactText(value)
    .replace(/\bextended[-\s]+release\b/gi, " ")
    .replace(/\bdelayed[-\s]+release\b/gi, " ")
    .replace(/\bimmediate[-\s]+release\b/gi, " ")
    .replace(/\b(?:oral|po|intravenous|iv|i\.v\.|injection|injectable|tablets?|tabs?|capsules?|caps?|solution|suspension|powder|vials?|prefilled|syringe|er|xr|dr|ir)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripStrengthSuffixes(value) {
  return compactText(value)
    .replace(/\bp\s*h\s*\d+(?:\s+\d+)?\s*$/i, " ")
    .replace(/\b(?:h\s*s|f\s*s)\s*$/i, " ")
    .replace(/\b\d+(?:\s+\d+){0,2}\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhStrength(value) {
  return compactText(value)
    .replace(/\bp\s*h\s+(\d+)\s+(\d+)\b/gi, "pH $1.$2")
    .replace(/\s+/g, " ")
    .trim();
}

function correctCommonLookupTypo(value) {
  const key = normalizeNameForScore(value);
  const corrections = [
    ["ciprofolxacin", "ciprofloxacin"],
    ["tizanidne", "tizanidine"],
    ["oseltamavir", "oseltamivir"],
    ["fosinopirl", "fosinopril"],
    ["olmesartran medoxomil", "olmesartan medoxomil"],
    ["amlodipine and olmesartran medoxomil", "amlodipine and olmesartan medoxomil"],
    ["llevofloxacin", "levofloxacin"],
    ["felopdipine", "felodipine"],
    ["nalxone", "naloxone"],
    ["scolopamine transdermal system", "scopolamine transdermal system"],
    ["gaunfacine", "guanfacine"],
  ];
  const exact = corrections.find(([typo]) => typo === key);
  if (exact) {
    return exact[1];
  }

  let corrected = compactText(value);
  for (const [typo, replacement] of corrections) {
    corrected = corrected.replace(new RegExp(`\\b${escapeRegExp(typo)}\\b`, "gi"), replacement);
  }
  return corrected;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildOpenFdaExactSearch(drug, productType = "prescription") {
  const safeDrug = String(drug || "").replaceAll('"', "");
  return [
    buildProductTypeClause(productType),
    `(${[
      `openfda.generic_name:"${safeDrug}"`,
      `openfda.brand_name:"${safeDrug}"`,
      `openfda.substance_name:"${safeDrug}"`,
    ].join(" OR ")})`,
  ].join(" AND ");
}

function buildOpenFdaTokenSearch(drug, productType = "prescription") {
  const tokens = String(drug || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && token !== "and")
    .slice(0, 4);
  if (tokens.length < 2) {
    return null;
  }

  const fieldQueries = ["openfda.generic_name", "openfda.brand_name", "openfda.substance_name"].map(
    (field) => `(${tokens.map((token) => `${field}:${token}`).join(" AND ")})`
  );

  return [
    buildProductTypeClause(productType),
    `(${fieldQueries.join(" OR ")})`,
  ].join(" AND ");
}

function buildProductTypeClause(productType) {
  return productType === "otc"
    ? 'openfda.product_type:"HUMAN OTC DRUG"'
    : 'openfda.product_type:"HUMAN PRESCRIPTION DRUG"';
}

function normalizeLabel(label, route, lookupTerm) {
  const brandNames = readOpenFdaArray(label, "brand_name");
  const genericNames = readOpenFdaArray(label, "generic_name");
  const routes = readOpenFdaArray(label, "route");
  const setId = readOpenFdaArray(label, "spl_set_id")[0] || label.set_id || label.spl_set_id || "";
  const effectiveTime = readOpenFdaArray(label, "effective_time")[0] || label.effective_time || "";
  const title = brandNames[0] || genericNames[0] || lookupTerm;
  return {
    status: "found",
    title,
    drugName: title,
    genericName: genericNames[0] || "",
    brandName: brandNames[0] || "",
    route: route === "ALL" ? routes.join(", ") : route || routes.join(", "),
    productType: readOpenFdaArray(label, "product_type").join(", "),
    setId,
    effectiveTime,
    sourceUrl: setId
      ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`
      : buildDailyMedSearchUrl(lookupTerm),
    sections: collectRelevantSections(label),
  };
}

function toPublicLabel(label) {
  if (!label || label.status !== "found") {
    return label;
  }
  return {
    ...label,
    sections: toPublicSections(label.sections),
  };
}

function toPublicSections(sections = []) {
  return sections.map((section) => ({
    heading: section.heading,
    hasRenalKeyword: section.hasRenalKeyword,
    text: section.text,
  }));
}

function collectRelevantSections(label) {
  return LABEL_FIELDS.flatMap((field) => {
    const entries = Array.isArray(label[field]) ? label[field] : [];
    return entries
      .map((text) => summarizeSection(field, text))
      .filter((section) => section.text.length > 0);
  }).sort((a, b) => Number(b.hasRenalKeyword) - Number(a.hasRenalKeyword));
}

function summarizeSection(field, text) {
  const cleanText = compactText(text);
  const renalSnippets = extractRenalSnippets(cleanText);
  const hasRenalKeyword = renalSnippets.length > 0;
  return {
    heading: labelizeField(field),
    hasRenalKeyword,
    fullText: cleanText,
    text: hasRenalKeyword ? renalSnippets.join(" ... ") : truncate(cleanText, 900),
  };
}

function extractRenalSnippets(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      return RENAL_KEYWORDS.some((keyword) => lower.includes(keyword));
    })
    .slice(0, 8)
    .map((snippet) => truncate(snippet, 520));
}

function sanitizePatient(body) {
  return {
    drug: compactText(body.drug),
    normalizedDrug: body.normalizedDrug || null,
    route: compactText(body.route) || "ALL",
    crcl: Number(body.crcl),
    egfr: Number(body.egfr),
    age: Number(body.age),
    sex: compactText(body.sex),
    weight: Number(body.weight),
    height: body.height ? Number(body.height) : null,
    dialysis: compactText(body.dialysis) || "none",
    indication: compactText(body.indication) || "any",
    formulation: compactText(body.formulation) || "any",
  };
}

function isHumanDrugLabel(label) {
  const productTypes = readOpenFdaArray(label, "product_type");
  return productTypes.some((type) => ["HUMAN PRESCRIPTION DRUG", "HUMAN OTC DRUG"].includes(type.toUpperCase()));
}

function filterByRoute(labels, route) {
  if (!route || route === "ALL") {
    return labels;
  }
  return labels.filter((label) => {
    const routes = getRouteEvidence(label);
    if (route === "IV") {
      return routes.some(hasIvRouteEvidence);
    }
    if (route === "ORAL") {
      return routes.some(hasOralRouteEvidence);
    }
    return true;
  });
}

function hasIvRouteEvidence(value) {
  return /\b(?:INTRAVENOUS|IV|I\.V\.)\b/i.test(String(value || ""));
}

function hasOralRouteEvidence(value) {
  const text = String(value || "");
  if (/\b(?:ORAL INHALATION|FOR ORAL INHALATION|INHALATION|INHALED|NEBULIZ)/i.test(text)) {
    return false;
  }
  return /\b(?:ORAL|TABLET|TABLETS|CAPSULE|CAPSULES|BY MOUTH)\b/i.test(text);
}

function getRouteEvidence(label) {
  return [
    ...readOpenFdaArray(label, "route"),
    ...readOpenFdaArray(label, "dosage_form"),
    ...(Array.isArray(label.spl_product_data_elements) ? label.spl_product_data_elements : []),
    ...(Array.isArray(label.package_label_principal_display_panel) ? label.package_label_principal_display_panel : []),
  ].filter(Boolean);
}

function chooseBestLabel(labels, drug) {
  if (!Array.isArray(labels) || !labels.length) {
    return null;
  }
  return [...labels].sort((a, b) => scoreLabelMatch(b, drug) - scoreLabelMatch(a, drug))[0];
}

function scoreLabelMatch(label, drug) {
  const query = normalizeNameForScore(drug);
  const brandNames = readOpenFdaArray(label, "brand_name").map(normalizeNameForScore);
  const genericNames = readOpenFdaArray(label, "generic_name").map(normalizeNameForScore);
  const substanceNames = readOpenFdaArray(label, "substance_name").map(normalizeNameForScore);
  const allNames = [...brandNames, ...genericNames, ...substanceNames].filter(Boolean);
  const routeEvidence = getRouteEvidence(label).join(" ").toLowerCase();
  const rawQuery = String(drug || "").toLowerCase();
  const queryIsCombo = /\b(?:and|with)\b|[\/+,;]/.test(query);
  let score = 0;

  if (genericNames.some((name) => name === query)) {
    score += 180;
  }
  if (brandNames.some((name) => name === query)) {
    score += 160;
  }
  if (!queryIsCombo && substanceNames.some((name) => name === query)) {
    score += 45;
  }
  if (allNames.some((name) => name === `${query} hydrochloride` || name === `${query} hcl`)) {
    score += 90;
  }
  if (genericNames.some((name) => name === `${query} sulfate` || name === `${query} sulphate`)) {
    score += 140;
  }
  if (substanceNames.some((name) => name === query)) {
    score += 80;
  }
  if (genericNames.some((name) => name.startsWith(`${query} `))) {
    score += 100;
  }
  if (allNames.some((name) => name.startsWith(`${query} `))) {
    score += 35;
  }
  if (allNames.some((name) => name.includes(query))) {
    score += 15;
  }
  if (!queryIsCombo && genericNames.some((name) => /\b(?:and|with)\b|[\/+,;]/.test(name) && name.includes(query))) {
    score -= 160;
  }
  if (!queryIsCombo && brandNames.some((name) => /\b(?:xr|duo|triple|combination)\b/.test(name)) && genericNames.some((name) => name.includes(query) && /\b(?:and|with)\b|[\/+,;]/.test(name))) {
    score -= 60;
  }
  if (/\b(?:injection|injectable|intravenous|iv|i\.v\.)\b/.test(rawQuery) && /\b(?:injection|injectable|intravenous|iv|i\.v\.)\b/.test(routeEvidence)) {
    score += 65;
  }
  if (/\b(?:oral|tablet|tablets|capsule|capsules)\b/.test(rawQuery) && /\b(?:oral|tablet|tablets|capsule|capsules)\b/.test(routeEvidence)) {
    score += 45;
  }
  if (/\b(?:extended[-\s]+release|er|xr)\b/.test(rawQuery) && /\b(?:extended[-\s]+release|er|xr)\b/.test(routeEvidence)) {
    score += 80;
  }
  return score;
}

function normalizeNameForScore(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDailyMedSearchUrl(drug) {
  const params = new URLSearchParams({ query: drug });
  return `${DAILYMED_DRUG_SEARCH_URL}?${params.toString()}`;
}

function readOpenFdaArray(label, key) {
  return Array.isArray(label.openfda?.[key]) ? label.openfda[key] : [];
}

function labelizeField(field) {
  return field
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function routeDisplayName(route) {
  if (route === "IV") {
    return "IV";
  }
  if (route === "ORAL") {
    return "Oral";
  }
  return "All routes";
}

function selectedRouteDisplayName(route, fallbackRoute) {
  if (route === "IV" || route === "ORAL") {
    return routeDisplayName(route);
  }
  return fallbackRoute || routeDisplayName(route);
}

function routeSentenceName(route) {
  const label = routeDisplayName(route);
  return label === "IV" ? "IV" : label.toLowerCase();
}

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, maxLength) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}…`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}

async function reserveFreeAiCall(env) {
  if (!env?.AI) {
    return { allowed: true, freeMode: true, remaining: null, sourceMode: "no-ai-binding" };
  }

  const freeMode = String(env.AI_FREE_MODE || "true").toLowerCase() !== "false";
  if (!freeMode) {
    return { allowed: true, freeMode: false, remaining: null, sourceMode: "cloudflare-ai" };
  }

  const limit = parsePositiveInteger(env.FREE_AI_DAILY_REQUEST_LIMIT, DEFAULT_FREE_AI_DAILY_REQUEST_LIMIT);
  if (!env.AI_USAGE) {
    return {
      allowed: true,
      freeMode: true,
      remaining: null,
      sourceMode: "cloudflare-ai-small-model",
      reason: "AI_USAGE KV is not configured; using compact prompts and cache-only cost control.",
    };
  }

  const key = `ai-usage:${new Date().toISOString().slice(0, 10)}`;
  const current = parsePositiveInteger(await env.AI_USAGE.get(key), 0);
  if (current >= limit) {
    return {
      allowed: false,
      freeMode: true,
      remaining: 0,
      sourceMode: "free-quota-guard",
      reason: "Free AI daily request guard reached. Review the DailyMed source.",
    };
  }

  await env.AI_USAGE.put(key, String(current + 1), { expirationTtl: 60 * 60 * 48 });
  return {
    allowed: true,
    freeMode: true,
    remaining: Math.max(limit - current - 1, 0),
    sourceMode: "cloudflare-ai-free-guard",
  };
}

function buildReviewSourceResult({ patient, label, reason }) {
  return {
    status: "review_source",
    drugName: label.title || patient.drug || "Selected drug",
    route: routeDisplayName(patient.route),
    renalMetricUsed: "crcl",
    renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
    dose: "Review DailyMed source",
    frequency: reason || "Free AI guard used the source-review fallback.",
    dialysisNote: "",
    importantCautions: [],
    sourceSetId: label.setId || "",
    sourceUrl: label.sourceUrl || "",
  };
}

function createRouteUnavailableAssistResult({ drugName, route, sourceUrl, message }) {
  const routeLabel = routeDisplayName(route);
  return {
    status: "not_found",
    drugName: drugName || "Selected drug",
    route: routeLabel,
    renalMetricUsed: "crcl",
    renalBand: "",
    dose: `No ${routeSentenceName(route)} DailyMed label found`,
    frequency: message || "Try the other route or review DailyMed directly.",
    dialysisNote: "",
    importantCautions: [],
    sourceSetId: "",
    sourceUrl: sourceUrl || buildDailyMedSearchUrl(drugName || ""),
  };
}

function buildSpecialPayloadFromMissingLabel({ result, label, sourceText }) {
  return {
    result,
    label,
    sourceSections: toPublicSections(label.sections),
    sourceText,
    sourceUrl: label.sourceUrl,
    sourceMode: "dailymed-special-review",
    modelUsed: "",
    freeMode: true,
    freeModeRemaining: null,
  };
}

function shouldUseParserFallback(aiResult, parserFallback) {
  if (!parserFallback || parserFallback.status === "review_source" || !isCleanParserResult(parserFallback)) {
    return false;
  }
  return aiResult.status !== "dose_found";
}

function isCleanParserResult(result) {
  return (
    (result?.status === "dose_found" &&
      !hasUnresolvedDosePhrase(result.dose) &&
      !hasVagueParserFrequency(result.frequency) &&
      !hasParserFragmentDose(result.dose)) ||
    result?.status === "no_renal_adjustment"
  );
}

function hasUnresolvedDosePhrase(value) {
  const text = compactText(value).toLowerCase();
  return /\b(?:recommended dose|usual recommended dose|usual dose|one-half recommended dose|half recommended dose|one-quarter recommended dose|quarter recommended dose)\b/.test(text);
}

function hasVagueParserFrequency(value) {
  return /^(?:by indication|use usual adult schedule by indication|usual fixed interval)$/i.test(compactText(value));
}

function hasParserFragmentDose(value) {
  const text = compactText(value);
  return /^(?:renal impairment|patients with renal impairment|use in specific populations)\b/i.test(text) ||
    /\b(?:CrCl|CLcr|creatinine clearance)\s*$/i.test(text) ||
    /[(\[][^)\]]*$/.test(text);
}

function buildParserFallbackResult({ label, patient }) {
  const guidance = deriveRenalDoseGuidance({
    label,
    crcl: patient.crcl,
    route: patient.route,
  });

  if (guidance.status === "matched") {
    const parts = splitDoseAndFrequency(guidance.recommendation);
    return {
      status: "dose_found",
      drugName: label.title || patient.drug || "Selected drug",
      route: routeDisplayName(patient.route),
      renalMetricUsed: "crcl",
      renalBand: guidance.crclBand || `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: parts.dose,
      frequency: parts.frequency,
      dialysisNote: "",
      importantCautions: [],
      sourceSetId: label.setId || "",
      sourceUrl: label.sourceUrl || "",
    };
  }

  if (
    guidance.status === "label_text" &&
    /no renal dose adjustment|label text suggests no renal dose adjustment/i.test(guidance.recommendation)
  ) {
    return {
      status: "no_renal_adjustment",
      drugName: label.title || patient.drug || "Selected drug",
      route: routeDisplayName(patient.route),
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "No renal dose adjustment",
      frequency: "Use usual adult schedule by indication.",
      dialysisNote: "",
      importantCautions: [],
      sourceSetId: label.setId || "",
      sourceUrl: label.sourceUrl || "",
    };
  }

  if (guidance.status === "label_text" && /renal avoidance|contraindication/i.test(guidance.recommendation)) {
    return {
      status: "dose_found",
      drugName: label.title || patient.drug || "Selected drug",
      route: routeDisplayName(patient.route),
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Avoid/restriction language in renal impairment",
      frequency: "Apply label restriction for this renal context.",
      dialysisNote: "",
      importantCautions: [
        "Label contains renal avoidance or contraindication language.",
      ],
      sourceSetId: label.setId || "",
      sourceUrl: label.sourceUrl || "",
    };
  }

  if (guidance.status === "label_text" && /renal caution|dose-reduction|monitoring/i.test(guidance.recommendation)) {
    return {
      status: "dose_found",
      drugName: label.title || patient.drug || "Selected drug",
      route: routeDisplayName(patient.route),
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Renal caution or dose-reduction language in label",
      frequency: "Use lower dose, slower titration, or monitoring as described in source.",
      dialysisNote: "",
      importantCautions: [
        "No simple CrCl table was parsed; label still contains renal caution or dose-reduction wording.",
      ],
      sourceSetId: label.setId || "",
      sourceUrl: label.sourceUrl || "",
    };
  }

  if (guidance.status === "label_text" || guidance.status === "not_available") {
    return {
      status: "no_renal_adjustment",
      drugName: label.title || patient.drug || "Selected drug",
      route: routeDisplayName(patient.route),
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "No renal-specific dose adjustment found",
      frequency: "Use usual adult schedule by indication if otherwise appropriate.",
      dialysisNote: "",
      importantCautions: [
        "DailyMed/openFDA sections returned to the app did not include renal-specific dose adjustment text.",
      ],
      sourceSetId: label.setId || "",
      sourceUrl: label.sourceUrl || "",
    };
  }

  return {
    status: "review_source",
    drugName: label.title || patient.drug || "Selected drug",
    route: routeDisplayName(patient.route),
    renalMetricUsed: "crcl",
    renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
    dose: "Review DailyMed source",
    frequency: guidance.recommendation || "Source review required",
    dialysisNote: "",
    importantCautions: [],
    sourceSetId: label.setId || "",
    sourceUrl: label.sourceUrl || "",
  };
}

export function buildMissingLabelSpecialResult(patient) {
  const requestedName = compactText(
    `${patient.drug || ""} ${patient.normalizedDrug?.searchTerm || ""} ${patient.normalizedDrug?.displayName || ""}`
  ).toLowerCase();

  if (/\bfludarabine\b/.test(requestedName) && /\b(?:tablet|tablets|oral)\b/.test(requestedName)) {
    const sourceUrl =
      "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ac76aca8-e718-4232-92ab-399166ce9e46";
    const dose = buildFludarabineTabletDose(patient.crcl);
    const sourceText =
      "Fludarabine phosphate tablets: recommended adult dose 40 mg/m2 orally daily for five consecutive days every 28 days. Renal impairment: reduce dose by 20% in creatinine clearance 30 to 70 mL/min/1.73 m2; reduce dose by 50% in creatinine clearance <30 mL/min/1.73 m2. Oral dose is different than intravenous dose.";
    const label = {
      status: "found",
      title: "Fludarabine phosphate tablets",
      drugName: "Fludarabine phosphate tablets",
      genericName: "Fludarabine phosphate",
      brandName: "",
      route: "ORAL",
      productType: "HUMAN PRESCRIPTION DRUG",
      setId: "ac76aca8-e718-4232-92ab-399166ce9e46",
      sourceUrl,
      sections: [
        {
          heading: "DailyMed direct label fallback",
          hasRenalKeyword: true,
          fullText: sourceText,
          text: sourceText,
        },
      ],
    };

    return {
      result: {
        status: dose.status,
        drugName: label.title,
        route: "Oral",
        renalMetricUsed: "crcl",
        renalBand: dose.band,
        dose: dose.dose,
        frequency: dose.frequency,
        dialysisNote: "",
        importantCautions: [
          "Oral fludarabine dose is different from IV fludarabine; do not interchange formulations.",
          "Direct DailyMed fallback used because openFDA route lookup did not expose the oral tablet label.",
        ],
        sourceSetId: label.setId,
        sourceUrl,
      },
      label,
      sourceText,
    };
  }

  return null;
}

export function buildSpecialDrugResult({ label, patient }) {
  const requestedName = compactText(
    `${patient.drug || ""} ${patient.normalizedDrug?.searchTerm || ""} ${patient.normalizedDrug?.displayName || ""}`
  ).toLowerCase();
  const correctedRequestedName = correctCommonLookupTypo(requestedName);
  const labelName = compactText(`${label.title || ""} ${label.genericName || ""}`).toLowerCase();
  const name = `${requestedName} ${labelName}`;
  const matchesRequested = (pattern) =>
    pattern.test(requestedName) ||
    (correctedRequestedName !== requestedName && pattern.test(correctedRequestedName)) ||
    (!requestedName && pattern.test(labelName));
  const base = {
    drugName: label.title || patient.drug || "Selected drug",
    route: routeDisplayName(patient.route),
    sourceSetId: label.setId || "",
    sourceUrl: label.sourceUrl || "",
  };

  if (matchesRequested(/\bpertuzumab\b|\bperjeta\b/)) {
    return {
      status: "review_source",
      ...base,
      route: selectedRouteDisplayName(patient.route, "IV"),
      renalMetricUsed: "crcl",
      renalBand: Number.isFinite(patient.crcl) ? `CrCl ${formatNumber(patient.crcl)} mL/min` : "CrCl not available",
      dose: "Review oncology label",
      frequency: "No quick renal dose line should be inferred from the label fragment.",
      dialysisNote: "",
      importantCautions: [
        "Pertuzumab/Perjeta renal labeling is not a simple CrCl dose table; verify full oncology context.",
      ],
      sourceSetId: label.setId || "",
      sourceUrl: label.sourceUrl || "",
    };
  }

  if (matchesRequested(/\bpemetrexed\b|\balimta\b/)) {
    const dose = buildPemetrexedDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV", dose });
  }

  if (matchesRequested(/\bpenicillin\s+g\b|\bpenicillin\b/)) {
    const dose = buildPenicillinGDose(patient.crcl);
    return buildCrclSpecialResult({ base: { ...base, drugName: "Penicillin G potassium" }, route: "IV/IM", dose });
  }

  if (matchesRequested(/\bcarmustine\b|\bbcnu\b/)) {
    const dose = buildCarmustineDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV", dose });
  }

  if (matchesRequested(/\bpiperacillin\b.*\btazobactam\b|\bzosyn\b|\btazocin\b|\bpiptaz\b|\bpip\s*tazo?\b/)) {
    const piptazDose = buildPiperacillinTazobactamDose(patient.crcl);
    if (!piptazDose) {
      return null;
    }
    return {
      status: "dose_found",
      ...base,
      drugName: "Piperacillin and tazobactam",
      route: "IV",
      renalMetricUsed: "crcl",
      renalBand: piptazDose.band,
      dose: piptazDose.dose,
      frequency: piptazDose.frequency,
      dialysisNote: "",
      importantCautions: [
        "Dose option differs for nosocomial pneumonia; review infection-specific regimen.",
        "For hemodialysis, review post-dialysis supplemental dose.",
      ],
    };
  }

  if (matchesRequested(/\bmeropenem\b|\bmerrem\b/)) {
    const meropenemDose = buildMeropenemDose(patient.crcl);
    if (!meropenemDose) {
      return null;
    }
    return {
      status: "dose_found",
      ...base,
      route: "IV",
      renalMetricUsed: "crcl",
      renalBand: meropenemDose.band,
      dose: meropenemDose.dose,
      frequency: meropenemDose.frequency,
      dialysisNote: "",
      importantCautions: [
        "Dose option depends on infection type; review full DailyMed label.",
        "Hemodialysis and peritoneal dialysis data are inadequate in the label.",
      ],
    };
  }

  if (matchesRequested(/\bdaptomycin\b|\bcubicin\b/)) {
    const dose = buildDaptomycinDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV", dose });
  }

  if (matchesRequested(/\blevofloxacin\b|\blevaquin\b|\blevoflox\b/)) {
    const levofloxacinDose = buildLevofloxacinDose(patient.crcl);
    if (!levofloxacinDose) {
      return null;
    }
    return {
      status: levofloxacinDose.status,
      ...base,
      renalMetricUsed: "crcl",
      renalBand: levofloxacinDose.band,
      dose: levofloxacinDose.dose,
      frequency: levofloxacinDose.frequency,
      dialysisNote: "",
      importantCautions: [
        "Choose the row matching the usual normal-renal levofloxacin regimen and indication.",
        "For hemodialysis or CAPD, review the DailyMed renal table and dialysis timing.",
      ],
    };
  }

  if (matchesRequested(/\blevetiracetam\b|\bkeppra\b/)) {
    const dose = buildLevetiracetamDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: selectedRouteDisplayName(patient.route, "Oral/IV"), dose });
  }

  if (matchesRequested(/\btopiramate\b|\btopamax\b/)) {
    const dose = buildTopiramateDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\blisinopril\b|\bprinivil\b|\bzestril\b/)) {
    const dose = buildLisinoprilDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\boxcarbazepine\b|\btrileptal\b|\boxtellar\b/)) {
    const dose = buildOxcarbazepineDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\blovastatin\b|\bmevacor\b|\baltoprev\b/)) {
    const dose = buildLovastatinDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\btadalafil\b|\bcialis\b|\badcirca\b|\balyq\b/)) {
    const dose = buildTadalafilDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bvoriconazole\b|\bvfend\b/)) {
    const dose = buildVoriconazoleDose(patient.crcl, patient.route);
    return buildCrclSpecialResult({ base, route: selectedRouteDisplayName(patient.route, "Oral/IV"), dose });
  }

  if (matchesRequested(/\bgentamicin\b|\bamikacin\b|\btobramycin\b|\bplazomicin\b/)) {
    const dose = buildAminoglycosideDose(patient.crcl, patient.route);
    return buildCrclSpecialResult({ base, route: patient.route === "ORAL" ? "Oral" : "IV/IM", dose });
  }

  if (matchesRequested(/\bcapecitabine\b|\bxeloda\b/)) {
    const dose = buildCapecitabineDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\beribulin\b|\bhalaven\b/)) {
    const dose = buildEribulinDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV", dose });
  }

  if (matchesRequested(/\bentecavir\b|\bbaraclude\b/)) {
    const dose = buildEntecavirDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\btenofovir\s+disoproxil\b|\bviread\b/)) {
    const dose = buildTenofovirDisoproxilDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bertapenem\b|\binvanz\b/)) {
    const dose = buildErtapenemDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV/IM", dose });
  }

  if (matchesRequested(/\bcefepime\b|\bmaxipime\b/)) {
    const dose = buildCefepimeDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV/IM", dose });
  }

  if (matchesRequested(/\bfamciclovir\b|\bfamvir\b/)) {
    const dose = buildFamciclovirDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bplerixafor\b|\bmozobil\b/)) {
    const dose = buildPlerixaforDose(patient.crcl, patient.weight);
    return buildCrclSpecialResult({ base, route: "Subcutaneous", dose });
  }

  if (matchesRequested(/\bdocetaxel\b|\btaxotere\b/)) {
    return buildNoAdjustmentSpecialResult({
      base: { ...base, route: "IV" },
      band: Number.isFinite(patient.crcl) ? `CrCl ${formatNumber(patient.crcl)} mL/min` : "CrCl not available",
      caution: "Docetaxel labeling does not provide a simple CrCl dose adjustment; hepatic function and regimen context drive dosing.",
    });
  }

  if (matchesRequested(/\blorlatinib\b|\blorbrena\b/)) {
    const dose = buildLorlatinibDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (
    matchesRequested(/\btrimethoprim\b|\bproloprim\b/) &&
    !matchesRequested(/\bsulfamethoxazole\b|\bbactrim\b|\bseptra\b|\bco-?trimoxazole\b|\btmp\s*[-/]?\s*smx\b/)
  ) {
    if (patient.route === "IV") {
      return buildCrclSpecialResult({
        base,
        route: "IV",
        dose: {
          status: "review_source",
          band: Number.isFinite(patient.crcl) ? `CrCl ${formatNumber(patient.crcl)} mL/min` : "CrCl not available",
          dose: "Review DailyMed source",
          frequency: "Trimethoprim-only IV renal guidance was not cleanly matched; verify whether TMP-SMX was intended.",
          cautions: ["Do not apply oral trimethoprim-only dosing to an IV request."],
        },
      });
    }
    const dose = buildTrimethoprimDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\ballopurinol\b|\baloprim\b|\bzyloprim\b/)) {
    const dose = buildAllopurinolDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: selectedRouteDisplayName(patient.route, "Oral/IV"), dose });
  }

  if (matchesRequested(/\btopotecan\b|\bhycamtin\b/)) {
    const dose = buildTopotecanDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: selectedRouteDisplayName(patient.route, "IV/Oral"), dose });
  }

  if (matchesRequested(/\bhydroxyurea\b|\bhydrea\b|\bdroxia\b|\bsiklos\b/)) {
    const dose = buildHydroxyureaDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bcobicistat\b|\btybost\b/)) {
    const dose = buildCobicistatDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bolmesartan\b.*\bamlodipine\b.*\bhydrochlorothiazide\b|\bolmesartan\b.*\bhydrochlorothiazide\b.*\bamlodipine\b|\bamlodipine\b.*\bolmesartan\b.*\bhydrochlorothiazide\b|\btribenzor\b/)) {
    const dose = buildOlmesartanAmlodipineHctzDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bamlodipine\b.*\bolmesartan\b|\bolmesartan\b.*\bamlodipine\b|\bazor\b/)) {
    const dose = buildAmlodipineOlmesartanDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bamoxicillin\b(?!.*clavulanate)|\bamoxil\b/)) {
    const dose = buildAmoxicillinDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bcephalexin\b|\bkeflex\b/)) {
    const dose = buildCephalexinDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bcefazolin\b|\bancef\b/)) {
    const dose = buildCefazolinDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV/IM", dose });
  }

  if (matchesRequested(/\bampicillin\b.*\bsulbactam\b|\bunasyn\b/)) {
    const dose = buildAmpicillinSulbactamDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV", dose });
  }

  if (matchesRequested(/\bcefuroxime\b.*\baxetil\b|\bceftin\b/)) {
    const dose = buildCefuroximeAxetilDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bceftriaxone\b|\brocephin\b/)) {
    return buildNoAdjustmentSpecialResult({
      base: { ...base, route: patient.route === "ORAL" ? base.route : "IV/IM" },
      band: Number.isFinite(patient.crcl) ? `CrCl ${formatNumber(patient.crcl)} mL/min` : "CrCl not available",
      caution: "Ceftriaxone label states usual doses generally do not require renal adjustment; do not exceed 2 g/day when significant renal and hepatic dysfunction coexist.",
    });
  }

  if (matchesRequested(/\bcefpodoxime\b|\bvantin\b/)) {
    const dose = buildCefpodoximeDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bcefixime\b|\bsuprax\b/)) {
    const dose = buildCefiximeDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bcefprozil\b|\bcefzil\b/)) {
    const dose = buildCefprozilDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "Oral", dose });
  }

  if (matchesRequested(/\bcefotetan\b/)) {
    const dose = buildCefotetanDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV/IM", dose });
  }

  if (matchesRequested(/\bceftolozane\b.*\btazobactam\b|\bzerbaxa\b/)) {
    const dose = buildCeftolozaneTazobactamDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV", dose });
  }

  if (matchesRequested(/\bceftazidime\b.*\bavibactam\b|\bavycaz\b/)) {
    const dose = buildCeftazidimeAvibactamDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV", dose });
  }

  if (matchesRequested(/\bcefiderocol\b|\bfetroja\b/)) {
    const dose = buildCefiderocolDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV", dose });
  }

  if (matchesRequested(/\baztreonam\b|\bazactam\b/)) {
    if (patient.route === "ORAL") {
      return buildCrclSpecialResult({
        base,
        route: "Oral",
        dose: {
          status: "review_source",
          band: Number.isFinite(patient.crcl) ? `CrCl ${formatNumber(patient.crcl)} mL/min` : "CrCl not available",
          dose: "No oral systemic aztreonam dose",
          frequency: "Review DailyMed source; inhaled aztreonam products should not be treated as oral renal-dose guidance.",
          cautions: ["Select IV if parenteral aztreonam renal dosing is intended."],
        },
      });
    }
    const dose = buildAztreonamDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV/IM", dose });
  }

  if (matchesRequested(/\bimipenem\b.*\bcilastatin\b|\bprimaxin\b/)) {
    const dose = buildImipenemCilastatinDose(patient.crcl);
    return buildCrclSpecialResult({ base, route: "IV", dose });
  }

  if (matchesRequested(/\bacyclovir\b|\bzovirax\b/)) {
    const acyclovirDose = buildAcyclovirDose(patient.crcl, patient.route);
    return {
      status: acyclovirDose.status,
      ...base,
      renalMetricUsed: "crcl",
      renalBand: acyclovirDose.band,
      dose: acyclovirDose.dose,
      frequency: acyclovirDose.frequency,
      dialysisNote: "",
      importantCautions: acyclovirDose.cautions,
    };
  }

  if (matchesRequested(/\bvalacyclovir\b|\bvaltrex\b/)) {
    return {
      status: "review_source",
      ...base,
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Indication-specific renal dosing",
      frequency: "Choose dose from DailyMed table for zoster, genital herpes, or cold sores.",
      dialysisNote: "",
      importantCautions: [
        "Valacyclovir renal dosing changes by indication; do not use one generic dose for all uses.",
      ],
    };
  }

  if (matchesRequested(/\boseltamivir\b|\btamiflu\b/)) {
    const oseltamivirDose = buildOseltamivirDose(patient.crcl);
    return {
      status: oseltamivirDose.status,
      ...base,
      renalMetricUsed: "crcl",
      renalBand: oseltamivirDose.band,
      dose: oseltamivirDose.dose,
      frequency: oseltamivirDose.frequency,
      dialysisNote: "",
      importantCautions: oseltamivirDose.cautions,
    };
  }

  if (matchesRequested(/\bciprofloxacin\b|\bcipro\b/)) {
    const ciprofloxacinDose = buildCiprofloxacinDose(patient.crcl, patient.route);
    return {
      status: ciprofloxacinDose.status,
      ...base,
      renalMetricUsed: "crcl",
      renalBand: ciprofloxacinDose.band,
      dose: ciprofloxacinDose.dose,
      frequency: ciprofloxacinDose.frequency,
      dialysisNote: "",
      importantCautions: ciprofloxacinDose.cautions,
    };
  }

  if (matchesRequested(/\bdoxycycline\b|\bdoxy\b|\bvibramycin\b/)) {
    return buildNoAdjustmentSpecialResult({
      base,
      band: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      caution: "Doxycycline is commonly used without renal adjustment; verify the selected DailyMed label.",
    });
  }

  if (matchesRequested(/\bclindamycin\b|\bcleocin\b/)) {
    return buildNoAdjustmentSpecialResult({
      base,
      band: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      caution: "Clindamycin is commonly used without renal adjustment; verify the selected DailyMed label.",
    });
  }

  if (matchesRequested(/\bazithromycin\b|\bzithromax\b|\bazi\b/)) {
    const azithromycinDose = buildAzithromycinDose(patient.crcl);
    return {
      status: azithromycinDose.status,
      ...base,
      renalMetricUsed: "crcl",
      renalBand: azithromycinDose.band,
      dose: azithromycinDose.dose,
      frequency: azithromycinDose.frequency,
      dialysisNote: "",
      importantCautions: azithromycinDose.cautions,
    };
  }

  if (matchesRequested(/\bmoxifloxacin\b|\bavelox\b/)) {
    return buildNoAdjustmentSpecialResult({
      base,
      band: Number.isFinite(patient.crcl) ? `CrCl ${formatNumber(patient.crcl)} mL/min` : "CrCl not available",
      caution: "Moxifloxacin label describes no meaningful renal pharmacokinetic change, including hemodialysis or CAPD; verify selected label.",
    });
  }

  if (matchesRequested(/\bpregabalin\b|\blyrica\b/)) {
    const pregabalinDose = buildPregabalinDose(patient.crcl);
    return {
      status: pregabalinDose.status,
      ...base,
      renalMetricUsed: "crcl",
      renalBand: pregabalinDose.band,
      dose: pregabalinDose.dose,
      frequency: pregabalinDose.frequency,
      dialysisNote: "",
      importantCautions: pregabalinDose.cautions,
    };
  }

  if (matchesRequested(/\bfamotidine\b|\bpepcid\b/)) {
    const famotidineDose = buildFamotidineDose(patient.crcl);
    return {
      status: famotidineDose.status,
      ...base,
      renalMetricUsed: "crcl",
      renalBand: famotidineDose.band,
      dose: famotidineDose.dose,
      frequency: famotidineDose.frequency,
      dialysisNote: "",
      importantCautions: famotidineDose.cautions,
    };
  }

  if (matchesRequested(/\b(?:sulfamethoxazole\s+(?:and\s+)?trimethoprim|trimethoprim\s+(?:and\s+)?sulfamethoxazole|bactrim|septra|co-?trimoxazole|tmp\s*[-/]?\s*smx)\b/)) {
    const tmpSmxDose = buildTmpSmxDose(patient.crcl);
    return {
      status: tmpSmxDose.status,
      ...base,
      route: selectedRouteDisplayName(patient.route, "Oral/IV"),
      renalMetricUsed: "crcl",
      renalBand: tmpSmxDose.band,
      dose: tmpSmxDose.dose,
      frequency: tmpSmxDose.frequency,
      dialysisNote: "",
      importantCautions: tmpSmxDose.cautions,
    };
  }

  if (matchesRequested(/\bdigoxin\b|\blanoxin\b/)) {
    return {
      status: "review_source",
      ...base,
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Renal/level-based dosing",
      frequency: "Use lower starting dose and monitor serum levels; review DailyMed source.",
      dialysisNote: "",
      importantCautions: [
        "Digoxin dose should not be selected from CrCl alone.",
      ],
    };
  }

  if (matchesRequested(/\bempagliflozin\b|\bjardiance\b/)) {
    const empagliflozinDose = buildEmpagliflozinDose(patient.egfr);
    return {
      status: empagliflozinDose.status,
      ...base,
      renalMetricUsed: "egfr",
      renalBand: empagliflozinDose.band,
      dose: empagliflozinDose.dose,
      frequency: empagliflozinDose.frequency,
      dialysisNote: "",
      importantCautions: empagliflozinDose.cautions,
    };
  }

  if (matchesRequested(/\bvancomycin\b/)) {
    return {
      status: "review_source",
      ...base,
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Monitoring-based dosing",
      frequency: "Use levels/AUC or local vancomycin protocol; review DailyMed source.",
      dialysisNote: "",
      importantCautions: [
        "Vancomycin dosing is individualized and should not be reduced to a single CrCl dose line.",
      ],
    };
  }

  if (matchesRequested(/\bapixaban\b|\beliquis\b/)) {
    return {
      status: "review_source",
      ...base,
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Criteria-based dosing",
      frequency: "Dose depends on indication plus age, weight, and serum creatinine criteria; review DailyMed source.",
      dialysisNote: "",
      importantCautions: [
        "Do not choose apixaban dose from CrCl alone.",
      ],
    };
  }

  if (matchesRequested(/\brivaroxaban\b|\bxarelto\b/)) {
    return {
      status: "review_source",
      ...base,
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Indication-specific renal dosing",
      frequency: "Dose depends on indication and CrCl; review DailyMed source.",
      dialysisNote: "",
      importantCautions: [
        "Do not choose rivaroxaban dose from CrCl alone without the indication.",
      ],
    };
  }

  if (matchesRequested(/\bdabigatran\b|\bpradaxa\b/)) {
    return {
      status: "review_source",
      ...base,
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Indication/P-gp-specific renal dosing",
      frequency: "Dose depends on indication, CrCl, and interacting P-gp inhibitors; review DailyMed source.",
      dialysisNote: "",
      importantCautions: [
        "Do not choose dabigatran dose from CrCl alone without indication and interaction review.",
      ],
    };
  }

  if (matchesRequested(/\benoxaparin\b|\blovenox\b/)) {
    return {
      status: "review_source",
      ...base,
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Indication-specific dosing",
      frequency: "Dose changes by indication and CrCl threshold; review DailyMed source.",
      dialysisNote: "",
      importantCautions: [
        "Enoxaparin renal dosing should not be shown as one generic dose without indication.",
      ],
    };
  }

  if (matchesRequested(/\bmorphine\b|\bms\s*contin\b|\broxanol\b/)) {
    return {
      status: "review_source",
      ...base,
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Renal impairment caution",
      frequency: "Use lower starting dose/titrate cautiously or review alternatives; verify DailyMed source.",
      dialysisNote: "",
      importantCautions: [
        "Morphine active metabolites can accumulate in renal impairment; avoid a single CrCl dose line.",
      ],
    };
  }

  if (matchesRequested(/\bnitrofurantoin\b|\bmacrobid\b|\bmacrodantin\b/)) {
    return {
      status: "review_source",
      ...base,
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Renal restriction/avoidance check",
      frequency: "Review DailyMed contraindications and renal impairment text before use.",
      dialysisNote: "",
      importantCautions: [
        "Nitrofurantoin labels commonly include renal function restrictions; verify current label and local guidance.",
      ],
    };
  }

  if (matchesRequested(/\bsitagliptin\b|\bjanuvia\b/)) {
    const egfr = Number.isFinite(patient.egfr) ? patient.egfr : null;
    const dose = egfr === null
      ? "Review DailyMed source"
      : egfr >= 45
        ? "100 mg"
        : egfr >= 30
          ? "50 mg"
          : "25 mg";
    const band = egfr === null
      ? "eGFR not available"
      : egfr >= 45
        ? "eGFR >= 45"
        : egfr >= 30
          ? "eGFR 30-44"
          : "eGFR < 30 or ESRD";
    return {
      status: egfr === null ? "review_source" : "dose_found",
      ...base,
      renalMetricUsed: "egfr",
      renalBand: band,
      dose,
      frequency: egfr === null ? "Review DailyMed source" : "once daily",
      dialysisNote: "",
      importantCautions: [
        "Sitagliptin renal dosing is based on eGFR; verify current DailyMed label.",
      ],
    };
  }

  if (matchesRequested(/\bmetformin\b|\bglucophage\b/)) {
    const egfr = Number.isFinite(patient.egfr) ? patient.egfr : null;
    const metformin = buildMetforminRenalAction(egfr);
    return {
      status: metformin.status,
      ...base,
      renalMetricUsed: "egfr",
      renalBand: metformin.band,
      dose: metformin.dose,
      frequency: metformin.frequency,
      dialysisNote: "",
      importantCautions: metformin.cautions,
    };
  }

  return null;
}

function buildMeropenemDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return null;
  }

  if (crcl > 50) {
    return {
      band: "CrCl > 50 mL/min",
      dose: "500 mg for cSSSI; 1 g for intra-abdominal or cSSSI due P. aeruginosa",
      frequency: "every 8 hours",
    };
  }
  if (crcl >= 26) {
    return {
      band: "CrCl 26-50 mL/min",
      dose: "500 mg for cSSSI; 1 g for intra-abdominal or cSSSI due P. aeruginosa",
      frequency: "every 12 hours",
    };
  }
  if (crcl >= 10) {
    return {
      band: "CrCl 10-25 mL/min",
      dose: "250 mg for cSSSI; 500 mg for intra-abdominal or cSSSI due P. aeruginosa",
      frequency: "every 12 hours",
    };
  }
  return {
    band: "CrCl < 10 mL/min",
    dose: "250 mg for cSSSI; 500 mg for intra-abdominal or cSSSI due P. aeruginosa",
    frequency: "every 24 hours",
  };
}

function buildPiperacillinTazobactamDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return null;
  }

  if (crcl > 40) {
    return {
      band: "CrCl > 40 mL/min",
      dose: "3.375 g; or 4.5 g for nosocomial pneumonia",
      frequency: "every 6 hours",
    };
  }
  if (crcl >= 20) {
    return {
      band: "CrCl 20-40 mL/min",
      dose: "2.25 g; or 3.375 g for nosocomial pneumonia",
      frequency: "every 6 hours",
    };
  }
  return {
    band: "CrCl < 20 mL/min",
    dose: "2.25 g",
    frequency: "every 8 hours; every 6 hours for nosocomial pneumonia",
  };
}

function buildDaptomycinDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the daptomycin indication-specific renal table.");
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl >= 30 mL/min",
      dose: "cSSSI: 4 mg/kg; S. aureus bloodstream infection: 6 mg/kg",
      frequency: "every 24 hours",
      cautions: ["Select the indication-specific row; review culture, severity, and source-control context."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 30 mL/min, including HD/CAPD",
    dose: "cSSSI: 4 mg/kg; S. aureus bloodstream infection: 6 mg/kg",
    frequency: "every 48 hours",
    cautions: ["On hemodialysis days, administer after completion of hemodialysis when feasible."],
  };
}

function buildCrclSpecialResult({ base, route, dose }) {
  if (!dose) {
    return null;
  }
  return {
    status: dose.status,
    ...base,
    route: route || base.route,
    renalMetricUsed: "crcl",
    renalBand: dose.band,
    dose: dose.dose,
    frequency: dose.frequency,
    dialysisNote: dose.dialysisNote || "",
    importantCautions: dose.cautions || [],
  };
}

function buildPemetrexedDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl before using pemetrexed renal restrictions.");
  }
  if (crcl >= 45) {
    return {
      status: "dose_found",
      band: "CrCl >= 45 mL/min",
      dose: "500 mg/m2 IV",
      frequency: "over 10 minutes on Day 1 of each 21-day cycle",
      cautions: [
        "Do not administer pemetrexed when CrCl is less than 45 mL/min.",
        "Use indication-specific combination, folic acid, vitamin B12, and dexamethasone instructions from the full label.",
      ],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 45 mL/min",
    dose: "Do not administer pemetrexed",
    frequency: "CrCl is below the labeled threshold.",
    cautions: ["DailyMed label warns not to administer pemetrexed when CrCl is less than 45 mL/min."],
  };
}

function buildPenicillinGDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and review the penicillin G renal impairment instructions.");
  }
  if (crcl < 10) {
    return {
      status: "dose_found",
      band: "CrCl < 10 mL/min/1.73 m2",
      dose: "Full loading dose, then one-half loading dose",
      frequency: "every 8 to 10 hours",
      cautions: ["Choose the loading dose from the infection-specific penicillin G table."],
    };
  }
  return {
    status: "review_source",
    band: "CrCl >= 10 mL/min/1.73 m2",
    dose: "Renal adjustment depends on uremia/severity",
    frequency: "If uremic, label suggests full loading dose then one-half loading dose every 4 to 5 hours.",
    cautions: [
      "Penicillin G label states adjustment is generally required only in severe renal impairment.",
      "Use infection-specific dose table and hepatic/renal context.",
    ],
  };
}

function buildCarmustineDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl before using carmustine renal restrictions.");
  }
  if (crcl < 10) {
    return {
      status: "dose_found",
      band: "CrCl < 10 mL/min",
      dose: "Discontinue / do not administer carmustine",
      frequency: "Renal restriction in label.",
      cautions: ["DailyMed label says to discontinue if CrCl is less than 10 mL/min."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl >= 10 mL/min",
    dose: "No simple renal dose reduction table",
    frequency: "Monitor renal function and toxicity; use hematologic-response dose adjustments.",
    cautions: [
      "Evaluate renal function before and during treatment.",
      "For compromised renal function, monitor toxicity more frequently.",
    ],
  };
}

function buildAmoxicillinDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the amoxicillin renal table.");
  }
  if (crcl >= 30) {
    return {
      status: "no_renal_adjustment",
      band: "GFR/CrCl >= 30 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult oral schedule by indication.",
      cautions: ["Avoid the 875 mg dose when GFR/CrCl is below 30 mL/min in the cited label."],
    };
  }
  if (crcl >= 10) {
    return {
      status: "dose_found",
      band: "GFR/CrCl 10-30 mL/min",
      dose: "250 mg or 500 mg, depending on infection severity",
      frequency: "every 12 hours",
      cautions: ["Do not use the 875 mg dose in this renal band."],
    };
  }
  return {
    status: "dose_found",
    band: "GFR/CrCl < 10 mL/min",
    dose: "250 mg or 500 mg, depending on infection severity",
    frequency: "every 24 hours",
    cautions: ["Hemodialysis labels add doses during and at the end of dialysis; verify if applicable."],
  };
}

function buildCephalexinDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the cephalexin renal table.");
  }
  if (crcl >= 60) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 60 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult oral regimen by indication.",
      cautions: ["Avoid reducing cephalexin to a vague 'by indication' line without the renal band."],
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-59 mL/min",
      dose: "Maximum daily dose 1 g/day",
      frequency: "divide per indication-specific regimen",
      cautions: ["Use the infection-specific usual regimen but do not exceed the renal maximum."],
    };
  }
  if (crcl >= 15) {
    return {
      status: "dose_found",
      band: "CrCl 15-29 mL/min",
      dose: "250 mg",
      frequency: "every 8 to 12 hours",
      cautions: [],
    };
  }
  if (crcl >= 5) {
    return {
      status: "dose_found",
      band: "CrCl 5-14 mL/min",
      dose: "250 mg",
      frequency: "every 24 hours",
      cautions: [],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl 1-4 mL/min",
    dose: "250 mg",
    frequency: "every 48 to 60 hours",
    cautions: [],
  };
}

function buildCefazolinDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the cefazolin renal table.");
  }
  if (crcl >= 55) {
    return {
      status: "dose_found",
      band: "CrCl >= 55 mL/min",
      dose: "100% of usual dose after loading dose",
      frequency: "usual adult schedule by indication",
      cautions: ["Give an initial loading dose appropriate to infection severity before renal maintenance adjustment."],
    };
  }
  if (crcl >= 35) {
    return {
      status: "dose_found",
      band: "CrCl 35-54 mL/min",
      dose: "100% of usual dose after loading dose",
      frequency: "at least every 8 hours",
      cautions: ["Give an initial loading dose appropriate to infection severity before renal maintenance adjustment."],
    };
  }
  if (crcl >= 11) {
    return {
      status: "dose_found",
      band: "CrCl 11-34 mL/min",
      dose: "50% of usual dose after loading dose",
      frequency: "every 12 hours",
      cautions: ["Give an initial loading dose appropriate to infection severity before renal maintenance adjustment."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl <= 10 mL/min",
    dose: "50% of usual dose after loading dose",
    frequency: "every 18 to 24 hours",
    cautions: ["Give an initial loading dose appropriate to infection severity before renal maintenance adjustment."],
  };
}

function buildAmpicillinSulbactamDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the ampicillin/sulbactam renal table.");
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl >= 30 mL/min/1.73 m2",
      dose: "1.5-3 g IV/IM",
      frequency: "every 6 to 8 hours",
      cautions: ["Dose is total ampicillin/sulbactam grams; choose dose by infection severity."],
    };
  }
  if (crcl >= 15) {
    return {
      status: "dose_found",
      band: "CrCl 15-29 mL/min/1.73 m2",
      dose: "1.5-3 g IV/IM",
      frequency: "every 12 hours",
      cautions: ["Dose is total ampicillin/sulbactam grams; choose dose by infection severity."],
    };
  }
  if (crcl >= 5) {
    return {
      status: "dose_found",
      band: "CrCl 5-14 mL/min/1.73 m2",
      dose: "1.5-3 g IV/IM",
      frequency: "every 24 hours",
      cautions: ["Dose is total ampicillin/sulbactam grams; choose dose by infection severity."],
    };
  }
  return {
    status: "review_source",
    band: "CrCl < 5 mL/min/1.73 m2",
    dose: "Very severe renal impairment",
    frequency: "Review DailyMed source and dialysis context.",
    cautions: ["DailyMed table does not provide a clean non-dialysis quick row below CrCl 5."],
  };
}

function buildCefuroximeAxetilDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the cefuroxime axetil renal table.");
  }
  if (crcl >= 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 30 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult oral schedule by indication.",
      cautions: ["For hemodialysis, review post-dialysis supplemental dose timing."],
    };
  }
  if (crcl >= 10) {
    return {
      status: "dose_found",
      band: "CrCl 10 to <30 mL/min",
      dose: "100% of usual individual oral dose",
      frequency: "every 24 hours",
      cautions: ["Choose the individual dose by indication, then extend the interval."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 10 mL/min",
    dose: "100% of usual individual oral dose",
    frequency: "every 48 hours",
    cautions: ["For hemodialysis, give an additional standard dose after dialysis per label."],
  };
}

function buildCefpodoximeDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the cefpodoxime renal table.");
  }
  if (crcl >= 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 30 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult oral schedule by indication.",
      cautions: ["If on hemodialysis, review the three-times-weekly after-dialysis regimen."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 30 mL/min",
    dose: "Usual individual oral dose",
    frequency: "every 24 hours",
    cautions: ["Hemodialysis regimen is 3 times weekly after dialysis; verify source if applicable."],
  };
}

function buildCefiximeDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the cefixime renal table.");
  }
  if (crcl >= 60) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 60 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult oral schedule by indication.",
      cautions: ["Below CrCl 60, cefixime label dosing depends on tablet/suspension product."],
    };
  }
  if (crcl >= 21) {
    return {
      status: "dose_found",
      band: "CrCl 21-59 mL/min",
      dose: "13 mL of 100 mg/5 mL suspension or 6.5 mL of 200 mg/5 mL suspension daily",
      frequency: "once daily",
      cautions: ["The cited label notes 400 mg tablets are not appropriate for this renal band."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl <= 20 mL/min",
    dose: "8.6 mL of 100 mg/5 mL suspension or 4.4 mL of 200 mg/5 mL suspension daily",
    frequency: "once daily",
    cautions: ["Continuous peritoneal dialysis uses this severe renal band in the cited label."],
  };
}

function buildCefprozilDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the cefprozil renal table.");
  }
  if (crcl >= 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl 30-120 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult oral schedule by indication.",
      cautions: ["For hemodialysis, administer after dialysis per label."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 30 mL/min",
    dose: "50% of standard oral dose",
    frequency: "standard interval",
    cautions: ["For hemodialysis, administer after dialysis per label."],
  };
}

function buildCefotetanDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the cefotetan renal table.");
  }
  if (crcl > 30) {
    return {
      status: "dose_found",
      band: "CrCl > 30 mL/min",
      dose: "1-2 g IV/IM by infection severity",
      frequency: "every 12 hours",
      cautions: ["Cefotetan label offers renal adjustment by interval extension or dose reduction."],
    };
  }
  if (crcl >= 10) {
    return {
      status: "dose_found",
      band: "CrCl 10-30 mL/min",
      dose: "1-2 g IV/IM q24h option; or 50% of chosen dose q12h option",
      frequency: "choose one label-supported adjustment method",
      cautions: ["Select either interval extension or dose reduction; do not combine both unless clinically intended."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 10 mL/min",
    dose: "1-2 g IV/IM q48h option; or 25% of chosen dose q12h option",
    frequency: "choose one label-supported adjustment method",
    cautions: ["Intermittent hemodialysis has separate day-of-dialysis dosing; review source if applicable."],
  };
}

function buildCeftolozaneTazobactamDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the ceftolozane/tazobactam renal table.");
  }
  if (crcl > 50) {
    return {
      status: "dose_found",
      band: "CrCl > 50 mL/min",
      dose: "1.5 g for cIAI/cUTI; 3 g for HABP/VABP",
      frequency: "every 8 hours",
      cautions: ["Dose is indication-specific; review source before choosing between columns."],
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-50 mL/min",
      dose: "750 mg for cIAI/cUTI; 1.5 g for HABP/VABP",
      frequency: "every 8 hours",
      cautions: ["Dose is indication-specific; review source before choosing between columns."],
    };
  }
  if (crcl >= 15) {
    return {
      status: "dose_found",
      band: "CrCl 15-29 mL/min",
      dose: "375 mg for cIAI/cUTI; 750 mg for HABP/VABP",
      frequency: "every 8 hours",
      cautions: ["Dose is indication-specific; review source before choosing between columns."],
    };
  }
  return {
    status: "review_source",
    band: "CrCl < 15 mL/min or ESRD",
    dose: "ESRD hemodialysis loading/maintenance regimen",
    frequency: "Review DailyMed table; give after dialysis on hemodialysis days.",
    cautions: ["Non-hemodialysis CrCl <15 is not a clean quick-dose row in the label."],
  };
}

function buildCeftazidimeAvibactamDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the ceftazidime/avibactam renal table.");
  }
  if (crcl > 50) {
    return { status: "dose_found", band: "CrCl > 50 mL/min", dose: "2.5 g IV", frequency: "every 8 hours", cautions: ["Use with metronidazole for cIAI per label when indicated."] };
  }
  if (crcl >= 31) {
    return { status: "dose_found", band: "CrCl 31-50 mL/min", dose: "1.25 g IV", frequency: "every 8 hours", cautions: ["Administer after hemodialysis on hemodialysis days if applicable."] };
  }
  if (crcl >= 16) {
    return { status: "dose_found", band: "CrCl 16-30 mL/min", dose: "0.94 g IV", frequency: "every 12 hours", cautions: ["Administer after hemodialysis on hemodialysis days if applicable."] };
  }
  if (crcl >= 6) {
    return { status: "dose_found", band: "CrCl 6-15 mL/min", dose: "0.94 g IV", frequency: "every 24 hours", cautions: ["Administer after hemodialysis on hemodialysis days if applicable."] };
  }
  return { status: "dose_found", band: "CrCl <= 5 mL/min", dose: "0.94 g IV", frequency: "every 48 hours", cautions: ["Administer after hemodialysis on hemodialysis days if applicable."] };
}

function buildCefiderocolDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the cefiderocol renal table.");
  }
  if (crcl >= 120) {
    return { status: "dose_found", band: "CLcr >= 120 mL/min", dose: "2 g IV", frequency: "every 6 hours", cautions: ["Infuse over 3 hours per label."] };
  }
  if (crcl >= 60) {
    return { status: "dose_found", band: "CLcr 60-119 mL/min", dose: "2 g IV", frequency: "every 8 hours", cautions: ["Infuse over 3 hours per label."] };
  }
  if (crcl >= 30) {
    return { status: "dose_found", band: "CLcr 30-59 mL/min", dose: "1.5 g IV", frequency: "every 8 hours", cautions: ["Infuse over 3 hours per label."] };
  }
  if (crcl >= 15) {
    return { status: "dose_found", band: "CLcr 15-29 mL/min", dose: "1 g IV", frequency: "every 8 hours", cautions: ["Infuse over 3 hours per label."] };
  }
  return { status: "dose_found", band: "CLcr < 15 mL/min", dose: "0.75 g IV", frequency: "every 12 hours", cautions: ["Includes intermittent hemodialysis in the cited label; administer after dialysis if applicable."] };
}

function buildAztreonamDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the aztreonam renal table.");
  }
  if (crcl > 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 30 mL/min/1.73 m2",
      dose: "No renal dose adjustment after usual loading dose",
      frequency: "Use usual adult schedule by indication.",
      cautions: ["For serious infections in hemodialysis, review supplemental dose instructions."],
    };
  }
  if (crcl >= 10) {
    return {
      status: "dose_found",
      band: "CrCl 10-30 mL/min/1.73 m2",
      dose: "50% of usual maintenance dose after 1-2 g loading dose",
      frequency: "usual fixed interval",
      cautions: ["Initial loading dose is not reduced in the cited label."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 10 mL/min/1.73 m2",
    dose: "25% of usual maintenance dose after usual initial dose",
    frequency: "usual fixed interval",
    cautions: ["Serious infections in hemodialysis may need a post-dialysis supplement; review source."],
  };
}

function buildImipenemCilastatinDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the imipenem/cilastatin renal table.");
  }
  if (crcl >= 90) {
    return {
      status: "dose_found",
      band: "CrCl >= 90 mL/min",
      dose: "500 mg q6h; 1 g q8h; or 1 g q6h for intermediate susceptibility",
      frequency: "by pathogen susceptibility and indication",
      cautions: ["Select the column based on suspected or proven pathogen susceptibility."],
    };
  }
  if (crcl >= 60) {
    return {
      status: "dose_found",
      band: "CrCl 60-89 mL/min",
      dose: "400 mg q6h; 500 mg q6h; or 750 mg q8h for intermediate susceptibility",
      frequency: "by pathogen susceptibility and indication",
      cautions: ["Select the column based on suspected or proven pathogen susceptibility."],
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-59 mL/min",
      dose: "300 mg q6h; 500 mg q8h; or 500 mg q6h for intermediate susceptibility",
      frequency: "by pathogen susceptibility and indication",
      cautions: ["Select the column based on suspected or proven pathogen susceptibility."],
    };
  }
  if (crcl >= 15) {
    return {
      status: "dose_found",
      band: "CrCl 15-29 mL/min",
      dose: "200 mg q6h; 500 mg q12h; or 500 mg q12h for intermediate susceptibility",
      frequency: "by pathogen susceptibility and indication",
      cautions: ["Seizure risk is higher in renal impairment; review full label."],
    };
  }
  return {
    status: "review_source",
    band: "CrCl < 15 mL/min",
    dose: "Do not use unless hemodialysis is instituted within 48 hours",
    frequency: "Use hemodialysis-specific timing from label if applicable.",
    cautions: ["Imipenem/cilastatin label restricts use below CrCl 15 unless hemodialysis is planned."],
  };
}

function buildMissingCrclReview(message) {
  return {
    status: "review_source",
    band: "CrCl not available",
    dose: "Review DailyMed source",
    frequency: message,
    cautions: [],
  };
}

function buildFludarabineTabletDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return {
      status: "review_source",
      band: "CrCl not available",
      dose: "Review DailyMed source",
      frequency: "Calculate CrCl before using the oral tablet renal adjustment.",
    };
  }

  if (crcl > 70) {
    return {
      status: "dose_found",
      band: "CrCl > 70 mL/min/1.73 m2",
      dose: "40 mg/m2",
      frequency: "daily for 5 days every 28 days",
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-70 mL/min/1.73 m2",
      dose: "Reduce oral dose by 20%",
      frequency: "daily for 5 days every 28 days",
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 30 mL/min/1.73 m2",
    dose: "Reduce oral dose by 50%",
    frequency: "daily for 5 days every 28 days",
  };
}

function buildLevofloxacinDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return null;
  }

  if (crcl >= 50) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 50 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult schedule by indication.",
    };
  }
  if (crcl >= 20) {
    return {
      status: "dose_found",
      band: "CrCl 20-49 mL/min",
      dose: "750 mg q48h; or 500 mg once then 250 mg q24h; or no adjustment for usual 250 mg regimen",
      frequency: "by usual normal-renal regimen",
    };
  }
  if (crcl >= 10) {
    return {
      status: "dose_found",
      band: "CrCl 10-19 mL/min",
      dose: "750 mg once then 500 mg q48h; or 500 mg once then 250 mg q48h; or 250 mg q48h",
      frequency: "by usual normal-renal regimen",
    };
  }
  return {
    status: "review_source",
    band: "CrCl < 10 mL/min",
    dose: "Severe renal impairment / dialysis-specific table",
    frequency: "Review DailyMed table for HD/CAPD and indication-specific regimen.",
  };
}

function buildLevetiracetamDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the levetiracetam adult renal table.");
  }
  if (crcl > 80) {
    return {
      status: "dose_found",
      band: "CrCl > 80 mL/min/1.73 m2",
      dose: "500-1500 mg",
      frequency: "every 12 hours",
      cautions: ["Label table uses creatinine clearance adjusted for body surface area."],
    };
  }
  if (crcl >= 50) {
    return {
      status: "dose_found",
      band: "CrCl 50-80 mL/min/1.73 m2",
      dose: "500-1000 mg",
      frequency: "every 12 hours",
      cautions: ["Label table uses creatinine clearance adjusted for body surface area."],
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-50 mL/min/1.73 m2",
      dose: "250-750 mg",
      frequency: "every 12 hours",
      cautions: ["Label table uses creatinine clearance adjusted for body surface area."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 30 mL/min/1.73 m2",
    dose: "250-500 mg",
    frequency: "every 12 hours; dialysis needs post-HD supplement",
    cautions: ["For ESRD on dialysis, label gives 500-1000 mg every 24 hours plus 250-500 mg after dialysis."],
  };
}

function buildTopiramateDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the topiramate renal dosing section.");
  }
  if (crcl >= 70) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 70 mL/min/1.73 m2",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult schedule by indication.",
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 70 mL/min/1.73 m2",
    dose: "50% of usual dose",
    frequency: "Usual interval by indication; titrate more slowly.",
    cautions: ["Hemodialysis may require a supplemental dose; individualize per label."],
  };
}

function buildLisinoprilDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the lisinopril renal impairment section.");
  }
  if (crcl > 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 30 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult initial dose by indication.",
      cautions: ["Monitor renal function and potassium as described in label warnings."],
    };
  }
  if (crcl >= 10) {
    return {
      status: "dose_found",
      band: "CrCl 10-30 mL/min",
      dose: "50% of usual dose",
      frequency: "once daily initially; titrate to response.",
      cautions: ["Label maximum titration may differ by indication."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 10 mL/min or hemodialysis",
    dose: "2.5 mg",
    frequency: "once daily initially; titrate to response.",
    cautions: ["Includes hemodialysis initial-dose guidance from the label."],
  };
}

function buildOxcarbazepineDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the oxcarbazepine renal impairment section.");
  }
  if (crcl >= 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 30 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult titration schedule by indication.",
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 30 mL/min",
    dose: "300 mg/day",
    frequency: "divided twice daily initially; increase slowly.",
    cautions: ["This is one-half the usual starting dose from the renal impairment section."],
  };
}

function buildLovastatinDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the lovastatin renal impairment section.");
  }
  if (crcl >= 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 30 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult schedule by LDL response.",
      cautions: ["Use lower starting doses with interacting drugs per label."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl 10-30 mL/min",
    dose: "10 mg/day",
    frequency: "once daily initially; titrate cautiously.",
    cautions: ["Severe renal impairment exposure is increased; monitor for myopathy."],
  };
}

function buildTadalafilDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the tadalafil renal impairment section.");
  }
  if (crcl > 50) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 50 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult schedule by indication/product.",
      cautions: ["Tadalafil renal dosing differs for ED as-needed, once-daily ED/BPH, and PAH products."],
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-50 mL/min",
      dose: "Renal dose limit depends on indication/product",
      frequency: "Use the ED, BPH, or PAH renal section for the selected product.",
      cautions: ["Do not collapse tadalafil products into one generic dose."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 30 mL/min or hemodialysis",
    dose: "Severe renal impairment product restriction",
    frequency: "Use product-specific DailyMed limits; some once-daily/PAH uses are not recommended.",
    cautions: ["Tadalafil recommendations differ by product and indication."],
  };
}

function buildVoriconazoleDose(crcl, route) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and review the voriconazole renal impairment section.");
  }
  if (route === "ORAL") {
    return {
      status: "no_renal_adjustment",
      band: `CrCl ${formatNumber(crcl)} mL/min`,
      dose: "No renal dose adjustment for oral dosing",
      frequency: "Use usual oral schedule by indication.",
      cautions: ["IV voriconazole has a renal vehicle caution; route matters."],
    };
  }
  if (crcl < 50) {
    return {
      status: "dose_found",
      band: "CrCl < 50 mL/min",
      dose: "Use oral route when possible",
      frequency: "IV vehicle accumulates; use IV only if benefit justifies risk.",
      cautions: ["Review selected voriconazole product and renal vehicle warning."],
    };
  }
  return {
    status: "no_renal_adjustment",
    band: "CrCl >= 50 mL/min",
    dose: "No renal dose adjustment",
    frequency: "Use usual schedule by route and indication.",
    cautions: ["Review hepatic function and therapeutic drug monitoring context."],
  };
}

function buildAminoglycosideDose(crcl, route) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use institution-specific aminoglycoside dosing with levels.");
  }
  if (route === "ORAL") {
    return {
      status: "review_source",
      band: `CrCl ${formatNumber(crcl)} mL/min`,
      dose: "Route/product-specific review",
      frequency: "Do not apply IV/IM aminoglycoside renal dosing to an oral or inhaled product.",
      cautions: ["Verify the selected DailyMed product and route before using aminoglycoside guidance."],
    };
  }
  return {
    status: "review_source",
    band: `CrCl ${formatNumber(crcl)} mL/min`,
    dose: "Monitoring-based aminoglycoside dosing",
    frequency: "Use institutional extended-interval or conventional dosing protocol with serum levels.",
    cautions: ["Aminoglycoside dosing should not be reduced to one fixed CrCl dose line."],
  };
}

function buildCapecitabineDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl before capecitabine dosing.");
  }
  if (crcl > 50) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 50 mL/min",
      dose: "No renal starting-dose adjustment",
      frequency: "Use usual regimen by oncology protocol.",
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-50 mL/min",
      dose: "75% of usual starting dose",
      frequency: "Use regimen schedule by indication.",
      cautions: ["Monitor toxicity closely; oncology regimen context is required."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 30 mL/min",
    dose: "Contraindicated",
    frequency: "Do not use per renal impairment labeling.",
  };
}

function buildEribulinDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl before eribulin dosing.");
  }
  if (crcl >= 50) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 50 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual oncology regimen.",
    };
  }
  if (crcl >= 15) {
    return {
      status: "dose_found",
      band: "CrCl 15-49 mL/min",
      dose: "1.1 mg/m2",
      frequency: "on days 1 and 8 of a 21-day cycle.",
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 15 mL/min",
    dose: "Dose not established",
    frequency: "Review oncology label and renal context.",
  };
}

function buildEntecavirDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the entecavir renal table.");
  }
  if (crcl >= 50) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 50 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual daily dose by indication.",
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-49 mL/min",
      dose: "Reduce dose or extend interval",
      frequency: "Use 50% daily dose or usual dose every 48 hours.",
    };
  }
  if (crcl >= 10) {
    return {
      status: "dose_found",
      band: "CrCl 10-29 mL/min",
      dose: "Reduce dose or extend interval",
      frequency: "Use reduced daily dose or usual dose every 72 hours.",
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 10 mL/min or dialysis",
    dose: "Reduce dose or extend interval",
    frequency: "Use label dialysis row; give after hemodialysis when applicable.",
  };
}

function buildTenofovirDisoproxilDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use tenofovir disoproxil renal dosing.");
  }
  if (crcl >= 50) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 50 mL/min",
      dose: "No renal dose adjustment",
      frequency: "300 mg once daily.",
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-49 mL/min",
      dose: "300 mg",
      frequency: "every 48 hours.",
    };
  }
  if (crcl >= 10) {
    return {
      status: "dose_found",
      band: "CrCl 10-29 mL/min",
      dose: "300 mg",
      frequency: "every 72-96 hours.",
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 10 mL/min or hemodialysis",
    dose: "Dialysis-specific renal dosing",
    frequency: "Review label; hemodialysis dosing differs from non-dialysis renal impairment.",
  };
}

function buildErtapenemDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl before ertapenem dosing.");
  }
  if (crcl > 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 30 mL/min",
      dose: "No renal dose adjustment",
      frequency: "1 g once daily.",
    };
  }
  return {
    status: "dose_found",
    band: "CrCl <= 30 mL/min or ESRD",
    dose: "500 mg",
    frequency: "once daily.",
    cautions: ["For hemodialysis, review supplemental timing if dose is given before dialysis."],
  };
}

function buildCefepimeDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the cefepime renal table.");
  }
  if (crcl > 60) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 60 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult regimen by indication.",
    };
  }
  return {
    status: "dose_found",
    band: `CrCl ${formatNumber(crcl)} mL/min`,
    dose: "Renal adjustment needed",
    frequency: "Use cefepime maintenance table for the intended normal-renal regimen.",
    cautions: ["Cefepime renal dose depends on the original indication-specific regimen."],
  };
}

function buildFamciclovirDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the famciclovir indication-specific renal table.");
  }
  if (crcl >= 60) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 60 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use indication-specific usual regimen.",
    };
  }
  return {
    status: "dose_found",
    band: `CrCl ${formatNumber(crcl)} mL/min`,
    dose: "Indication-specific renal adjustment needed",
    frequency: "Use the herpes zoster, recurrent genital herpes, or suppression row for this CrCl band.",
  };
}

function buildPlerixaforDose(crcl, weight) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl before plerixafor dosing.");
  }
  if (crcl > 50) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 50 mL/min",
      dose: "No renal dose adjustment",
      frequency: "0.24 mg/kg once daily before apheresis.",
    };
  }
  const maxNote = Number.isFinite(weight) && weight > 0 ? "; do not exceed label maximum" : "";
  return {
    status: "dose_found",
    band: "CrCl <= 50 mL/min",
    dose: "0.16 mg/kg",
    frequency: `once daily before apheresis${maxNote}.`,
  };
}

function buildLorlatinibDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use the lorlatinib renal impairment section.");
  }
  if (crcl >= 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 30 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult schedule.",
    };
  }
  if (crcl >= 15) {
    return {
      status: "dose_found",
      band: "CrCl 15-<30 mL/min",
      dose: "75 mg",
      frequency: "once daily.",
    };
  }
  return {
    status: "review_source",
    band: "CrCl < 15 mL/min",
    dose: "Renal dosing not established",
    frequency: "Review oncology label and specialist context.",
    cautions: ["Do not treat this as a quick-dose recommendation."],
  };
}

function buildTrimethoprimDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl before trimethoprim dosing.");
  }
  if (crcl > 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 30 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult regimen.",
    };
  }
  if (crcl >= 15) {
    return {
      status: "dose_found",
      band: "CrCl 15-30 mL/min",
      dose: "50% of usual dose",
      frequency: "Use usual interval unless label/product specifies otherwise.",
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 15 mL/min",
    dose: "Not recommended",
    frequency: "Avoid use unless specialist/source review supports it.",
  };
}

function buildAllopurinolDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl before allopurinol dosing.");
  }
  if (crcl >= 60) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 60 mL/min",
      dose: "No renal starting-dose reduction",
      frequency: "Titrate by uric acid/indication and tolerability.",
    };
  }
  return {
    status: "dose_found",
    band: `CrCl ${formatNumber(crcl)} mL/min`,
    dose: "Use lower starting dose",
    frequency: "Titrate cautiously with renal function and uric acid monitoring.",
  };
}

function buildTopotecanDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and use product-specific topotecan renal dosing.");
  }
  if (crcl >= 40) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 40 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual oncology regimen by product.",
    };
  }
  if (crcl >= 20) {
    return {
      status: "dose_found",
      band: "CrCl 20-39 mL/min",
      dose: "Renal dose reduction needed",
      frequency: "Use IV/oral product-specific renal row.",
    };
  }
  return {
    status: "review_source",
    band: "CrCl < 20 mL/min",
    dose: "Renal dosing not established",
    frequency: "Review oncology label; no quick dose should be inferred.",
    cautions: ["Do not treat this as a quick-dose recommendation."],
  };
}

function buildHydroxyureaDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl before hydroxyurea dosing.");
  }
  if (crcl >= 60) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 60 mL/min",
      dose: "15 mg/kg",
      frequency: "once daily initial dose; individualize by indication and blood counts.",
      cautions: ["Base dose on actual or ideal body weight, whichever is less, per label."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 60 mL/min or ESRD",
    dose: "7.5 mg/kg",
    frequency: "once daily initial dose; give after hemodialysis on dialysis days.",
    cautions: ["This corresponds to a 50% renal dose reduction; monitor hematologic parameters closely."],
  };
}

function buildCobicistatDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl/eCrCl before cobicistat-containing therapy.");
  }
  if (crcl < 70) {
    return {
      status: "dose_found",
      band: "CrCl < 70 mL/min",
      dose: "150 mg",
      frequency: "once daily with atazanavir or darunavir and food; not recommended with TDF when CrCl is below 70 mL/min.",
      cautions: ["Cobicistat is a booster; review the coadministered antiretroviral label."],
    };
  }
  return {
    status: "no_renal_adjustment",
    band: "CrCl >= 70 mL/min",
    dose: "150 mg",
    frequency: "once daily with atazanavir or darunavir and food.",
    cautions: ["Assess CrCl and review other antiretrovirals in the regimen."],
  };
}

function buildOlmesartanAmlodipineHctzDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl before olmesartan/amlodipine/hydrochlorothiazide use.");
  }
  if (crcl <= 30) {
    return {
      status: "dose_found",
      band: "CrCl <= 30 mL/min",
      dose: "Avoid use",
      frequency: "Use an alternative antihypertensive plan; hydrochlorothiazide-containing label advises avoiding this renal band.",
    };
  }
  return {
    status: "no_renal_adjustment",
    band: "CrCl > 30 mL/min",
    dose: "No renal dose adjustment",
    frequency: "Dose once daily; titrate every 2 weeks up to 40/10/25 mg if appropriate.",
    cautions: ["Dose selection should be individualized based on previous therapy."],
  };
}

function buildAmlodipineOlmesartanDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return buildMissingCrclReview("Calculate CrCl and review renal function context.");
  }
  return {
    status: "no_renal_adjustment",
    band: `CrCl ${formatNumber(crcl)} mL/min`,
    dose: "No CrCl dose table in label",
    frequency: "Usual starting dose is 5/20 mg once daily; titrate up to 10/40 mg once daily if appropriate.",
    cautions: ["Monitor renal function in severe renal impairment and review pregnancy warning."],
  };
}

function buildAcyclovirDose(crcl, route) {
  if (!Number.isFinite(crcl)) {
    return {
      status: "review_source",
      band: "CrCl not available",
      dose: "Review DailyMed source",
      frequency: "Calculate CrCl and use the renal interval table.",
      cautions: [],
    };
  }

  if (route !== "IV") {
    return {
      status: "review_source",
      band: `CrCl ${formatNumber(crcl)} mL/min`,
      dose: "Route/indication-specific renal dosing",
      frequency: "Review DailyMed table for the selected acyclovir product.",
      cautions: ["Acyclovir oral and IV products use different renal adjustment tables."],
    };
  }

  if (crcl > 50) {
    return {
      status: "dose_found",
      band: "CrCl > 50 mL/min",
      dose: "100% of usual dose by indication",
      frequency: "every 8 hours",
      cautions: ["Acyclovir IV dose is weight/indication-based; this adjusts the interval only."],
    };
  }
  if (crcl >= 25) {
    return {
      status: "dose_found",
      band: "CrCl 25-50 mL/min",
      dose: "100% of usual dose by indication",
      frequency: "every 12 hours",
      cautions: ["Acyclovir IV dose is weight/indication-based; this adjusts the interval only."],
    };
  }
  if (crcl >= 10) {
    return {
      status: "dose_found",
      band: "CrCl 10-24 mL/min",
      dose: "100% of usual dose by indication",
      frequency: "every 24 hours",
      cautions: ["Acyclovir IV dose is weight/indication-based; this adjusts the interval only."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 10 mL/min",
    dose: "50% of usual dose by indication",
    frequency: "every 24 hours",
    cautions: ["Acyclovir IV dose is weight/indication-based; review dialysis timing if applicable."],
  };
}

function buildOseltamivirDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return {
      status: "review_source",
      band: "CrCl not available",
      dose: "Review DailyMed source",
      frequency: "Calculate CrCl and use the renal dosing table.",
      cautions: [],
    };
  }

  if (crcl > 60) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 60 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Treatment 75 mg twice daily; prophylaxis 75 mg once daily.",
      cautions: ["Oseltamivir dose depends on treatment versus prophylaxis."],
    };
  }
  if (crcl > 30) {
    return {
      status: "dose_found",
      band: "CrCl > 30-60 mL/min",
      dose: "Treatment 30 mg; prophylaxis 30 mg",
      frequency: "treatment twice daily; prophylaxis once daily",
      cautions: ["Oseltamivir dose depends on treatment versus prophylaxis."],
    };
  }
  if (crcl > 10) {
    return {
      status: "dose_found",
      band: "CrCl > 10-30 mL/min",
      dose: "Treatment 30 mg; prophylaxis 30 mg",
      frequency: "treatment once daily; prophylaxis every other day",
      cautions: ["Oseltamivir dose depends on treatment versus prophylaxis."],
    };
  }
  return {
    status: "review_source",
    band: "CrCl <= 10 mL/min or ESRD",
    dose: "ESRD/dialysis-specific dosing",
    frequency: "Review DailyMed table for hemodialysis, CAPD, or ESRD not on dialysis.",
    cautions: ["Do not infer oseltamivir ESRD dosing from non-dialysis CrCl bands."],
  };
}

function buildCiprofloxacinDose(crcl, route) {
  if (!Number.isFinite(crcl)) {
    return {
      status: "review_source",
      band: "CrCl not available",
      dose: "Review DailyMed source",
      frequency: "Calculate CrCl and use the renal dosing table.",
      cautions: [],
    };
  }

  if (route === "IV") {
    if (crcl > 30) {
      return {
        status: "no_renal_adjustment",
        band: "CrCl > 30 mL/min",
        dose: "No renal dose adjustment",
        frequency: "Use usual IV regimen by indication.",
        cautions: ["For serious infections, verify indication-specific ciprofloxacin regimen."],
      };
    }
    if (crcl >= 5) {
      return {
        status: "dose_found",
        band: "CrCl 5-29 mL/min",
        dose: "200-400 mg IV",
        frequency: "every 18-24 hours",
        cautions: ["For hemodialysis or peritoneal dialysis, review post-dialysis timing."],
      };
    }
    return {
      status: "review_source",
      band: "CrCl < 5 mL/min or dialysis",
      dose: "Dialysis-specific IV dosing",
      frequency: "Review DailyMed source.",
      cautions: ["Ciprofloxacin dialysis dosing requires source review."],
    };
  }

  if (crcl > 50) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 50 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual oral regimen by indication.",
      cautions: ["Verify indication-specific ciprofloxacin regimen."],
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-50 mL/min",
      dose: "250-500 mg oral",
      frequency: "every 12 hours",
      cautions: ["Verify indication-specific ciprofloxacin regimen."],
    };
  }
  if (crcl >= 5) {
    return {
      status: "dose_found",
      band: "CrCl 5-29 mL/min",
      dose: "250-500 mg oral",
      frequency: "every 18 hours",
      cautions: ["For dialysis, review DailyMed timing."],
    };
  }
  return {
    status: "review_source",
    band: "CrCl < 5 mL/min or dialysis",
    dose: "Dialysis-specific oral dosing",
    frequency: "Review DailyMed source.",
    cautions: ["Ciprofloxacin dialysis dosing requires source review."],
  };
}

function buildAzithromycinDose(crcl) {
  return {
    status: "no_renal_adjustment",
    band: Number.isFinite(crcl) ? `CrCl ${formatNumber(crcl)} mL/min` : "CrCl not available",
    dose: "No renal dose adjustment",
    frequency: "Use usual adult dosing by indication.",
    cautions: Number.isFinite(crcl) && crcl < 10
      ? ["Use caution in severe renal impairment; verify the selected azithromycin DailyMed label."]
      : ["Verify the selected azithromycin DailyMed label."],
  };
}

function buildPregabalinDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return {
      status: "review_source",
      band: "CrCl not available",
      dose: "Review DailyMed source",
      frequency: "Calculate CrCl and use the pregabalin renal table.",
      cautions: [],
    };
  }

  if (crcl >= 60) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 60 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual daily dose by indication.",
      cautions: ["Pregabalin total daily dose depends on indication and target dose."],
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-60 mL/min",
      dose: "75-300 mg/day",
      frequency: "divided BID or TID",
      cautions: ["Use the row corresponding to the intended normal-renal pregabalin daily dose."],
    };
  }
  if (crcl >= 15) {
    return {
      status: "dose_found",
      band: "CrCl 15-30 mL/min",
      dose: "25-150 mg/day",
      frequency: "once daily or divided BID",
      cautions: ["Use the row corresponding to the intended normal-renal pregabalin daily dose."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 15 mL/min",
    dose: "25-75 mg/day",
    frequency: "once daily",
    cautions: ["For hemodialysis, review the supplemental post-dialysis dose table."],
  };
}

function buildFamotidineDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return {
      status: "review_source",
      band: "CrCl not available",
      dose: "Review DailyMed source",
      frequency: "Calculate CrCl and use the famotidine renal table.",
      cautions: [],
    };
  }

  if (crcl >= 60) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl >= 60 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual adult dosing by indication.",
      cautions: ["Famotidine dosing varies by indication and product."],
    };
  }
  if (crcl >= 30) {
    return {
      status: "dose_found",
      band: "CrCl 30-59 mL/min",
      dose: "Reduce dose or extend interval",
      frequency: "Reduce dose or extend interval using the selected indication/product row.",
      cautions: ["Famotidine renal adjustment is indication/product-specific."],
    };
  }
  return {
    status: "dose_found",
    band: "CrCl < 30 mL/min",
    dose: "Reduce dose or extend interval",
    frequency: "Further reduce dose or extend interval using the selected indication/product row.",
    cautions: ["Famotidine renal adjustment is indication/product-specific."],
  };
}

function buildTmpSmxDose(crcl) {
  if (!Number.isFinite(crcl)) {
    return {
      status: "review_source",
      band: "CrCl not available",
      dose: "Review DailyMed source",
      frequency: "Calculate CrCl and use the TMP-SMX renal table.",
      cautions: [],
    };
  }

  if (crcl > 30) {
    return {
      status: "no_renal_adjustment",
      band: "CrCl > 30 mL/min",
      dose: "No renal dose adjustment",
      frequency: "Use usual regimen by indication.",
      cautions: ["TMP-SMX dose depends on indication and tablet/suspension strength."],
    };
  }
  if (crcl >= 15) {
    return {
      status: "dose_found",
      band: "CrCl 15-30 mL/min",
      dose: "50% of usual regimen",
      frequency: "by indication",
      cautions: ["TMP-SMX dose depends on indication and tablet/suspension strength."],
    };
  }
  return {
    status: "review_source",
    band: "CrCl < 15 mL/min",
    dose: "Use not recommended",
    frequency: "Review DailyMed source.",
    cautions: ["TMP-SMX labeling commonly recommends avoiding use below CrCl 15 mL/min."],
  };
}

function buildEmpagliflozinDose(egfr) {
  if (!Number.isFinite(egfr)) {
    return {
      status: "review_source",
      band: "eGFR not available",
      dose: "Review eGFR-based guidance",
      frequency: "Calculate eGFR and review DailyMed source.",
      cautions: [],
    };
  }

  if (egfr >= 30) {
    return {
      status: "no_renal_adjustment",
      band: "eGFR >= 30",
      dose: "No renal dose adjustment",
      frequency: "Usual adult dosing by indication; verify label.",
      cautions: ["Empagliflozin renal restrictions are eGFR and indication-specific."],
    };
  }
  return {
    status: "review_source",
    band: "eGFR < 30",
    dose: "Indication-specific renal restriction",
    frequency: "Review DailyMed source before use.",
    cautions: ["Use for glycemic control is generally not recommended at low eGFR; other indications may differ by label."],
  };
}

function buildNoAdjustmentSpecialResult({ base, band, caution }) {
  return {
    status: "no_renal_adjustment",
    ...base,
    renalMetricUsed: "crcl",
    renalBand: band,
    dose: "No renal dose adjustment",
    frequency: "Use usual adult dosing by indication.",
    dialysisNote: "",
    importantCautions: [caution],
  };
}

function buildMetforminRenalAction(egfr) {
  const contrastCaution =
    Number.isFinite(egfr) && egfr >= 30 && egfr <= 60
      ? ["For iodinated contrast procedures at eGFR 30-60, review hold/restart instructions."]
      : [];
  const standardCautions = [
    "Metformin renal guidance is eGFR restriction-based, not CrCl dose-band based.",
    ...contrastCaution,
  ];

  if (!Number.isFinite(egfr)) {
    return {
      status: "review_source",
      band: "eGFR not available",
      dose: "Review eGFR-based renal guidance",
      frequency: "Calculate eGFR and review DailyMed source.",
      cautions: standardCautions,
    };
  }

  if (egfr < 30) {
    return {
      status: "dose_found",
      band: "eGFR < 30",
      dose: "Contraindicated / discontinue",
      frequency: "Do not use; review DailyMed source.",
      cautions: standardCautions,
    };
  }

  if (egfr < 45) {
    return {
      status: "dose_found",
      band: "eGFR 30-44",
      dose: "Do not initiate",
      frequency: "If already taking, assess benefit/risk of continuation.",
      cautions: standardCautions,
    };
  }

  return {
    status: "no_renal_adjustment",
    band: "eGFR >= 45",
    dose: "No renal dose adjustment",
    frequency: "Use usual adult dosing by product/clinical plan; monitor eGFR periodically.",
    cautions: standardCautions,
  };
}

function splitDoseAndFrequency(text) {
  const cleaned = compactText(text);
  if (/% of usual daily dose/i.test(cleaned)) {
    return {
      dose: cleaned,
      frequency: /after loading dose/i.test(cleaned) ? "after loading dose; then daily dose by indication" : "daily dose by indication",
    };
  }
  const mgPerDay = cleaned.match(/^(\d+(?:\.\d+)?\s*(?:to|-|–|—)\s*\d+(?:\.\d+)?\s*mg\/day)\s*;\s*(.+)$/i);
  if (mgPerDay) {
    return {
      dose: mgPerDay[1],
      frequency: mgPerDay[2],
    };
  }
  const repeatedEvery = cleaned.match(/\b(?:one-half\s+)?(?:recommended dose|\d+(?:\.\d+)?\s*(?:mg|g|mcg|units?))(?:\s+or\s+\d+(?:\.\d+)?\s*(?:mg|g|mcg|units?))?\s+every\s+\d+\s+hours?\b/gi) || [];
  if (repeatedEvery.length > 1) {
    const doseParts = repeatedEvery
      .map((part) => part.match(/\b(?:one-half\s+)?(?:recommended dose|\d+(?:\.\d+)?\s*(?:mg|g|mcg|units?))\b/i)?.[0])
      .filter(Boolean);
    const frequencyParts = repeatedEvery
      .map((part) => part.match(/\bevery\s+\d+\s+hours?\b/i)?.[0])
      .filter(Boolean);
    const uniqueFrequencies = [...new Set(frequencyParts.map((part) => part.toLowerCase()))];
    if (doseParts.length > 1 && uniqueFrequencies.length === 1) {
      return {
        dose: [...new Set(doseParts)].join(" or "),
        frequency: frequencyParts[0],
      };
    }
  }

  const match = cleaned.match(/\b(every\s+\d+\s+hours?|once daily|twice daily|three times daily|daily|single dose|after dialysis|following dialysis|q\s*\d+\s*h)\b/i);
  if (!match) {
    return { dose: cleaned || "Review source", frequency: "By indication" };
  }
  return {
    dose: cleaned.slice(0, match.index).trim() || "Recommended dose",
    frequency: cleaned.slice(match.index).replace(/\s+\b(?:CrCl|Clcr|Creatinine Clearance)\b\s*$/i, "").trim(),
  };
}

function buildAssistCacheKey({ patient, label }) {
  const crclBand = Number.isFinite(patient.crcl) ? Math.floor(patient.crcl / 5) * 5 : "unknown";
  const params = new URLSearchParams({
    version: ASSIST_CACHE_VERSION,
    drug: label.setId || patient.normalizedDrug?.searchTerm || patient.drug,
    route: patient.route || "ALL",
    crclBand: String(crclBand),
    dialysis: patient.dialysis || "none",
    indication: patient.indication || "any",
    formulation: patient.formulation || "any",
  });
  return `https://renal-dose.local/cache/assist?${params.toString()}`;
}

async function readJsonCache(key) {
  if (typeof caches === "undefined" || !caches.default) {
    return null;
  }
  try {
    const cached = await caches.default.match(new Request(key, { method: "GET" }));
    return cached ? cached.json() : null;
  } catch {
    return null;
  }
}

async function writeJsonCache(key, value, ttlSeconds) {
  if (typeof caches === "undefined" || !caches.default) {
    return;
  }
  try {
    const response = new Response(JSON.stringify(value), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttlSeconds}`,
      },
    });
    await caches.default.put(new Request(key, { method: "GET" }), response);
  } catch {
    // Cache failures should never block clinical source review.
  }
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function jsonResponse(value, status) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
