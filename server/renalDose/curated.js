import { findCuratedRenalDoseGuidance } from "../../src/curatedDoseRules.js";
import { routeDisplayName } from "./format.js";

const NO_ADJUSTMENT = /\bno (?:renal )?(?:dose |dosage )?(?:adjustment|reduction)\b/i;
const AVOID = /\b(?:avoid|contraindicated|not recommended|do not use|do not initiate)\b/i;

/**
 * Step 1 of the dose pipeline: the curated renal-rule database.
 *
 * Returns an API payload when a curated record has a band for this patient's
 * renal function, or null so the caller falls through to DailyMed/openFDA.
 * Records without a band for this value (the label is silent there) fall
 * through rather than guessing.
 */
export function resolveCuratedPayload(patient) {
  const lookup = {
    drugQuery: patient.drug,
    normalizedDrug: patient.normalizedDrug,
    crcl: patient.crcl,
    egfr: patient.egfr,
    route: patient.route,
    dialysis: patient.dialysis,
    indication: patient.indication,
    formulation: patient.formulation,
  };
  let guidance = findCuratedRenalDoseGuidance(lookup);
  if (!guidance || !guidance.rows?.some((row) => row.selected)) {
    return null;
  }

  const cautions = [];
  const apixaban = applyApixabanNvafCriteria(guidance, patient);
  if (apixaban) {
    guidance = findCuratedRenalDoseGuidance({ ...lookup, indication: apixaban.indication }) || guidance;
    cautions.push(apixaban.caution);
  }
  cautions.push(...describeDefaultedContext(guidance, { ...patient, indication: apixaban?.indication || patient.indication }));

  const verified = guidance.verification.status === "verified";
  return toCuratedPayload(guidance, patient, cautions, verified ? "curated-verified" : "curated-draft");
}

export function toCuratedPayload(guidance, patient, cautions, sourceMode) {
  return {
    result: toAssistResult(guidance, patient, cautions),
    curated: guidance,
    label: null,
    sourceSections: [],
    sourceText: "",
    sourceUrl: guidance.sourceUrl,
    sourceMode,
    modelUsed: "",
    freeMode: true,
    freeModeRemaining: null,
  };
}

/**
 * When a record's dose depends on indication/product/dialysis and the request
 * did not choose one, the rule engine uses the first option. Say so, so the
 * user confirms the context instead of trusting a silent default.
 */
function describeDefaultedContext(guidance, patient) {
  const options = guidance.options;
  const selected = guidance.selectedControls;
  if (!options || !selected) {
    return [];
  }
  const checks = [
    ["indications", "indication", "Indication"],
    ["formulations", "formulation", "Product/formulation"],
  ];
  return checks
    .filter(([optionKey, field]) => options[optionKey]?.length > 1 && patient[field] !== selected[field])
    .map(([optionKey, field, label]) => {
      const option = options[optionKey].find((item) => item.value === selected[field]);
      return `${label} not selected; showing "${option?.label || selected[field]}". Choose the ${label.toLowerCase()} to confirm this dose.`;
    });
}

/**
 * Apixaban NVAF: the label reduces the dose to 2.5 mg twice daily when at
 * least 2 of age >= 80 years, weight <= 60 kg, serum creatinine >= 1.5 mg/dL.
 * All three are known here, so pick the matching NVAF row automatically.
 */
export function applyApixabanNvafCriteria(guidance, patient) {
  if (!/apixaban/i.test(guidance.drugName)) {
    return null;
  }
  if (patient.indication && !["any", "nvaf-usual", "nvaf-reduced"].includes(patient.indication)) {
    return null;
  }
  const met = [
    patient.age >= 80 ? "age >= 80 years" : "",
    patient.weight <= 60 ? "weight <= 60 kg" : "",
    patient.creatinine >= 1.5 ? "serum creatinine >= 1.5 mg/dL" : "",
  ].filter(Boolean);
  if (!Number.isFinite(patient.age) || !Number.isFinite(patient.weight) || !Number.isFinite(patient.creatinine)) {
    return null;
  }
  const indication = met.length >= 2 ? "nvaf-reduced" : "nvaf-usual";
  return {
    indication,
    caution: `NVAF dose-reduction criteria met: ${met.length} of 3${met.length ? ` (${met.join(", ")})` : ""}. For other indications, choose the indication.`,
  };
}

function toAssistResult(guidance, patient, extraCautions = []) {
  const recommendation = guidance.recommendation || "";
  const needsReview = guidance.status === "curated_needs_review";
  let status = "dose_found";
  if (NO_ADJUSTMENT.test(recommendation) && !AVOID.test(recommendation)) {
    status = "no_renal_adjustment";
  } else if (needsReview && !AVOID.test(recommendation)) {
    status = "review_source";
  }

  return {
    status,
    drugName: guidance.drugName,
    route: guidance.routeLabel || routeDisplayName(patient.route),
    renalMetricUsed: /eGFR/.test(guidance.crclBand) ? "egfr" : "crcl",
    renalBand: guidance.crclBand,
    dose: guidance.dose || recommendation,
    frequency: guidance.dose ? guidance.interval || "" : "",
    dialysisNote: "",
    importantCautions: [...extraCautions, guidance.indicationNote].filter(Boolean),
    sourceSetId: extractSetId(guidance.sourceUrl),
    sourceUrl: guidance.sourceUrl,
  };
}

function extractSetId(url) {
  return String(url || "").match(/setid=([\w-]+)/i)?.[1] || "";
}
