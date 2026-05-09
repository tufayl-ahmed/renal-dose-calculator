import test from "node:test";
import assert from "node:assert/strict";
import { deriveRenalDoseGuidance, extractDoseRows } from "../src/doseGuidance.js";

const meropenemSection =
  "Recommended Meropenem Dosage Schedule for Adult Patients with Renal Impairment Creatinine Clearance (mL/min) Dose (dependent on type of infection) Dosing Interval Greater than 50 Recommended dose Every 8 hours 26 to 50 Recommended dose Every 12 hours 10 to 25 One-half recommended dose Every 12 hours Less than 10 One-half recommended dose Every 24 hours";

const meropenemSectionWithPediatricText = `${meropenemSection} Pediatric patients 3 months of age and older Recommended Meropenem Dosage Schedule 10 500 mg Every 8 hours 20 1 gram Every 8 hours`;
const piptazSection =
  "Adult Patients with Renal Impairment: Dosage in patients with renal impairment (creatinine clearance <=40 mL/min) should be reduced. Pediatric Patients by Indication and Age: See Table below. 2.4 Dosage in Adult Patients With Renal Impairment In adult patients with renal impairment, the intravenous dose should be adjusted to the degree of renal impairment. The recommended daily dosage administered by intravenous infusion over 30 minutes is described in Table 1. Table 1: Recommended Dosage of Piperacillin and Tazobactam in Patients with Renal Impairment (as total grams piperacillin and tazobactam) Creatinine Clearance, mL/min All Indications except Nosocomial Pneumonia Nosocomial Pneumonia Greater than 40 mL/min 3.375 every 6 hours 4.5 every 6 hours 20 to 40 mL/min 2.25 every 6 hours 3.375 every 6 hours Less than 20 mL/min 2.25 every 8 hours 2.25 every 6 hours Pediatric Patients";
const gabapentinSection =
  "Dosage Adjustment in Patients with Renal Impairment TABLE 1. Gabapentin Dosage Based on Renal Function TID = Three times a day; BID = Two times a day; QD = Single daily dose Renal Function Creatinine Clearance (mL/min) Total Daily Dose Range (mg/day) Dose Regimen (mg) ≥60 900 to 3600 300 TID 400 TID 600 TID 800 TID 1200 TID >30 to 59 400 to 1400 200 BID 300 BID 400 BID 500 BID 700 BID >15 to 29 200 to 700 200 QD 300 QD 400 QD 500 QD 700 QD";
const fluconazoleSection =
  "Dosage In Patients With Impaired Renal Function: After the loading dose, the daily dose according to indication should be based on the following table: Creatinine Clearance (mL/min) Recommended Dose (%) >50 100 ≤50 (no dialysis) 50 Hemodialysis 100% after each hemodialysis";

test("extracts renal dose rows from DailyMed-style text", () => {
  const rows = extractDoseRows(meropenemSection, "Dosage And Administration");

  assert.equal(rows.length, 4);
  assert.equal(rows[1].min, 26);
  assert.equal(rows[1].max, 50);
  assert.match(rows[1].recommendation, /Every 12 hours/);
});

test("matches Cockcroft-Gault CrCl to the parsed dose band", () => {
  const guidance = deriveRenalDoseGuidance({
    crcl: 44,
    route: "IV",
    label: {
      status: "found",
      sections: [
        {
          heading: "Dosage And Administration",
          hasRenalKeyword: true,
          fullText: meropenemSection,
          text: meropenemSection,
        },
      ],
    },
  });

  assert.equal(guidance.status, "matched");
  assert.equal(guidance.crclBand, "CrCl 26-50 mL/min");
  assert.match(guidance.recommendation, /Every 12 hours/);
  assert.equal(guidance.routeLabel, "IV");
});

test("matches integer-label renal bands when calculated CrCl falls in decimal gap", () => {
  const guidance = deriveRenalDoseGuidance({
    crcl: 25.9,
    route: "IV",
    label: {
      status: "found",
      sections: [
        {
          heading: "Dosage And Administration",
          hasRenalKeyword: true,
          fullText: meropenemSection,
          text: meropenemSection,
        },
      ],
    },
  });

  assert.equal(guidance.status, "matched");
  assert.equal(guidance.crclBand, "CrCl 26-50 mL/min");
});

test("does not include pediatric table fragments for adult-only guidance", () => {
  const rows = extractDoseRows(meropenemSectionWithPediatricText, "Dosage And Administration");

  assert.equal(rows.length, 4);
  assert.doesNotMatch(rows[3].recommendation, /Pediatric/i);
});

test("prioritizes dosage section over other renal label text", () => {
  const guidance = deriveRenalDoseGuidance({
    crcl: 44,
    route: "ALL",
    label: {
      status: "found",
      sections: [
        {
          heading: "Dosage And Administration",
          hasRenalKeyword: true,
          fullText: meropenemSection,
          text: meropenemSection,
        },
        {
          heading: "Use In Specific Populations",
          hasRenalKeyword: true,
          fullText:
            "Renal impairment text from non-dosing section. 20 to 50 after mating at doses of 120 mg/kg/day did not produce fetal toxicity.",
          text: "Renal impairment text from non-dosing section.",
        },
      ],
    },
  });

  assert.equal(guidance.rows.length, 4);
  assert.equal(guidance.crclBand, "CrCl 26-50 mL/min");
});

test("parses adult piperacillin-tazobactam renal table after pediatric summary text", () => {
  const guidance = deriveRenalDoseGuidance({
    crcl: 44,
    route: "ALL",
    label: {
      status: "found",
      sections: [
        {
          heading: "Dosage And Administration",
          hasRenalKeyword: true,
          fullText: piptazSection,
          text: piptazSection,
        },
      ],
    },
  });

  assert.equal(guidance.status, "matched");
  assert.equal(guidance.crclBand, "CrCl > 40 mL/min");
  assert.match(guidance.recommendation, /3\.375 g every 6 hours/);
  assert.match(guidance.recommendation, /4\.5 g every 6 hours/);
});

test("keeps non-table renal label text out of the quick dose recommendation", () => {
  const noisyDoxycyclineText =
    "Renal impairment: Studies have shown no significant difference in serum half-life of doxycycline in patients with normal and severely impaired renal function. Creatinine clearance values from 10 to 75 mL/min were observed during pharmacokinetic studies. No dosage adjustment is recommended.";

  const guidance = deriveRenalDoseGuidance({
    crcl: 44,
    route: "ORAL",
    label: {
      status: "found",
      sections: [
        {
          heading: "Use In Specific Populations",
          hasRenalKeyword: true,
          fullText: noisyDoxycyclineText,
          text: noisyDoxycyclineText,
        },
      ],
    },
  });

  assert.equal(guidance.status, "label_text");
  assert.equal(guidance.rows.length, 0);
  assert.match(guidance.recommendation, /No CrCl dose table was parsed/i);
  assert.doesNotMatch(guidance.recommendation, /Studies have shown/i);
  assert.ok(guidance.recommendation.length < 120);
});

test("surfaces renal avoidance text without creating a fake dose", () => {
  const guidance = deriveRenalDoseGuidance({
    crcl: 26,
    route: "ORAL",
    label: {
      status: "found",
      sections: [
        {
          heading: "Contraindications",
          hasRenalKeyword: true,
          fullText: "Nitrofurantoin is contraindicated in patients with significant impairment of renal function.",
          text: "Nitrofurantoin is contraindicated in patients with significant impairment of renal function.",
        },
      ],
    },
  });

  assert.equal(guidance.status, "label_text");
  assert.match(guidance.recommendation, /renal avoidance|contraindication/i);
});

test("parses renal ranges with symbols and inherited mg units", () => {
  const guidance = deriveRenalDoseGuidance({
    crcl: 44,
    route: "ORAL",
    label: {
      status: "found",
      sections: [
        {
          heading: "Dosage And Administration",
          hasRenalKeyword: true,
          fullText: gabapentinSection,
          text: gabapentinSection,
        },
      ],
    },
  });

  assert.equal(guidance.status, "matched");
  assert.equal(guidance.crclBand, "CrCl > 30-59 mL/min");
  assert.match(guidance.recommendation, /400 to 1400 mg/);
  assert.match(guidance.recommendation, /200 mg BID/);
});

test("parses percent dose renal tables", () => {
  const guidance = deriveRenalDoseGuidance({
    crcl: 44,
    route: "ORAL",
    label: {
      status: "found",
      sections: [
        {
          heading: "Dosage And Administration",
          hasRenalKeyword: true,
          fullText: fluconazoleSection,
          text: fluconazoleSection,
        },
      ],
    },
  });

  assert.equal(guidance.status, "matched");
  assert.equal(guidance.crclBand, "CrCl <= 50 mL/min");
  assert.match(guidance.recommendation, /50% of usual daily dose/);
});

test("does not interpret age ranges as CrCl dose bands", () => {
  const ageBasedDosingText =
    "Dosage and Administration: Patients with renal impairment are described in the label. For pediatric patients greater than 8 years of age, the recommended dose is 2 mg/kg given once daily. No dosage adjustment is recommended in renal impairment.";

  const guidance = deriveRenalDoseGuidance({
    crcl: 44,
    route: "ORAL",
    label: {
      status: "found",
      sections: [
        {
          heading: "Dosage And Administration",
          hasRenalKeyword: true,
          fullText: ageBasedDosingText,
          text: ageBasedDosingText,
        },
      ],
    },
  });

  assert.equal(guidance.status, "label_text");
  assert.equal(guidance.rows.length, 0);
  assert.doesNotMatch(guidance.crclBand, /> 8/);
  assert.doesNotMatch(guidance.recommendation, /2 mg\/kg/i);
});
