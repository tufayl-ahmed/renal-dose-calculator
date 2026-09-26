// Hand-curated from FDA labels (DailyMed / openFDA) for drugs whose renal
// guidance could not be extracted automatically. Each record states only
// what its label says; where a label gives cautions but no numbers, the
// record says so (decisionHint "caution" / "not-studied") instead of
// inventing a dose. All records are drafts until a clinician verifies them.

const REVIEWER = "Claude label curation (draft)";
const REVIEWED_ON = "2026-09-26";
const DAILYMED = "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=";

function record({ name, search, aliases = [], route, setId, section, note, hint, metric, rules }) {
  return {
    drugName: name,
    searchTerm: search || name.toLowerCase(),
    aliases,
    routes: [route],
    adultOnly: true,
    indicationNote: note,
    sourceLabel: `DailyMed label: ${section}`,
    sourceUrl: `${DAILYMED}${setId}`,
    reviewedBy: REVIEWER,
    reviewedOn: REVIEWED_ON,
    confidence: "draft-source-extracted",
    ...(hint ? { decisionHint: hint } : {}),
    ...(metric ? { renalMetric: metric } : {}),
    rules,
  };
}

/** One rule covering every renal value. */
function all(dose, interval, condition = "Renal impairment") {
  return [{ type: "all", min: 0, max: Infinity, variants: [{ condition, dose, interval }] }];
}

/** A banded rule: type is gt | gte | lt | range; hint applies to this band only. */
function band(type, min, max, dose, interval, condition = "Adult dosing", hint = "") {
  return {
    type,
    min: type === "lt" ? 0 : min,
    max: type === "gt" || type === "gte" ? Infinity : max,
    variants: [{ condition, dose, interval }],
    ...(hint ? { hint } : {}),
  };
}

export const labelCuratedRules = [
  // Batches are appended below.

  // ---- Batch 1 ----
  record({
    name: "Bupropion", route: "ORAL", setId: "004d8121-59d4-46c4-acb8-b2dd097bf556", metric: "egfr",
    section: "2.7 Dose Adjustment in Patients with Renal Impairment; 8.6 Renal Impairment",
    note: "Label defines renal impairment as GFR below 90 mL/min; it gives no specific reduced dose.",
    rules: [
      band("gte", 90, Infinity, "Usual dose", "no renal adjustment stated for GFR ≥ 90 mL/min"),
      band("lt", 0, 90, "Consider reducing the dose and/or dosing frequency", "label gives no specific amount", "Renal impairment (GFR < 90 mL/min)", "caution"),
    ],
  }),
  record({
    name: "Ibuprofen", route: "ORAL", setId: "00872852-680a-41b3-901b-b991b12a176d", hint: "caution",
    section: "Warnings: Renal Effects; Advanced Renal Disease",
    note: "NSAIDs can precipitate renal decompensation in patients with impaired renal function; the label gives no CrCl threshold.",
    rules: all("Advanced renal disease: not recommended", "if it must be used, closely monitor renal function"),
  }),
  record({
    name: "Ibuprofen", route: "IV", setId: "1eaa7790-f1a1-4f51-b10a-cbbaf033f684", hint: "caution",
    section: "Dosage and Administration; Warnings: Renal Toxicity",
    note: "Patients must be well hydrated before administration. The label gives no CrCl threshold.",
    rules: all("Advanced renal disease: avoid unless benefits outweigh the risk of worsening renal function", "ensure hydration before each dose; monitor renal function"),
  }),
  record({
    name: "Diclofenac", route: "ORAL", setId: "03c4f06f-6a49-4404-bf3b-0aafa33c81ef", hint: "caution",
    section: "Warnings: Renal Toxicity and Hyperkalemia",
    note: "No controlled data in advanced renal disease; renal effects may hasten progression of renal dysfunction.",
    rules: all("Renal impairment: use with caution; no dose guidance in the label", "monitor renal function; correct volume status before starting"),
  }),
  record({
    name: "Potassium Chloride", route: "ORAL", setId: "00615fad-ad3b-46e8-a89d-48290d937ae2", hint: "caution",
    section: "8.7 Renal Impairment",
    note: "Reduced urinary potassium excretion in renal impairment increases the risk of hyperkalemia.",
    rules: all("Renal impairment: start at the low end of the dosing range", "monitor serum potassium and renal function"),
  }),
  record({
    name: "Baclofen", route: "ORAL", setId: "020632f4-5e8a-f4a0-e063-6294a90a6301", hint: "caution",
    section: "Warnings: Impaired Renal Function",
    note: "Baclofen is excreted mainly unchanged by the kidneys; the label gives no specific reduced dose.",
    rules: all("Renal impairment: give with caution; dose reduction may be necessary", "label gives no specific amount"),
  }),
  record({
    name: "Hydrochlorothiazide", route: "ORAL", setId: "01ad3531-5ed9-434c-b7d5-02d72aa82e46", hint: "caution",
    section: "Warnings; Contraindications",
    note: "Thiazides may precipitate azotemia in renal disease; contraindicated in anuria.",
    rules: all("Severe renal disease: use with caution; contraindicated in anuria", "consider withholding or stopping if renal impairment progresses"),
  }),
  record({
    name: "Famotidine", route: "IV", setId: "1fdf16e5-145d-4c19-a318-fc6c10794b50",
    section: "Dosage Adjustments for Patients with Moderate or Severe Renal Insufficiency",
    note: "CNS adverse effects have been reported with moderate and severe renal insufficiency.",
    rules: [
      band("gte", 50, Infinity, "Usual dose", "no renal adjustment for CrCl ≥ 50 mL/min"),
      band("lt", 0, 50, "Half the usual dose, or extend the interval to 36–48 hours", "as indicated by clinical response", "Moderate (CrCl < 50) or severe renal insufficiency"),
    ],
  }),
  record({
    name: "Furosemide", route: "ORAL", setId: "01a5f094-b473-4e46-9e61-69d5ec6dd766", hint: "caution",
    section: "Warnings; Contraindications",
    note: "Ototoxicity is more likely with severe renal impairment.",
    rules: all("Contraindicated in anuria; stop if azotemia and oliguria increase in severe progressive renal disease", "no renal dose table in the label"),
  }),
  record({
    name: "Furosemide", route: "IV", setId: "08a44bdd-028d-41af-9d4e-70971b0bcc4e", hint: "caution",
    section: "5 Warnings and Precautions: Worsening Renal Function",
    note: "Monitor serum electrolytes, BUN and creatinine; ototoxicity is more likely with severe renal impairment.",
    rules: all("Stop if azotemia and oliguria increase in severe progressive renal disease", "monitor for dehydration and azotemia"),
  }),
  record({
    name: "Furosemide", route: "SC", setId: "eac958dd-8d43-e44e-e053-2995a90a4d5e", hint: "caution",
    section: "8.6 Renal Impairment; 5.1 Worsening Renal Function",
    note: "The on-body infusor delivers a fixed 80 mg dose.",
    rules: all("Significantly reduced renal function may need additional diuretic therapy", "stop if azotemia and oliguria increase in severe progressive renal disease"),
  }),
  record({
    name: "Ketorolac", route: "ORAL", setId: "04d5114e-332b-4ed0-85df-b276c1dc296c", hint: "caution",
    section: "Dosage and Administration; Contraindications",
    note: "Contraindicated in advanced renal impairment or risk of renal failure from volume depletion. Total ketorolac course (all routes) is limited to 5 days.",
    rules: all("Renally impaired: 10 mg once, then 10 mg every 4–6 hours as needed", "maximum 40 mg/day; contraindicated in advanced renal impairment"),
  }),
  record({
    name: "Ketorolac", route: "IV", setId: "014ba8d7-7ed3-4d4a-847a-22b65161117e", hint: "caution",
    section: "Dosage and Administration; Contraindications",
    note: "Applies to renally impaired patients, age ≥ 65 or weight < 50 kg. Contraindicated in advanced renal impairment or risk of renal failure from volume depletion.",
    rules: all("Renally impaired: 15 mg IV every 6 hours (single dose 15 mg)", "maximum 60 mg/day; contraindicated in advanced renal impairment"),
  }),
  record({
    name: "Celecoxib", route: "ORAL", setId: "00e67d5e-df6f-4dfd-8c2d-a001c8a99af0", hint: "caution",
    section: "Warnings and Precautions: Renal Toxicity",
    note: "The label gives no CrCl threshold for advanced renal disease.",
    rules: all("Advanced renal disease: avoid unless benefits outweigh the risk of worsening renal function", "monitor renal function"),
  }),
  record({
    name: "Pravastatin", route: "ORAL", setId: "01beb7e2-ba01-4f2f-8554-4a8ec0941c9f", hint: "caution",
    section: "2.2 Dosage in Patients with Renal Impairment; 5.1 Skeletal Muscle",
    note: "Renal impairment is a risk factor for myopathy; the label gives no CrCl cut-off for 'significant' impairment.",
    rules: all("Significant renal impairment: start 10 mg once daily", "titrate cautiously"),
  }),
  record({
    name: "Allopurinol", route: "IV", setId: "2caf5eed-2408-4ce0-bd0d-04f4c90e434d",
    section: "2.2 Dosage Modifications in Patients with Renal Impairment",
    note: "Usual adult dose 200–400 mg/m²/day (maximum 600 mg/day), started 24–48 hours before chemotherapy.",
    rules: [
      band("gt", 20, Infinity, "No reduction specified", "usual 200–400 mg/m²/day, maximum 600 mg/day"),
      band("range", 10, 20, "200 mg/day", "daily", "CrCl 10–20 mL/min"),
      {
        type: "lt", min: 0, max: 10,
        variants: [
          { condition: "CrCl < 10 mL/min", dose: "100 mg/day", interval: "daily" },
          { condition: "On dialysis", dose: "50 mg every 12 hours or 100 mg every 24 hours", interval: "per label" },
        ],
      },
    ],
  }),
  record({
    name: "Naproxen", route: "ORAL", setId: "000155a8-709c-44e5-a75f-cd890f3a7caf",
    section: "8.6 Renal Impairment; 5.5 Renal Toxicity",
    note: "Avoid in advanced renal disease unless benefits outweigh the risk of worsening renal function.",
    rules: [
      band("gte", 30, Infinity, "Use with caution; no dose change specified", "monitor renal function", "CrCl ≥ 30 mL/min", "caution"),
      band("lt", 0, 30, "Not recommended", "CrCl < 30 mL/min", "Moderate to severe and severe renal impairment"),
    ],
  }),
  record({
    name: "Glycopyrrolate", route: "ORAL", setId: "098c7654-a352-47ee-bf23-6a81f8601266", hint: "caution",
    section: "8 Use in Specific Populations: Renal Impairment",
    note: "The label gives no specific reduced dose.",
    rules: all("Renal impairment: monitor for anticholinergic adverse reactions", "discontinue if anticholinergic adverse reactions occur"),
  }),
  record({
    name: "Glycopyrrolate", route: "IV", setId: "02541cfd-b209-49b9-a73f-13ef18dce06d", hint: "caution",
    section: "8.6 Renal Impairment; 5.6 Risk of Use in Patients with Renal Impairment",
    note: "The label gives no specific reduced dose.",
    rules: all("Renal failure: renal elimination may be significantly reduced", "use with caution; monitor for anticholinergic effects"),
  }),
  record({
    name: "Dicyclomine", route: "ORAL", setId: "2c656550-7e5b-445f-e063-6294a90a8f52", hint: "not-studied",
    section: "8.6 Renal Impairment",
    note: "Substantially excreted by the kidney; toxic reactions may be more likely with impaired renal function.",
    rules: all("Renal impairment: not studied", "use with caution"),
  }),
  record({
    name: "Dicyclomine", route: "IV", setId: "26a94263-46c0-4938-849c-ffb396e48dd3", hint: "not-studied",
    section: "8.6 Renal Impairment",
    note: "Substantially excreted by the kidney; toxic reactions may be more likely with impaired renal function.",
    rules: all("Renal impairment: not studied", "use with caution"),
  }),
  record({
    name: "Meloxicam", route: "ORAL", setId: "06a401f0-4380-4081-86ed-a309a25abf6b", hint: "caution",
    section: "2.5 Renal Impairment; 5.6 Renal Toxicity",
    note: "Avoid in advanced renal disease unless benefits outweigh the risk of worsening renal function.",
    rules: [
      {
        type: "all", min: 0, max: Infinity,
        variants: [
          { condition: "Severe renal impairment", dose: "Not recommended", interval: "no CrCl threshold given" },
          { condition: "Hemodialysis", dose: "Maximum 7.5 mg per day", interval: "once daily" },
        ],
      },
    ],
  }),
  record({
    name: "Meloxicam", route: "IV", setId: "385fd779-1be1-49ae-8213-750b96ecc997", hint: "caution",
    section: "Dosage and Administration; Contraindications",
    note: "Contraindicated in moderate to severe renal insufficiency with risk of renal failure from volume depletion. Hydrate before dosing.",
    rules: all("Advanced renal disease: avoid unless benefits outweigh the risk of worsening renal function", "ensure hydration before dosing"),
  }),
  record({
    name: "Phentermine", route: "ORAL", setId: "27e88ebe-6247-4598-8ef2-c882992ed579", metric: "egfr",
    section: "2.2 Dosage in Patients With Renal Impairment",
    note: "eGFR-based adult dosing.",
    rules: [
      band("gte", 30, Infinity, "Usual dose", "no renal adjustment stated for eGFR ≥ 30"),
      band("range", 15, 29.99, "Maximum 15 mg daily", "severe renal impairment", "eGFR 15–29 mL/min/1.73 m²"),
      band("lt", 0, 15, "Avoid", "eGFR < 15 mL/min/1.73 m² or dialysis", "End-stage renal disease"),
    ],
  }),
  record({
    name: "Diltiazem", route: "IV", setId: "3f2942d7-f4d0-2d77-e063-6294a90a74ad", hint: "caution",
    section: "Warnings; Precautions",
    note: "The label gives no specific reduced dose.",
    rules: all("Impaired renal function: use with caution", "no specific dose adjustment in the label"),
  }),
  record({
    name: "Glipizide", route: "ORAL", setId: "00729e82-150a-464a-abe7-a3319721fbdb", hint: "caution",
    section: "Dosage and Administration",
    note: "To avoid hypoglycemia; the label gives no specific dose.",
    rules: all("Impaired renal function: conservative initial and maintenance dosing", "titrate carefully to avoid hypoglycemia"),
  }),
  record({
    name: "Lorazepam", route: "IV", setId: "20140b19-846b-425f-b191-670e17809945", hint: "caution",
    section: "Dosage and Administration: Patients with Renal Disease; Warnings",
    note: "Excretion of the glucuronide is renal.",
    rules: [
      {
        type: "all", min: 0, max: Infinity,
        variants: [
          { condition: "Acute (single) doses", dose: "No adjustment needed", interval: "caution with frequent doses over short periods" },
          { condition: "Renal failure", dose: "Not recommended", interval: "use with caution in mild to moderate renal disease" },
        ],
      },
    ],
  }),
  record({
    name: "Lamotrigine", route: "ORAL", setId: "003663e5-c0c7-4fc1-a64d-313f2a5b10d2", hint: "caution",
    section: "2.1 Patients with Renal Impairment; 8.6 Renal Impairment",
    note: "Initial doses depend on concomitant medications.",
    rules: all("Significant renal impairment: reduced maintenance doses may be effective", "label gives no specific amount"),
  }),
  record({
    name: "Clonazepam", route: "ORAL", setId: "00f323c0-e007-40df-ae7f-e6b3c7ba0aa8", hint: "caution",
    section: "Precautions: Caution in Renally Impaired Patients",
    note: "Renally excreted metabolites may accumulate.",
    rules: all("Impaired renal function: use with caution", "label gives no specific dose reduction"),
  }),
  record({
    name: "Hydrocortisone", route: "IV", setId: "37534164-9de5-4bb3-9f87-341dfcf90883", hint: "caution",
    section: "Precautions: Cardio-renal",
    note: "Sodium retention, edema and potassium loss may occur.",
    rules: all("Renal insufficiency: use with caution", "no dose adjustment in the label"),
  }),
];

// Exported for tests of the helpers.
export const _helpers = { record, all, band };
