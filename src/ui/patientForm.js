import { $ } from "./dom.js";

const FIELDS = {
  age: { min: 18, max: 120, message: "Adults only: enter an age from 18 to 120 years." },
  weight: { min: 20, max: 300, message: "Enter weight in kg (20–300)." },
  creatinine: { min: 0.1, max: 25, message: "Enter serum creatinine in mg/dL (0.1–25)." },
  height: { min: 100, max: 230, message: "Height is optional; if entered use cm (100–230).", optional: true },
};

/**
 * Reads the patient fields. Returns { values } when complete and valid,
 * otherwise { errors } keyed by field (empty required fields are "missing").
 */
export function readPatient(form) {
  const data = new FormData(form);
  const values = {
    sex: data.get("sex") === "female" ? "female" : "male",
    route: ["IV", "SC"].includes(data.get("route")) ? data.get("route") : "ORAL",
  };
  const errors = {};
  for (const [name, rule] of Object.entries(FIELDS)) {
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
  return Object.keys(errors).length ? { errors, values } : { values };
}

/** Shows field errors. Missing fields are only flagged when `showMissing`. */
export function showFieldErrors(errors = {}, { showMissing = false } = {}) {
  for (const name of Object.keys(FIELDS)) {
    const input = $(`#${name}`);
    const output = $(`#${name}-error`);
    const error = errors[name];
    const message = error === "missing" ? (showMissing ? "Required" : "") : error || "";
    output.textContent = message;
    input.toggleAttribute("aria-invalid", Boolean(message));
  }
}

export function fillPatient(form, patient) {
  for (const name of ["age", "weight", "height", "creatinine"]) {
    if (patient[name] !== undefined && patient[name] !== "") {
      form.elements[name].value = patient[name] ?? "";
    }
  }
  if (patient.sex) {
    form.querySelector(`input[name="sex"][value="${patient.sex === "female" ? "female" : "male"}"]`).checked = true;
  }
}

export function setDefaultRoute(form, route) {
  form.querySelector(`input[name="route"][value="${["IV", "SC"].includes(route) ? route : "ORAL"}"]`).checked = true;
}
