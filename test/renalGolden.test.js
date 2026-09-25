import assert from "node:assert/strict";
import test from "node:test";
import { calculateCockcroftGault, calculateEgfrCkdEpi2021, getCkdStage } from "../src/renal.js";
import { gaugePosition } from "../src/ui/kidneyCard.js";

// Independent reference implementations (CKD-EPI 2021 race-free; Cockcroft-Gault).
function referenceEgfr({ age, sex, creatinine }) {
  const female = sex === "female";
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const ratio = creatinine / kappa;
  const value = 142 * Math.min(ratio, 1) ** alpha * Math.max(ratio, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
  return Math.round(value * 10) / 10;
}

function referenceCrcl({ age, sex, creatinine, weight }) {
  const value = (((140 - age) * weight) / (72 * creatinine)) * (sex === "female" ? 0.85 : 1);
  return Math.round(value * 10) / 10;
}

test("eGFR and CrCl match the reference equations across the adult range", () => {
  for (const sex of ["male", "female"]) {
    for (const age of [18, 30, 45, 65, 80, 95, 110]) {
      for (const creatinine of [0.3, 0.6, 0.7, 0.9, 1.2, 2.5, 5, 12]) {
        for (const weight of [40, 70, 120]) {
          const input = { age, sex, creatinine, weight };
          assert.equal(calculateEgfrCkdEpi2021(input), referenceEgfr(input), JSON.stringify(input));
          assert.equal(calculateCockcroftGault(input), referenceCrcl(input), JSON.stringify(input));
        }
      }
    }
  }
});

test("KDIGO G categories use >= lower bounds", () => {
  assert.equal(getCkdStage(90).stage, "G1");
  assert.equal(getCkdStage(89.9).stage, "G2");
  assert.equal(getCkdStage(60).stage, "G2");
  assert.equal(getCkdStage(59.9).stage, "G3a");
  assert.equal(getCkdStage(45).stage, "G3a");
  assert.equal(getCkdStage(30).stage, "G3b");
  assert.equal(getCkdStage(15).stage, "G4");
  assert.equal(getCkdStage(14.9).stage, "G5");
});

test("gauge marker maps eGFR onto equal-width KDIGO segments", () => {
  assert.equal(gaugePosition(0), 0);
  assert.equal(gaugePosition(15), 16.7);
  assert.equal(gaugePosition(52.5), 58.3);
  assert.equal(gaugePosition(90), 83.3);
  assert.equal(gaugePosition(150), 100);
});
