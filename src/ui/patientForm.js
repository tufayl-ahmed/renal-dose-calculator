import { creatinineFromMgDl, creatinineToMgDl } from "../renal.js";
import { $, storage } from "./dom.js";

const UNIT_KEY = "renal-dose-scr-unit";

const CREATININE_RULES = {
  mg: {
    min: 0.1,
    max: 25,
    step: "0.01",
    placeholder: "1.4",
    label: "mg/dL",
    message: "Enter serum creatinine in mg/dL (0.1–25).",
  },
  umol: {
    min: 9,
    max: 2210,
    step: "1",
    placeholder: "124",
    label: "µmol/L",
    message: "Enter serum creatinine in µmol/L (9–2210).",
  },
};

const FIELDS = {
  age: { min: 18, max: 120, message: "Adults only: enter an age from 18 to 120 years." },
  weight: { min: 20, max: 300, message: "Enter weight in kg (20–300)." },
  height: { min: 100, max: 230, message: "Height is optional; if entered use cm (100–230).", optional: true },
};

/** Wires the mg/dL ⇄ µmol/L toggle; converts any value already typed. */
export function initCreatinineUnit(form, onChange) {
  applyUnit(form, storage.get(UNIT_KEY, "mg"), { convert: false });
  $("#scr-unit").addEventListener("click", () => {
    const next = currentUnit(form) === "mg" ? "umol" : "mg";
    applyUnit(form, next, { convert: true });
    storage.set(UNIT_KEY, next);
    onChange();
  });
}

function currentUnit(form) {
  return form.elements.creatinineUnit.value === "umol" ? "umol" : "mg";
}

function applyUnit(form, unit, { convert }) {
  const input = form.elements.creatinine;
  const previous = currentUnit(form);
  if (convert && input.value.trim() && previous !== unit) {
    const mg = creatinineToMgDl(Number(input.value), previous);
    if (Number.isFinite(mg)) {
      input.value = String(creatinineFromMgDl(mg, unit));
    }
  }
  const rule = CREATININE_RULES[unit];
  form.elements.creatinineUnit.value = unit;
  input.min = String(rule.min);
  input.max = String(rule.max);
  input.step = rule.step;
  input.placeholder = rule.placeholder;
  const button = $("#scr-unit");
  button.textContent = rule.label;
  button.setAttribute(
    "aria-label",
    `Creatinine unit ${rule.label}; switch to ${CREATININE_RULES[unit === "mg" ? "umol" : "mg"].label}`
  );
}

/**
 * Reads the patient fields. Returns { values } when complete and valid,
 * otherwise { errors } keyed by field (empty required fields are "missing").
 * values.creatinine is always mg/dL.
 */
export function readPatient(form) {
  const data = new FormData(form);
  const unit = currentUnit(form);
  const values = {
    sex: data.get("sex") === "female" ? "female" : "male",
    route: ["IV", "SC"].includes(data.get("route")) ? data.get("route") : "ORAL",
    weightBasis: ["ideal", "adjusted"].includes(data.get("weightBasis")) ? data.get("weightBasis") : "actual",
    dialysis: ["hd", "pd", "crrt"].includes(data.get("dialysis")) ? data.get("dialysis") : "none",
    unstable: data.get("unstable") === "on",
    creatinineUnit: unit,
  };
  const errors = {};
  const rules = { ...FIELDS, creatinine: CREATININE_RULES[unit] };
  for (const [name, rule] of Object.entries(rules)) {
    const text = String(data.get(name) ?? "").trim();
    if (!text) {
      if (rule.optional) {
        values[name] = null;
      } else {
        errors[name] = "missing";
      }
      continue;
    }
    const number = Number(text);
    if (!Number.isFinite(number) || number < rule.min || number > rule.max) {
      errors[name] = rule.message;
      continue;
    }
    values[name] = number;
  }
  if (Number.isFinite(values.creatinine)) {
    values.creatinineInput = values.creatinine;
    values.creatinine = creatinineToMgDl(values.creatinine, unit);
  }
  return Object.keys(errors).length ? { errors, values } : { values };
}

/** Shows field errors. Missing fields are only flagged when `showMissing`. */
export function showFieldErrors(errors = {}, { showMissing = false } = {}) {
  for (const name of ["age", "weight", "height", "creatinine"]) {
    const input = $(`#${name}`);
    const output = $(`#${name}-error`);
    const error = errors[name];
    const message = error === "missing" ? (showMissing ? "Required" : "") : error || "";
    output.textContent = message;
    input.toggleAttribute("aria-invalid", Boolean(message));
  }
}

/** Fills the form; `patient.creatinine` is in mg/dL. */
export function fillPatient(form, patient) {
  for (const name of ["age", "weight", "height"]) {
    if (patient[name] !== undefined && patient[name] !== "") {
      form.elements[name].value = patient[name] ?? "";
    }
  }
  if (patient.creatinine !== undefined && patient.creatinine !== "") {
    form.elements.creatinine.value = String(creatinineFromMgDl(Number(patient.creatinine), currentUnit(form)));
  }
  if (patient.sex) {
    form.querySelector(`input[name="sex"][value="${patient.sex === "female" ? "female" : "male"}"]`).checked = true;
  }
  if (patient.weightBasis) {
    const basis = ["ideal", "adjusted"].includes(patient.weightBasis) ? patient.weightBasis : "actual";
    form.querySelector(`input[name="weightBasis"][value="${basis}"]`).checked = true;
  }
  if (patient.dialysis) {
    form.elements.dialysis.value = ["hd", "pd", "crrt"].includes(patient.dialysis) ? patient.dialysis : "none";
  }
  if (patient.unstable !== undefined) {
    form.elements.unstable.checked = Boolean(patient.unstable);
  }
}

export function setDefaultRoute(form, route) {
  form.querySelector(`input[name="route"][value="${["IV", "SC"].includes(route) ? route : "ORAL"}"]`).checked = true;
}
