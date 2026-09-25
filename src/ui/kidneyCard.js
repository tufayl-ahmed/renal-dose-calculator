import {
  buildInterpretation,
  calculateAdjustedBodyWeight,
  calculateBmi,
  calculateCockcroftGault,
  calculateEgfrCkdEpi2021,
  calculateIdealBodyWeight,
  getCkdStage,
} from "../renal.js";
import { $, html, setHtml } from "./dom.js";

// Equal-width gauge segments; each maps an eGFR range onto one sixth of the bar.
const GAUGE_STOPS = [0, 15, 30, 45, 60, 90, 120];

export function computeRenal(values) {
  const egfr = calculateEgfrCkdEpi2021(values);
  const crcl = calculateCockcroftGault(values);
  return {
    egfr,
    crcl,
    stage: getCkdStage(egfr),
    bmi: calculateBmi(values),
    ibw: calculateIdealBodyWeight(values),
    abw: calculateAdjustedBodyWeight(values),
    bsa: calculateMostellerBsa(values),
  };
}

export function renderKidneyCard(values, renal) {
  $("#crcl-value").textContent = renal.crcl.toFixed(1);
  $("#egfr-value").textContent = renal.egfr.toFixed(1);
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

  const notes = [
    `Cockcroft-Gault used actual body weight (${values.weight} kg).`,
    ...buildInterpretation({ ...values, egfr: renal.egfr, crcl: renal.crcl }).filter(
      (note) => !/^CKD G category|^For drug dosing/.test(note)
    ),
  ];
  if (renal.abw && renal.bmi >= 30) {
    notes.push(`BMI ≥30: many protocols use adjusted body weight (${renal.abw} kg) for Cockcroft-Gault.`);
  }
  notes.push("A single creatinine assumes stable kidney function; estimates are unreliable in acute kidney injury.");
  setHtml($("#kidney-notes"), html`${notes.map((note) => html`<li>${note}</li>`)}`);

  $("#bar-crcl").textContent = renal.crcl.toFixed(0);
  $("#bar-egfr").textContent = renal.egfr.toFixed(0);
}

export function resetKidneyCard() {
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
