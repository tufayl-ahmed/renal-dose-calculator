import { deriveRenalDoseGuidance } from "./doseGuidance.js?v=20260509-4";
import { buildDailyMedSearchUrl, lookupDrugLabel } from "./drugLookup.js?v=20260510-1";
import {
  buildAssistGuidance,
  createNoLabelAssistResult,
  parseAndValidateAssistResponse,
  validateAssistResponse,
} from "./llmDoseAssistCore.js?v=20260509-2";

export async function requestLlmDoseAssist(values) {
  const payload = buildAssistPayload(values);

  try {
    const response = await fetch("/api/renal-dose/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      return normalizeAssistPayload(data, values);
    }
  } catch {
    // Local static development has no Cloudflare Function; use browser fallback below.
  }

  return buildLocalMockAssist(values);
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
    height: values.height || null,
    dialysis: values.dialysis || "none",
    indication: values.indication || "any",
    formulation: values.formulation || "any",
  };
}

export function normalizeAssistPayload(data, values = {}) {
  const isParserResult = data.sourceMode === "dailymed-table-parser" || data.sourceMode === "dailymed-table-parser-fallback";
  const isSpecialResult = data.sourceMode === "dailymed-special-review";
  const isRouteNotFound = data.sourceMode === "route-not-found";
  const result = validateAssistResponse(data.result || data, data.sourceText || "", {
    drugName: data.drugName || values.drug,
    route: data.route || routeDisplayName(values.route),
    renalBand: `CrCl ${formatNumber(values.crcl)} mL/min`,
    crcl: values.crcl,
    egfr: values.egfr,
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
  };
}

async function buildLocalMockAssist(values) {
  const label = await lookupDrugLabel(values);

  if (!label || label.status !== "found") {
    const result = createNoLabelAssistResult({
      drugName: label?.title || values.drug,
      route: values.route,
      sourceUrl: label?.sourceUrl || buildDailyMedSearchUrl(values.drug),
    });
    return {
      result,
      guidance: buildAssistGuidance(result, values),
      label,
      sourceSections: [],
      sourceUrl: result.sourceUrl,
      sourceMode: "local-mock",
    };
  }

  const sourceText = (label.sections || [])
    .map((section) => `${section.heading}: ${section.fullText || section.text}`)
    .join("\n\n");
  const parsedGuidance = deriveRenalDoseGuidance({ label, crcl: values.crcl, route: values.route });
  const mockResult = buildMockResultFromParsedGuidance({ label, parsedGuidance, values });
  const result = parseAndValidateAssistResponse(mockResult, sourceText, {
    drugName: label.title,
    route: routeDisplayName(values.route),
    renalBand: parsedGuidance.crclBand || `CrCl ${formatNumber(values.crcl)} mL/min`,
    crcl: values.crcl,
    egfr: values.egfr,
    sourceUrl: label.sourceUrl,
  });

  return {
    result,
    guidance: buildAssistGuidance(result, values),
    label,
    sourceSections: label.sections || [],
    sourceUrl: label.sourceUrl,
    sourceMode: "local-mock",
  };
}

function buildMockResultFromParsedGuidance({ label, parsedGuidance, values }) {
  if (parsedGuidance.status === "matched") {
    const parts = splitDoseAndFrequency(parsedGuidance.recommendation);
    return {
      status: "dose_found",
      drugName: label.title,
      route: routeDisplayName(values.route),
      renalMetricUsed: "crcl",
      renalBand: parsedGuidance.crclBand,
      dose: parts.dose,
      frequency: parts.frequency,
      dialysisNote: "",
      importantCautions: [],
      sourceSetId: extractSetId(label.sourceUrl),
      sourceUrl: label.sourceUrl,
    };
  }

  if (parsedGuidance.status === "label_text" && /no renal dose adjustment|no crcl dose table/i.test(parsedGuidance.recommendation)) {
    return {
      status: "no_renal_adjustment",
      drugName: label.title,
      route: routeDisplayName(values.route),
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(values.crcl)} mL/min`,
      dose: "No renal dose adjustment found in supplied label text",
      frequency: "Verify source",
      dialysisNote: "",
      importantCautions: [],
      sourceSetId: extractSetId(label.sourceUrl),
      sourceUrl: label.sourceUrl,
    };
  }

  return {
    status: "review_source",
    drugName: label.title,
    route: routeDisplayName(values.route),
    renalMetricUsed: "crcl",
    renalBand: `CrCl ${formatNumber(values.crcl)} mL/min`,
    dose: "Review DailyMed source",
    frequency: parsedGuidance.recommendation || "Source review required",
    dialysisNote: "",
    importantCautions: [],
    sourceSetId: extractSetId(label.sourceUrl),
    sourceUrl: label.sourceUrl,
  };
}

function splitDoseAndFrequency(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  const repeatedEvery = cleaned.match(/\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|units?)\s+every\s+\d+\s+hours?\b/gi) || [];
  if (repeatedEvery.length > 1) {
    const doseParts = repeatedEvery
      .map((part) => part.match(/\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|units?)\b/i)?.[0])
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
    frequency: cleaned.slice(match.index).trim(),
  };
}

function extractSetId(url) {
  try {
    return new URL(url).searchParams.get("setid") || "";
  } catch {
    return "";
  }
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
