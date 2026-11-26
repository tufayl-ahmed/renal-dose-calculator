import assert from "node:assert/strict";
import test from "node:test";
import { calculateCockcroftGault, calculateEgfrCkdEpi2021, creatinineToMgDl, getCkdStage } from "../src/renal.js";
import { computeRenal, gaugePosition } from "../src/ui/kidneyCard.js";

// kidney.org/professionals/gfr_calculator (calculateGfr2021, creatinine path), copied
// step for step: µmol/L ÷ 88.4 with no rounding, then the equation, then a whole number.
function nkfCalculatorEgfr({ scr, unit, age, sex }) {
  const mgdl = unit === "umol" ? scr / 88.4 : scr;
  const kappa = sex === "female" ? 0.7 : 0.9;
  const alpha = sex === "female" ? -0.241 : -0.302;
  const result =
    142 *
    Math.pow(Math.min(mgdl / kappa, 1), alpha) *
    Math.pow(Math.max(mgdl / kappa, 1), -1.2) *
    Math.pow(0.9938, age) *
    (sex === "female" ? 1.012 : 1);
  return Math.round(result);
}

// What the form hands to computeRenal for a typed creatinine (see readPatient).
function formValues({ scr, unit, age, sex }) {
  return {
    age,
    sex,
    weight: 70,
    height: null,
    weightBasis: "actual",
    creatinine: creatinineToMgDl(scr, unit),
    creatinineUnit: unit,
    creatinineInput: scr,
  };
}

// Independent reference implementations (CKD-EPI 2021 race-free; Cockcroft-Gault).
function referenceEgfr({ age, sex, creatinine }) {
  const female = sex === "female";
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const ratio = creatinine / kappa;
  const value = 142 * Math.min(ratio, 1) ** alpha * Math.max(ratio, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
  return Math.round(value);
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

test("KDIGO G categories use >= lower bounds on the whole-number eGFR", () => {
  const cases = [
    [90, "G1"],
    [89.5, "G1"],
    [89.4, "G2"],
    [60, "G2"],
    [59.5, "G2"],
    [59.4, "G3a"],
    [45, "G3a"],
    [44.5, "G3a"],
    [44.4, "G3b"],
    [30, "G3b"],
    [29.5, "G3b"],
    [29.4, "G4"],
    [15, "G4"],
    [14.5, "G4"],
    [14.4, "G5"],
  ];
  for (const [egfr, stage] of cases) {
    assert.equal(getCkdStage(egfr).stage, stage, String(egfr));
  }
});

test("eGFR rounding matches the NKF/KDIGO calculator for mg/dL and µmol/L input", () => {
  const inputs = [];
  for (let scr = 0.3; scr <= 15; scr = Math.round((scr + 0.01) * 100) / 100) inputs.push({ scr, unit: "mg" });
  for (let scr = 27; scr <= 1300; scr += 1) inputs.push({ scr, unit: "umol" });
  for (const sex of ["male", "female"]) {
    for (let age = 18; age <= 100; age += 3) {
      for (const input of inputs) {
        const patient = { ...input, age, sex };
        assert.equal(computeRenal(formValues(patient)).egfr, nkfCalculatorEgfr(patient), JSON.stringify(patient));
      }
    }
  }
});

test("µmol/L creatinine is not rounded before the equation", () => {
  // Rounding 142 µmol/L to 1.61 mg/dL first gives 59 (G3a); kidney.org shows 60 (G2).
  const renal = computeRenal(formValues({ scr: 142, unit: "umol", age: 28, sex: "male" }));
  assert.equal(renal.egfr, 60);
  assert.equal(renal.stage.stage, "G2");
});

test("eGFR is a whole number, matching the NKF eGFR calculator", () => {
  // kidney.org/professionals/gfr_calculator shows 53 and 60 (G2) for these men (checked Nov 2026).
  assert.equal(calculateEgfrCkdEpi2021({ age: 72, sex: "male", creatinine: 1.4 }), 53);

  const man = calculateEgfrCkdEpi2021({ age: 68, sex: "male", creatinine: 1.3 });
  assert.equal(man, 60);
  assert.equal(getCkdStage(man).stage, "G2");

  const woman = calculateEgfrCkdEpi2021({ age: 50, sex: "female", creatinine: 0.8 });
  assert.equal(woman, 90);
  assert.equal(getCkdStage(woman).stage, "G1");
});

test("gauge marker maps eGFR onto equal-width KDIGO segments", () => {
  assert.equal(gaugePosition(0), 0);
  assert.equal(gaugePosition(15), 16.7);
  assert.equal(gaugePosition(52.5), 58.3);
  assert.equal(gaugePosition(90), 83.3);
  assert.equal(gaugePosition(150), 100);
});
