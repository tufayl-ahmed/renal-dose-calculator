import { LABEL_CACHE_TTL_SECONDS, readJsonCache, writeJsonCache } from "./cache.js";
import { compactText, escapeRegExp, routeDisplayName, routeSentenceName, truncate } from "./format.js";

const OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json";

const DAILYMED_DRUG_SEARCH_URL = "https://dailymed.nlm.nih.gov/dailymed/search.cfm";

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const LABEL_FIELDS = [
  "renal_impairment",
  "dosage_and_administration",
  "dosage_forms_and_strengths",
  "use_in_specific_populations",
  "warnings",
  "warnings_and_cautions",
  "contraindications",
  // Older (non-PLR) labels put renal warnings under Precautions.
  "precautions",
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
    .replace(
      /\b(?:oral|po|intravenous|iv|i\.v\.|injection|injectable|tablets?|tabs?|capsules?|caps?|solution|suspension|powder|vials?|prefilled|syringe|er|xr|dr|ir)\b/gi,
      " "
    )
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

export function correctCommonLookupTypo(value) {
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

  return [buildProductTypeClause(productType), `(${fieldQueries.join(" OR ")})`].join(" AND ");
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

export function toPublicLabel(label) {
  if (!label || label.status !== "found") {
    return label;
  }
  return {
    ...label,
    sections: toPublicSections(label.sections),
  };
}

export function toPublicSections(sections = []) {
  return sections.map((section) => ({
    heading: section.heading,
    hasRenalKeyword: section.hasRenalKeyword,
    text: section.text,
  }));
}

function collectRelevantSections(label) {
  return LABEL_FIELDS.flatMap((field) => {
    const entries = Array.isArray(label[field]) ? label[field] : [];
    return entries.map((text) => summarizeSection(field, text)).filter((section) => section.text.length > 0);
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
  const queryIsCombo = /\b(?:and|with)\b|[/+,;]/.test(query);
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
  if (!queryIsCombo && genericNames.some((name) => /\b(?:and|with)\b|[/+,;]/.test(name) && name.includes(query))) {
    score -= 160;
  }
  if (
    !queryIsCombo &&
    brandNames.some((name) => /\b(?:xr|duo|triple|combination)\b/.test(name)) &&
    genericNames.some((name) => name.includes(query) && /\b(?:and|with)\b|[/+,;]/.test(name))
  ) {
    score -= 60;
  }
  if (
    /\b(?:injection|injectable|intravenous|iv|i\.v\.)\b/.test(rawQuery) &&
    /\b(?:injection|injectable|intravenous|iv|i\.v\.)\b/.test(routeEvidence)
  ) {
    score += 65;
  }
  if (
    /\b(?:oral|tablet|tablets|capsule|capsules)\b/.test(rawQuery) &&
    /\b(?:oral|tablet|tablets|capsule|capsules)\b/.test(routeEvidence)
  ) {
    score += 45;
  }
  if (
    /\b(?:extended[-\s]+release|er|xr)\b/.test(rawQuery) &&
    /\b(?:extended[-\s]+release|er|xr)\b/.test(routeEvidence)
  ) {
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

export function buildDailyMedSearchUrl(drug) {
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
