import { normalizeDrugQuery } from "./drugNormalizer.js";
import { parseQuickInput } from "./quickInput.js";
import {
  calculateCockcroftGault,
  calculateEgfrCkdEpi2021,
  getCkdStage,
  validateParsedInputs,
} from "./renal.js";

export const APP_URL = "https://renal-dose-calculator.pages.dev";

const BRAND_LINE = "Made by Dr. Tufayl (Cortex Labs)";
const DEFAULT_MAX_TEXT_LENGTH = 3900;
const EDUCATIONAL_DISCLAIMER = "Educational only. Results are estimates and are not for prescribing.";
const AI_DISCLAIMER = "Educational only. AI-assisted output may be wrong. Not for prescribing.";

export async function buildCalculatorReplyFromText(text, context, options = {}) {
  const trimmed = String(text || "").trim();
  const platform = options.platform || "WhatsApp";

  if (!trimmed || isHelpRequest(trimmed)) {
    return buildWelcomeReply({ platform });
  }
  if (isFormRequest(trimmed)) {
    return buildFormReply({ platform });
  }
  if (isWebRequest(trimmed)) {
    return buildWebReply();
  }

  const parsed = parseQuickInput(trimmed);
  if (!parsed) {
    return buildWelcomeReply({ platform });
  }

  const values = {
    age: Number(parsed.age),
    sex: parsed.sex,
    creatinine: Number(parsed.creatinine),
    weight: Number(parsed.weight),
    height: parsed.height ? Number(parsed.height) : null,
    drug: String(parsed.drug || "").trim(),
    route: parsed.route || "ALL",
    dialysis: "none",
    indication: "any",
    formulation: "any",
  };

  try {
    validateParsedInputs(values);
  } catch (error) {
    return buildInputErrorReply(error.message, { platform });
  }

  const renalValues = {
    ...values,
    egfr: calculateEgfrCkdEpi2021(values),
    crcl: calculateCockcroftGault(values),
  };

  if (!renalValues.drug) {
    return formatKidneyOnlyReply(renalValues, options);
  }

  const normalizedDrug = await normalizeDrugQuery(renalValues.drug);
  const assistRequester = options.assistRequester;
  if (!assistRequester) {
    return buildInputErrorReply("Drug-dose assistance is not configured for this bot.", { platform });
  }

  const assist = await assistRequester({ ...renalValues, normalizedDrug }, context);
  return formatDoseAssistReply({
    values: renalValues,
    normalizedDrug,
    assist,
    maxLength: options.maxLength,
    platform,
  });
}

function buildWelcomeReply({ platform = "WhatsApp" } = {}) {
  return [
    heading("Renal Dose Calculator", platform),
    "",
    `Adult eGFR + Cockcroft-Gault CrCl + optional DailyMed renal-dose summary.`,
    "",
    "Fast input:",
    "45 M 2.1 70 meropenem IV",
    "",
    "Format:",
    "age sex S.Creatinine weight drug route",
    "",
    "Drug, route, and height are optional. Weight is required for CrCl.",
    "",
    "Commands:",
    "FORM - copy-paste template",
    "WEB - open calculator",
    "",
    APP_URL,
    "",
    EDUCATIONAL_DISCLAIMER,
    BRAND_LINE,
  ].join("\n");
}

function buildFormReply() {
  return [
    "Renal Dose Calculator form",
    "",
    "Copy, fill, send:",
    "",
    "Age:",
    "Sex: M/F",
    "S. Creatinine mg/dL:",
    "Weight kg:",
    "Height cm: optional",
    "Drug: optional",
    "Route: All/IV/Oral optional",
    "",
    "Example:",
    "Age: 45",
    "Sex: Male",
    "S. Creatinine mg/dL: 2.1",
    "Weight kg: 70",
    "Height cm: 170",
    "Drug: meropenem",
    "Route: IV",
    "",
    EDUCATIONAL_DISCLAIMER,
    BRAND_LINE,
  ].join("\n");
}

function buildWebReply() {
  return [
    "Open the web calculator:",
    APP_URL,
    "",
    EDUCATIONAL_DISCLAIMER,
  ].join("\n");
}

function buildInputErrorReply(errorMessage, { platform = "WhatsApp" } = {}) {
  return [
    "Could not calculate.",
    "",
    `Reason: ${cleanReplyText(errorMessage)}`,
    "",
    "Use this format:",
    "45 M 2.1 70 meropenem IV",
    "",
    `Or send FORM for the ${platform} template.`,
    "",
    EDUCATIONAL_DISCLAIMER,
    BRAND_LINE,
  ].join("\n");
}

function formatKidneyOnlyReply(values, options = {}) {
  const stage = getCkdStage(values.egfr);
  const platform = options.platform || "WhatsApp";
  const lines = [
    heading("Renal Dose Calculator", platform),
    "",
    heading("Patient", platform),
    formatPatientLine(values),
    "",
    heading("Kidney", platform),
    `eGFR ${formatNumber(values.egfr)} mL/min/1.73 m2 (CKD ${stage.stage})`,
    `CrCl ${formatNumber(values.crcl)} mL/min (Cockcroft-Gault)`,
    "",
    EDUCATIONAL_DISCLAIMER,
  ];

  return limitText(compactOptionalLines(lines).join("\n"), options.maxLength);
}

function formatDoseAssistReply({
  values,
  normalizedDrug,
  assist,
  maxLength = DEFAULT_MAX_TEXT_LENGTH,
  platform = "WhatsApp",
}) {
  const result = assist?.result || assist || {};
  const stage = getCkdStage(values.egfr);
  const drugName = result.drugName || normalizedDrug?.displayName || values.drug;
  const route = result.route || routeDisplayName(values.route);
  const cautions = Array.isArray(result.importantCautions) ? result.importantCautions.filter(Boolean) : [];
  const dose = cleanReplyText(result.dose || "Review DailyMed source");
  const frequency = cleanReplyText(result.frequency || "Review DailyMed source");
  const sourceUrl = result.sourceUrl || assist?.sourceUrl || "";
  const renalBand = cleanReplyText(result.renalBand || `CrCl ${formatNumber(values.crcl)} mL/min`);
  const status = result.status || "";
  const actionLine = guidanceActionLine(status, dose, frequency);
  const note = [
    result.dialysisNote ? `Dialysis: ${cleanReplyText(result.dialysisNote)}` : "",
    ...cautions.slice(0, 2).map((caution) => cleanReplyText(caution)),
  ]
    .filter(Boolean)
    .join(" ");

  const lines = [
    heading("Renal Dose Calculator", platform),
    "",
    heading("Patient", platform),
    formatPatientLine(values),
    "",
    heading("Kidney", platform),
    `eGFR ${formatNumber(values.egfr)} mL/min/1.73 m2 (CKD ${stage.stage})`,
    `CrCl ${formatNumber(values.crcl)} mL/min (Cockcroft-Gault)`,
    "",
    heading("Dose guidance", platform),
    `${drugName} | ${route}`,
    renalBand ? `Band: ${renalBand}` : null,
    actionLine,
    shouldShowSeparateInterval(status, frequency) ? `Interval: ${compactFrequency(frequency)}` : null,
    note ? `Notes: ${note}` : null,
    sourceUrl ? `DailyMed: ${sourceUrl}` : null,
    "",
    AI_DISCLAIMER,
  ];

  return limitText(compactOptionalLines(lines).join("\n"), maxLength);
}

function isHelpRequest(value) {
  return /^(?:help|hi|hello|start|\/start|\/help|\?)$/i.test(String(value || "").trim());
}

function isFormRequest(value) {
  return /^(?:form|\/form|format|template|fill|fill form|sample form)$/i.test(String(value || "").trim());
}

function isWebRequest(value) {
  return /^(?:web|\/web|website|site|link|app|calculator)$/i.test(String(value || "").trim());
}

export function limitText(value, maxLength = DEFAULT_MAX_TEXT_LENGTH) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 18).trim()}\n...[truncated]`;
}

function formatPatientLine(values) {
  const parts = [
    `${formatNumber(values.age, 0)} yr ${sexLabel(values.sex)}`,
    `SCr ${formatCompactNumber(values.creatinine)} mg/dL`,
    `Wt ${formatCompactNumber(values.weight)} kg`,
    values.height ? `Ht ${formatNumber(values.height, 0)} cm` : "",
  ].filter(Boolean);
  return parts.join(" | ");
}

function heading(value, platform) {
  return platform === "WhatsApp" ? `*${value}*` : value;
}

function guidanceActionLine(status, dose, frequency) {
  if (status === "not_found") {
    return `Action: ${dose || "Drug label not found"}`;
  }
  if (status === "review_source") {
    return `Action: ${dose || "Review DailyMed source"}`;
  }
  if (status === "no_renal_adjustment") {
    return `Dose: ${dose || "No renal dose adjustment found in supplied label text"}`;
  }
  return `Dose: ${dose}${frequency ? ` | ${compactFrequency(frequency)}` : ""}`;
}

function shouldShowSeparateInterval(status, frequency) {
  return ["not_found", "review_source", "no_renal_adjustment"].includes(status) && Boolean(frequency);
}

function compactFrequency(value) {
  const text = String(value || "").trim();
  return text
    .replace(/\bevery\s+(\d+)\s+hours?\b/gi, "q$1h")
    .replace(/\bonce\s+daily\b/gi, "daily")
    .replace(/\btwice\s+daily\b/gi, "BID")
    .replace(/\bthree\s+times\s+daily\b/gi, "TID")
    .replace(/\bfour\s+times\s+daily\b/gi, "QID");
}

function compactOptionalLines(lines) {
  return lines.filter((line) => line !== null && line !== undefined);
}

function sexLabel(sex) {
  return sex === "female" ? "Female" : "Male";
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

function formatNumber(value, decimals = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(decimals) : "--";
}

function formatCompactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "--";
  }
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function cleanReplyText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\b(?:dose_found|review_source|no_renal_adjustment|not_found)\b/gi, "")
    .trim();
}
