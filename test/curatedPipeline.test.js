import assert from "node:assert/strict";
import test from "node:test";
import { resolveCuratedPayload } from "../server/renalDose/curated.js";

const patient = (overrides) => ({
  drug: "",
  normalizedDrug: null,
  route: "ORAL",
  age: 45,
  sex: "male",
  weight: 70,
  creatinine: 2.1,
  crcl: 44,
  egfr: 38.8,
  dialysis: "none",
  indication: "any",
  formulation: "any",
  ...overrides,
});

test("curated rule answers before any label lookup", () => {
  const payload = resolveCuratedPayload(patient({ drug: "meropenem", route: "IV" }));

  assert.equal(payload.sourceMode, "curated-verified");
  assert.equal(payload.result.status, "dose_found");
  assert.equal(payload.result.renalBand, "CrCl 26-50 mL/min");
  assert.match(payload.sourceUrl, /^https:\/\/dailymed\.nlm\.nih\.gov\//);
  assert.equal(payload.curated.verification.status, "verified");
});

test("draft curated records are labelled as draft", () => {
  const payload = resolveCuratedPayload(patient({ drug: "sitagliptin" }));

  assert.equal(payload.sourceMode, "curated-draft");
  assert.equal(payload.curated.verification.status, "draft");
  assert.equal(payload.result.dose, "50 mg once daily");
});

test("unknown drugs fall through to the label pipeline", () => {
  assert.equal(resolveCuratedPayload(patient({ drug: "zzqxnotadrug" })), null);
});

test("route mismatch falls through to the label pipeline", () => {
  assert.equal(resolveCuratedPayload(patient({ drug: "piptaz", route: "ORAL" })), null);
});

test("renal ranges the label is silent on fall through instead of guessing", () => {
  // Benazepril's curated record only has a CrCl < 30 band.
  assert.equal(resolveCuratedPayload(patient({ drug: "benazepril", crcl: 70, egfr: 70 })), null);
  assert.ok(resolveCuratedPayload(patient({ drug: "benazepril", crcl: 20, egfr: 20 })));
});

test("a defaulted indication is called out so the user confirms it", () => {
  const payload = resolveCuratedPayload(patient({ drug: "enoxaparin", route: "ALL", crcl: 12, egfr: 14 }));

  assert.equal(payload.result.dose, "30 mg");
  assert.match(payload.result.importantCautions[0], /Indication not selected; showing "DVT prophylaxis"/);

  const treatment = resolveCuratedPayload(
    patient({ drug: "enoxaparin", route: "ALL", crcl: 12, egfr: 14, indication: "dvt-treatment" })
  );
  assert.equal(treatment.result.dose, "1 mg/kg");
  assert.ok(!treatment.result.importantCautions.some((caution) => /not selected/.test(caution)));
});

test("apixaban NVAF dose uses the label's age/weight/creatinine criteria", () => {
  const usual = resolveCuratedPayload(patient({ drug: "apixaban" }));
  assert.equal(usual.result.dose, "5 mg");
  assert.match(usual.result.importantCautions[0], /1 of 3/);

  const reduced = resolveCuratedPayload(patient({ drug: "apixaban", age: 82, weight: 55, creatinine: 1.3 }));
  assert.equal(reduced.result.dose, "2.5 mg");
  assert.match(reduced.result.importantCautions[0], /2 of 3 \(age ≥ 80 years, weight ≤ 60 kg\)/);

  const dvt = resolveCuratedPayload(patient({ drug: "apixaban", age: 82, weight: 55, indication: "dvt-pe" }));
  assert.ok(!dvt.result.importantCautions.some((caution) => /NVAF dose-reduction/.test(caution)));
});

test("label-curated records keep their own route-specific rules", () => {
  const iv = resolveCuratedPayload(patient({ drug: "famotidine", route: "IV", crcl: 30, egfr: 30 }));
  assert.match(iv.result.dose, /Half the usual dose/);
  const oral = resolveCuratedPayload(patient({ drug: "famotidine", route: "ORAL", crcl: 30, egfr: 30 }));
  assert.doesNotMatch(oral.result.dose, /Half the usual dose/);
});

test("caution-only labels are shown as cautions, per band where the label sets a threshold", () => {
  const low = resolveCuratedPayload(patient({ drug: "bupropion", crcl: 50, egfr: 50 }));
  assert.equal(low.result.decisionHint, "caution");
  const normal = resolveCuratedPayload(patient({ drug: "bupropion", crcl: 95, egfr: 95 }));
  assert.equal(normal.result.decisionHint, undefined);
  assert.equal(resolveCuratedPayload(patient({ drug: "dicyclomine" })).result.decisionHint, "not-studied");
});
