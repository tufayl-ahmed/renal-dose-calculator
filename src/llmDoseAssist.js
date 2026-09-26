import { buildAssistGuidance, validateAssistResponse } from "./llmDoseAssistCore.js";

const DAILYMED_DRUG_SEARCH_URL = "https://dailymed.nlm.nih.gov/dailymed/search.cfm";

/** Calls the renal dose API. Throws when the service cannot be reached. */
export async function requestLlmDoseAssist(values) {
  const response = await fetchAssistWithRetry(buildAssistPayload(values));
  if (!response.ok) {
    throw new Error(`Dose service returned ${response.status}.`);
  }
  return normalizeAssistPayload(await response.json(), values);
}

export function buildDailyMedSearchUrl(drug) {
  const params = new URLSearchParams({ query: String(drug || "").trim() });
  return `${DAILYMED_DRUG_SEARCH_URL}?${params.toString()}`;
}

async function fetchAssistWithRetry(payload) {
  const attempts = 5;
  let lastResponse = null;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch("/api/renal-dose/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!isTransientHttpStatus(response.status) || attempt === attempts) {
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        throw error;
      }
    }
    await sleep(500 * attempt);
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw lastError || new Error("Dose lookup failed.");
}

function isTransientHttpStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildAssistPayload(values) {
  return {
    drug: values.drug,
    normalizedDrug: values.normalizedDrug || null,
    route: values.route || "ORAL",
    crcl: values.crcl,
    egfr: values.egfr,
    age: values.age,
    sex: values.sex,
    weight: values.weight,
    creatinine: values.creatinine,
    height: values.height || null,
    dialysis: values.dialysis || "none",
    unstable: values.unstable === true,
    indication: values.indication || "any",
    formulation: values.formulation || "any",
  };
}

export function normalizeAssistPayload(data, values = {}) {
  const isParserResult =
    data.sourceMode === "dailymed-table-parser" || data.sourceMode === "dailymed-table-parser-fallback";
  const isSpecialResult = data.sourceMode === "dailymed-special-review";
  const isRouteNotFound = data.sourceMode === "route-not-found";
  // Curated and auto-extracted database rules are already structured; the
  // validator below is for free-text AI output and would reject them.
  const isCurated = String(data.sourceMode || "").startsWith("curated") || data.sourceMode === "label-extracted";
  const result = isCurated
    ? { importantCautions: [], dialysisNote: "", ...data.result }
    : validateAssistResponse(data.result || data, data.sourceText || "", {
        drugName: data.drugName || values.drug,
        route: data.route || routeDisplayName(values.route),
        renalBand: `CrCl ${formatNumber(values.crcl)} mL/min`,
        crcl: values.crcl,
        egfr: values.egfr,
        creatinine: values.creatinine,
        sourceUrl: data.sourceUrl || buildDailyMedSearchUrl(values.drug || ""),
        trustSourceEvidence: isParserResult || isSpecialResult,
      });
  const guidance = buildAssistGuidance(result, values);
  if (isParserResult) {
    guidance.title = "DailyMed renal table summary";
    guidance.badge = "DailyMed renal table";
    guidance.sourceLabel = "DailyMed/openFDA label table parsing";
    guidance.sourceHeading = "DailyMed renal table summary";
  }
  if (isSpecialResult) {
    guidance.title = "DailyMed renal label summary";
    guidance.badge = "DailyMed renal label";
    guidance.sourceLabel = "DailyMed/openFDA deterministic renal guidance";
    guidance.sourceHeading = "DailyMed renal label summary";
  }
  if (isCurated) {
    const verified = data.sourceMode === "curated-verified";
    guidance.title = "Curated renal dose rule";
    guidance.badge = verified
      ? "Clinician-verified"
      : data.sourceMode === "label-extracted"
        ? "Auto-extracted"
        : "Curated draft";
    guidance.sourceLabel = verified
      ? `Curated rule verified by ${data.curated?.verification?.verifiedBy || "clinician"}`
      : "Curated rule (draft, pending clinician review)";
    guidance.sourceHeading = data.curated?.sourceLabel || "Curated renal dose rule";
    guidance.rows = data.curated?.rows || guidance.rows;
    guidance.variants = data.curated?.variants || null;
    guidance.options = data.curated?.options || null;
    guidance.selectedControls = data.curated?.selectedControls || null;
    guidance.verification = data.curated?.verification || null;
  }
  if (isRouteNotFound) {
    guidance.title = "Route unavailable";
    guidance.badge = "Route unavailable";
    guidance.sourceLabel = "DailyMed/openFDA route-filtered lookup";
    guidance.sourceHeading = "Route unavailable";
  }

  return {
    result,
    guidance,
    label: data.label || null,
    sourceSections: data.sourceSections || data.label?.sections || [],
    sourceUrl: result.sourceUrl || data.sourceUrl || buildDailyMedSearchUrl(values.drug || ""),
    sourceMode: data.sourceMode || "cloudflare-ai",
    modelUsed: data.modelUsed || "",
    freeMode: data.freeMode !== false,
    freeModeRemaining: Number.isFinite(data.freeModeRemaining) ? data.freeModeRemaining : null,
    kidneyContext: data.kidneyContext || null,
  };
}

function routeDisplayName(route) {
  if (route === "IV") {
    return "IV";
  }
  if (route === "ORAL") {
    return "Oral";
  }
  return "Oral";
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}
