import { buildShareText } from "./doseView.js";
import { parseQuickInput } from "./quickInput.js";
import { $, copyText, toast } from "./ui/dom.js";
import { createDoseCards } from "./ui/doseCards.js";
import { createDrugInput } from "./ui/drugInput.js";
import { createHistory } from "./ui/history.js";
import { computeRenal, renderKidneyCard, resetKidneyCard } from "./ui/kidneyCard.js";
import { fillPatient, readPatient, setDefaultRoute, showFieldErrors } from "./ui/patientForm.js";
import { initPwa } from "./ui/pwa.js";
import { haptic, initTelegram } from "./ui/telegram.js";
import { initTheme } from "./ui/theme.js";

const REFRESH_DELAY_MS = 700;

initTheme();
initPwa();
initTelegram();

const form = $("#renal-form");
let current = null; // { values, renal } for the last valid patient
let calculated = false;
let refreshTimer = 0;

const drugInput = createDrugInput({
  getDefaultRoute: () => new FormData(form).get("route") || "ORAL",
  onChange: () => cards.sync(drugInput.drugs, calculated ? patientPayload() : null),
});
const cards = createDoseCards({});
const history = createHistory({ onSelect: loadHistoryItem });

form.addEventListener("input", (event) => {
  if (event.target.closest(".quick-entry, .drug-entry")) {
    return;
  }
  updateKidney();
  if (calculated && current) {
    // Patient changed after a calculation: refresh drug guidance once typing pauses.
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => cards.sync(drugInput.drugs, patientPayload()), REFRESH_DELAY_MS);
  }
});

form.addEventListener("change", (event) => {
  if (event.target.name === "route") {
    drugInput.refreshRoutes();
    cards.sync(drugInput.drugs, calculated ? patientPayload() : null);
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
});

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    current = null;
    calculated = false;
    drugInput.clear();
    cards.reset();
    resetKidneyCard();
    showFieldErrors({});
    setFormError("");
  }, 0);
});

$("#quick-apply").addEventListener("click", applyQuickInput);
$("#quick-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyQuickInput();
  }
});

$("#copy-all").addEventListener("click", async () => {
  if (!current) {
    return;
  }
  const text = buildShareText({ patient: current.values, renal: current.renal, views: cards.views() });
  toast((await copyText(text)) ? "Copied summary" : "Copy failed");
});
$("#print").addEventListener("click", () => window.print());

function updateKidney() {
  const { values, errors } = readPatient(form);
  showFieldErrors(errors);
  if (errors) {
    current = null;
    resetKidneyCard();
    return false;
  }
  current = { values, renal: computeRenal(values) };
  renderKidneyCard(values, current.renal);
  setFormError("");
  return true;
}

function calculate() {
  drugInput.commitPending();
  const { errors } = readPatient(form);
  if (errors) {
    showFieldErrors(errors, { showMissing: true });
    setFormError("Complete the highlighted fields to calculate.");
    form.querySelector("[aria-invalid]")?.focus();
    haptic("error");
    return;
  }
  updateKidney();
  calculated = true;
  haptic("light");
  const drugs = drugInput.drugs;
  cards.sync(drugs, patientPayload());
  history.add({ patient: current.values, drugs, crcl: current.renal.crcl });
  if (window.matchMedia("(max-width: 959px)").matches) {
    $("#results").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }
}

function patientPayload() {
  if (!current) {
    return null;
  }
  const { values, renal } = current;
  return {
    age: values.age,
    sex: values.sex,
    weight: values.weight,
    height: values.height,
    creatinine: values.creatinine,
    crcl: renal.crcl,
    egfr: renal.egfr,
  };
}

function applyQuickInput() {
  const parsed = parseQuickInput($("#quick-input").value);
  if (!parsed) {
    return;
  }
  fillPatient(form, parsed);
  if (parsed.drugs?.length === 1 && parsed.route) {
    // A single drug takes the route wherever it appears in the line ("IV meropenem 72 M ...").
    setDefaultRoute(form, parsed.route);
    drugInput.set([{ name: parsed.drugs[0].name, route: parsed.route }]);
  } else if (parsed.drugs?.length) {
    // With several drugs a route word only applies to the drug just before it.
    drugInput.set(parsed.drugs);
  }
  calculate();
}

function loadHistoryItem(item) {
  fillPatient(form, item.patient);
  drugInput.set(item.drugs);
  calculate();
}

function setFormError(message) {
  const element = $("#form-error");
  element.textContent = message;
  element.classList.toggle("hidden", !message);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
