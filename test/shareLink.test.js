import assert from "node:assert/strict";
import test from "node:test";
import { decodeCheck, encodeCheck } from "../src/shareLink.js";

test("share links round-trip a check", () => {
  const hash = encodeCheck({
    patient: {
      age: 82,
      sex: "female",
      weight: 55,
      height: 158,
      creatinine: 1.6,
      weightBasis: "ideal",
      dialysis: "hd",
      unstable: true,
    },
    drugs: [
      { name: "apixaban", route: "ORAL" },
      { name: "méropénem", route: "IV" },
    ],
    defaultRoute: "IV",
  });
  assert.match(hash, /^c=[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeCheck(`#${hash}`), {
    patient: {
      age: 82,
      sex: "female",
      weight: 55,
      height: 158,
      creatinine: 1.6,
      creatinineUnit: "mg",
      creatinineInput: 1.6,
      weightBasis: "ideal",
      dialysis: "hd",
      unstable: true,
    },
    defaultRoute: "IV",
    drugs: [
      { name: "apixaban", route: "ORAL" },
      { name: "méropénem", route: "IV" },
    ],
  });
});

test("share links keep creatinine typed in µmol/L exactly", () => {
  const hash = encodeCheck({
    patient: { age: 28, sex: "male", weight: 80, creatinine: 1.61, creatinineUnit: "umol", creatinineInput: 142 },
    drugs: [],
  });
  const { patient } = decodeCheck(`#${hash}`);
  assert.equal(patient.creatinine, 1.61);
  assert.equal(patient.creatinineUnit, "umol");
  assert.equal(patient.creatinineInput, 142);
});

test("bad or foreign fragments are ignored", () => {
  assert.equal(decodeCheck("#results"), null);
  assert.equal(decodeCheck("#c=not-json"), null);
  assert.equal(decodeCheck(""), null);
});
