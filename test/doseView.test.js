import assert from "node:assert/strict";
import test from "node:test";
import { buildDoseView, buildShareText, cleanBand, getSourceTier } from "../src/doseView.js";

const assist = (overrides = {}) => ({
  result: {
    status: "dose_found",
    drugName: "Drug",
    route: "Oral",
    renalBand: "CrCl 10-25 mL/min",
    dose: "250 mg",
    frequency: "every 12 hours",
  },
  guidance: {},
  sourceMode: "curated-draft",
  sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=x",
  ...overrides,
});

test("source tiers map from API source modes", () => {
  assert.equal(getSourceTier("curated-verified").label, "Clinician-verified");
  assert.equal(getSourceTier("curated-draft").id, "curated");
  assert.equal(getSourceTier("label-extracted").id, "extracted");
  assert.equal(getSourceTier("cloudflare-ai-small-model").id, "ai");
  assert.equal(getSourceTier("route-not-found").id, "review");
});

test("decision reflects the renal band and dose text", () => {
  assert.equal(buildDoseView(assist()).decision.id, "adjust");
  assert.equal(
    buildDoseView(assist({ result: { ...assist().result, renalBand: "CrCl > 50 mL/min" } })).decision.id,
    "usual"
  );
  assert.equal(
    buildDoseView(assist({ result: { ...assist().result, renalBand: "All CrCl values", dose: "2.5 mg" } })).decision.id,
    "label-dose"
  );
  assert.equal(
    buildDoseView(assist({ result: { ...assist().result, dose: "Contraindicated", frequency: "" } })).decision.id,
    "avoid"
  );
  assert.equal(
    buildDoseView(
      assist({ result: { ...assist().result, status: "no_renal_adjustment", dose: "No renal dose adjustment" } })
    ).decision.id,
    "no-change"
  );
  assert.equal(
    buildDoseView(assist({ sourceMode: "no-ai-binding", result: { ...assist().result, status: "review_source" } }))
      .decision.id,
    "review"
  );
});

test("cautions drop internal context echoes and flag defaulted choices", () => {
  const view = buildDoseView(
    assist({
      guidance: {
        indicationNote:
          'Indication not selected; showing "DVT prophylaxis". Choose the indication to confirm this dose. Observe bleeding. Indication: prophylaxis.',
      },
    })
  );
  assert.deepEqual(view.cautions, [
    'Indication not selected; showing "DVT prophylaxis".',
    "Choose the indication to confirm this dose.",
    "Observe bleeding.",
  ]);
  assert.deepEqual(view.defaultedControls, ["indication"]);
});

test("bands are shown without metric and unit", () => {
  assert.equal(cleanBand("CrCl 26-50 mL/min"), "26-50");
  assert.equal(cleanBand("eGFR < 30 mL/min/1.73 m2"), "< 30");
  assert.equal(cleanBand("All CrCl values"), "All values");
});

test("share text includes patient, each drug, sources and the disclaimer", () => {
  const text = buildShareText({
    patient: { age: 70, sex: "male", creatinine: 1.4, weight: 70, height: null },
    renal: { egfr: 53.4, crcl: 52.6, stage: { stage: "G3a" } },
    views: [buildDoseView(assist())],
  });
  assert.match(text, /CrCl \(Cockcroft-Gault\): 52\.6 mL\/min/);
  assert.match(text, /Drug \(Oral\) — Adjust dose \[Curated · draft\]/);
  assert.match(text, /DailyMed: https:\/\/dailymed/);
  assert.match(text, /not for prescribing/);
});
