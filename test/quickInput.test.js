import test from "node:test";
import assert from "node:assert/strict";
import { parseQuickInput } from "../src/quickInput.js";

test("quick input parses labelled values in random order", () => {
  const parsed = parseQuickInput("wt 70 meropenem iv S. Creatinine 2.1 male age 45");

  assert.equal(parsed.age, 45);
  assert.equal(parsed.sex, "male");
  assert.equal(parsed.creatinine, 2.1);
  assert.equal(parsed.weight, 70);
  assert.equal(parsed.drug, "meropenem");
  assert.equal(parsed.route, "IV");
});

test("quick input keeps scr as a supported alias", () => {
  const parsed = parseQuickInput("wt 70 meropenem iv scr 2.1 male age 45");

  assert.equal(parsed.creatinine, 2.1);
  assert.equal(parsed.drug, "meropenem");
});

test("quick input parses attached units and compact sex", () => {
  const parsed = parseQuickInput("piptaz 70kg 45F SCr 1.8 oral 160cm");

  assert.equal(parsed.age, 45);
  assert.equal(parsed.sex, "female");
  assert.equal(parsed.creatinine, 1.8);
  assert.equal(parsed.weight, 70);
  assert.equal(parsed.height, 160);
  assert.equal(parsed.drug, "piptaz");
  assert.equal(parsed.route, "ORAL");
});

test("quick input keeps old shorthand order as fallback", () => {
  const parsed = parseQuickInput("45 M 2.1 70 meropenem IV");

  assert.equal(parsed.age, 45);
  assert.equal(parsed.sex, "male");
  assert.equal(parsed.creatinine, 2.1);
  assert.equal(parsed.weight, 70);
  assert.equal(parsed.drug, "meropenem");
  assert.equal(parsed.route, "IV");
});

test("quick input handles labels after numbers", () => {
  const parsed = parseQuickInput("doxy 65 age f 1.1 mg/dL 62 kg oral");

  assert.equal(parsed.age, 65);
  assert.equal(parsed.sex, "female");
  assert.equal(parsed.creatinine, 1.1);
  assert.equal(parsed.weight, 62);
  assert.equal(parsed.drug, "doxy");
  assert.equal(parsed.route, "ORAL");
});

test("quick input parses WhatsApp copy-paste form labels", () => {
  const parsed = parseQuickInput(`
    Age: 45
    Sex: Male
    S. Creatinine mg/dL: 2.1
    Weight kg: 70
    Height cm: 170
    Drug: meropenem
    Route: IV
  `);

  assert.equal(parsed.age, 45);
  assert.equal(parsed.sex, "male");
  assert.equal(parsed.creatinine, 2.1);
  assert.equal(parsed.weight, 70);
  assert.equal(parsed.height, 170);
  assert.equal(parsed.drug, "meropenem");
  assert.equal(parsed.route, "IV");
});

test("quick input does not infer an unsupported all-routes mode", () => {
  const parsed = parseQuickInput("45 M 2.1 70 metformin all");

  assert.equal(parsed.drug, "metformin");
  assert.equal(parsed.route, "");
});
