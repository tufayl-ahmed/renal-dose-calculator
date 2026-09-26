import test from "node:test";
import assert from "node:assert/strict";
import { validateAssistResponse } from "../src/llmDoseAssistCore.js";
import { buildDoseView } from "../src/doseView.js";

// Cases from a live output audit: AI answers that looked like renal doses
// but were not, and review cards padded with unrelated text.
const fallback = { drugName: "testdrug", crcl: 25, egfr: 24, renalBand: "CrCl 25.0 mL/min" };
const sourceText = "Usual dose 200 mg daily. In renal impairment use caution.";

function ai(fields) {
  return validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Testdrug",
      route: "Oral",
      renalMetricUsed: "crcl",
      importantCautions: [],
      ...fields,
    },
    sourceText,
    fallback
  );
}

test("an AI dose with a non-renal band is sent to review", () => {
  assert.equal(ai({ renalBand: "not_applicable", dose: "200 mg", frequency: "daily" }).status, "review_source");
  assert.equal(
    ai({ renalBand: "mild to moderate hepatic impairment", dose: "5 mg", frequency: "once daily" }).status,
    "review_source"
  );
});

test("a no-adjustment answer with a hepatic band is sent to review", () => {
  const result = ai({
    status: "no_renal_adjustment",
    renalBand: "mild to moderate hepatic impairment",
    dose: "5 mg",
    frequency: "once daily",
  });
  assert.equal(result.status, "review_source");
  assert.equal(result.dose, "Review DailyMed source");
  assert.equal(result.renalBand, "CrCl 25.0 mL/min");
});

test("an AI dose without its own band is not given the patient's CrCl as one", () => {
  const result = ai({ renalBand: "", dose: "200 mg", frequency: "daily" });
  assert.equal(result.status, "review_source");
});

test("renal and bare numeric AI bands still pass the band check", () => {
  assert.equal(ai({ renalBand: "CrCl 10-30 mL/min", dose: "200 mg", frequency: "daily" }).status, "dose_found");
  assert.equal(ai({ renalBand: "< 30", dose: "200 mg", frequency: "daily" }).status, "dose_found");
});

test("a review answer never shows just the drug's name as the dose", () => {
  const result = ai({ status: "review_source", drugName: "amlodipine", dose: "amlodipine", frequency: "" });
  assert.equal(result.dose, "Review DailyMed source");
});

test("AI cautions unrelated to the kidneys are dropped", () => {
  const result = ai({
    status: "review_source",
    dose: "",
    importantCautions: [
      "Acute adrenal crisis in patients with concomitant adrenal insufficiency.",
      "Monitor renal function in patients with renal impairment.",
    ],
  });
  assert.deepEqual(result.importantCautions, ["Monitor renal function in patients with renal impairment."]);
});

test("a missing AI drug name falls back to the searched name", () => {
  const result = ai({ status: "review_source", drugName: "", dose: "" });
  assert.equal(result.drugName, "Testdrug");
});

function curatedView(variants, extra = {}) {
  return buildDoseView(
    {
      sourceMode: "curated-draft",
      result: { status: "dose_found", drugName: "Examplemab", renalBand: "CrCl < 30 mL/min", ...extra },
      guidance: {
        drugName: "Examplemab",
        crclBand: "CrCl < 30 mL/min",
        dose: "",
        recommendation: variants.map((v) => `${v.condition}: ${v.text}`).join("; "),
        variants,
      },
    },
    { drug: "examplemab", crcl: 25 }
  );
}

test("regimens that disagree are shown as 'Depends on situation'", () => {
  const view = curatedView([
    { condition: "Glycemic control", text: "Not recommended — eGFR < 30" },
    { condition: "Heart failure", text: "10 mg once daily" },
  ]);
  assert.equal(view.decision.id, "varies");
  assert.equal(view.variants.length, 2);
});

test("regimens that agree keep a single decision", () => {
  const view = curatedView([
    { condition: "Treatment", text: "Start 0.3 mg/day" },
    { condition: "Prophylaxis", text: "Start 0.3 mg twice a week" },
  ]);
  assert.equal(view.decision.id, "adjust");
});
