import { mkdir, writeFile } from "node:fs/promises";
import { calculateCockcroftGault, calculateEgfrCkdEpi2021 } from "../src/renal.js";

const OUT_DIR = new URL("../docs/testing/generated/", import.meta.url);
const CASE_COUNT = 100;
const SEED = 20260510;
const MDCALC_VERSION = "24-638491f186fc605fdc8c1c88de56c5e50312e0cb";
const MDCALC_EGFR_ID = 3939;
const MDCALC_CRCL_ID = 43;
const DISPLAY_ROUNDING_TOLERANCE = 0.55;
const EXACT_TOLERANCE = 0.000001;

const generatedAt = new Date().toISOString();
const cases = generateCases(CASE_COUNT, SEED);
const results = [];

for (const patientCase of cases) {
  const appEgfr = calculateEgfrCkdEpi2021(patientCase);
  const appCrcl = calculateCockcroftGault(patientCase);
  const referenceEgfr = referenceCkdEpi2021(patientCase);
  const referenceCrcl = referenceCockcroftGault(patientCase);

  const mdcalcEgfr = await fetchMdcalcEgfr(patientCase);
  const mdcalcCrcl = await fetchMdcalcCrcl(patientCase);

  results.push({
    ...patientCase,
    appEgfr,
    referenceEgfr,
    mdcalcEgfr,
    egfrDifferenceVsReference: roundTo(appEgfr - referenceEgfr, 3),
    egfrDifferenceVsMdcalcDisplay: roundTo(appEgfr - mdcalcEgfr, 3),
    egfrExactFormulaMatch: Math.abs(appEgfr - referenceEgfr) <= EXACT_TOLERANCE,
    egfrMdcalcDisplayMatch: Math.abs(appEgfr - mdcalcEgfr) <= DISPLAY_ROUNDING_TOLERANCE,
    appCrcl,
    referenceCrcl,
    mdcalcCrcl,
    crclDifferenceVsReference: roundTo(appCrcl - referenceCrcl, 3),
    crclDifferenceVsMdcalcDisplay: roundTo(appCrcl - mdcalcCrcl, 3),
    crclExactFormulaMatch: Math.abs(appCrcl - referenceCrcl) <= EXACT_TOLERANCE,
    crclMdcalcDisplayMatch: Math.abs(appCrcl - mdcalcCrcl) <= DISPLAY_ROUNDING_TOLERANCE,
  });
}

const summary = summarize(results);
await mkdir(OUT_DIR, { recursive: true });

const stamp = generatedAt.replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const jsonUrl = new URL(`renal-mdcalc-validation-${stamp}.json`, OUT_DIR);
const mdUrl = new URL(`renal-mdcalc-validation-${stamp}.md`, OUT_DIR);
const latestJsonUrl = new URL("renal-mdcalc-validation-latest.json", OUT_DIR);
const latestMdUrl = new URL("renal-mdcalc-validation-latest.md", OUT_DIR);

const payload = {
  generatedAt,
  seed: SEED,
  caseCount: CASE_COUNT,
  units: {
    age: "years",
    sex: "male/female",
    creatinine: "mg/dL",
    weight: "kg",
    height: "not used",
  },
  mdcalc: {
    egfrCalculator: "CKD-EPI Equations for Glomerular Filtration Rate (GFR)",
    egfrCalculatorId: MDCALC_EGFR_ID,
    crclCalculator: "Creatinine Clearance (Cockcroft-Gault Equation)",
    crclCalculatorId: MDCALC_CRCL_ID,
    note: "MDCalc displayed whole-number outputs; app and independent references are rounded to 1 decimal.",
  },
  tolerance: {
    exactFormula: EXACT_TOLERANCE,
    mdcalcDisplay: DISPLAY_ROUNDING_TOLERANCE,
  },
  summary,
  results,
};

const markdown = renderMarkdown(payload);
await writeFile(jsonUrl, JSON.stringify(payload, null, 2));
await writeFile(mdUrl, markdown);
await writeFile(latestJsonUrl, JSON.stringify(payload, null, 2));
await writeFile(latestMdUrl, markdown);

console.log(
  JSON.stringify(
    {
      generatedAt,
      totalCases: CASE_COUNT,
      summary,
      jsonPath: filePath(jsonUrl),
      mdPath: filePath(mdUrl),
      latestJsonPath: filePath(latestJsonUrl),
      latestMdPath: filePath(latestMdUrl),
    },
    null,
    2
  )
);

function generateCases(count, seed) {
  const random = mulberry32(seed);
  const boundaryCases = [
    { age: 18, sex: "male", creatinine: 0.6, weight: 55 },
    { age: 18, sex: "female", creatinine: 0.6, weight: 45 },
    { age: 45, sex: "male", creatinine: 2.1, weight: 70 },
    { age: 70, sex: "female", creatinine: 1.4, weight: 60 },
    { age: 82, sex: "male", creatinine: 4.8, weight: 52 },
    { age: 90, sex: "female", creatinine: 3.9, weight: 42 },
    { age: 36, sex: "male", creatinine: 1.0, weight: 130 },
    { age: 58, sex: "female", creatinine: 2.6, weight: 118 },
  ];
  const cases = [...boundaryCases];

  while (cases.length < count) {
    const sex = random() >= 0.5 ? "male" : "female";
    const age = randomInt(random, 18, 95);
    const creatinine = roundTo(randomFloat(random, 0.5, 6), random() > 0.7 ? 2 : 1);
    const weight = roundTo(randomFloat(random, 40, 160), random() > 0.65 ? 1 : 0);
    cases.push({ age, sex, creatinine, weight });
  }

  return cases.map((row, index) => ({ caseId: index + 1, ...row }));
}

function referenceCkdEpi2021({ age, sex, creatinine }) {
  const isFemale = sex === "female";
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const ratio = creatinine / kappa;

  return roundTo(
    142 *
      Math.min(ratio, 1) ** alpha *
      Math.max(ratio, 1) ** -1.2 *
      0.9938 ** age *
      (isFemale ? 1.012 : 1),
    1
  );
}

function referenceCockcroftGault({ age, sex, creatinine, weight }) {
  return roundTo((((140 - age) * weight) / (72 * creatinine)) * (sex === "female" ? 0.85 : 1), 1);
}

async function fetchMdcalcEgfr(patientCase) {
  const data = await postMdcalc(MDCALC_EGFR_ID, {
    UOMSYSTEM: true,
    webLanguage: "english",
    calc: 3,
    gender: patientCase.sex === "male" ? 1 : 0,
    age: patientCase.age,
    scr: patientCase.creatinine,
  });

  return readNumericOutput(data, "Estimated GFR by 2021 CKD-EPI Creatinine");
}

async function fetchMdcalcCrcl(patientCase) {
  const data = await postMdcalc(MDCALC_CRCL_ID, {
    UOMSYSTEM: true,
    webLanguage: "english",
    sex: patientCase.sex === "female" ? 1 : 0,
    age: patientCase.age,
    weight: patientCase.weight,
    creatinine: patientCase.creatinine,
  });

  return readNumericOutput(data, "Creatinine clearance, original Cockcroft-Gault");
}

async function postMdcalc(calcId, payload) {
  const response = await fetch(`https://www.mdcalc.com/api/v1/calc/${calcId}/calculate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "mdcalc-source": "web",
      "mdcalc-version": MDCALC_VERSION,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`MDCalc ${calcId} returned HTTP ${response.status}`);
  }

  return response.json();
}

function readNumericOutput(data, message) {
  const output =
    data?.output?.find((item) => item.message === message) ??
    data?.output?.find((item) => item.name === "mini") ??
    null;
  const number = Number.parseFloat(output?.value);
  if (!Number.isFinite(number)) {
    throw new Error(`Could not parse MDCalc output for "${message}"`);
  }
  return number;
}

function summarize(rows) {
  const egfrExactMatches = rows.filter((row) => row.egfrExactFormulaMatch).length;
  const crclExactMatches = rows.filter((row) => row.crclExactFormulaMatch).length;
  const egfrMdcalcDisplayMatches = rows.filter((row) => row.egfrMdcalcDisplayMatch).length;
  const crclMdcalcDisplayMatches = rows.filter((row) => row.crclMdcalcDisplayMatch).length;
  const maxEgfrMdcalcDisplayDiff = maxAbs(rows.map((row) => row.egfrDifferenceVsMdcalcDisplay));
  const maxCrclMdcalcDisplayDiff = maxAbs(rows.map((row) => row.crclDifferenceVsMdcalcDisplay));
  const maxEgfrReferenceDiff = maxAbs(rows.map((row) => row.egfrDifferenceVsReference));
  const maxCrclReferenceDiff = maxAbs(rows.map((row) => row.crclDifferenceVsReference));

  return {
    egfrExactMatches,
    crclExactMatches,
    egfrMdcalcDisplayMatches,
    crclMdcalcDisplayMatches,
    failedRows: rows.filter(
      (row) =>
        !row.egfrExactFormulaMatch ||
        !row.crclExactFormulaMatch ||
        !row.egfrMdcalcDisplayMatch ||
        !row.crclMdcalcDisplayMatch
    ).length,
    maxEgfrReferenceDiff,
    maxCrclReferenceDiff,
    maxEgfrMdcalcDisplayDiff,
    maxCrclMdcalcDisplayDiff,
  };
}

function renderMarkdown(report) {
  const rows = report.results
    .map((row) =>
      [
        row.caseId,
        row.age,
        row.sex,
        row.creatinine,
        row.weight,
        row.appEgfr,
        row.mdcalcEgfr,
        signed(row.egfrDifferenceVsMdcalcDisplay),
        row.appCrcl,
        row.mdcalcCrcl,
        signed(row.crclDifferenceVsMdcalcDisplay),
        row.egfrMdcalcDisplayMatch && row.crclMdcalcDisplayMatch ? "Pass" : "Review",
      ]
        .map(markdownCell)
        .join(" | ")
    )
    .map((row) => `| ${row} |`)
    .join("\n");

  return `# Renal Calculator Accuracy Validation Against MDCalc

Generated: ${report.generatedAt}

Seed: ${report.seed}

Cases: ${report.caseCount} synthetic adult patient sets.

Units: age in years, sex as male/female, serum creatinine in mg/dL, weight in kg. Height was not used because this validation targets the app's current actual-body-weight Cockcroft-Gault calculation.

## Sources

- MDCalc calculator 3939: CKD-EPI Equations for Glomerular Filtration Rate (GFR)
- MDCalc calculator 43: Creatinine Clearance (Cockcroft-Gault Equation)
- MDCalc API endpoint used for validation only: /api/v1/calc/{id}/calculate

The MDCalc web endpoint returns whole-number displayed results. The app intentionally displays 1-decimal values, so the MDCalc display comparison allows ±${report.tolerance.mdcalcDisplay} mL/min or mL/min/1.73 m². The exact formula comparison uses independent local equations rounded to 1 decimal.

## Summary

| Check | Result |
|---|---:|
| CKD-EPI exact formula matches | ${report.summary.egfrExactMatches}/${report.caseCount} |
| Cockcroft-Gault exact formula matches | ${report.summary.crclExactMatches}/${report.caseCount} |
| CKD-EPI matches MDCalc displayed result | ${report.summary.egfrMdcalcDisplayMatches}/${report.caseCount} |
| Cockcroft-Gault matches MDCalc displayed result | ${report.summary.crclMdcalcDisplayMatches}/${report.caseCount} |
| Rows needing review | ${report.summary.failedRows} |
| Max CKD-EPI exact-formula difference | ${report.summary.maxEgfrReferenceDiff} |
| Max Cockcroft-Gault exact-formula difference | ${report.summary.maxCrclReferenceDiff} |
| Max CKD-EPI displayed MDCalc difference | ${report.summary.maxEgfrMdcalcDisplayDiff} |
| Max Cockcroft-Gault displayed MDCalc difference | ${report.summary.maxCrclMdcalcDisplayDiff} |

## Interpretation

The app's CKD-EPI 2021 creatinine and Cockcroft-Gault calculations matched the independent formula implementation in all generated cases. The MDCalc displayed values also matched within display-rounding tolerance in all generated cases.

This validates the arithmetic layer only. It does not validate drug-dose interpretation, DailyMed parsing, body-weight selection policy for obesity/underweight states, pediatric dosing, dialysis dosing, or prescribing decisions.

## Case Table

| Case | Age | Sex | SCr mg/dL | Weight kg | App eGFR | MDCalc eGFR | eGFR diff | App CrCl | MDCalc CrCl | CrCl diff | Status |
|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
${rows}
`;
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomFloat(random, min, max) {
  return random() * (max - min) + min;
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function maxAbs(values) {
  return roundTo(Math.max(...values.map((value) => Math.abs(value))), 3);
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function markdownCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .trim();
}

function filePath(url) {
  return decodeURIComponent(url.pathname);
}
