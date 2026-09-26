import test from "node:test";
import assert from "node:assert/strict";
import { baseDrugKey } from "../src/drugNormalizer.js";
import { findCuratedRenalDoseGuidance } from "../src/curatedDoseRules.js";

const lookup = (drug) =>
  findCuratedRenalDoseGuidance({
    drugQuery: drug,
    normalizedDrug: drug,
    route: "ORAL",
    crcl: 40,
    egfr: 40,
    age: 60,
    weight: 70,
    sex: "male",
    creatinine: 1.8,
  });

test("baseDrugKey drops salt words but never empties a name", () => {
  assert.equal(baseDrugKey("Olmesartan Medoxomil"), "olmesartan");
  assert.equal(baseDrugKey("losartan potassium tablets"), "losartan");
  assert.equal(baseDrugKey("Potassium Chloride"), "potassiumchloride");
  assert.equal(baseDrugKey("Sodium Bicarbonate"), "sodiumbicarbonate");
  assert.equal(baseDrugKey("Magnesium Sulfate"), "magnesiumsulfate");
  assert.equal(baseDrugKey("Tenofovir Disoproxil Fumarate"), "tenofovirdisoproxil");
});

test("salt-free names find salt-named records", () => {
  assert.equal(lookup("olmesartan")?.drugName, "Olmesartan Medoxomil");
});

test("prodrugs that are dosed differently stay distinct", () => {
  assert.equal(lookup("tenofovir alafenamide")?.drugName, "Tenofovir alafenamide");
  assert.equal(lookup("tenofovir disoproxil fumarate")?.drugName, "Tenofovir disoproxil fumarate");
  assert.equal(lookup("tenofovir"), null);
});
