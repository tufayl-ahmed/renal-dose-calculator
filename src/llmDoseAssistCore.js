const AI_ASSIST_CAVEAT =
  "Educational purpose only. AI-assisted output may be wrong. Results are estimates and are not for prescribing.";
export const AI_SOURCE_TEXT_LIMIT = 9000;

const ASSIST_STATUSES = new Set([
  "dose_found",
  "no_renal_adjustment",
  "review_source",
  "not_found",
]);

const VAGUE_DOSE =
  /\b(?:usual dose|usual dosage|see label|see prescribing information|as directed|adjust(?:\s+the)?\s+dose|adjust(?:\s+the)?\s+dosage|dose adjustment|dosage adjustment|review source|not applicable|n\/a)\b/i;
const DOSE_UNIT = /\b\d+(?:\.\d+)?\s*(?:(?:mg|g|gram|grams|mcg|units?|iu|meq|mmol|ml|percent)\b|%)/i;
const DOSE_DEPENDENT_PHRASE = /\b\d+(?:\.\d+)?\s*%\s+of\s+(?:the\s+)?(?:usual|daily)\s+dose\b/i;
const RENAL_ACTION_PHRASE =
  /\b(?:do not initiate|contraindicated|discontinue|do not use|avoid(?: use)?|restriction language|product restriction|renal caution|use with caution|monitor renal function|dose-reduction language|dose reduction|dose decrease|dose limit|lower dose|lower individual doses|slower titration|not recommended|no renal-specific dose adjustment found|no renal dose adjustment|no dose adjustment|reduce dose|reduce(?:\s+\w+){0,4}\s+dose by \d+%|dose should not exceed)\b/i;
const FREQUENCY_SIGNAL =
  /\b(?:every\s+\d+\s+hours?|q\s*\d+\s*h|once daily|twice daily|three times daily|four times daily|daily|weekly|single dose|after dialysis|following dialysis|with each dialysis|bid|tid|qid|q24h|q12h|q8h|q6h|q48h|q72h)\b/i;
const NO_ADJUSTMENT =
  /\b(?:no\s+(?:dosage?|dose)\s+adjustment\s+(?:is\s+)?(?:necessary|required|recommended)|(?:dosage?|dose)\s+adjustment\s+(?:is\s+)?not\s+(?:necessary|required|recommended)|no\s+adjustment\s+(?:is\s+)?(?:necessary|required|recommended))\b/i;
const INTERNAL_STATUS_TOKEN = /^(?:dose_found|no_renal_adjustment|review_source|not_found)$/i;

export function buildLlmDosePrompt({ label, patient }) {
  const sourceText = buildCompactSourceText(label.sections || []);

  return {
    messages: [
      {
        role: "system",
        content:
          "You extract renal dose guidance only from supplied DailyMed/openFDA label text. Do not use memory. If the text does not clearly support a dose for the renal function, return review_source. Return JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Return minimal adult renal dose guidance for the provided kidney function.",
            patient,
            requiredJsonFields: [
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
            allowedStatuses: [...ASSIST_STATUSES],
            sourceText,
          },
          null,
          2
        ),
      },
    ],
    sourceText,
  };
}

function buildCompactSourceText(sections) {
  const renalSections = sections.filter((section) => section.hasRenalKeyword);
  const selectedSections = renalSections.length ? renalSections : sections;
  return compactText(
    selectedSections
      .slice(0, 5)
      .map((section) => {
        const shouldUseFullText = section.hasRenalKeyword && /dosage|administration/i.test(section.heading);
        return `${section.heading}: ${shouldUseFullText ? dosageSourceWindow(section.fullText || section.text || "") : section.text || section.fullText || ""}`;
      })
      .join("\n\n")
  ).slice(0, AI_SOURCE_TEXT_LIMIT);
}

function dosageSourceWindow(text) {
  const clean = compactText(text);
  const lower = clean.toLowerCase();
  const renalSpecificStarts = [
    "dosage adjustments in adult patients with renal impairment",
    "dosage adjustment in adult patients with renal impairment",
    "dosage adjustment in patients with renal impairment",
    "dosing in patients with renal impairment",
    "recommended dosage in patients with renal impairment",
    "recommended dosage for patients with renal impairment",
    "adult patients with renal impairment",
    "patients with renal impairment",
    "dose adjustment in patients with renal impairment",
    "dose adjustment in renal impairment",
  ]
    .flatMap((phrase) => allIndexesOf(lower, phrase))
    .filter((index) => index >= 0);
  const lateSpecificStart = renalSpecificStarts.find((index) => index > 300);
  if (lateSpecificStart >= 0) {
    return clean.slice(lateSpecificStart, lateSpecificStart + AI_SOURCE_TEXT_LIMIT);
  }

  const starts = [
    "dosage adjustment",
    "dosage adjustments",
    "dosage in adult patients with renal impairment",
    "adult patients with renal impairment",
    "dosing in patients with renal impairment",
    "recommended dosage schedule for adult patients with renal impairment",
    "recommended dosage",
    "creatinine clearance",
    "crcl",
    "clcr",
  ]
    .map((phrase) => lower.indexOf(phrase))
    .filter((index) => index >= 0);
  const start = starts.length ? Math.min(...starts) : 0;
  return clean.slice(start, start + AI_SOURCE_TEXT_LIMIT);
}

function allIndexesOf(text, phrase) {
  const indexes = [];
  let startIndex = 0;
  while (startIndex < text.length) {
    const index = text.indexOf(phrase, startIndex);
    if (index === -1) {
      break;
    }
    indexes.push(index);
    startIndex = index + phrase.length;
  }
  return indexes;
}

export function parseAndValidateAssistResponse(rawValue, sourceText, fallback = {}) {
  const parsed = typeof rawValue === "string" ? parseJsonObject(rawValue) : rawValue;
  if (!parsed || typeof parsed !== "object") {
    return buildReviewSourceResult(fallback, "AI response was not valid JSON.");
  }
  return validateAssistResponse(parsed, sourceText, fallback);
}

export function validateAssistResponse(value, sourceText, fallback = {}) {
  const requestedMetric = normalizeRenalMetric(value.renalMetricUsed);
  const inferredMetric = inferRenalMetric(value.renalBand, requestedMetric);
  const result = {
    status: ASSIST_STATUSES.has(value.status) ? value.status : "review_source",
    drugName: compactText(value.drugName) || fallback.drugName || "Selected drug",
    route: compactText(value.route) || fallback.route || "All routes",
    renalMetricUsed: inferredMetric,
    renalBand: cleanModelText(value.renalBand) || fallback.renalBand || "",
    dose: cleanModelText(value.dose),
    frequency: cleanModelText(value.frequency),
    dialysisNote: cleanModelText(value.dialysisNote),
    importantCautions: Array.isArray(value.importantCautions)
      ? value.importantCautions.map(cleanModelText).filter(Boolean).slice(0, 4)
      : [],
    sourceSetId: fallback.sourceSetId || compactText(value.sourceSetId) || "",
    sourceUrl: fallback.sourceUrl || compactText(value.sourceUrl) || "",
  };

  const bandMatch = renalBandMatchesMetric(result.renalBand, result.renalMetricUsed, fallback);
  if (result.status === "dose_found" && !bandMatch.matches) {
    return buildReviewSourceResult(
      { ...fallback, ...result },
      `AI renal band did not match the calculated ${bandMatch.metricLabel}.`
    );
  }

  if (result.status === "dose_found" && bandMatch.warning) {
    result.importantCautions = [bandMatch.warning, ...result.importantCautions].slice(0, 4);
  }

  if (result.status === "dose_found" && isClearlyUnusableDoseResult(result)) {
    return buildReviewSourceResult(
      { ...fallback, ...result },
      "AI dose/frequency was not specific enough for quick dosing."
    );
  }

  if (result.status === "dose_found" && !fallback.trustSourceEvidence && !isSupportedDoseResult(result, sourceText)) {
    result.importantCautions = [
      "AI-assisted summary could not be fully verified against compact source text; verify DailyMed.",
      ...result.importantCautions,
    ].slice(0, 4);
  }

  if (result.status === "no_renal_adjustment" && !fallback.trustSourceEvidence && !NO_ADJUSTMENT.test(sourceText)) {
    result.importantCautions = [
      "No-adjustment summary could not be fully verified against compact source text; verify DailyMed.",
      ...result.importantCautions,
    ].slice(0, 4);
  }

  if (result.status === "no_renal_adjustment" && !fallback.trustSourceEvidence && hasRenalDoseTableEvidence(sourceText)) {
    result.status = "review_source";
    result.dose = "Review DailyMed source";
    result.frequency = "Renal dose table text was present; verify the source table.";
  }

  if (result.status === "dose_found" && (!result.dose || !result.frequency)) {
    return buildReviewSourceResult({ ...fallback, ...result }, "AI response did not include both dose and frequency.");
  }

  if (result.status === "not_found") {
    result.dose = result.dose || "Drug label not found";
    result.frequency = result.frequency || "Review DailyMed source";
  }

  if (result.status === "review_source") {
    result.dose = isInternalToken(result.dose) ? "" : result.dose;
    result.frequency = isInternalToken(result.frequency) ? "" : result.frequency;
    result.dose = result.dose || "Review DailyMed source";
    result.frequency = result.frequency || "Source review required";
  }

  if (result.status === "no_renal_adjustment") {
    result.dose = isInternalToken(result.dose) ? "" : result.dose;
    result.frequency = isInternalToken(result.frequency) ? "" : result.frequency;
    result.dose = result.dose || "No renal dose adjustment found in supplied label text";
    result.frequency = result.frequency || "Verify source";
  }

  return result;
}

export function buildAssistGuidance(result, { crcl, egfr, route } = {}) {
  const status = normalizeAssistStatus(result.status);
  const reviewLevel = status === "dose_found" ? "clean-dose" : status === "no_renal_adjustment" ? "source-summary" : "manual-review";

  return {
    status: status === "dose_found" ? "ai_assisted_matched" : "ai_assisted_needs_review",
    title: "AI-assisted DailyMed summary",
    badge: "AI-assisted DailyMed summary",
    drugName: result.drugName || "Selected drug",
    routeLabel: result.route || routeDisplayName(route),
    renalBandLabel: result.renalMetricUsed === "egfr" ? "eGFR band" : "CrCl band",
    crclBand: result.renalBand || `${result.renalMetricUsed === "egfr" ? "eGFR" : "CrCl"} ${formatNumber(result.renalMetricUsed === "egfr" ? egfr : crcl)} mL/min`,
    recommendation: `${result.dose || "Review DailyMed source"} ${result.frequency || ""}`.trim(),
    dose: result.dose || "Review DailyMed source",
    interval: result.frequency || "Source review required",
    reviewLevel,
    sourceUrl: result.sourceUrl || "",
    sourceLabel: "DailyMed/openFDA label text with AI-assisted summarization",
    sourceHeading: "AI-assisted DailyMed summary",
    indicationNote: result.dialysisNote || result.importantCautions?.join(" ") || "",
    caveat: AI_ASSIST_CAVEAT,
    rows: [],
  };
}

export function createNoLabelAssistResult({ drugName, route, sourceUrl }) {
  return {
    status: "not_found",
    drugName: drugName || "Selected drug",
    route: routeDisplayName(route),
    renalMetricUsed: "crcl",
    renalBand: "",
    dose: "Drug label not found",
    frequency: "Review DailyMed source",
    dialysisNote: "",
    importantCautions: [],
    sourceSetId: "",
    sourceUrl: sourceUrl || "",
  };
}

function isSupportedDoseResult(result, sourceText) {
  const source = compactText(sourceText).toLowerCase();
  if (!source || isClearlyUnusableDoseResult(result)) {
    return false;
  }

  const doseSupported = DOSE_UNIT.test(result.dose)
    ? allImportantDoseTokensPresent(result.dose, source)
    : source.includes(result.dose.toLowerCase());
  const frequencySupported = FREQUENCY_SIGNAL.test(result.frequency)
    ? hasFrequencyEvidence(result.frequency, source)
    : source.includes(result.frequency.toLowerCase());

  return doseSupported && frequencySupported;
}

function isClearlyUnusableDoseResult(result) {
  const hasUsableDoseShape =
    DOSE_UNIT.test(result.dose) ||
    DOSE_DEPENDENT_PHRASE.test(result.dose) ||
    RENAL_ACTION_PHRASE.test(`${result.dose} ${result.frequency}`);
  return (
    (!hasUsableDoseShape && VAGUE_DOSE.test(result.dose)) ||
    !hasUsableDoseShape
  );
}

function hasRenalDoseTableEvidence(sourceText) {
  const source = compactText(sourceText);
  return (
    /\b(?:creatinine clearance|crcl|clcr)\b/i.test(source) &&
    /\b(?:recommended dosage|dosage adjustment|dose adjustment|dosing interval|dose|dosage)\b/i.test(source) &&
    (
      (source.match(/\b(?:less than|greater than|more than|above|below|under|at least)\s*\d+(?:\.\d+)?/gi) || []).length >= 2 ||
      (source.match(/\b\d+(?:\.\d+)?\s*(?:to|-|–|—)\s*\d+(?:\.\d+)?/g) || []).length >= 2
    )
  );
}

function renalBandMatchesMetric(renalBand, metric, fallback) {
  const metricKey = metric === "egfr" ? "egfr" : "crcl";
  const value = metricKey === "egfr" ? fallback.egfr : fallback.crcl;
  const metricLabel = metricKey === "egfr" ? "eGFR" : "CrCl";

  if (!Number.isFinite(value)) {
    return { matches: true, metricLabel };
  }

  const text = compactText(renalBand).toLowerCase();
  if (!text) {
    return { matches: true, metricLabel };
  }

  if (/\b(?:serum creatinine|scr)\b|mg\/dl/i.test(text)) {
    return {
      matches: true,
      metricLabel,
      warning: "Dose appears to depend on serum creatinine or other criteria; verify the DailyMed label.",
    };
  }

  const matches = renalBandMatchesNumber(text, value);
  const roundedMatches = matches || renalBandMatchesNumber(text, Math.round(value));
  return { matches: roundedMatches, metricLabel };
}

function renalBandMatchesNumber(text, value) {
  const rangeToLessThan = text.match(/(\d+(?:\.\d+)?)\s*(?:to|-|–|—)\s*(?:<|less than|below|under)\s*(\d+(?:\.\d+)?)/);
  if (rangeToLessThan) {
    const low = Number(rangeToLessThan[1]);
    const high = Number(rangeToLessThan[2]);
    return value >= low && value < high;
  }

  const rangeToGreaterThan = text.match(/(?:>|greater than|more than|above|over)\s*(\d+(?:\.\d+)?)\s*(?:to|-|–|—)\s*(\d+(?:\.\d+)?)/);
  if (rangeToGreaterThan) {
    const low = Number(rangeToGreaterThan[1]);
    const high = Number(rangeToGreaterThan[2]);
    return value > low && value <= high;
  }

  const greaterSymbol = text.match(/(?:^|[\s(])(?:>|>=|≥)\s*(\d+(?:\.\d+)?)/);
  if (greaterSymbol) {
    return greaterSymbol[0].includes(">") && !greaterSymbol[0].includes("=") && !greaterSymbol[0].includes("≥")
      ? value > Number(greaterSymbol[1])
      : value >= Number(greaterSymbol[1]);
  }

  const greater = text.match(/\b(?:greater than|more than|above|over)\s*(?:or equal to\s*)?(\d+(?:\.\d+)?)/);
  if (greater) {
    return value > Number(greater[1]);
  }

  const greaterEqual = text.match(/\b(?:at least)\s*(\d+(?:\.\d+)?)/);
  if (greaterEqual) {
    return value >= Number(greaterEqual[1]);
  }

  const lessSymbol = text.match(/(?:^|[\s(])(?:<|<=|≤)\s*(\d+(?:\.\d+)?)/);
  if (lessSymbol) {
    return lessSymbol[0].includes("<") && !lessSymbol[0].includes("=") && !lessSymbol[0].includes("≤")
      ? value < Number(lessSymbol[1])
      : value <= Number(lessSymbol[1]);
  }

  const less = text.match(/\b(?:less than|below|under)\s*(\d+(?:\.\d+)?)/);
  if (less) {
    return value < Number(less[1]);
  }

  const lessEqual = text.match(/\b(?:up to)\s*(\d+(?:\.\d+)?)/);
  if (lessEqual) {
    return value <= Number(lessEqual[1]);
  }

  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:to|-|–|—)\s*(\d+(?:\.\d+)?)/);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    return value >= Math.min(low, high) && value <= Math.max(low, high);
  }

  return true;
}

function allImportantDoseTokensPresent(text, source) {
  const tokens = text.match(/\b\d+(?:\.\d+)?\s*(?:mg|g|gram|grams|mcg|units?|iu|meq|mmol|ml|%)\b/gi) || [];
  return tokens.length > 0 && tokens.every((token) => doseTokenPresent(token, source));
}

function doseTokenPresent(token, source) {
  const lower = token.toLowerCase();
  if (source.includes(lower)) {
    return true;
  }

  const match = lower.match(/^(\d+(?:\.\d+)?)\s*(g|gram|grams)$/);
  return Boolean(match && source.includes(match[1]) && /\b(?:g|gram|grams)\b/.test(source));
}

function hasFrequencyEvidence(text, source) {
  const lower = text.toLowerCase();
  const everyMatch = lower.match(/every\s+(\d+)\s+hours?/);
  if (everyMatch) {
    return source.includes(`every ${everyMatch[1]} hours`) || source.includes(`q${everyMatch[1]}h`);
  }
  return lower
    .split(/[;,.]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => source.includes(part) || FREQUENCY_SIGNAL.test(part));
}

function buildReviewSourceResult(fallback, reason) {
  const fallbackDose = cleanReviewFallbackText(fallback.dose);
  const fallbackFrequency = cleanReviewFallbackText(fallback.frequency);
  const shouldUseReason = Boolean(reason);
  return {
    status: "review_source",
    drugName: fallback.drugName || "Selected drug",
    route: fallback.route || "All routes",
    renalMetricUsed: normalizeRenalMetric(fallback.renalMetricUsed),
    renalBand: fallback.renalBand || "",
    dose: shouldUseReason ? "DailyMed source guidance" : fallbackDose || "DailyMed source guidance",
    frequency: shouldUseReason ? reason : fallbackFrequency || "Use linked label details for full context",
    dialysisNote: fallback.dialysisNote || "",
    importantCautions: [
      reason ? "The automated summary could not be converted into a fully source-matched one-line dose." : "",
      ...(fallback.importantCautions || []),
    ].filter(Boolean),
    sourceSetId: fallback.sourceSetId || "",
    sourceUrl: fallback.sourceUrl || "",
  };
}

function cleanReviewFallbackText(value) {
  const text = compactText(value);
  if (!text || isInternalToken(text) || /^review\s+(?:dailymed\s+)?source$/i.test(text)) {
    return "";
  }
  return text;
}

function parseJsonObject(value) {
  try {
    return JSON.parse(value);
  } catch {
    const match = String(value || "").match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeRenalMetric(value) {
  const metric = compactText(value).toLowerCase();
  return metric === "egfr" || metric === "crcl" ? metric : "unclear";
}

function inferRenalMetric(renalBand, requestedMetric) {
  const text = compactText(renalBand).toLowerCase();
  if (/\begfr\b/.test(text)) {
    return "egfr";
  }
  if (/\b(?:crcl|clcr|creatinine clearance)\b/.test(text)) {
    return "crcl";
  }
  return requestedMetric === "egfr" || requestedMetric === "crcl" ? requestedMetric : "crcl";
}

function normalizeAssistStatus(value) {
  return ASSIST_STATUSES.has(value) ? value : "review_source";
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

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanModelText(value) {
  const text = compactText(value);
  return isInternalToken(text) ? "" : text;
}

function isInternalToken(value) {
  return INTERNAL_STATUS_TOKEN.test(compactText(value));
}
