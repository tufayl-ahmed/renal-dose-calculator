import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAdjustedBodyWeight,
  calculateCockcroftGault,
  calculateEgfrCkdEpi2021,
  calculateIdealBodyWeight,
  getCkdStage,
} from "../src/renal.js";

test("calculates CKD-EPI 2021 eGFR for an adult male", () => {
  const egfr = calculateEgfrCkdEpi2021({
    age: 45,
    sex: "male",
    creatinine: 2.1,
  });

  assert.equal(egfr, 38.8);
});

test("calculates CKD-EPI 2021 eGFR for an adult female", () => {
  const egfr = calculateEgfrCkdEpi2021({
    age: 70,
    sex: "female",
    creatinine: 1.4,
  });

  assert.equal(egfr, 40.5);
});

test("calculates Cockcroft-Gault creatinine clearance", () => {
  const crcl = calculateCockcroftGault({
    age: 45,
    sex: "male",
    creatinine: 2.1,
    weight: 70,
  });

  assert.equal(crcl, 44);
});

test("applies female multiplier in Cockcroft-Gault", () => {
  const crcl = calculateCockcroftGault({
    age: 70,
    sex: "female",
    creatinine: 1.4,
    weight: 60,
  });

  assert.equal(crcl, 35.4);
});

test("classifies CKD G categories", () => {
  assert.equal(getCkdStage(92).stage, "G1");
  assert.equal(getCkdStage(75).stage, "G2");
  assert.equal(getCkdStage(52).stage, "G3a");
  assert.equal(getCkdStage(31).stage, "G3b");
  assert.equal(getCkdStage(20).stage, "G4");
  assert.equal(getCkdStage(11).stage, "G5");
});

test("estimates adult ideal and adjusted body weight when height is available", () => {
  const ideal = calculateIdealBodyWeight({ sex: "male", height: 180 });
  const adjusted = calculateAdjustedBodyWeight({ sex: "male", height: 180, weight: 110 });

  assert.equal(ideal, 75);
  assert.equal(adjusted, 89);
});

test("rejects pediatric age for adult-only MVP", () => {
  assert.throws(
    () =>
      calculateEgfrCkdEpi2021({
        age: 16,
        sex: "male",
        creatinine: 4.1,
      }),
    /Adult age/
  );
});
