import {
  buildInterpretation,
  calculateAdjustedBodyWeight,
  calculateBmi,
  calculateCockcroftGault,
  calculateEgfrCkdEpi2021,
  calculateIdealBodyWeight,
  getCkdStage,
  parseClinicalInput,
} from "./renal.js";
import { buildDailyMedSearchUrl } from "./drugLookup.js?v=20260508-1";
import { requestLlmDoseAssist } from "./llmDoseAssist.js?v=20260509-1";
import { normalizeDrugQuery } from "./drugNormalizer.js?v=20260508-2";
import { parseQuickInput } from "./quickInput.js?v=20260509-2";

const form = document.querySelector("#renal-form");
const egfrValue = document.querySelector("#egfr-value");
const crclValue = document.querySelector("#crcl-value");
const ckdStage = document.querySelector("#ckd-stage");
const crclStage = document.querySelector("#crcl-stage");
const weightMethod = document.querySelector("#weight-method");
const crclNote = document.querySelector("#crcl-note");
const interpretationList = document.querySelector("#interpretation-list");
const drugStatus = document.querySelector("#drug-status");
const drugEmpty = document.querySelector("#drug-empty");
const drugResults = document.querySelector("#drug-results");
const drugTitle = document.querySelector("#drug-title");
const drugMeta = document.querySelector("#drug-meta");
const sourceLink = document.querySelector("#source-link");
const doseCallout = document.querySelector("#dose-callout");
const labelSections = document.querySelector("#label-sections");
const dosingContext = document.querySelector("#dosing-context");
const dialysisField = document.querySelector("#dialysis-field");
const indicationField = document.querySelector("#indication-field");
const formulationField = document.querySelector("#formulation-field");
const dialysisSelect = document.querySelector("#dialysis");
const indicationSelect = document.querySelector("#indication");
const formulationSelect = document.querySelector("#formulation");
const copyResultButton = document.querySelector("#copy-result");
const quickInput = document.querySelector("#quick-input");
const quickApplyButton = document.querySelector("#quick-apply");
const recentPanel = document.querySelector("#recent-panel");
const recentList = document.querySelector("#recent-list");
const clearHistoryButton = document.querySelector("#clear-history");
const sourceDetails = document.querySelector("#source-details");
const sourceSummaryText = document.querySelector("#source-summary-text");
const mobileResultStrip = document.querySelector("#mobile-result-strip");
const stripCrcl = document.querySelector("#strip-crcl");
const stripEgfr = document.querySelector("#strip-egfr");
const stripDrug = document.querySelector("#strip-drug");
const stripDose = document.querySelector("#strip-dose");
const telegramWebApp = window.Telegram?.WebApp || null;
const isTelegramMiniApp = detectTelegramMiniApp();
const fields = {
  age: document.querySelector("#age"),
  sex: document.querySelector("#sex"),
  creatinine: document.querySelector("#creatinine"),
  weight: document.querySelector("#weight"),
  height: document.querySelector("#height"),
  drug: document.querySelector("#drug"),
};
let drugLookupRequestId = 0;
let latestRenalSummary = "";
let latestDrugSummary = "";
let latestCockpitState = {
  egfr: null,
  crcl: null,
  drug: "",
  dose: "",
  route: "ALL",
};
const RECENT_KEY = "renal-dose-recent-v2";

initializeTelegramMiniApp();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  notifyTelegramImpact("light");
  await runCalculation(new FormData(form));
});

form.addEventListener("change", async (event) => {
  if (!event.target.matches("#dialysis, #indication, #formulation")) {
    return;
  }
  if (!drugResults.classList.contains("hidden")) {
    await runCalculation(new FormData(form));
  }
});

form.addEventListener("reset", () => {
  window.setTimeout(resetUi, 0);
});

copyResultButton?.addEventListener("click", copyCurrentResult);
doseCallout?.addEventListener("click", handleDoseCalloutClick);
quickApplyButton?.addEventListener("click", applyQuickInput);
quickInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyQuickInput();
  }
});
recentList?.addEventListener("click", handleRecentClick);
clearHistoryButton?.addEventListener("click", clearRecentHistory);

renderRecentHistory();

async function runCalculation(formData) {
  try {
    const values = parseClinicalInput(formData);
    const egfr = calculateEgfrCkdEpi2021(values);
    const crcl = calculateCockcroftGault(values);
    const stage = getCkdStage(egfr);
    const crclTone = getCrclTone(crcl);

    renderRenalResults({ values, egfr, crcl, stage, crclTone });

    if (values.drug) {
      await renderDrugLookup({ ...values, egfr, crcl });
    } else {
      drugLookupRequestId += 1;
      resetDrugUi();
    }
  } catch (error) {
    renderError(error.message);
  }
}

function renderRenalResults({ values, egfr, crcl, stage, crclTone }) {
  egfrValue.textContent = egfr.toFixed(1);
  crclValue.textContent = crcl.toFixed(1);

  ckdStage.textContent = stage.stage;
  ckdStage.dataset.tone = stage.tone;
  crclStage.textContent = crclTone.label;
  crclStage.dataset.tone = crclTone.tone;

  const bmi = calculateBmi(values);
  const idealBodyWeight = calculateIdealBodyWeight(values);
  const adjustedBodyWeight = calculateAdjustedBodyWeight(values);
  weightMethod.textContent = values.height
    ? `Actual ${values.weight} kg · IBW ${idealBodyWeight} kg`
    : "Cockcroft-Gault (Actual body weight)";

  const bodyWeightNote = values.height
    ? `BMI ${bmi} kg/m². Adjusted body weight estimate: ${adjustedBodyWeight ? `${adjustedBodyWeight} kg` : "not needed by current rule"}.`
    : "Height was not entered, so Cockcroft-Gault used actual body weight only.";
  crclNote.textContent = bodyWeightNote;

  const notes = buildInterpretation({ ...values, egfr, crcl });
  interpretationList.innerHTML = notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  latestRenalSummary = [
    "Renal Dose Calculator",
    `Age/Sex: ${values.age} years, ${values.sex}`,
    `S. Creatinine: ${values.creatinine} mg/dL`,
    `Weight: ${values.weight} kg${values.height ? `, height ${values.height} cm` : ""}`,
    `eGFR CKD-EPI 2021: ${egfr.toFixed(1)} mL/min/1.73 m2 (${stage.stage})`,
    `Cockcroft-Gault CrCl: ${crcl.toFixed(1)} mL/min (${crclTone.label})`,
  ].join("\n");
  latestCockpitState = {
    ...latestCockpitState,
    egfr,
    crcl,
    drug: values.drug || latestCockpitState.drug || "",
    route: values.route || latestCockpitState.route || "ALL",
  };
  renderMobileResultStrip();
}

async function renderDrugLookup(values) {
  const requestId = (drugLookupRequestId += 1);
  drugEmpty.classList.add("hidden");
  drugResults.classList.remove("hidden");
  drugStatus.textContent = "Searching";
  drugStatus.classList.add("is-loading");
  drugTitle.textContent = values.drug;
  drugMeta.textContent = "Checking DailyMed/openFDA label text with AI assistance...";
  labelSections.innerHTML = "";
  doseCallout.innerHTML = renderLoadingDoseGuidance(values);
  sourceDetails.open = false;
  sourceSummaryText.textContent = "Waiting for label";
  latestCockpitState = {
    ...latestCockpitState,
    drug: values.drug,
    route: values.route,
    dose: "Searching label",
  };
  renderMobileResultStrip();
  sourceLink.href = buildDailyMedSearchUrl(values.drug);
  sourceLink.classList.remove("is-disabled");

  try {
    const normalizedDrug = await normalizeDrugQuery(values.drug);
    if (requestId !== drugLookupRequestId) {
      return;
    }
    renderDosingContextControls(null);
    const assist = await requestLlmDoseAssist({
      ...values,
      normalizedDrug,
      dialysis: dialysisSelect.value,
      indication: indicationSelect.value,
      formulation: formulationSelect.value,
    });
    if (requestId !== drugLookupRequestId) {
      return;
    }
    renderAssistedDrugGuidance(assist, normalizedDrug, values);
    notifyTelegramNotification("success");
  } catch (error) {
    if (requestId !== drugLookupRequestId) {
      return;
    }
    drugStatus.textContent = "Source needed";
    drugStatus.classList.remove("is-loading");
    drugTitle.textContent = values.drug;
    drugMeta.textContent = error.message;
    sourceLink.href = buildDailyMedSearchUrl(values.drug);
    doseCallout.innerHTML = renderDoseGuidance({
      status: "not_available",
      title: "Dose guidance unavailable",
      badge: "Source needed",
      routeLabel: routeDisplayName(values.route),
      crclBand: `CrCl ${values.crcl.toFixed(1)} mL/min`,
      recommendation:
        "Could not fetch label text for AI-assisted summarization. Use the DailyMed source link for review.",
      caveat: "Educational purpose only. AI-assisted output may be wrong. Results are estimates and are not for prescribing.",
      rows: [],
    });
    labelSections.innerHTML = "";
    sourceDetails.open = false;
    sourceSummaryText.textContent = "Source needed";
    latestCockpitState = {
      ...latestCockpitState,
      drug: values.drug,
      route: values.route,
      dose: "Review source",
    };
    renderMobileResultStrip();
    renderDosingContextControls(null);
    notifyTelegramNotification("error");
  }
}

function renderAssistedDrugGuidance(assist, normalizedDrug, values) {
  const guidance = assist.guidance;
  drugStatus.textContent = formatGuidanceStatus(assist, guidance);
  drugStatus.classList.remove("is-loading");
  drugTitle.textContent = guidance.drugName;
  drugMeta.textContent = [
    formatNormalizationMeta(normalizedDrug),
    `${guidance.routeLabel} label summary`,
    formatAssistSourceMode(assist),
    guidance.sourceLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  sourceLink.href = assist.sourceUrl || guidance.sourceUrl || buildDailyMedSearchUrl(guidance.drugName || values.drug);
  sourceLink.classList.remove("is-disabled");
  renderDosingContextControls(null);
  doseCallout.innerHTML = renderDoseGuidance(guidance, {
    drugName: guidance.drugName,
    route: values.route,
    sourceMode: assist.sourceMode,
  });
  labelSections.innerHTML = renderAssistedSourceSections(assist);
  latestDrugSummary = buildDrugShareText({ assist, guidance, values });
  latestCockpitState = {
    ...latestCockpitState,
    drug: guidance.drugName || values.drug,
    route: values.route,
    dose: formatStripDose(guidance),
  };
  sourceDetails.open = false;
  sourceSummaryText.textContent = summarizeSourceEvidence(assist);
  renderMobileResultStrip();
  addRecentCalculation({ values, guidance, assist });
  setCopyButtonState(true);
  focusDoseResultForSmallScreens();
}

function formatGuidanceStatus(assist, guidance) {
  const sourceMode = assist?.sourceMode || "";
  if (sourceMode === "dailymed-special-review" || sourceMode === "dailymed-table-parser" || sourceMode === "dailymed-table-parser-fallback") {
    return "DailyMed";
  }
  if (sourceMode === "route-not-found") {
    return "Unavailable";
  }
  if (guidance.reviewLevel === "manual-review") {
    return "DailyMed";
  }
  if (guidance.reviewLevel === "source-summary") {
    return "DailyMed";
  }
  return "Dose ready";
}

function renderAssistedSourceSections(assist) {
  const sections = assist.sourceSections || [];
  const sourceSections = sections.filter((section) => section.hasRenalKeyword).slice(0, 3);
  return sourceSections.length
    ? sourceSections.map(renderSection).join("")
    : `<div class="label-section"><h4>No dosing sections returned</h4><p>Open the DailyMed source to review the current label.</p></div>`;
}

function formatAssistSourceMode(assist) {
  const mode = assist?.sourceMode || "";
  const remaining = Number.isFinite(assist?.freeModeRemaining)
    ? ` · ${assist.freeModeRemaining} guarded AI calls left today`
    : "";
  if (mode === "local-mock") {
    return "Local mock AI path";
  }
  if (mode === "cache") {
    return "Cached AI summary";
  }
  if (mode === "no-ai-binding") {
    return "Cloudflare AI not configured";
  }
  if (mode === "free-quota-guard") {
    return "Free AI quota protected";
  }
  if (mode === "route-not-found") {
    return "Selected route not found";
  }
  if (mode === "dailymed-special-review") {
    return "DailyMed renal label logic";
  }
  if (mode === "dailymed-table-parser" || mode === "dailymed-table-parser-fallback") {
    return "DailyMed table parser";
  }
  if (mode === "cloudflare-ai-fallback-model") {
    return `Cloudflare AI fallback model${remaining}`;
  }
  if (mode === "cloudflare-ai-small-model" || mode === "cloudflare-ai-free-guard") {
    return `Cloudflare AI small model${remaining}`;
  }
  return "Cloudflare AI path";
}

function renderLoadingDoseGuidance(values) {
  const crcl = Number(values.crcl);
  const crclBand = getLoadingCrclBand(crcl);
  const crclDisplay = Number.isFinite(crcl) ? crcl.toFixed(1) : "pending";
  const routeLabel = routeDisplayName(values.route);
  const drugName = values.drug || "Selected drug";

  return `
    <div class="dose-loading" role="status" aria-live="polite" aria-label="Loading renal dose guidance">
      <div class="dose-loading-header">
        <span class="dose-badge">AI-assisted DailyMed scan</span>
        <strong>${escapeHtml(drugName)}</strong>
        <span>${escapeHtml(routeLabel)} · CrCl ${escapeHtml(crclDisplay)} mL/min</span>
      </div>

      <div class="dose-loading-grid">
        <div class="source-scan-card" aria-hidden="true">
          <div class="scan-toolbar">
            <span></span>
            <span></span>
            <span></span>
            <strong>DailyMed label</strong>
          </div>
          <div class="scan-sheet">
            <span class="scan-beam"></span>
            <span class="scan-row scan-row-wide"></span>
            <span class="scan-row scan-row-medium"></span>
            <span class="scan-row"></span>
            <div class="scan-highlight">
              <span></span>
              <strong>Renal dosing section</strong>
            </div>
            <span class="scan-row scan-row-short"></span>
            <span class="scan-row scan-row-medium"></span>
          </div>
        </div>

        <div class="dose-build-card">
          <div class="renal-band-loader" style="--crcl-position: ${crclBand.position}%;">
            <div class="band-loader-head">
              <span>Matching CrCl band</span>
              <strong>${escapeHtml(crclBand.label)}</strong>
            </div>
            <div class="band-track" aria-hidden="true">
              <span class="${crclBand.key === "high" ? "is-active" : ""}">&gt;50</span>
              <span class="${crclBand.key === "mid" ? "is-active" : ""}">30-50</span>
              <span class="${crclBand.key === "low" ? "is-active" : ""}">10-29</span>
              <span class="${crclBand.key === "critical" ? "is-active" : ""}">&lt;10</span>
              <i class="crcl-marker"></i>
            </div>
          </div>

          <div class="dose-card-skeleton" aria-hidden="true">
            <span class="skeleton-line skeleton-title"></span>
            <div class="skeleton-dose-grid">
              <span></span>
              <span></span>
            </div>
            <span class="skeleton-line"></span>
            <span class="skeleton-line skeleton-short"></span>
          </div>
        </div>
      </div>

      <div class="source-steps">
        <div><span></span>Find human label</div>
        <div><span></span>Read renal text</div>
        <div><span></span>Match CrCl band</div>
        <div><span></span>Build quick card</div>
      </div>
    </div>
  `;
}

function getLoadingCrclBand(crcl) {
  if (!Number.isFinite(crcl)) {
    return { key: "unknown", label: "CrCl pending", position: 8 };
  }
  if (crcl > 50) {
    return { key: "high", label: ">50 mL/min", position: 12.5 };
  }
  if (crcl >= 30) {
    return { key: "mid", label: "30-50 mL/min", position: 37.5 };
  }
  if (crcl >= 10) {
    return { key: "low", label: "10-29 mL/min", position: 62.5 };
  }
  return { key: "critical", label: "<10 mL/min", position: 87.5 };
}

function renderDoseGuidance(guidance, context = {}) {
  const recommendation = buildRecommendationDisplay(guidance);
  const chips = buildGuidanceChips(guidance, context);
  const drugHeading = context.drugName
    ? `${context.drugName}${guidance.routeLabel ? ` (${guidance.routeLabel})` : ""}`
    : guidance.title;
  const rows = guidance.rows?.length
    ? `
      <details class="dose-table">
        <summary>View parsed renal bands</summary>
        <div class="dose-bands" aria-label="Parsed renal dose bands">
          ${guidance.rows
            .map(
              (row) => `
                <div class="dose-band ${row.selected ? "is-selected" : ""}">
                  <span>${escapeHtml(row.band)}</span>
                  <strong>${escapeHtml(row.recommendation)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </details>
    `
    : "";
  const safetyNote = buildGuidanceSafetyNote(guidance);
  const sourceHref = guidance.sourceUrl || sourceLink?.href || "";

  return `
    <div class="dose-guidance" data-status="${escapeHtml(guidance.status)}" data-review-level="${escapeHtml(guidance.reviewLevel || "clean-dose")}">
      <div class="dose-guidance-header">
        <div class="dose-header-stack">
          <span class="dose-badge">${escapeHtml(guidance.badge)}</span>
          <div class="dose-chip-row" aria-label="Dose context">
            ${chips.map((chip) => `<span class="dose-context-chip" data-tone="${escapeHtml(chip.tone)}">${escapeHtml(chip.label)}</span>`).join("")}
          </div>
        </div>
      </div>
      <div class="guidance-safety" data-level="${escapeHtml(guidance.reviewLevel || "clean-dose")}">
        <strong>${escapeHtml(safetyNote.title)}</strong>
        <span>${escapeHtml(safetyNote.text)}</span>
      </div>
      <div class="dose-main">
        <div class="dose-band-large">
          <span>${escapeHtml(guidance.renalBandLabel || (guidance.crclBand ? "CrCl band" : guidance.routeLabel))}</span>
          <strong>${escapeHtml(cleanRenalBand(guidance.crclBand) || guidance.routeLabel)}</strong>
        </div>
        <div class="dose-recommendation">
          <h3>${escapeHtml(drugHeading)}</h3>
          <div class="dose-columns">
            <div>
              <span>${escapeHtml(recommendation.label)}</span>
              <strong>${escapeHtml(recommendation.dose)}</strong>
            </div>
            <div>
              <span>${escapeHtml(recommendation.intervalLabel)}</span>
              <strong>${escapeHtml(recommendation.interval)}</strong>
            </div>
          </div>
          ${guidance.indicationNote ? `<p class="dose-note">${escapeHtml(guidance.indicationNote)}</p>` : ""}
          <p>${escapeHtml(guidance.caveat)}</p>
        </div>
      </div>
      <div class="dose-actions-row">
        <button class="text-action" type="button" data-action="show-source">Why this dose?</button>
        ${
          sourceHref && !sourceHref.endsWith("#")
            ? `<a class="text-action" href="${escapeHtml(sourceHref)}" target="_blank" rel="noreferrer">Open DailyMed</a>`
            : ""
        }
      </div>
      ${rows}
    </div>
  `;
}

function buildGuidanceChips(guidance, context = {}) {
  const chips = [];
  const sourceMode = context.sourceMode || "";
  chips.push({ label: sourceMode.includes("table-parser") ? "Parsed table" : "DailyMed label", tone: "source" });
  chips.push({ label: guidance.renalMetricUsed === "egfr" || /egfr/i.test(guidance.renalBandLabel || "") ? "eGFR-based" : "CrCl-based", tone: "metric" });
  if (guidance.routeLabel) {
    chips.push({ label: guidance.routeLabel, tone: "route" });
  }
  const combined = `${guidance.dose || ""} ${guidance.interval || ""} ${guidance.indicationNote || ""}`;
  if (/no renal dose adjustment|no dose adjustment/i.test(combined)) {
    chips.push({ label: "No renal adjustment", tone: "ok" });
  } else if (/contraindicated|do not use|avoid|not recommended|do not initiate/i.test(combined)) {
    chips.push({ label: "Restriction", tone: "caution" });
  } else if (/level|auc|monitor|indication|susceptibility|formulation/i.test(combined)) {
    chips.push({ label: "Context needed", tone: "caution" });
  } else {
    chips.push({ label: "Dose matched", tone: "ok" });
  }
  return chips.slice(0, 5);
}

function renderDosingContextControls(options, selected = {}) {
  const hasDialysis = renderSelectOptions(dialysisSelect, options?.dialysis, selected.dialysis);
  const hasIndication = renderSelectOptions(indicationSelect, options?.indications, selected.indication);
  const hasFormulation = renderSelectOptions(formulationSelect, options?.formulations, selected.formulation);
  const hasAnyContext = hasDialysis || hasIndication || hasFormulation;

  dosingContext.classList.toggle("hidden", !hasAnyContext);
  dialysisField.classList.toggle("hidden", !hasDialysis);
  indicationField.classList.toggle("hidden", !hasIndication);
  formulationField.classList.toggle("hidden", !hasFormulation);
}

function renderSelectOptions(select, options = [], selectedValue = "") {
  const visibleOptions = Array.isArray(options) ? options : [];
  if (visibleOptions.length <= 1) {
    return false;
  }

  const currentValue = selectedValue || select.value;
  select.innerHTML = visibleOptions
    .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
  select.value = visibleOptions.some((option) => option.value === currentValue)
    ? currentValue
    : visibleOptions[0].value;
  return true;
}

function buildRecommendationDisplay(guidance) {
  if (guidance.dose || guidance.interval) {
    const reviewLevel = guidance.reviewLevel || "clean-dose";
    const actionLike = isActionLikeRecommendation(`${guidance.dose || ""} ${guidance.interval || ""}`);
    if (reviewLevel === "manual-review") {
      return {
        label: "Clinical action",
        dose: guidance.dose || "DailyMed source guidance",
        intervalLabel: "Instruction",
        interval: guidance.interval || "Use source-linked label details",
      };
    }
    if (reviewLevel === "source-summary") {
      return {
        label: "DailyMed guidance",
        dose: guidance.dose || "No renal dose adjustment",
        intervalLabel: "Instruction",
        interval: guidance.interval || "Use usual adult schedule by indication",
      };
    }
    return {
      label: actionLike ? "Action" : "Dose",
      dose: guidance.dose || "Recommended dose",
      intervalLabel: actionLike ? "Instruction" : "Frequency",
      interval: guidance.interval || "By indication",
    };
  }

  return splitRecommendation(guidance.recommendation);
}

function buildGuidanceSafetyNote(guidance) {
  if (guidance.reviewLevel === "manual-review") {
    return {
      title: "Source-derived guidance",
      text: "DailyMed renal information is shown when available; some drugs need indication, formulation, dialysis, levels, or interaction context.",
    };
  }
  if (guidance.reviewLevel === "source-summary") {
    return {
      title: "DailyMed source guidance",
      text: "The selected label did not provide a CrCl-based dose reduction for this input; use the linked label for full context.",
    };
  }
  return {
    title: "Source-matched output",
    text: "Shown from DailyMed/openFDA label text or deterministic label logic. Educational use only.",
  };
}

function isActionLikeRecommendation(text) {
  return /\b(?:do not initiate|contraindicated|discontinue|do not use|avoid|not recommended|no renal dose adjustment|no dose adjustment|review)\b/i.test(
    text
  );
}

function buildDrugShareText({ assist, guidance, values }) {
  const drug = guidance.drugName || values.drug;
  const route = guidance.routeLabel || routeDisplayName(values.route);
  const renalBand = guidance.crclBand || `${guidance.renalMetricUsed === "egfr" ? "eGFR" : "CrCl"} ${formatNumber(values.crcl)} mL/min`;
  const dose = guidance.dose || "DailyMed source guidance";
  const interval = guidance.interval || "Use linked label details";
  const caution = compactQuickText(guidance.indicationNote || "", 180);
  const source = assist.sourceUrl || guidance.sourceUrl || "";
  return [
    `Renal dose guidance: ${drug} (${route})`,
    `CrCl ${formatNumber(values.crcl)} mL/min; eGFR ${formatNumber(values.egfr)} mL/min/1.73 m2.`,
    `${renalBand}: ${dose}${interval ? `; ${interval}` : ""}.`,
    caution ? `Note: ${caution}` : "",
    source ? `DailyMed: ${source}` : "",
    "Educational purpose only. Results are estimates and are not for prescribing.",
    "Made by Dr. Tufayl (Cortex Labs)",
  ]
    .filter(Boolean)
    .join("\n");
}

async function copyCurrentResult() {
  const text = latestDrugSummary || latestRenalSummary;
  if (!text || !copyResultButton) {
    return;
  }

  const originalText = copyResultButton.querySelector("span")?.textContent || "Copy";
  try {
    await navigator.clipboard.writeText(text);
    setCopyButtonLabel("Copied");
    notifyTelegramNotification("success");
  } catch {
    setCopyButtonLabel("Copy failed");
    notifyTelegramNotification("error");
  }
  window.setTimeout(() => setCopyButtonLabel(originalText), 1400);
}

function setCopyButtonState(enabled) {
  if (!copyResultButton) {
    return;
  }
  copyResultButton.disabled = !enabled;
  copyResultButton.setAttribute("aria-disabled", String(!enabled));
}

function setCopyButtonLabel(value) {
  const label = copyResultButton?.querySelector("span");
  if (label) {
    label.textContent = value;
  }
}

function handleDoseCalloutClick(event) {
  const action = event.target.closest("[data-action='show-source']");
  if (!action || !sourceDetails) {
    return;
  }
  sourceDetails.open = true;
  document.querySelector("#source-panel")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function focusDoseResultForSmallScreens() {
  if (!window.matchMedia("(max-width: 720px)").matches || !doseCallout) {
    return;
  }
  window.setTimeout(() => {
    doseCallout.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 120);
}

async function applyQuickInput() {
  const parsed = parseQuickInput(quickInput?.value || "");
  if (!parsed) {
    quickInput?.focus();
    return;
  }

  fillClinicalFields(parsed);
  await runCalculation(new FormData(form));
}

function fillClinicalFields(parsed) {
  fields.age.value = parsed.age || "";
  fields.sex.value = parsed.sex || "male";
  fields.creatinine.value = parsed.creatinine || "";
  fields.weight.value = parsed.weight || "";
  fields.height.value = parsed.height || "";
  fields.drug.value = parsed.drug || "";
  setRoute(parsed.route || "ALL");
}

function setRoute(route) {
  const routeInput = form.querySelector(`input[name="route"][value="${route}"]`);
  if (routeInput) {
    routeInput.checked = true;
  }
}

function renderMobileResultStrip() {
  if (!mobileResultStrip) {
    return;
  }
  const hasRenal = Number.isFinite(latestCockpitState.crcl) || Number.isFinite(latestCockpitState.egfr);
  mobileResultStrip.classList.toggle("hidden", !hasRenal);
  stripCrcl.textContent = Number.isFinite(latestCockpitState.crcl)
    ? latestCockpitState.crcl.toFixed(1)
    : "--";
  stripEgfr.textContent = Number.isFinite(latestCockpitState.egfr)
    ? latestCockpitState.egfr.toFixed(1)
    : "--";
  stripDrug.textContent = latestCockpitState.drug || "No drug";
  stripDose.textContent = latestCockpitState.dose || "Awaiting result";
}

function formatStripDose(guidance) {
  const dose = guidance.dose || "Review source";
  const interval = guidance.interval || "";
  if (/^review/i.test(dose)) {
    return "Review source";
  }
  if (!interval || /by indication|source review required/i.test(interval)) {
    return compactQuickText(dose, 42);
  }
  return compactQuickText(`${dose} · ${interval}`, 58);
}

function summarizeSourceEvidence(assist) {
  const count = (assist.sourceSections || []).filter((section) => section.hasRenalKeyword).length;
  if (count > 1) {
    return `${count} renal sections`;
  }
  if (count === 1) {
    return "1 renal section";
  }
  return "Open source preview";
}

function addRecentCalculation({ values, guidance, assist }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    age: values.age,
    sex: values.sex,
    creatinine: values.creatinine,
    weight: values.weight,
    height: values.height || "",
    drug: values.drug,
    route: values.route,
    egfr: values.egfr,
    crcl: values.crcl,
    dose: guidance.dose || "",
    interval: guidance.interval || "",
    label: guidance.drugName || values.drug,
    sourceMode: assist.sourceMode || "",
  };
  const key = recentKey(entry);
  const next = [entry, ...readRecentHistory().filter((item) => recentKey(item) !== key)].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  renderRecentHistory();
}

function recentKey(entry) {
  return [
    entry.age,
    entry.sex,
    entry.creatinine,
    entry.weight,
    entry.height,
    entry.drug,
    entry.route,
  ].join("|").toLowerCase();
}

function readRecentHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderRecentHistory() {
  const items = readRecentHistory();
  if (!recentPanel || !recentList) {
    return;
  }
  recentPanel.classList.toggle("hidden", items.length === 0);
  recentList.innerHTML = items
    .map(
      (item, index) => `
        <button class="recent-item" type="button" data-index="${index}">
          <span>${escapeHtml(item.label || item.drug || "Drug")}</span>
          <strong>${escapeHtml(routeDisplayName(item.route))} · CrCl ${Number(item.crcl).toFixed(1)} · ${escapeHtml(formatStripDose(item))}</strong>
        </button>
      `
    )
    .join("");
}

async function handleRecentClick(event) {
  const button = event.target.closest(".recent-item");
  if (!button) {
    return;
  }
  const item = readRecentHistory()[Number(button.dataset.index)];
  if (!item) {
    return;
  }
  fillClinicalFields(item);
  await runCalculation(new FormData(form));
}

function clearRecentHistory() {
  localStorage.removeItem(RECENT_KEY);
  renderRecentHistory();
}

function detectTelegramMiniApp() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("telegram") === "1" ||
    params.has("tgWebAppData") ||
    Boolean(telegramWebApp?.initData)
  );
}

function initializeTelegramMiniApp() {
  if (!isTelegramMiniApp) {
    return;
  }

  document.documentElement.classList.add("is-telegram-mini-app");
  document.body.classList.add("is-telegram-mini-app");
  addTelegramMiniAppBadge();

  if (!telegramWebApp) {
    return;
  }

  try {
    applyTelegramTheme();
    telegramWebApp.onEvent?.("themeChanged", applyTelegramTheme);
    telegramWebApp.ready?.();
    telegramWebApp.expand?.();
  } catch {
    // Telegram WebApp methods are only available inside the Telegram client.
  }
}

function addTelegramMiniAppBadge() {
  const actions = document.querySelector(".topbar-actions");
  if (!actions || actions.querySelector("[data-telegram-mini-app-badge]")) {
    return;
  }

  const badge = document.createElement("div");
  badge.className = "status-pill subtle";
  badge.dataset.telegramMiniAppBadge = "true";
  badge.textContent = "Telegram Mini App";
  actions.prepend(badge);
}

function applyTelegramTheme() {
  const theme = telegramWebApp?.themeParams || {};
  const root = document.documentElement;
  const colorMap = {
    "--page": theme.bg_color,
    "--canvas": theme.secondary_bg_color || theme.bg_color,
    "--surface": theme.secondary_bg_color || theme.bg_color,
    "--surface-soft": theme.secondary_bg_color || theme.bg_color,
    "--ink": theme.text_color,
    "--text": theme.text_color,
    "--muted": theme.hint_color,
    "--placeholder": theme.hint_color,
    "--line": theme.section_separator_color || theme.hint_color,
    "--line-strong": theme.section_separator_color || theme.hint_color,
    "--teal": theme.button_color,
    "--teal-dark": theme.button_color,
    "--blue": theme.link_color,
  };

  Object.entries(colorMap).forEach(([name, value]) => {
    if (value) {
      root.style.setProperty(name, value);
    }
  });

  root.style.colorScheme = telegramWebApp?.colorScheme === "dark" ? "dark" : "light";

  try {
    telegramWebApp.setHeaderColor?.(theme.bg_color || "#f8fbfa");
    telegramWebApp.setBackgroundColor?.(theme.bg_color || "#f8fbfa");
    telegramWebApp.setBottomBarColor?.(theme.secondary_bg_color || theme.bg_color || "#f8fbfa");
  } catch {
    // Some Telegram clients do not expose every color method.
  }
}

function notifyTelegramImpact(style = "light") {
  if (!isTelegramMiniApp) {
    return;
  }
  try {
    telegramWebApp?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    // Haptics are best-effort only.
  }
}

function notifyTelegramNotification(type = "success") {
  if (!isTelegramMiniApp) {
    return;
  }
  try {
    telegramWebApp?.HapticFeedback?.notificationOccurred?.(type);
  } catch {
    // Haptics are best-effort only.
  }
}

function renderSection(section) {
  const badge = section.hasRenalKeyword ? `<span class="keyword-badge">renal match</span>` : "";
  return `
    <article class="label-section">
      <h4>${escapeHtml(section.heading)} ${badge}</h4>
      <p>${escapeHtml(section.text)}</p>
    </article>
  `;
}

function renderError(message) {
  egfrValue.textContent = "--";
  crclValue.textContent = "--";
  ckdStage.textContent = "Check input";
  ckdStage.dataset.tone = "danger";
  crclStage.textContent = "Check input";
  crclStage.dataset.tone = "danger";
  crclNote.textContent = message;
  interpretationList.innerHTML = `<li>${escapeHtml(message)}</li>`;
  latestCockpitState = { egfr: null, crcl: null, drug: "", dose: "Check input", route: "ALL" };
  renderMobileResultStrip();
}

function resetUi() {
  egfrValue.textContent = "--";
  crclValue.textContent = "--";
  ckdStage.textContent = "Waiting";
  ckdStage.dataset.tone = "neutral";
  crclStage.textContent = "Waiting";
  crclStage.dataset.tone = "neutral";
  weightMethod.textContent = "Cockcroft-Gault";
  crclNote.textContent = "Enter adult patient details to calculate CrCl for medication dosing.";
  interpretationList.innerHTML = "<li>No calculation yet.</li>";
  latestRenalSummary = "";
  latestCockpitState = { egfr: null, crcl: null, drug: "", dose: "", route: "ALL" };
  renderMobileResultStrip();
  resetDrugUi();
}

function resetDrugUi() {
  drugLookupRequestId += 1;
  drugStatus.textContent = "No drug";
  drugStatus.classList.remove("is-loading");
  drugEmpty.classList.remove("hidden");
  drugResults.classList.add("hidden");
  drugTitle.textContent = "No drug selected";
  drugMeta.textContent = "Search a drug to view label evidence.";
  sourceLink.href = "#";
  sourceLink.classList.add("is-disabled");
  labelSections.innerHTML = "";
  sourceDetails.open = false;
  sourceSummaryText.textContent = "Open source preview";
  latestDrugSummary = "";
  latestCockpitState = {
    ...latestCockpitState,
    drug: "",
    dose: Number.isFinite(latestCockpitState.crcl) ? "Awaiting result" : "",
  };
  renderMobileResultStrip();
  setCopyButtonState(false);
  renderDosingContextControls(null);
}

function getCrclTone(crcl) {
  if (!Number.isFinite(crcl)) {
    return { label: "Waiting", tone: "neutral" };
  }
  if (crcl >= 60) {
    return { label: "Mild", tone: "good" };
  }
  if (crcl >= 30) {
    return { label: "Moderate", tone: "caution" };
  }
  if (crcl >= 15) {
    return { label: "Severe", tone: "warning" };
  }
  return { label: "Very severe", tone: "danger" };
}

function splitRecommendation(text) {
  const cleaned = compactQuickText(text);
  const schedule = splitCommonSchedule(cleaned);

  if (schedule) {
    return schedule;
  }

  const intervalPattern =
    /\b(every\s+\d+\s+hours?|q\s*\d+\s*h(?:ours?)?|once daily|twice daily|three times daily|four times daily|daily|divided\s+(?:BID|TID|QID)|BID|TID|QID|at bedtime|every\s+\d+\s+days?)\b/gi;
  const intervalMatches = [...cleaned.matchAll(intervalPattern)];

  if (!intervalMatches.length) {
    return {
      label: "Recommendation",
      dose: cleaned || "Review source",
      intervalLabel: "Interval",
      interval: needsManualReview(cleaned) ? "Review source" : "By indication",
    };
  }

  if (intervalMatches.length > 1) {
    return {
      label: "Recommendation",
      dose: cleaned,
      intervalLabel: "Interval",
      interval: "By indication",
    };
  }

  const intervalMatch = intervalMatches[0];
  const dose = compactQuickText(cleaned.slice(0, intervalMatch.index), 80) || "Recommended dose";
  const interval = intervalMatch[0].replace(/^every\s+/i, "");
  return {
    label: "Recommended dose",
    dose,
    intervalLabel: /^every\s+/i.test(intervalMatch[0]) ? "Every" : "Schedule",
    interval,
  };
}

function splitCommonSchedule(text) {
  const cleaned = String(text || "").trim();
  const usualScheduleMatch = cleaned.match(
    /\b(?:usual adult schedule by indication|usual schedule by indication|usual interval unless reduced)\b/i
  );

  if (usualScheduleMatch) {
    return {
      label: "Recommendation",
      dose: compactQuickText(cleaned.slice(0, usualScheduleMatch.index), 90) || "No renal dose adjustment specified",
      intervalLabel: "Schedule",
      interval: "By indication",
    };
  }

  const sourceSummary = cleaned.match(/^Source summary only\s*/i);
  if (sourceSummary) {
    return {
      label: "Source summary",
      dose: compactQuickText(cleaned.replace(/^Source summary only\s*/i, ""), 95),
      intervalLabel: "Action",
      interval: "Review label",
    };
  }

  return null;
}

function needsManualReview(text) {
  return /review|not studied|not established|not recommended|contraindicated|avoid|source summary/i.test(text);
}

function compactQuickText(text, maxLength = 150) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 3).trim()}...`;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : "--";
}

function cleanRenalBand(value) {
  return String(value || "")
    .replace(/^(?:CrCl|eGFR)\s*/i, "")
    .replace(/\s*mL\/min(?:\/1\.73\s*m2)?$/i, "")
    .trim();
}

function routeDisplayName(route) {
  if (route === "IV") {
    return "IV";
  }
  if (route === "ORAL") {
    return "Oral";
  }
  if (route === "SC" || route === "SUBQ") {
    return "Subcutaneous";
  }
  if (route === "IM") {
    return "IM";
  }
  return "All routes";
}

function formatNormalizationMeta(normalization) {
  if (!normalization?.changed) {
    return "";
  }

  if (normalization.source === "rxnorm" && normalization.rxcui) {
    return `Matched by RxNorm: ${normalization.original} -> ${normalization.displayName} (${normalization.rxcui})`;
  }

  return `Matched alias: ${normalization.original} -> ${normalization.displayName}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
