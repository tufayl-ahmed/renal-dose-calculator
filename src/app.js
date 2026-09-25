import { buildShareText } from "./doseView.js";
import { parseQuickInput } from "./quickInput.js";
import { decodeCheck, encodeCheck } from "./shareLink.js";
import { $, copyText, toast } from "./ui/dom.js";
import { createDoseCards } from "./ui/doseCards.js";
import { createDrugInput } from "./ui/drugInput.js";
import { createHistory } from "./ui/history.js";
import { computeRenal, renderKidneyCard, resetKidneyCard } from "./ui/kidneyCard.js";
import { fillPatient, initCreatinineUnit, readPatient, setDefaultRoute, showFieldErrors } from "./ui/patientForm.js";
import { initPwa } from "./ui/pwa.js";
import { haptic, initTelegram } from "./ui/telegram.js";
import { initTheme } from "./ui/theme.js";

const REFRESH_DELAY_MS = 700;

initTheme();
initPwa();
initTelegram();

const form = $("#renal-form");
let current = null; // { values, renal } for the last valid patient
let refreshTimer = 0;

const drugInput = createDrugInput({
  getDefaultRoute: () => new FormData(form).get("route") || "ORAL",
  // Adding, removing or re-routing a drug looks it up straight away when the
  // patient details are complete; no need to press Calculate.
  onChange: () => {
    cards.sync(drugInput.drugs, patientPayload());
    rememberCheck();
  },
});
const cards = createDoseCards({});
const recentChecks = createHistory({ onSelect: loadHistoryItem });
initCreatinineUnit(form, () => form.dispatchEvent(new Event("input")));

form.addEventListener("input", (event) => {
  if (event.target.closest(".quick-entry, .drug-entry")) {
    return;
  }
  updateKidney();
  // Patient details changed: dim existing dose cards at once, then refresh
  // them once typing pauses (or leave them waiting if details are incomplete).
  cards.markStale();
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    cards.sync(drugInput.drugs, patientPayload());
    rememberCheck();
  }, REFRESH_DELAY_MS);
});

form.addEventListener("change", (event) => {
  if (event.target.name === "route") {
    drugInput.refreshRoutes();
    cards.sync(drugInput.drugs, patientPayload());
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
});

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    current = null;
    $("#share").disabled = true;
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
$("#share").addEventListener("click", shareCheck);

openSharedCheck();

function updateKidney() {
  const { values, errors } = readPatient(form);
  showFieldErrors(errors);
  if (errors) {
    current = null;
    $("#share").disabled = true;
    resetKidneyCard();
    return false;
  }
  current = { values, renal: computeRenal(values) };
  $("#share").disabled = false;
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
  window.clearTimeout(refreshTimer);
  haptic("light");
  cards.sync(drugInput.drugs, patientPayload());
  rememberCheck();
  if (window.matchMedia("(max-width: 959px)").matches) {
    $("#results").scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }
}

/** Saves the current patient + drugs to Recent (deduplicated). */
function rememberCheck() {
  const drugs = drugInput.drugs;
  if (current && drugs.length) {
    recentChecks.add({ patient: current.values, drugs, crcl: current.renal.crcl });
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
    weightBasis: renal.crclWeight.basis,
    dialysis: values.dialysis,
    unstable: values.unstable,
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

async function shareCheck() {
  if (!current) {
    return;
  }
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = encodeCheck({
    patient: { ...current.values, weightBasis: current.renal.crclWeight.basis },
    drugs: drugInput.drugs,
    defaultRoute: new FormData(form).get("route"),
  });
  const link = url.toString();
  if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title: "Renal dose check", url: link });
      return;
    } catch {
      // Cancelled or unsupported: fall back to copying.
    }
  }
  toast((await copyText(link)) ? "Link copied" : "Copy failed");
}

/** Opens a check shared as a #c=... link, then removes it from the address bar. */
function openSharedCheck() {
  const shared = decodeCheck(window.location.hash);
  if (!shared) {
    return;
  }
  history.replaceState(null, "", window.location.pathname);
  fillPatient(form, shared.patient);
  setDefaultRoute(form, shared.defaultRoute);
  drugInput.set(shared.drugs);
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
