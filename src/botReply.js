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
    route: parsed.route || "ORAL",
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
    italic("Adult eGFR + Cockcroft-Gault CrCl + DailyMed renal-dose helper.", platform),
    "",
    heading("Send Like This", platform),
    codeLine("45 M 2.1 70 meropenem IV", platform),
    "",
    heading("Format", platform),
    codeLine("age sex S.Creatinine weight drug route", platform),
    formatLabelLine("Route", "Oral by default. Write IV for injection labels.", platform),
    formatLabelLine("Required", "Age, sex, S. Creatinine, weight.", platform),
    formatLabelLine("Optional", "Drug and height.", platform),
    "",
    heading("Commands", platform),
    formatLabelLine("FORM", "copy-paste template", platform),
    formatLabelLine("WEB", "open calculator", platform),
    "",
    APP_URL,
    "",
    italic(EDUCATIONAL_DISCLAIMER, platform),
    italic(BRAND_LINE, platform),
  ].join("\n");
}

function buildFormReply() {
  return [
    heading("Renal Dose Calculator Form", "WhatsApp"),
    "",
    italic("Copy, fill, and send:", "WhatsApp"),
    "",
    formatLabelLine("Age", "", "WhatsApp"),
    formatLabelLine("Sex", "M/F", "WhatsApp"),
    formatLabelLine("S. Creatinine mg/dL", "", "WhatsApp"),
    formatLabelLine("Weight kg", "", "WhatsApp"),
    formatLabelLine("Height cm", "optional", "WhatsApp"),
    formatLabelLine("Drug", "optional", "WhatsApp"),
    formatLabelLine("Route", "Oral/IV optional", "WhatsApp"),
    "",
    heading("Example", "WhatsApp"),
    codeLine(
      [
        "Age: 45",
        "Sex: Male",
        "S. Creatinine mg/dL: 2.1",
        "Weight kg: 70",
        "Height cm: 170",
        "Drug: meropenem",
        "Route: IV",
      ].join("\n"),
      "WhatsApp"
    ),
    "",
    italic(EDUCATIONAL_DISCLAIMER, "WhatsApp"),
    italic(BRAND_LINE, "WhatsApp"),
  ].join("\n");
}

function buildWebReply() {
  return [
    heading("Open Web Calculator", "WhatsApp"),
    APP_URL,
    "",
    italic(EDUCATIONAL_DISCLAIMER, "WhatsApp"),
  ].join("\n");
}

function buildInputErrorReply(errorMessage, { platform = "WhatsApp" } = {}) {
  return [
    heading("Could Not Calculate", platform),
    "",
    formatLabelLine("Reason", cleanReplyText(errorMessage), platform),
    "",
    heading("Use This Format", platform),
    codeLine("45 M 2.1 70 meropenem IV", platform),
    "",
    `Or send FORM for the ${platform} template.`,
    "",
    italic(EDUCATIONAL_DISCLAIMER, platform),
    italic(BRAND_LINE, platform),
  ].join("\n");
}

function formatKidneyOnlyReply(values, options = {}) {
  const stage = getCkdStage(values.egfr);
  const platform = options.platform || "WhatsApp";
  const lines = [
    heading("Renal Dose Calculator", platform),
    "",
    heading("Patient", platform),
    ...formatPatientLines(values, platform),
    "",
    heading("Kidney Function", platform),
    formatLabelLine("eGFR", `${formatNumber(values.egfr)} mL/min/1.73 m2`, platform),
    formatLabelLine("CKD", `${stage.stage} - ${stage.label}`, platform),
    formatLabelLine("CrCl", `${formatNumber(values.crcl)} mL/min`, platform),
    formatLabelLine("Method", "Cockcroft-Gault", platform),
    "",
    heading("Disclaimer", platform),
    italic(EDUCATIONAL_DISCLAIMER, platform),
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
  const guidanceLines = buildGuidanceLines(status, dose, frequency, platform);
  const noteLines = [
    result.dialysisNote ? `Dialysis: ${cleanReplyText(result.dialysisNote)}` : "",
    ...cautions.slice(0, 2).map((caution) => cleanReplyText(caution)),
  ].filter(Boolean);

  const lines = [
    heading("Renal Dose Calculator", platform),
    "",
    heading("Patient", platform),
    ...formatPatientLines(values, platform),
    "",
    heading("Kidney Function", platform),
    formatLabelLine("eGFR", `${formatNumber(values.egfr)} mL/min/1.73 m2 | CKD ${stage.stage}`, platform),
    formatLabelLine("CrCl", `${formatNumber(values.crcl)} mL/min | Cockcroft-Gault`, platform),
    "",
    heading("Dose Guidance", platform),
    formatLabelLine("Drug", drugName, platform),
    formatLabelLine("Route", route, platform),
    renalBand ? formatLabelLine("Renal band", renalBand, platform) : null,
    ...guidanceLines,
    noteLines.length ? "" : null,
    noteLines.length ? heading("Notes", platform) : null,
    ...noteLines.map((note) => italic(`- ${note}`, platform)),
    sourceUrl ? "" : null,
    sourceUrl ? heading("Source", platform) : null,
    sourceUrl ? formatLabelLine("DailyMed", sourceUrl, platform) : null,
    "",
    heading("Disclaimer", platform),
    italic(AI_DISCLAIMER, platform),
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

function formatPatientLines(values, platform) {
  return [
    formatLabelLine("Age/Sex", `${formatNumber(values.age, 0)} yr ${sexLabel(values.sex)}`, platform),
    formatLabelLine("S. Creatinine", `${formatCompactNumber(values.creatinine)} mg/dL`, platform),
    formatLabelLine("Weight", `${formatCompactNumber(values.weight)} kg`, platform),
    values.height ? formatLabelLine("Height", `${formatNumber(values.height, 0)} cm`, platform) : null,
  ].filter(Boolean);
}

function heading(value, platform) {
  return platform === "WhatsApp" ? `*${value}*` : value;
}

function formatLabelLine(label, value, platform) {
  const prefix = platform === "WhatsApp" ? `*${label}:*` : `${label}:`;
  return value ? `${prefix} ${value}` : prefix;
}

function italic(value, platform) {
  return platform === "WhatsApp" ? `_${value}_` : value;
}

function codeLine(value, platform) {
  return platform === "WhatsApp" ? `\`\`\`${value}\`\`\`` : value;
}

function buildGuidanceLines(status, dose, frequency, platform) {
  if (status === "not_found") {
    return [
      formatLabelLine("Action", dose || "Drug label not found", platform),
      formatLabelLine("Details", compactFrequency(frequency), platform),
    ].filter(Boolean);
  }
  if (status === "review_source") {
    return [
      formatLabelLine("Action", dose || "Review DailyMed source", platform),
      formatLabelLine("Details", compactFrequency(frequency), platform),
    ].filter(Boolean);
  }
  if (status === "no_renal_adjustment") {
    return [
      formatLabelLine("Action", dose || "No renal dose adjustment found in supplied label text", platform),
      frequency ? formatLabelLine("Details", compactFrequency(frequency), platform) : null,
    ].filter(Boolean);
  }
  return [
    formatLabelLine("Dose", dose, platform),
    frequency ? formatLabelLine("Frequency", compactFrequency(frequency), platform) : null,
  ].filter(Boolean);
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
  return "Oral";
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
