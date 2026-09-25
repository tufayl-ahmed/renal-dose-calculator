import { deriveRenalDoseGuidance } from "../../src/doseGuidance.js";
import { compactText, formatNumber, routeDisplayName, routeSentenceName, splitDoseAndFrequency } from "./format.js";
import { buildDailyMedSearchUrl, toPublicSections } from "./openfda.js";

export function sanitizePatient(body) {
  return {
    drug: compactText(body.drug),
    normalizedDrug: body.normalizedDrug || null,
    route: compactText(body.route) || "ALL",
    crcl: Number(body.crcl),
    egfr: Number(body.egfr),
    age: Number(body.age),
    sex: compactText(body.sex),
    weight: Number(body.weight),
    creatinine: Number(body.creatinine),
    height: body.height ? Number(body.height) : null,
    dialysis: compactText(body.dialysis) || "none",
    indication: compactText(body.indication) || "any",
    formulation: compactText(body.formulation) || "any",
  };
}

export function buildReviewSourceResult({ patient, label, reason }) {
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

export function createRouteUnavailableAssistResult({ drugName, route, sourceUrl, message }) {
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

export function buildSpecialPayloadFromMissingLabel({ result, label, sourceText }) {
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

export function shouldUseParserFallback(aiResult, parserFallback) {
  if (!parserFallback || parserFallback.status === "review_source" || !isCleanParserResult(parserFallback)) {
    return false;
  }
  return aiResult.status !== "dose_found";
}

export function isCleanParserResult(result) {
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
  return /\b(?:recommended dose|usual recommended dose|usual dose|one-half recommended dose|half recommended dose|one-quarter recommended dose|quarter recommended dose)\b/.test(
    text
  );
}

function hasVagueParserFrequency(value) {
  return /^(?:by indication|use usual adult schedule by indication|usual fixed interval)$/i.test(compactText(value));
}

function hasParserFragmentDose(value) {
  const text = compactText(value);
  return (
    /^(?:renal impairment|patients with renal impairment|use in specific populations)\b/i.test(text) ||
    /\b(?:CrCl|CLcr|creatinine clearance)\s*$/i.test(text) ||
    /[([][^)\]]*$/.test(text)
  );
}

export function buildParserFallbackResult({ label, patient }) {
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
      importantCautions: ["Label contains renal avoidance or contraindication language."],
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

  if (guidance.status === "label_text") {
    // The label mentions kidney function but no rule could be parsed. This is
    // not evidence that no adjustment is needed, so ask for source review.
    return {
      status: "review_source",
      drugName: label.title || patient.drug || "Selected drug",
      route: routeDisplayName(patient.route),
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Review renal text in label",
      frequency: `The label mentions kidney function${guidance.sourceHeading ? ` (${guidance.sourceHeading})` : ""} but no renal dose rule could be extracted.`,
      dialysisNote: "",
      importantCautions: [],
      sourceSetId: label.setId || "",
      sourceUrl: label.sourceUrl || "",
    };
  }

  if (guidance.status === "not_available") {
    // Silence is not evidence of safety: the sections read may miss renal text.
    return {
      status: "review_source",
      drugName: label.title || patient.drug || "Selected drug",
      route: routeDisplayName(patient.route),
      renalMetricUsed: "crcl",
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      dose: "Review label",
      frequency: "The label sections read do not mention kidney function. Check the full label before assuming no adjustment.",
      dialysisNote: "",
      importantCautions: [],
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
