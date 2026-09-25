import assert from "node:assert/strict";
import test from "node:test";
import { resolveDosePayload } from "../server/renalDose/pipeline.js";
import { selectCrclWeight } from "../src/renal.js";

const patient = (overrides) => ({
  drug: "",
  normalizedDrug: null,
  route: "IV",
  age: 60,
  sex: "male",
  weight: 70,
  creatinine: 1.2,
  crcl: 64,
  egfr: 68,
  dialysis: "none",
  indication: "any",
  formulation: "any",
  unstable: false,
  ...overrides,
});

test("hemodialysis uses the drug's dialysis rule when the curated record has one", async () => {
  const payload = await resolveDosePayload({ patient: patient({ drug: "cefepime", dialysis: "hd" }), env: {} });
  assert.equal(payload.curated.selectedControls.dialysis, "hd");
  assert.match(payload.result.importantCautions[0], /hemodialysis rule is shown/);
  assert.equal(payload.kidneyContext.reviewRequired, false);
});

test("hemodialysis without a dialysis rule falls back to the lowest band and asks for review", async () => {
  const payload = await resolveDosePayload({ patient: patient({ drug: "meropenem", dialysis: "hd" }), env: {} });
  assert.equal(payload.result.renalBand, "CrCl < 10 mL/min");
  assert.match(payload.result.importantCautions[0], /no hemodialysis-specific rule/);
  assert.equal(payload.kidneyContext.reviewRequired, true);
});

test("CRRT always requires review and unstable creatinine adds a caution", async () => {
  const payload = await resolveDosePayload({
    patient: patient({ drug: "meropenem", dialysis: "crrt", unstable: true }),
    env: {},
  });
  assert.equal(payload.kidneyContext.reviewRequired, true);
  assert.match(payload.result.importantCautions.join(" "), /CRRT/);
  assert.match(payload.result.importantCautions.join(" "), /Creatinine not stable/);
});

test("no kidney context leaves the payload unannotated", async () => {
  const payload = await resolveDosePayload({ patient: patient({ drug: "meropenem" }), env: {} });
  assert.equal(payload.kidneyContext, undefined);
});

test("Cockcroft-Gault weight basis", () => {
  const base = { sex: "male", height: 175 };
  assert.deepEqual(selectCrclWeight({ ...base, basis: "actual", weight: 110 }), {
    basis: "actual",
    weight: 110,
    note: "",
  });
  assert.equal(selectCrclWeight({ ...base, basis: "ideal", weight: 110 }).weight, 70.5);
  assert.equal(selectCrclWeight({ ...base, basis: "ideal", weight: 60 }).basis, "actual");
  assert.equal(selectCrclWeight({ ...base, basis: "adjusted", weight: 110 }).weight, 86.3);
  assert.equal(selectCrclWeight({ sex: "male", basis: "adjusted", weight: 110, height: null }).basis, "actual");
});
