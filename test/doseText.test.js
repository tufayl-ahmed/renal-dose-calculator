import test from "node:test";
import assert from "node:assert/strict";
import { joinDoseText } from "../src/doseText.js";

test("schedules join the dose with a space", () => {
  assert.equal(joinDoseText("400 mg", "once daily"), "400 mg once daily");
  assert.equal(joinDoseText("15 mg/kg", "every 24 hours (1 time/day)"), "15 mg/kg every 24 hours (1 time/day)");
  assert.equal(joinDoseText("1 tablet (0.18 mg)", "4 times daily"), "1 tablet (0.18 mg) 4 times daily");
  assert.equal(joinDoseText("3 mg", "after dialysis on HD days"), "3 mg after dialysis on HD days");
});

test("reasons and notes join the dose with a dash", () => {
  assert.equal(joinDoseText("Contraindicated", "CrCl < 50 mL/min"), "Contraindicated — CrCl < 50 mL/min");
  assert.equal(joinDoseText("Usual dose", "no renal adjustment"), "Usual dose — no renal adjustment");
  assert.equal(
    joinDoseText("Renal impairment: use with caution", "label gives no dose change"),
    "Renal impairment: use with caution — label gives no dose change"
  );
});

test("a capitalized ordinary word after the dash is lowercased", () => {
  assert.equal(
    joinDoseText("No renal dose adjustment", "Use usual adult schedule by indication"),
    "No renal dose adjustment — use usual adult schedule by indication"
  );
  assert.equal(joinDoseText("Avoid", "CrCl < 30 mL/min"), "Avoid — CrCl < 30 mL/min");
  assert.equal(joinDoseText("Not recommended", "ESRD"), "Not recommended — ESRD");
  assert.equal(joinDoseText("Contraindicated", "Child-Pugh C"), "Contraindicated — Child-Pugh C");
});

test("empty parts are dropped", () => {
  assert.equal(joinDoseText("Avoid", ""), "Avoid");
  assert.equal(joinDoseText("", "once daily"), "once daily");
  assert.equal(joinDoseText(undefined, undefined), "");
});
