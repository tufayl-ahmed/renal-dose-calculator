import {
  buildInterpretation,
  calculateAdjustedBodyWeight,
  calculateBmi,
  calculateCockcroftGault,
  calculateEgfrCkdEpi2021,
  calculateIdealBodyWeight,
  getCkdStage,
  selectCrclWeight,
  UMOL_PER_MG_DL,
} from "../renal.js";
import { $, html, setHtml } from "./dom.js";

// Equal-width gauge segments; each maps an eGFR range onto one sixth of the bar.
const GAUGE_STOPS = [0, 15, 30, 45, 60, 90, 120];

export function computeRenal(values) {
  const egfr = calculateEgfrCkdEpi2021(values);
  const crclWeight = selectCrclWeight({ ...values, basis: values.weightBasis });
  const crcl = calculateCockcroftGault({ ...values, weight: crclWeight.weight });
  const ibw = calculateIdealBodyWeight(values);
  const abw = calculateAdjustedBodyWeight(values);
  const crclByWeight = ibw
    ? {
        actual: calculateCockcroftGault(values),
        ideal: calculateCockcroftGault({ ...values, weight: Math.min(ibw, values.weight) }),
        adjusted: abw ? calculateCockcroftGault({ ...values, weight: abw }) : null,
      }
    : null;
  return {
    egfr,
    crcl,
    crclWeight,
    crclByWeight,
    stage: getCkdStage(egfr),
    bmi: calculateBmi(values),
    ibw,
    abw,
    bsa: calculateMostellerBsa(values),
  };
}

export function renderKidneyCard(values, renal) {
  countTo($("#crcl-value"), renal.crcl);
  countTo($("#egfr-value"), renal.egfr);
  $("#crcl-note").textContent = describeCrcl(renal.crcl);
  $("#egfr-note").textContent = `${renal.stage.stage} · ${renal.stage.label}`;

  const tag = $("#ckd-tag");
  tag.textContent = `CKD ${renal.stage.stage}`;
  tag.dataset.tone = renal.stage.tone;

  const marker = $("#gauge-marker");
  marker.classList.remove("hidden");
  marker.style.setProperty("--pos", `${gaugePosition(renal.egfr)}%`);
  marker.dataset.tone = renal.stage.tone;
  document.querySelectorAll("#ckd-gauge [data-stage]").forEach((segment) => {
    segment.classList.toggle("is-active", segment.dataset.stage === renal.stage.stage);
  });

  $("#bmi-value").textContent = renal.bmi ? `${renal.bmi} kg/m²` : "Add height";
  $("#ibw-value").textContent = renal.ibw ? `${renal.ibw} kg` : "Add height";
  $("#abw-value").textContent = renal.abw ? `${renal.abw} kg` : renal.ibw ? "Not needed" : "Add height";
  $("#bsa-value").textContent = renal.bsa ? `${renal.bsa} m²` : "Add height";

  const basisLabel = { actual: "actual", ideal: "ideal", adjusted: "adjusted" }[renal.crclWeight.basis];
  const notes = [
    `Cockcroft-Gault used ${basisLabel} body weight (${renal.crclWeight.weight} kg).`,
    ...buildInterpretation({ ...values, egfr: renal.egfr, crcl: renal.crcl }).filter(
      (note) => !/^CKD G category|^For drug dosing/.test(note)
    ),
  ];
  if (renal.crclByWeight) {
    const { actual, ideal, adjusted } = renal.crclByWeight;
    notes.push(
      `CrCl by weight: actual ${actual.toFixed(1)}, ideal ${ideal.toFixed(1)}${adjusted ? `, adjusted ${adjusted.toFixed(1)}` : ""} mL/min.`
    );
  }
  if (renal.abw && renal.bmi >= 30 && renal.crclWeight.basis === "actual") {
    notes.push(`BMI ≥30: many protocols use adjusted body weight (${renal.abw} kg) for Cockcroft-Gault.`);
  }
  if (values.creatinineUnit === "umol") {
    notes.push(`Creatinine ${values.creatinineInput} µmol/L = ${values.creatinine} mg/dL (÷${UMOL_PER_MG_DL}).`);
  }
  if (!values.unstable && values.dialysis === "none") {
    notes.push("A single creatinine assumes stable kidney function; estimates are unreliable in acute kidney injury.");
  }
  setHtml($("#kidney-notes"), html`${notes.map((note) => html`<li>${note}</li>`)}`);

  const alert = kidneyAlert(values);
  $("#kidney-card").classList.toggle("is-dialysis", values.dialysis !== "none");
  $("#kidney-alert").classList.toggle("hidden", !alert);
  $("#kidney-alert").textContent = alert;
  $("#weight-basis-note").textContent =
    renal.crclWeight.note ||
    (renal.ibw
      ? `Ideal ${renal.ibw} kg${renal.abw ? ` · adjusted ${renal.abw} kg` : ""}`
      : "Ideal and adjusted weight need height.");

  $("#bar-crcl").textContent = renal.crcl.toFixed(0);
  $("#bar-egfr").textContent = renal.egfr.toFixed(0);
}

export function kidneyAlert(values) {
  if (values.dialysis === "hd" || values.dialysis === "pd") {
    return `On ${values.dialysis === "hd" ? "hemodialysis" : "peritoneal dialysis"}: creatinine-based eGFR and CrCl are not valid. Drug guidance uses dialysis rules where the label has them, otherwise the lowest renal band (CrCl < 10).`;
  }
  if (values.dialysis === "crrt") {
    return "On CRRT: clearance depends on the prescribed effluent rate, not creatinine. Drug guidance needs pharmacy or local CRRT protocol review.";
  }
  if (values.unstable) {
    return "Creatinine not stable: eGFR and CrCl assume steady state and may overestimate kidney function in AKI. Re-check dosing as creatinine changes.";
  }
  return "";
}

export function resetKidneyCard() {
  ["#crcl-value", "#egfr-value"].forEach((id) => window.cancelAnimationFrame(Number($(id).dataset.frame || 0)));
  $("#kidney-alert").classList.add("hidden");
  $("#kidney-card").classList.remove("is-dialysis");
  $("#crcl-value").textContent = "—";
  $("#egfr-value").textContent = "—";
  $("#crcl-note").textContent = "Used for most drug labels";
  $("#egfr-note").textContent = "KDIGO category";
  const tag = $("#ckd-tag");
  tag.textContent = "Waiting";
  tag.dataset.tone = "neutral";
  $("#gauge-marker").classList.add("hidden");
  document.querySelectorAll("#ckd-gauge [data-stage]").forEach((segment) => segment.classList.remove("is-active"));
  ["#bmi-value", "#ibw-value", "#abw-value", "#bsa-value"].forEach((id) => {
    $(id).textContent = "—";
  });
  setHtml($("#kidney-notes"), html`<li>Enter age, sex, weight and creatinine. Results update as you type.</li>`);
  $("#bar-crcl").textContent = "—";
  $("#bar-egfr").textContent = "—";
}

/** Animates a number to its new value (skipped for reduced motion). */
function countTo(element, value) {
  const from = Number.parseFloat(element.textContent);
  window.cancelAnimationFrame(Number(element.dataset.frame || 0));
  if (!Number.isFinite(from) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.textContent = value.toFixed(1);
    return;
  }
  const start = performance.now();
  const duration = 450;
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = (from + (value - from) * eased).toFixed(1);
    if (progress < 1) {
      element.dataset.frame = String(window.requestAnimationFrame(step));
    }
  };
  element.dataset.frame = String(window.requestAnimationFrame(step));
}

export function gaugePosition(egfr) {
  const value = Math.max(0, Math.min(egfr, GAUGE_STOPS.at(-1)));
  const segment = GAUGE_STOPS.findIndex(
    (stop, index) => value < GAUGE_STOPS[index + 1] || index === GAUGE_STOPS.length - 2
  );
  const start = GAUGE_STOPS[segment];
  const end = GAUGE_STOPS[segment + 1];
  const segmentWidth = 100 / (GAUGE_STOPS.length - 1);
  return Math.round((segment + (value - start) / (end - start)) * segmentWidth * 10) / 10;
}

function describeCrcl(crcl) {
  if (crcl >= 60) return "Mildly reduced or normal";
  if (crcl >= 30) return "Moderately reduced";
  if (crcl >= 15) return "Severely reduced";
  return "Very severely reduced";
}

function calculateMostellerBsa({ weight, height }) {
  if (!Number.isFinite(weight) || !Number.isFinite(height) || weight <= 0 || height <= 0) {
    return null;
  }
  return Math.round(Math.sqrt((height * weight) / 3600) * 100) / 100;
}
