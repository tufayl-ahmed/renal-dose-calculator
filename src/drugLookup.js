import { normalizeDrugQuery } from "./drugNormalizer.js?v=20260506-8";

const OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json";
const DAILYMED_DRUG_SEARCH_URL = "https://dailymed.nlm.nih.gov/dailymed/search.cfm";
const CACHE_PREFIX = "renal-dose-openfda:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
  "hemodialysis",
  "haemodialysis",
  "dialysis",
  "peritoneal",
  "crrt",
  "esrd",
  "impairment",
];

export async function lookupDrugLabel({ drug, route }) {
  const cleanedDrug = drug.trim();
  if (!cleanedDrug) {
    return null;
  }

  const normalizedDrug = await normalizeDrugQuery(cleanedDrug);
  const lookupTerm = normalizedDrug?.searchTerm || cleanedDrug;
  const data = await fetchOpenFdaLabels(lookupTerm, route);
  const matches = Array.isArray(data.results) ? data.results : [];
  const humanPrescriptionMatches = matches.filter(isHumanPrescriptionLabel);
  const routeMatches = filterByRoute(humanPrescriptionMatches, route);
  const hasRouteFilter = route && route !== "ALL";
  const label = hasRouteFilter ? routeMatches[0] : humanPrescriptionMatches[0] || matches[0];

  if (!label && hasRouteFilter && humanPrescriptionMatches.length) {
    return {
      status: "route_not_found",
      title: cleanedDrug,
      message: `No ${routeLabel(route)} human DailyMed label match was found${formatLookupSuffix(normalizedDrug)}. Try All routes or review DailyMed directly.`,
      sourceUrl: buildDailyMedSearchUrl(lookupTerm),
      normalization: normalizedDrug,
      sections: [],
    };
  }

  if (!label) {
    return {
      status: "not_found",
      title: cleanedDrug,
      message: `No openFDA label match found${formatLookupSuffix(normalizedDrug)}. Try a generic name or check DailyMed directly.`,
      sourceUrl: buildDailyMedSearchUrl(lookupTerm),
      normalization: normalizedDrug,
      sections: [],
    };
  }

  return normalizeLabel(label, normalizedDrug, route);
}

function routeLabel(route) {
  if (route === "IV") {
    return "IV";
  }
  if (route === "ORAL") {
    return "oral";
  }
  return "selected-route";
}

export function buildDailyMedSearchUrl(drug) {
  const params = new URLSearchParams({ query: drug });
  return `${DAILYMED_DRUG_SEARCH_URL}?${params.toString()}`;
}

async function fetchOpenFdaLabels(drug, route) {
  const searches = buildOpenFdaSearches(drug, route);

  for (const search of searches) {
    const data = await requestOpenFdaSearch(search);
    if (Array.isArray(data.results) && data.results.length) {
      return data;
    }
  }

  return { results: [] };
}

function requestOpenFdaSearch(search) {
  const params = new URLSearchParams({ search, limit: "10" });
  const url = `${OPENFDA_LABEL_URL}?${params.toString()}`;
  const cached = readCache(url);
  if (cached) {
    return Promise.resolve(cached);
  }

  return fetch(url).then(async (response) => {
    if (!response.ok) {
      if (response.status === 404) {
        return { results: [] };
      }
      throw new Error("openFDA label lookup failed. Try again or use the DailyMed source link.");
    }
    const json = await response.json();
    writeCache(url, json);
    return json;
  });
}

function buildOpenFdaSearches(drug, route) {
  const routeClause = buildOpenFdaRouteClause(route);
  const exactSearch = buildOpenFdaExactSearch(drug);
  const tokenSearch = buildOpenFdaTokenSearch(drug);
  return [
    routeClause && exactSearch ? `${exactSearch} AND ${routeClause}` : null,
    routeClause && tokenSearch ? `${tokenSearch} AND ${routeClause}` : null,
    exactSearch,
    tokenSearch,
  ].filter(Boolean);
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

function buildOpenFdaExactSearch(drug) {
  const safeDrug = drug.replaceAll('"', "");
  return [
    'openfda.product_type:"HUMAN PRESCRIPTION DRUG"',
    `(${[
      `openfda.generic_name:"${safeDrug}"`,
      `openfda.brand_name:"${safeDrug}"`,
      `openfda.substance_name:"${safeDrug}"`,
    ].join(" OR ")})`,
  ].join(" AND ");
}

function buildOpenFdaTokenSearch(drug) {
  const tokens = extractSearchTokens(drug);
  if (tokens.length < 2) {
    return null;
  }

  const fieldQueries = ["openfda.generic_name", "openfda.brand_name", "openfda.substance_name"].map(
    (field) => `(${tokens.map((token) => `${field}:${token}`).join(" AND ")})`
  );

  return [
    'openfda.product_type:"HUMAN PRESCRIPTION DRUG"',
    `(${fieldQueries.join(" OR ")})`,
  ].join(" AND ");
}

function extractSearchTokens(drug) {
  return drug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && token !== "and")
    .slice(0, 4);
}

function isHumanPrescriptionLabel(label) {
  const productTypes = readOpenFdaArray(label, "product_type");
  return productTypes.some((type) => type.toUpperCase() === "HUMAN PRESCRIPTION DRUG");
}

function filterByRoute(labels, route) {
  if (!route || route === "ALL") {
    return labels;
  }

  return labels.filter((label) => {
    const routes = getRouteEvidence(label).map((value) => value.toUpperCase());
    if (route === "IV") {
      return routes.some((value) => /\b(?:INTRAVENOUS|IV|I\.V\.)\b/.test(value));
    }
    if (route === "ORAL") {
      return routes.some((value) => /\b(?:ORAL|TABLET|TABLETS|CAPSULE|CAPSULES|BY MOUTH)\b/.test(value));
    }
    return true;
  });
}

function getRouteEvidence(label) {
  return [
    ...readOpenFdaArray(label, "route"),
    ...readOpenFdaArray(label, "dosage_form"),
    ...(Array.isArray(label.spl_product_data_elements) ? label.spl_product_data_elements : []),
    ...(Array.isArray(label.package_label_principal_display_panel) ? label.package_label_principal_display_panel : []),
  ].filter(Boolean);
}

function normalizeLabel(label, normalizedDrug, route) {
  const requestedDrug = normalizedDrug?.original || "";
  const lookupTerm = normalizedDrug?.searchTerm || requestedDrug;
  const brandNames = readOpenFdaArray(label, "brand_name");
  const genericNames = readOpenFdaArray(label, "generic_name");
  const routes = readOpenFdaArray(label, "route");
  const setId = readOpenFdaArray(label, "spl_set_id")[0] || label.set_id || label.spl_set_id;
  const title = brandNames[0] || genericNames[0] || requestedDrug;
  const sections = collectRelevantSections(label);

  return {
    status: "found",
    title,
    genericName: genericNames[0] || "",
    brandName: brandNames[0] || "",
    normalization: normalizedDrug,
    route: route === "ALL" ? routes.join(", ") : route || routes.join(", "),
    productType: readOpenFdaArray(label, "product_type").join(", "),
    sourceUrl: setId
      ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`
      : buildDailyMedSearchUrl(lookupTerm),
    sections,
  };
}

function formatLookupSuffix(normalizedDrug) {
  if (!normalizedDrug?.changed) {
    return "";
  }

  return ` after matching "${normalizedDrug.original}" to "${normalizedDrug.displayName}"`;
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
  const snippets = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return RENAL_KEYWORDS.some((keyword) => lower.includes(keyword));
  });

  return snippets.slice(0, 6).map((snippet) => truncate(snippet, 420));
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

function compactText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function readCache(key) {
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) {
      return null;
    }
    const entry = JSON.parse(raw);
    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    window.localStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({
        createdAt: Date.now(),
        value,
      })
    );
  } catch {
    // Cache is optional; private browsing and strict settings can block it.
  }
}
