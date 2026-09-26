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
  // ---- Batch 2 ----
  record({
    name: "Sulfamethoxazole and Trimethoprim", route: "IV", setId: "640f5b0c-748d-4a68-a1de-59cc3e00ed49",
    section: "Table 2: Impaired Renal Function Dosage Guidelines",
    note: "Doses are based on the trimethoprim component and vary by infection.",
    rules: [
      band("gt", 30, Infinity, "Usual standard dosage regimen", "by infection"),
      band("range", 15, 30, "Half the usual dosage regimen", "by infection", "CrCl 15–30 mL/min"),
      band("lt", 0, 15, "Use not recommended", "CrCl below 15 mL/min", "Severe renal impairment"),
    ],
  }),
  record({
    name: "Diazepam", route: "ORAL", setId: "01f04ee4-fff9-499a-8213-984e16368084", hint: "caution",
    section: "Geriatric Use / Precautions",
    note: "Metabolites are substantially excreted by the kidney.",
    rules: all("Impaired renal function: toxic reactions may be more likely", "take care in dose selection; label gives no specific amount"),
  }),
  record({
    name: "Diazepam", route: "IV", setId: "1632f040-3b2c-43da-a42f-f2baf5ec778a", hint: "caution",
    section: "Precautions",
    note: "Metabolites are excreted by the kidney.",
    rules: all("Compromised kidney function: use with caution to avoid metabolite accumulation", "label gives no specific dose reduction"),
  }),
  record({
    name: "Tizanidine", route: "ORAL", setId: "03fa03a6-fd05-4f17-872a-3c123330935d",
    section: "2.2 Dosing in Patients with Renal Impairment",
    note: "Clearance is reduced by more than 50% with CrCl below 25 mL/min, prolonging the clinical effect.",
    rules: [
      band("gte", 25, Infinity, "Usual dose", "no renal adjustment stated for CrCl ≥ 25 mL/min"),
      band("lt", 0, 25, "Use with caution; reduce individual doses during titration", "CrCl < 25 mL/min", "Renal insufficiency", "caution"),
    ],
  }),
  record({
    name: "Mirtazapine", route: "ORAL", setId: "0f19ab40-1a30-4ac2-9bd7-c2f8199e29e1", hint: "caution",
    section: "8.6 Renal or Hepatic Impairment",
    note: "The label gives no specific reduced dose.",
    rules: all("Moderate to severe renal impairment: clearance is reduced", "use with caution; label gives no specific amount"),
  }),
  record({
    name: "Indomethacin", route: "ORAL", setId: "009097a5-2c1e-4f5d-8054-896cf896cb3d", hint: "caution",
    section: "Warnings and Precautions: Renal Toxicity",
    note: "The label gives no CrCl threshold for advanced renal disease.",
    rules: all("Advanced renal disease: avoid unless benefits outweigh the risk of worsening renal function", "monitor renal function"),
  }),
  record({
    name: "Oxybutynin", route: "ORAL", setId: "1f95920c-5dc2-44e4-b61d-b2c5e05390ba", hint: "not-studied",
    section: "8.6 Renal Impairment",
    note: "No studies in renal impairment.",
    rules: all("Renal impairment: not studied", "use with caution"),
  }),
  record({
    name: "Losartan and Hydrochlorothiazide", route: "ORAL", setId: "03c0ec8d-9daf-43e8-8a4e-a2ddc3573ca7",
    section: "Dosage and Administration; 5 Warnings and Precautions",
    note: "Monitor renal function and potassium in susceptible patients.",
    rules: [
      band("gte", 30, Infinity, "Usual dose; monitor renal function and potassium", "no renal dose change stated", "CrCl ≥ 30 mL/min", "caution"),
      band("lt", 0, 30, "Safety and effectiveness not established", "CrCl < 30 mL/min", "Severe renal impairment", "not-studied"),
    ],
  }),
  record({
    name: "Epinephrine", route: "IV", setId: "0172280c-f7d6-4613-9dbd-f94d3ae5825a", hint: "caution",
    section: "5 Warnings and Precautions",
    note: "The label gives no renal dose adjustment.",
    rules: all("Constricts renal blood vessels; oliguria or renal impairment may result", "monitor renal function"),
  }),
  record({
    name: "Vancomycin", route: "ORAL", setId: "127d95d1-8070-41ac-8343-3168b0cf1312", hint: "caution",
    section: "5.3 Nephrotoxicity; 8 Use in Specific Populations",
    note: "Oral vancomycin label; monitor renal function, especially in patients over 65.",
    rules: all("Monitor renal function during and after treatment", "no renal dose adjustment in the label"),
  }),
  record({
    name: "Morphine", route: "ORAL", setId: "07593aa4-f2c4-4d6e-b186-ab2a4ecaa38a", hint: "caution",
    section: "Use in Specific Populations",
    note: "Morphine is substantially excreted by the kidney.",
    rules: all("Impaired renal function: adverse reactions may be more likely", "use caution; start at the low end of the dosing range"),
  }),
  record({
    name: "Morphine", route: "IV", setId: "1034467f-d436-4b87-a902-c7e8885daa8a", hint: "caution",
    section: "8.7 Renal Impairment",
    note: "The label gives no specific reduced dose.",
    rules: all("Renal failure: morphine pharmacokinetics are altered", "use caution; titrate to effect"),
  }),
  record({
    name: "Etodolac", route: "ORAL", setId: "00125d63-d8d0-46c5-bdf1-80d2c85eda5a", hint: "caution",
    section: "Dosage and Administration; Warnings: Advanced Renal Disease",
    note: "May further decrease renal function in some patients with impaired renal function.",
    rules: [
      {
        type: "all", min: 0, max: Infinity,
        variants: [
          { condition: "Mild to moderate renal impairment", dose: "Dose adjustment generally not required", interval: "use with caution" },
          { condition: "Advanced renal disease", dose: "Not recommended", interval: "no CrCl threshold given" },
        ],
      },
    ],
  }),
  record({
    name: "Levofloxacin", route: "IV", setId: "4d400bf9-988f-42ec-93f1-e71a93a324b2",
    section: "Table 3: Dosage Adjustment in Adult Patients with Renal Impairment",
    note: "Choose the row matching the usual (normal renal function) regimen for the infection.",
    rules: [
      band("gte", 50, Infinity, "Usual dose", "250–750 mg every 24 hours by infection"),
      {
        type: "range", min: 20, max: 49,
        variants: [
          { condition: "Usual 750 mg", dose: "750 mg", interval: "every 48 hours" },
          { condition: "Usual 500 mg", dose: "500 mg once, then 250 mg", interval: "every 24 hours" },
          { condition: "Usual 250 mg", dose: "No dosage adjustment", interval: "every 24 hours" },
        ],
      },
      {
        type: "range", min: 10, max: 19,
        variants: [
          { condition: "Usual 750 mg", dose: "750 mg once, then 500 mg", interval: "every 48 hours" },
          { condition: "Usual 500 mg", dose: "500 mg once, then 250 mg", interval: "every 48 hours" },
          { condition: "Usual 250 mg", dose: "250 mg", interval: "every 48 hours (uncomplicated UTI: no adjustment)" },
        ],
      },
      {
        type: "lt", min: 0, max: 10,
        variants: [
          { condition: "Hemodialysis or CAPD, usual 750 mg", dose: "750 mg once, then 500 mg", interval: "every 48 hours" },
          { condition: "Hemodialysis or CAPD, usual 500 mg", dose: "500 mg once, then 250 mg", interval: "every 48 hours" },
          { condition: "Hemodialysis or CAPD, usual 250 mg", dose: "No dosing information", interval: "label gives none" },
        ],
      },
    ],
  }),
  record({
    name: "Olmesartan Medoxomil", route: "ORAL", setId: "04f0107b-4194-4412-9ebb-3219da5a9ac9", hint: "caution",
    section: "2 Dosage and Administration; 5.3 Hypotension",
    note: "Applies to possible intravascular volume depletion (e.g. diuretics), particularly with impaired renal function.",
    rules: all("Impaired renal function with volume depletion: start under close supervision", "consider a lower starting dose"),
  }),
  record({
    name: "Bumetanide", route: "ORAL", setId: "056be255-5880-48e9-b160-bd5b3d82c24a", hint: "caution",
    section: "Contraindications; Warnings",
    note: "Can be used to induce diuresis in renal insufficiency.",
    rules: all("Contraindicated in anuria; stop if BUN or creatinine rises markedly or oliguria develops in progressive renal disease", "no renal dose table in the label"),
  }),
  record({
    name: "Bumetanide", route: "IV", setId: "084b34ad-36ba-43bd-a43a-1f4b4da26d8f", hint: "caution",
    section: "Contraindications; Warnings",
    note: "Can be used to induce diuresis in renal insufficiency; parenteral use with other ototoxic drugs is riskier with impaired renal function.",
    rules: all("Contraindicated in anuria; stop if BUN or creatinine rises markedly or oliguria develops in progressive renal disease", "no renal dose table in the label"),
  }),
  record({
    name: "Warfarin", route: "ORAL", setId: "2cbcc99d-9107-4d39-a1e9-e19305de8b5d",
    section: "2.5 Renal Impairment; 8.6 Renal Impairment",
    note: "Monitor INR more frequently with compromised renal function.",
    rules: all("No dosage adjustment necessary", "monitor INR more frequently"),
  }),
  record({
    name: "Mesalamine", route: "ORAL", setId: "00f77203-3615-47e8-ae25-6e1cf8a2a00a", hint: "caution",
    section: "5 Warnings and Precautions: Renal Impairment",
    note: "Evaluate risks and benefits in known renal impairment or with nephrotoxic drugs.",
    rules: all("Assess renal function before and during treatment", "discontinue if renal function deteriorates"),
  }),
  record({
    name: "Sucralfate", route: "ORAL", setId: "0206d7fa-a1d5-35d9-e063-6294a90a5eb3", hint: "caution",
    section: "Precautions",
    note: "The label gives no specific dose change.",
    rules: all("Chronic renal failure: use with caution", "label gives no specific dose change"),
  }),
  record({
    name: "Phenylephrine", route: "IV", setId: "71b8fb8a-e13a-246f-f7b4-aa912b9ccd54", hint: "caution",
    section: "5.7 Renal Toxicity",
    note: "The label gives no renal dose adjustment.",
    rules: all("May increase the need for renal replacement therapy in septic shock", "monitor renal function"),
  }),
  record({
    name: "Triamterene and Hydrochlorothiazide", route: "ORAL", setId: "02752dae-30b7-4726-b22b-985b330a2060",
    section: "Contraindications: Impaired Renal Function; Warnings: Hyperkalemia",
    note: "Hyperkalemia risk is accentuated by renal impairment; monitor serum potassium frequently.",
    rules: [
      {
        type: "all", min: 0, max: Infinity,
        variants: [
          { condition: "Anuria, acute or chronic renal insufficiency, or significant renal impairment", dose: "Contraindicated", interval: "hyperkalemia may be fatal" },
          { condition: "Mild renal impairment", dose: "Only with frequent, continuing monitoring", interval: "serum potassium and renal function" },
        ],
      },
    ],
  }),
  record({
    name: "Lovastatin", route: "ORAL", setId: "027bd594-6a0a-4e6d-bd3c-4f33fdb4166a",
    section: "Dosage in Patients With Renal Insufficiency",
    note: "Renal insufficiency increases the risk of myopathy/rhabdomyolysis.",
    rules: [
      band("gte", 30, Infinity, "Usual dose", "no renal adjustment stated for CrCl ≥ 30 mL/min"),
      band("lt", 0, 30, "Consider doses above 20 mg/day carefully; increase cautiously", "CrCl < 30 mL/min", "Severe renal insufficiency", "caution"),
    ],
  }),
  // ---- Batch 3 ----
  record({
    name: "Acetazolamide", route: "ORAL", setId: "0700a910-79aa-4431-aecf-637fe14fcae8", hint: "caution",
    section: "Contraindications",
    note: "The label gives no CrCl threshold for 'marked' kidney disease.",
    rules: all("Marked kidney disease or dysfunction: contraindicated", "no renal dose table in the label"),
  }),
  record({
    name: "Acetazolamide", route: "IV", setId: "2b9fb0dd-e42e-4f9b-bf24-98b268d877e5", hint: "caution",
    section: "Contraindications",
    note: "The label gives no CrCl threshold for 'marked' kidney disease.",
    rules: all("Marked kidney disease or dysfunction: contraindicated", "no renal dose table in the label"),
  }),
  record({
    name: "Penicillin", route: "IV", setId: "1442486a-05d6-4dce-8b95-857a30f478c2",
    section: "Dosage and Administration: Renal Impairment",
    note: "Penicillin G potassium injection. Adjustments are generally needed only in severe renal impairment; further changes may be needed with hepatic disease.",
    rules: [
      {
        type: "gte", min: 10, max: Infinity,
        variants: [
          { condition: "Not uremic", dose: "Usual dose", interval: "adjust generally only in severe renal impairment" },
          { condition: "Uremic, CrCl > 10 mL/min/1.73 m²", dose: "Full loading dose, then half the loading dose", interval: "every 4–5 hours" },
        ],
      },
      band("lt", 0, 10, "Full loading dose, then half the loading dose", "every 8–10 hours", "CrCl < 10 mL/min/1.73 m²"),
    ],
  }),
  record({
    name: "Tobramycin", route: "IV", setId: "ed254eec-10f4-425a-895b-66e325b7bf69", hint: "caution",
    section: "Administration for Patients with Impaired Renal Function",
    note: "The label's dosing guides (by CrCl or serum creatinine) are for use when serum levels cannot be measured.",
    rules: all("Impaired renal function: 1 mg/kg loading dose, then reduced doses every 8 hours or normal doses at longer intervals", "monitor serum tobramycin concentrations"),
  }),
  record({
    name: "Colchicine", route: "ORAL", setId: "0f69b9c6-8c00-45e2-b950-34dc5ae62352",
    section: "2 Dosage and Administration: Dose Modification in Renal Impairment",
    note: "Do not combine with P-gp or strong CYP3A4 inhibitors in patients with renal or hepatic impairment. Label bands: mild CrCl 50–80, moderate 30–50, severe < 30.",
    rules: [
      {
        type: "gte", min: 30, max: Infinity,
        variants: [
          { condition: "Gout flare treatment", dose: "No dose adjustment", interval: "monitor closely for adverse effects" },
          { condition: "Gout flare prophylaxis", dose: "No dose adjustment", interval: "monitor closely for adverse effects" },
        ],
      },
      {
        type: "lt", min: 0, max: 30,
        variants: [
          { condition: "Gout flare treatment", dose: "Usual flare dose", interval: "repeat course no more than once every 2 weeks" },
          { condition: "Gout flare prophylaxis", dose: "Start 0.3 mg/day", interval: "increase only with close monitoring" },
          { condition: "Dialysis, flare treatment", dose: "Single 0.6 mg dose", interval: "not repeated more than once every 2 weeks" },
          { condition: "Dialysis, prophylaxis", dose: "Start 0.3 mg", interval: "twice a week, with close monitoring" },
        ],
      },
    ],
  }),
  record({
    name: "Midodrine", route: "ORAL", setId: "03b54024-2a26-4abe-bd8b-b66bb6781fa7", hint: "caution",
    section: "Dosage and Administration; Contraindications",
    note: "Desglymidodrine is renally excreted; not systematically studied in renal impairment.",
    rules: all("Abnormal renal function: start with 2.5 mg doses", "contraindicated in acute renal disease"),
  }),
  record({
    name: "Hyoscyamine", route: "ORAL", setId: "08ee0b24-a05b-451c-9d29-975570baed48", hint: "caution",
    section: "Precautions",
    note: "The label gives no specific dose change.",
    rules: all("Renal disease: use with caution", "label gives no specific dose change"),
  }),
  record({
    name: "Hyoscyamine", route: "SC", setId: "6c0a1fef-c634-4ecf-9850-d188e6496b90", hint: "caution",
    section: "Precautions",
    note: "The label gives no specific dose change.",
    rules: all("Renal disease: use with caution", "label gives no specific dose change"),
  }),
  record({
    name: "Lithium Carbonate", search: "lithium carbonate", aliases: ["lithium"], route: "ORAL", setId: "01c4facd-ed79-4078-ba33-2044de372d0f",
    section: "2.5 Dosage Recommendations in Patients with Renal Impairment",
    note: "Monitor kidney function during treatment (lithium-induced chronic kidney disease).",
    rules: [
      band("gte", 90, Infinity, "Usual dose", "titrate to serum lithium concentrations"),
      band("range", 30, 89, "Start below the usual dosage; titrate slowly", "with frequent monitoring", "Mild to moderate renal impairment (CrCl 30–89)", "caution"),
      band("lt", 0, 30, "Avoid use", "CrCl < 30 mL/min", "Severe renal impairment"),
    ],
  }),
  record({
    name: "Nabumetone", route: "ORAL", setId: "0186328f-3eb7-4407-bf9e-8007d08ebe7b",
    section: "Warnings: Renal Effects; Advanced Renal Disease",
    note: "Moderate impairment raises unbound 6MNA by 50%. The label gives no CrCl threshold for 'advanced' renal disease.",
    rules: [
      band("gte", 50, Infinity, "Usual dose", "monitor renal function"),
      band("range", 30, 49, "Dose adjustment may be warranted", "label gives no specific amount", "Moderate renal impairment (CrCl 30–49)", "caution"),
      band("lt", 0, 30, "Advanced renal disease: not recommended", "if it must be used, closely monitor renal function", "Severe renal impairment", "caution"),
    ],
  }),
  record({
    name: "Hydroxychloroquine", route: "ORAL", setId: "04139607-f7c0-4fe1-a210-ffa5af347d56", hint: "caution",
    section: "8.6 Patients with Renal or Hepatic Disease; 5.6 Renal Toxicity",
    note: "Discontinue if renal toxicity is suspected or shown.",
    rules: all("Renal disease: a dose reduction may be necessary", "label gives no specific amount"),
  }),
  record({
    name: "Mycophenolate Mofetil", route: "IV", setId: "37241e87-4af4-4dc3-a1aa-ea6f20d8dc40", metric: "egfr",
    section: "Dosage and Administration: Patients with Renal Impairment",
    note: "Applies to kidney transplant patients with severe chronic graft impairment; monitor carefully.",
    rules: [
      band("gte", 25, Infinity, "Usual dose", "no renal adjustment stated"),
      band("lt", 0, 25, "Do not exceed 1 g twice a day", "monitor carefully", "Severe chronic graft impairment (GFR < 25 mL/min/1.73 m²)"),
    ],
  }),
  record({
    name: "Tranexamic Acid", route: "IV", setId: "00630e54-0e84-465d-96a5-63486c87dcd9",
    section: "Table 1: Recommended Dosage in Patients With Varying Degrees of Renal Impairment",
    note: "This label doses by serum creatinine, not CrCl: pick the row for the patient's creatinine. Applies to all doses before and after tooth extraction.",
    rules: [
      {
        type: "all", min: 0, max: Infinity,
        variants: [
          { condition: "SCr 1.36–2.83 mg/dL (120–250 µmol/L)", dose: "10 mg/kg", interval: "twice daily" },
          { condition: "SCr 2.83–5.66 mg/dL (250–500 µmol/L)", dose: "10 mg/kg", interval: "daily" },
          { condition: "SCr > 5.66 mg/dL (> 500 µmol/L)", dose: "10 mg/kg every 48 hours or 5 mg/kg", interval: "every 24 hours" },
        ],
      },
    ],
  }),
  record({
    name: "Irbesartan", route: "ORAL", setId: "029a90b6-0722-49be-8400-3ec29526aafd", hint: "caution",
    section: "2.4 Dose Adjustment in Volume and Salt-Depleted Patients",
    note: "Includes patients on hemodialysis. Monitor renal function periodically.",
    rules: all("Volume or salt depletion (e.g. hemodialysis): initial dose 75 mg once daily", "monitor renal function periodically"),
  }),
  record({
    name: "Tacrolimus", route: "ORAL", setId: "0a557ca9-b1a1-cf8f-a317-e4d8d4d6e60f", hint: "caution",
    section: "2.4 Dosage Modification for Patients with Renal Impairment",
    note: "In kidney transplant with post-operative oliguria, the first dose may be delayed until renal function recovers.",
    rules: all("Pre-existing renal impairment (liver or heart transplant): dose at the lower end of the therapeutic range", "further reductions may be needed; guide by trough levels"),
  }),
  record({
    name: "Tacrolimus", route: "IV", setId: "9d502961-e9c0-4611-92bf-ce742a7b962c", hint: "caution",
    section: "2.4 Dosage Modification for Patients with Renal Impairment",
    note: "Continuous infusion only; switch to oral as soon as tolerated.",
    rules: all("Pre-existing renal impairment (liver or heart transplant): dose at the lower end of the therapeutic range", "further reductions may be needed; guide by trough levels"),
  }),
  record({
    name: "Telmisartan", route: "ORAL", setId: "09d31eee-cd22-4918-a889-3eb4d2969525",
    section: "Dosage and Administration",
    note: "Patients on dialysis may develop orthostatic hypotension; monitor blood pressure closely.",
    rules: all("No initial dosage adjustment (including hemodialysis)", "monitor blood pressure on dialysis"),
  }),
  record({
    name: "Clarithromycin", route: "ORAL", setId: "0be243c6-de02-45dd-8210-cab1bbc8dfa7",
    section: "2.6 Dosage Adjustment in Patients with Renal Impairment (Table 2)",
    note: "Reductions apply to the usual dose for the infection.",
    rules: [
      band("gt", 60, Infinity, "Usual dose", "no renal adjustment"),
      {
        type: "range", min: 30, max: 60,
        variants: [
          { condition: "With atazanavir or ritonavir-containing regimen", dose: "Reduce the dosage by 50%", interval: "usual interval" },
          { condition: "Without those drugs", dose: "No dosage adjustment", interval: "usual interval" },
        ],
      },
      {
        type: "lt", min: 0, max: 30,
        variants: [
          { condition: "Without atazanavir or ritonavir", dose: "Reduce the dosage by 50%", interval: "usual interval" },
          { condition: "With atazanavir or ritonavir-containing regimen", dose: "Reduce the dosage by 75%", interval: "usual interval" },
        ],
      },
    ],
  }),
  record({
    name: "Ezetimibe", route: "ORAL", setId: "02b00cb2-7253-4fb4-a216-53691a929a28",
    section: "8.6 Renal Impairment",
    note: "Ezetimibe alone; combination products have their own labels.",
    rules: all("No dosage adjustment necessary", "usual dose"),
  }),
  record({
    name: "Voriconazole", route: "IV", setId: "171272c7-d76e-4352-81bc-fcb40386d7d0",
    section: "2.6 Dosage Adjustment in Adult Patients with Renal Impairment",
    note: "The IV vehicle accumulates in moderate to severe renal impairment; oral voriconazole needs no renal adjustment.",
    rules: [
      band("gte", 50, Infinity, "Usual IV dose", "no renal adjustment"),
      band("lt", 0, 50, "Avoid intravenous administration", "CrCl < 50 mL/min; consider oral voriconazole", "Moderate to severe renal impairment"),
    ],
  }),
  record({
    name: "Phenazopyridine", route: "ORAL", setId: "132cc592-6b03-4b75-bf39-df476fb9dc81", hint: "caution",
    section: "Contraindications; Precautions",
    note: "Yellowish skin or sclera may indicate accumulation from impaired renal excretion; stop therapy.",
    rules: all("Renal insufficiency: contraindicated", "no CrCl threshold given"),
  }),
  record({
    name: "Desmopressin", route: "ORAL", setId: "0d447b48-3f4b-430e-9e68-d8b9401c002e",
    section: "Contraindications; Precautions",
    note: "Patients with renal disorders are prone to hyponatremia.",
    rules: [
      band("gte", 50, Infinity, "Usual dose; use with caution in renal disorders", "hyponatremia risk", "CrCl ≥ 50 mL/min"),
      band("lt", 0, 50, "Contraindicated", "CrCl below 50 mL/min", "Moderate to severe renal impairment"),
    ],
  }),
  record({
    name: "Desmopressin", route: "IV", setId: "0d96944d-736d-4b56-b726-d21eacd8bc85",
    section: "Contraindications; 8.6 Renal Impairment",
    note: "Patients with renal disorders are prone to hyponatremia.",
    rules: [
      band("gte", 50, Infinity, "Usual dose; use with caution in renal disorders", "hyponatremia risk", "CrCl ≥ 50 mL/min"),
      band("lt", 0, 50, "Contraindicated", "CrCl below 50 mL/min", "Moderate to severe renal impairment"),
    ],
  }),
  record({
    name: "Desmopressin", route: "SC", setId: "0d96944d-736d-4b56-b726-d21eacd8bc85",
    section: "Contraindications; 8.6 Renal Impairment",
    note: "Patients with renal disorders are prone to hyponatremia.",
    rules: [
      band("gte", 50, Infinity, "Usual dose; use with caution in renal disorders", "hyponatremia risk", "CrCl ≥ 50 mL/min"),
      band("lt", 0, 50, "Contraindicated", "CrCl below 50 mL/min", "Moderate to severe renal impairment"),
    ],
  }),
  record({
    name: "Methotrexate", route: "ORAL", setId: "2a6afc4c-819d-4ba9-8040-4504519c116a",
    section: "8.6 Renal Impairment",
    note: "Methotrexate elimination is reduced in renal impairment (CrCl < 90 mL/min, Cockcroft-Gault).",
    rules: [
      band("gte", 90, Infinity, "Usual dose", "no renal adjustment stated"),
      band("lt", 0, 90, "Increased risk of adverse reactions: monitor closely", "label gives no specific dose reduction", "CrCl < 90 mL/min", "caution"),
    ],
  }),
  record({
    name: "Methotrexate", route: "IV", setId: "3989d30d-56e5-4e8d-9379-c30fecc894f2",
    section: "8.6 Renal Impairment; Dosage and Administration",
    note: "Monitor serum creatinine at least daily with high-dose therapy; hydrate and alkalinize urine; adjust leucovorin to methotrexate levels.",
    rules: [
      band("gte", 90, Infinity, "Usual dose", "follow elimination-promoting measures"),
      band("lt", 0, 90, "Increased risk of adverse reactions: follow elimination-promoting measures", "monitor methotrexate levels and renal function", "CrCl < 90 mL/min", "caution"),
    ],
  }),
  // ---- Batch 4 ----
  record({
    name: "Methotrexate", route: "SC", setId: "0d63ba29-b692-41b4-87e8-351265c8273f", hint: "caution",
    section: "Dosage and Administration; 8.6 Renal Impairment",
    note: "Monitor serum creatinine; hydrate and alkalinize urine with intermediate or high doses.",
    rules: all("Renal impairment: increased risk of adverse reactions", "monitor renal function; label gives no specific dose reduction"),
  }),
  record({
    name: "Glyburide", route: "ORAL", setId: "05341afe-5b7a-462a-a196-689cb09f83fc", hint: "caution",
    section: "Dosage and Administration",
    note: "To avoid hypoglycemia; the label gives no specific dose.",
    rules: all("Impaired renal function: conservative initial and maintenance dosing", "titrate carefully to avoid hypoglycemia"),
  }),
  record({
    name: "Methylprednisolone", route: "IV", setId: "77a8d96c-37df-4f3a-9757-b2d4131ff82b", hint: "caution",
    section: "Precautions: Cardio-renal",
    note: "Sodium retention, edema and potassium loss may occur.",
    rules: all("Renal insufficiency: use with caution", "no dose adjustment in the label"),
  }),
  record({
    name: "Cefadroxil", route: "ORAL", setId: "02566385-46f3-255a-e063-6294a90a1d1c",
    section: "Dosage and Administration: Renal Impairment",
    note: "Adults: initial dose 1000 mg, then 500 mg maintenance at the interval for CrCl (mL/min/1.73 m²).",
    rules: [
      band("gt", 50, Infinity, "Usual dose", "no renal adjustment"),
      band("range", 25, 50, "1000 mg first dose, then 500 mg", "every 12 hours", "CrCl 25–50"),
      band("range", 10, 24.99, "1000 mg first dose, then 500 mg", "every 24 hours", "CrCl 10–25"),
      band("lt", 0, 10, "1000 mg first dose, then 500 mg", "every 36 hours", "CrCl 0–10"),
    ],
  }),
  record({
    name: "Pirfenidone", route: "ORAL", setId: "07ff87b3-0a88-15b4-e063-6294a90a72ab", hint: "caution",
    section: "8.7 Renal Impairment",
    note: "Label bands: mild CrCl 50–80, moderate 30–50, severe < 30.",
    rules: [
      {
        type: "all", min: 0, max: Infinity,
        variants: [
          { condition: "Mild, moderate or severe renal impairment", dose: "Use with caution", interval: "monitor for adverse reactions; consider dose modification or discontinuation" },
          { condition: "End-stage renal disease on dialysis", dose: "Not recommended", interval: "not studied" },
        ],
      },
    ],
  }),
  record({
    name: "Butalbital Acetaminophen and Caffeine", route: "ORAL", setId: "03475828-eae2-49ed-a1c0-8074f35c712d", hint: "caution",
    section: "Precautions",
    note: "Monitor renal function with serial tests in severe renal disease.",
    rules: all("Severe renal impairment: prescribe with caution", "monitor effects with serial renal function tests"),
  }),
  record({
    name: "Emtricitabine and Tenofovir Disoproxil", route: "ORAL", setId: "1289b02c-50f7-4adc-80d1-24afc1bad01b",
    section: "2.6 Dosage in Patients with Renal Impairment",
    note: "Treatment of HIV-1 and HIV-1 PrEP have different renal limits.",
    rules: [
      band("gte", 60, Infinity, "Usual dose: 1 tablet once daily", "treatment and PrEP"),
      {
        type: "range", min: 50, max: 59.99,
        variants: [
          { condition: "HIV-1 treatment", dose: "1 tablet", interval: "once daily" },
          { condition: "HIV-1 PrEP", dose: "Not recommended", interval: "CrCl below 60 mL/min" },
        ],
      },
      {
        type: "range", min: 30, max: 49.99,
        variants: [
          { condition: "HIV-1 treatment", dose: "1 tablet", interval: "every 48 hours" },
          { condition: "HIV-1 PrEP", dose: "Not recommended", interval: "CrCl below 60 mL/min" },
        ],
      },
      band("lt", 0, 30, "Not recommended", "CrCl below 30 mL/min or hemodialysis", "Treatment and PrEP"),
    ],
  }),
  record({
    name: "Posaconazole", route: "IV", setId: "1ebbd88b-547b-4b49-ab73-98094a2d5a79", metric: "egfr",
    section: "2.11 Dosage Modifications in Patients with Renal Impairment",
    note: "The IV vehicle accumulates with reduced eGFR.",
    rules: [
      band("gte", 50, Infinity, "Usual IV dose", "no renal adjustment"),
      band("lt", 0, 50, "Avoid IV posaconazole unless benefit justifies the risk", "if used, closely monitor serum creatinine", "eGFR < 50 mL/min/1.73 m²"),
    ],
  }),
  record({
    name: "Ephedrine", route: "IV", setId: "08f5ec19-7b53-681b-e063-6294a90acc86", hint: "caution",
    section: "Use in Specific Populations: Renal Impairment",
    note: "Slower elimination may prolong the effect and adverse reactions.",
    rules: all("Renal impairment: monitor carefully after the initial bolus", "label gives no specific dose change"),
  }),
  record({
    name: "Perphenazine", route: "ORAL", setId: "003fe32c-a55d-4191-99fa-1013522b1b2e", hint: "caution",
    section: "Precautions",
    note: "Monitor renal function on long-term therapy.",
    rules: all("Diminished renal function: use with caution", "stop if BUN becomes abnormal"),
  }),
  record({
    name: "Zonisamide", route: "ORAL", setId: "061fdccc-d08e-4e42-8a32-54afb6c89701", hint: "caution",
    section: "Dosage and Administration: Patients with Renal or Hepatic Disease",
    note: "Renal disease predisposes to metabolic acidosis with zonisamide.",
    rules: all("Renal disease: treat with caution; may need slower titration", "monitor more frequently"),
  }),
  record({
    name: "Gentamicin", route: "IV", setId: "09cf88af-59da-f147-e063-6294a90aac99", hint: "caution",
    section: "Dosage and Administration: Patients with Impaired Renal Function",
    note: "Dose must be adjusted to avoid excessive blood levels.",
    rules: all("Impaired renal function: adjust dose (e.g. usual doses at longer intervals)", "monitor serum gentamicin concentrations"),
  }),
  record({
    name: "Olmesartan Medoxomil and Hydrochlorothiazide", route: "ORAL", setId: "0360db3a-17cf-4d24-97ba-e0a6fcc94351",
    section: "8.6 Renal Impairment",
    note: "Monitor renal function and potassium in susceptible patients.",
    rules: [
      band("gt", 30, Infinity, "No dose adjustment", "mild (CrCl 60–90) or moderate (CrCl 30–60) impairment"),
      band("range", 0, 30, "Safety and effectiveness not established", "CrCl ≤ 30 mL/min", "Severe renal impairment", "not-studied"),
    ],
  }),
  record({
    name: "Ranolazine", route: "ORAL", setId: "00979fb3-d70f-493d-94ca-2914cbadaa9d",
    section: "8.7 Use in Patients with Renal Impairment; 5.2",
    note: "In a study with CrCl < 30, 2 of 4 subjects developed acute renal failure.",
    rules: [
      band("gte", 60, Infinity, "Usual dose", "no renal adjustment stated"),
      band("range", 30, 59.99, "Monitor renal function periodically", "discontinue if acute renal failure develops", "Moderate renal impairment", "caution"),
      band("lt", 0, 30, "Acute renal failure reported: monitor renal function closely", "discontinue if acute renal failure develops", "Severe renal impairment", "caution"),
    ],
  }),
  record({
    name: "Deferasirox", route: "ORAL", setId: "0354cbc7-9b32-4513-976a-2ef2da39b6b3", metric: "egfr",
    section: "2.5 Patients with Baseline Renal Impairment",
    note: "Usual initial dose: 14 mg/kg/day (transfusional iron overload) or 7 mg/kg/day (NTDT).",
    rules: [
      band("gt", 60, Infinity, "Usual initial dose", "once daily"),
      band("range", 40, 60, "Reduce the starting dose by 50%", "monitor renal function", "eGFR 40–60 mL/min/1.73 m²"),
      band("lt", 0, 40, "Do not use", "eGFR < 40 mL/min/1.73 m²", "Renal impairment"),
    ],
  }),
  record({
    name: "Timolol", route: "ORAL", setId: "0bc40b2c-65eb-4095-87e6-4752d5b19a3a", hint: "caution",
    section: "Precautions: Impaired Hepatic or Renal Function",
    note: "Excreted mainly by the kidneys.",
    rules: all("Renal insufficiency: dosage reductions may be necessary", "label gives no specific amount"),
  }),
  record({
    name: "Midazolam", route: "IV", setId: "3c2fd6ee-4ede-4ee4-8c05-34c93598f381", hint: "caution",
    section: "Warnings",
    note: "Patients with chronic renal failure eliminate midazolam more slowly.",
    rules: all("Chronic renal failure: slower elimination", "titrate carefully; label gives no specific dose"),
  }),
  record({
    name: "Amlodipine and Benazepril", route: "ORAL", setId: "02e233c4-48d1-456d-8fc8-f99a06ef854a",
    section: "2.2; 5.5 Impaired Renal Function; 8.6",
    note: "Monitor renal function periodically.",
    rules: [
      band("gte", 30, Infinity, "No dose adjustment", "mild or moderate renal impairment"),
      band("lt", 0, 30, "Not recommended", "severe renal impairment", "Severe renal impairment"),
    ],
  }),
  record({
    name: "Enoxaparin", route: "IV", setId: "066f27ec-352c-4051-ba29-248e292690db",
    section: "2.3 Dose Reduction for Patients with Severe Renal Impairment (Table 1)",
    note: "IV use is limited to the STEMI bolus; maintenance and prophylaxis doses are subcutaneous.",
    rules: [
      band("gte", 30, Infinity, "Usual dose", "no renal adjustment for CrCl ≥ 30 mL/min"),
      {
        type: "lt", min: 0, max: 30,
        variants: [
          { condition: "Prophylaxis (surgery or acute medical illness)", dose: "30 mg SC", interval: "once daily" },
          { condition: "DVT treatment, UA/NSTEMI", dose: "1 mg/kg SC", interval: "once daily" },
          { condition: "STEMI, age < 75", dose: "30 mg IV bolus plus 1 mg/kg SC, then 1 mg/kg SC", interval: "once daily" },
          { condition: "STEMI, age ≥ 75", dose: "1 mg/kg SC (no bolus)", interval: "once daily" },
        ],
      },
    ],
  }),
  record({
    name: "Norepinephrine", route: "IV", setId: "759807dd-61a8-4f6f-8bf5-f6ee773c81bc", hint: "caution",
    section: "5.1 Tissue Ischemia",
    note: "The label gives no renal dose adjustment.",
    rules: all("Hypovolemia: correct first (renal perfusion and urine output can fall)", "no renal dose adjustment in the label"),
  }),
  record({
    name: "Hydromorphone", route: "IV", setId: "31d5a37a-0e90-4e88-be14-75c877be9de2",
    section: "2.4 Dosage Modifications in Patients with Renal Impairment",
    note: "Titrate to effect from the reduced starting dose.",
    rules: all("Renal impairment: start at one-quarter to one-half the usual starting dose", "depending on the degree of impairment"),
  }),
  record({
    name: "Hydromorphone", route: "SC", setId: "31d5a37a-0e90-4e88-be14-75c877be9de2",
    section: "2.4 Dosage Modifications in Patients with Renal Impairment",
    note: "Titrate to effect from the reduced starting dose.",
    rules: all("Renal impairment: start at one-quarter to one-half the usual starting dose", "depending on the degree of impairment"),
  }),
  record({
    name: "Buprenorphine", route: "IV", setId: "23aa1bb3-cecf-4e62-29bb-48488bb66fc3", hint: "caution",
    section: "Precautions",
    note: "The label gives no specific dose change.",
    rules: all("Severe renal impairment: administer with caution", "label gives no specific dose change"),
  }),
  record({
    name: "Nitrofurantoin Macrocrystals", route: "ORAL", setId: "075fe819-fc4f-2dce-e063-6294a90ad823",
    section: "Contraindications",
    note: "Monitor renal function periodically on long-term therapy.",
    rules: [
      band("gte", 60, Infinity, "Usual dose", "no renal adjustment"),
      band("lt", 0, 60, "Contraindicated", "CrCl under 60 mL/min, anuria or oliguria", "Significant renal impairment"),
    ],
  }),
  // ---- Batch 5 ----
  record({
    name: "Azacitidine", route: "IV", setId: "060d56e7-1a24-87c1-7f40-149ecf424f7c", hint: "caution",
    section: "2.6 Dosage Adjustment Based on Serum Electrolytes and Renal Toxicity",
    note: "Also reduce by 50% if serum bicarbonate falls below 20 mEq/L without explanation.",
    rules: all("Unexplained rise in BUN or creatinine: delay the next cycle until normal or baseline, then reduce the dose by 50%", "monitor renal function each cycle"),
  }),
  record({
    name: "Azacitidine", route: "SC", setId: "060d56e7-1a24-87c1-7f40-149ecf424f7c", hint: "caution",
    section: "2.6 Dosage Adjustment Based on Serum Electrolytes and Renal Toxicity",
    note: "Also reduce by 50% if serum bicarbonate falls below 20 mEq/L without explanation.",
    rules: all("Unexplained rise in BUN or creatinine: delay the next cycle until normal or baseline, then reduce the dose by 50%", "monitor renal function each cycle"),
  }),
  record({
    name: "Calcitriol", route: "ORAL", setId: "1bd717a4-5fdf-4697-a6b2-9df55c6517bb", hint: "caution",
    section: "Precautions",
    note: "Risk of ectopic calcification in renal failure.",
    rules: all("Renal failure: use with caution", "on chronic dialysis, avoid magnesium-containing antacids (hypermagnesemia)"),
  }),
  record({
    name: "Cyclosporine", route: "ORAL", setId: "1952d4c7-a40e-4924-b669-c41400774cb9", hint: "caution",
    section: "Dosage and Administration; Contraindications",
    note: "Nephrotoxic; monitor renal function and blood concentrations.",
    rules: [
      {
        type: "all", min: 0, max: Infinity,
        variants: [
          { condition: "Rheumatoid arthritis or psoriasis", dose: "Impaired renal function: must not receive cyclosporine", interval: "contraindicated" },
          { condition: "Transplant", dose: "Monitor renal function; reduce dose if indicated", interval: "guide by blood concentrations" },
        ],
      },
    ],
  }),
  record({
    name: "Leflunomide", route: "ORAL", setId: "006b5bf4-97c0-48dc-8e5e-3c6f64d7bdc1", hint: "caution",
    section: "Use in Specific Populations: Renal Insufficiency",
    note: "The label gives no specific dose change.",
    rules: all("Renal insufficiency: use with caution", "label gives no specific dose change"),
  }),
  record({
    name: "Pyridostigmine", route: "IV", setId: "208af931-a44e-43bf-a265-8e08534dc55f", hint: "caution",
    section: "Precautions",
    note: "Titrate to effect.",
    rules: all("Renal disease: lower doses may be required", "titrate dosage to effect"),
  }),
  record({
    name: "Drospirenone and Ethinyl Estradiol", route: "ORAL", setId: "0f8f8a21-cee8-462f-98b3-6c06f2f33e0d", hint: "caution",
    section: "8.6 Patients with Renal Impairment; Contraindications",
    note: "Drospirenone raises potassium; exposure increases with CrCl 30–49 mL/min.",
    rules: all("Renal impairment: contraindicated", "hyperkalemia risk"),
  }),
  record({
    name: "Pemetrexed Disodium", search: "pemetrexed disodium", route: "IV", setId: "1d8bcf03-e055-a274-7844-ae9a523e3c4c",
    section: "2 Dosage and Administration: Renal Impairment",
    note: "CrCl by Cockcroft-Gault.",
    rules: [
      band("gte", 45, Infinity, "500 mg/m² IV", "day 1 of each 21-day cycle"),
      band("lt", 0, 45, "Not recommended: no recommended dose", "CrCl < 45 mL/min", "Renal impairment"),
    ],
  }),
  record({
    name: "Acetaminophen", route: "IV", setId: "0f67c1bd-915b-4681-88dd-22f5154a80b3",
    section: "8.7 Patients with Renal Impairment",
    note: "The label gives no specific interval or maximum.",
    rules: [
      band("gt", 30, Infinity, "Usual dose", "no renal adjustment"),
      band("range", 0, 30, "Longer dosing intervals and a reduced total daily dose may be warranted", "CrCl ≤ 30 mL/min", "Severe renal impairment", "caution"),
    ],
  }),
  record({
    name: "Calcium Gluconate", route: "IV", setId: "13d7cfc9-ff7a-437e-8c21-d9709ac07d48",
    section: "2.4 Dosage in Renal Impairment",
    note: "Applies to all age groups.",
    rules: all("Renal impairment: start at the lowest dose of the recommended range", "monitor serum calcium every 4 hours"),
  }),
  record({
    name: "Liraglutide", route: "SC", setId: "0450d8a2-a88e-4849-9788-ed4f5246f223",
    section: "8.6 Renal Impairment",
    note: "Studied in moderate renal impairment (eGFR 30–60); watch for dehydration from GI adverse reactions.",
    rules: all("No dose adjustment", "usual dose"),
  }),
  record({
    name: "Magnesium Sulfate", route: "IV", setId: "5176ed24-015e-43fe-9eb4-85098debf5f1", hint: "caution",
    section: "Dosage and Administration; Precautions",
    note: "Magnesium is removed from the body solely by the kidneys.",
    rules: all("Severe renal insufficiency: maximum 20 g per 48 hours", "check serum magnesium frequently"),
  }),
  record({
    name: "Magnesium Sulfate Heptahydrate", route: "IV", setId: "27a581a3-2342-4cc3-b90f-6c739bdf7120", hint: "caution",
    section: "Dosage and Administration; Precautions",
    note: "Magnesium is removed from the body solely by the kidneys.",
    rules: all("Severe renal insufficiency: maximum 20 g per 48 hours", "check serum magnesium frequently"),
  }),
  record({
    name: "Irbesartan and Hydrochlorothiazide", route: "ORAL", setId: "17561aae-f0bc-4ffc-a007-985b17e9baf0",
    section: "2.1 Dosage: Renal Impairment",
    note: "Loop diuretics are preferred to thiazides in severe renal impairment.",
    rules: [
      band("gte", 30, Infinity, "Usual regimen", "CrCl > 30 mL/min"),
      band("lt", 0, 30, "Not recommended", "CrCl < 30 mL/min", "Severe renal impairment"),
    ],
  }),
  record({
    name: "Irinotecan", route: "IV", setId: "4f98e9ed-f7b1-5346-af72-fccb0abf3f4b", hint: "caution",
    section: "8.5 Patients with Renal Impairment; 5.4",
    note: "Rare renal impairment and acute renal failure have been reported.",
    rules: [
      {
        type: "all", min: 0, max: Infinity,
        variants: [
          { condition: "Impaired renal function", dose: "Use with caution", interval: "label gives no specific dose" },
          { condition: "On dialysis", dose: "Not recommended", interval: "per label" },
        ],
      },
    ],
  }),
  record({
    name: "Captopril", route: "ORAL", setId: "1395ba5b-2fc9-41ff-9c43-e0740d781dee", hint: "caution",
    section: "Dosage Adjustment in Renal Impairment",
    note: "Captopril is excreted mainly by the kidneys.",
    rules: all("Significant renal impairment: reduce the initial daily dose", "titrate slowly in small steps (1–2 week intervals)"),
  }),
  record({
    name: "Ibuprofen and Famotidine", route: "ORAL", setId: "03733e49-7db4-4d98-b363-d0d23686ec72",
    section: "8.6 Renal Insufficiency; 5.3 Renal Toxicity",
    note: "The famotidine dose in the combination is fixed.",
    rules: [
      band("gte", 50, Infinity, "Use with caution; avoid in advanced renal disease", "monitor renal function", "CrCl ≥ 50 mL/min", "caution"),
      band("lt", 0, 50, "Not recommended", "CrCl < 50 mL/min (fixed famotidine dose)", "Renal insufficiency"),
    ],
  }),
  record({
    name: "Clozapine", route: "ORAL", setId: "09231d80-6343-4a34-bd5b-100c547fd3c9", hint: "caution",
    section: "2.8 Dosage Recommendations in Patients with Renal or Hepatic Impairment",
    note: "The label gives no specific amount.",
    rules: all("Significant renal impairment: dose reduction may be necessary", "label gives no specific amount"),
  }),
  record({
    name: "Eribulin", route: "IV", setId: "1038e984-3bf7-5bbf-f1ec-ce15ae330efc",
    section: "2.1 Recommended Dose; 8.7 Renal Impairment",
    note: "Usual dose 1.4 mg/m² on days 1 and 8 of a 21-day cycle.",
    rules: [
      band("gte", 50, Infinity, "1.4 mg/m² IV", "days 1 and 8 of a 21-day cycle"),
      band("range", 15, 49, "1.1 mg/m² IV", "days 1 and 8 of a 21-day cycle", "Moderate or severe renal impairment (CrCl 15–49)"),
      band("lt", 0, 15, "Not studied", "CrCl < 15 mL/min", "End-stage renal disease", "not-studied"),
    ],
  }),
  record({
    name: "Piroxicam", route: "ORAL", setId: "0373da3a-7779-4e26-87f1-cd346018282c", hint: "caution",
    section: "Warnings and Precautions: Renal Toxicity",
    note: "The label gives no CrCl threshold for advanced renal disease.",
    rules: all("Advanced renal disease: avoid unless benefits outweigh the risk of worsening renal function", "monitor renal function"),
  }),
  record({
    name: "Prucalopride", route: "ORAL", setId: "70fced73-c25b-46cb-ad30-19328e6130c3",
    section: "Table 1: Recommended Dosage Regimen and Dosage Adjustments",
    note: "Adults with chronic idiopathic constipation.",
    rules: [
      band("gte", 30, Infinity, "2 mg", "once daily"),
      {
        type: "lt", min: 0, max: 30,
        variants: [
          { condition: "Severe renal impairment (CrCl < 30)", dose: "1 mg", interval: "once daily" },
          { condition: "End-stage renal disease on dialysis", dose: "Avoid", interval: "per label" },
        ],
      },
    ],
  }),
  record({
    name: "Rufinamide", route: "ORAL", setId: "12fc41f9-b6a9-4bbd-afbe-5d269f5a42f6",
    section: "2.3 Dosing in Patients Undergoing Hemodialysis; 8.6 Renal Impairment",
    note: "Pharmacokinetics with CrCl < 30 were similar to healthy subjects.",
    rules: [
      {
        type: "all", min: 0, max: Infinity,
        variants: [
          { condition: "Renal impairment", dose: "No dose adjustment", interval: "usual dose" },
          { condition: "Hemodialysis", dose: "Consider adjusting the dose during dialysis", interval: "dialysis lowers exposure by about 30%" },
        ],
      },
    ],
  }),
  record({
    name: "Tenofovir Disoproxil", route: "ORAL", setId: "08a30772-02fc-4f63-e063-6394a90afd43",
    section: "2.3 Dose Adjustment for Renal Impairment in Adults",
    note: "Tenofovir disoproxil fumarate 300 mg tablets.",
    rules: [
      band("gte", 50, Infinity, "300 mg", "once daily"),
      band("range", 30, 49, "300 mg", "every 48 hours", "CrCl 30–49 mL/min"),
      band("range", 10, 29, "300 mg", "every 72–96 hours", "CrCl 10–29 mL/min"),
      {
        type: "lt", min: 0, max: 10,
        variants: [
          { condition: "Hemodialysis", dose: "300 mg", interval: "every 7 days or after about 12 hours of dialysis" },
          { condition: "CrCl < 10, not on dialysis", dose: "No dosing recommendation", interval: "label gives none" },
        ],
      },
    ],
  }),
  record({
    name: "Tramadol and Acetaminophen", route: "ORAL", setId: "12f113b3-d6b1-a7b0-e063-6294a90a999d",
    section: "2.4 Dosage Modification in Patients with Renal Impairment",
    note: "Tramadol 37.5 mg / acetaminophen 325 mg tablets.",
    rules: [
      band("gte", 30, Infinity, "Usual dose", "no renal adjustment"),
      band("lt", 0, 30, "Do not exceed 2 tablets", "every 12 hours", "CrCl < 30 mL/min"),
    ],
  }),
  record({
    name: "Brivaracetam", route: "ORAL", setId: "11ca0e1d-1c0d-4357-9ebd-ee1e87185dde",
    section: "8.6 Renal Impairment",
    note: "No data in end-stage renal disease on dialysis.",
    rules: [
      band("gte", 15, Infinity, "No dose adjustment", "usual dose"),
      {
        type: "lt", min: 0, max: 15,
        variants: [
          { condition: "End-stage renal disease on dialysis", dose: "Not recommended", interval: "no data" },
          { condition: "Not on dialysis", dose: "No dose adjustment", interval: "usual dose" },
        ],
      },
    ],
  }),
  record({
    name: "Brivaracetam", route: "IV", setId: "2c6af271-3222-4602-98a6-14754f0a29ba",
    section: "8.6 Renal Impairment",
    note: "No data in end-stage renal disease on dialysis.",
    rules: [
      band("gte", 15, Infinity, "No dose adjustment", "usual dose"),
      {
        type: "lt", min: 0, max: 15,
        variants: [
          { condition: "End-stage renal disease on dialysis", dose: "Not recommended", interval: "no data" },
          { condition: "Not on dialysis", dose: "No dose adjustment", interval: "usual dose" },
        ],
      },
    ],
  }),
  // ---- Batch 6 ----
  record({
    name: "Darunavir", route: "ORAL", setId: "04a542b3-15ad-4a8a-aab4-ace8e08732f3",
    section: "8.7 Renal Impairment",
    note: "Pharmacokinetics were not significantly affected with CrCl 30–60 mL/min. Do not give colchicine with darunavir in renal or hepatic impairment.",
    rules: [
      band("gte", 30, Infinity, "No dose adjustment", "usual dose"),
      band("lt", 0, 30, "Not studied", "CrCl < 30 mL/min", "Severe renal impairment", "not-studied"),
    ],
  }),
  record({
    name: "Droxidopa", route: "ORAL", setId: "049f997b-1649-467e-bbb9-bdb991b0bc6e", metric: "egfr",
    section: "Use in Specific Populations: Renal Impairment",
    note: "Mild or moderate impairment (GFR > 30) did not increase adverse reactions in trials.",
    rules: [
      band("gt", 30, Infinity, "Usual dose", "no renal adjustment"),
      band("range", 0, 30, "Limited clinical experience", "GFR < 30 mL/min", "Severe renal impairment", "not-studied"),
    ],
  }),
  record({
    name: "Alfuzosin", route: "ORAL", setId: "26fcc267-c8d7-e059-1bcf-830dded43690",
    section: "8.6 Renal Impairment; 5.2",
    note: "Safety data are available for only 6 patients with CrCl below 30 mL/min.",
    rules: [
      band("gte", 30, Infinity, "Usual dose", "no renal adjustment"),
      band("lt", 0, 30, "Use with caution", "limited safety data", "Severe renal impairment", "caution"),
    ],
  }),
  record({
    name: "Carmustine", route: "IV", setId: "11c3fad8-65ef-39a7-e063-6294a90a73e1",
    section: "Dosage and Administration: Renal Impairment",
    note: "Monitor for toxicity more often with compromised renal function.",
    rules: [
      band("gte", 10, Infinity, "Usual dose; monitor for toxicity more frequently if renal function is reduced", "per regimen"),
      band("lt", 0, 10, "Discontinue", "CrCl < 10 mL/min", "Severe renal impairment"),
    ],
  }),
  record({
    name: "Cytarabine", route: "IV", setId: "1be2668b-d76f-4c65-aea9-86c5c40889a2", hint: "caution",
    section: "Precautions",
    note: "The label gives no specific reduced dose.",
    rules: all("Poor kidney function: use with caution, possibly at a reduced dose", "label gives no specific amount"),
  }),
  record({
    name: "Cytarabine", route: "SC", setId: "1be2668b-d76f-4c65-aea9-86c5c40889a2", hint: "caution",
    section: "Precautions",
    note: "The label gives no specific reduced dose.",
    rules: all("Poor kidney function: use with caution, possibly at a reduced dose", "label gives no specific amount"),
  }),
  record({
    name: "Methylergonovine", route: "ORAL", setId: "a7ec8dfe-9b58-4363-a709-c1b72ee67855", hint: "caution",
    section: "Warnings",
    note: "The label gives no specific dose change.",
    rules: all("Renal impairment: use with caution", "label gives no specific dose change"),
  }),
  record({
    name: "Methylergonovine", route: "IV", setId: "17ee0c79-ac98-4400-ae77-985978fca07e", hint: "caution",
    section: "Warnings",
    note: "The label gives no specific dose change.",
    rules: all("Renal impairment: use with caution", "label gives no specific dose change"),
  }),
  record({
    name: "Milrinone", route: "IV", setId: "07dddead-22ed-004c-e063-6294a90a76fc",
    section: "Dosage Adjustment in Renally Impaired Patients",
    note: "Loading dose unchanged. The label tabulates infusion rates at CrCl 5, 10, 20, 30, 40 and 50 mL/min/1.73 m²; each band shows the rate for the nearest tabulated value. Usual maintenance 0.375–0.75 mcg/kg/min.",
    rules: [
      band("gt", 50, Infinity, "Usual maintenance infusion", "0.375–0.75 mcg/kg/min"),
      band("range", 45, 50, "0.43 mcg/kg/min", "continuous infusion", "CrCl 50"),
      band("range", 35, 44.99, "0.38 mcg/kg/min", "continuous infusion", "CrCl 40"),
      band("range", 25, 34.99, "0.33 mcg/kg/min", "continuous infusion", "CrCl 30"),
      band("range", 15, 24.99, "0.28 mcg/kg/min", "continuous infusion", "CrCl 20"),
      band("range", 7.5, 14.99, "0.23 mcg/kg/min", "continuous infusion", "CrCl 10"),
      band("lt", 0, 7.5, "0.2 mcg/kg/min", "continuous infusion", "CrCl 5"),
    ],
  }),
  record({
    name: "Naproxen and Esomeprazole Magnesium", route: "ORAL", setId: "167340c2-1234-4d00-b4e2-cccf3d270fda",
    section: "Renal Impairment; 5.6 Renal Toxicity",
    note: "Avoid in advanced renal disease unless benefits outweigh the risk of worsening renal function.",
    rules: [
      band("gte", 30, Infinity, "Use with caution; monitor renal function", "no dose change specified", "CrCl ≥ 30 mL/min", "caution"),
      band("lt", 0, 30, "Not recommended", "CrCl < 30 mL/min", "Moderate to severe or severe renal impairment"),
    ],
  }),
  record({
    name: "Sitagliptin and Metformin", route: "ORAL", setId: "0098dec4-f0e5-45d5-8aa4-5d0faf9ab142", metric: "egfr",
    section: "2.2 Recommended Dosage in Patients with Renal Impairment",
    note: "Assess eGFR before starting and periodically; may need to stop around iodinated contrast.",
    rules: [
      band("gte", 45, Infinity, "Usual dose", "twice daily with meals"),
      band("range", 30, 44.99, "Not recommended", "eGFR 30 to < 45 mL/min/1.73 m²", "Moderate renal impairment"),
      band("lt", 0, 30, "Do not use (contraindicated)", "eGFR < 30 mL/min/1.73 m²", "Severe renal impairment"),
    ],
  }),
  record({
    name: "Cisplatin", route: "IV", setId: "00396546-6a80-4b9f-a5f8-c22c1d1bb173", hint: "caution",
    section: "Contraindications",
    note: "Cisplatin is substantially excreted by the kidney and is nephrotoxic.",
    rules: all("Pre-existing renal impairment: contraindicated", "no CrCl threshold in the label"),
  }),
  record({
    name: "Dalfampridine", route: "ORAL", setId: "1134ac0f-59c1-a20b-e063-6294a90affcc",
    section: "2.3 Dosing in Renal Impairment; Contraindications",
    note: "Seizure risk rises with exposure; maximum dose 10 mg twice daily.",
    rules: [
      band("gt", 80, Infinity, "10 mg", "twice daily, about 12 hours apart"),
      band("range", 51, 80, "Weigh benefit against higher seizure risk", "mild renal impairment (CrCl 51–80)", "Mild renal impairment", "caution"),
      band("range", 0, 50, "Contraindicated", "CrCl ≤ 50 mL/min", "Moderate or severe renal impairment"),
    ],
  }),
  record({
    name: "Deflazacort", route: "ORAL", setId: "18518568-a40b-41cb-91ce-44fbb5557971",
    section: "8.6 Renal Impairment",
    note: "Monitor blood pressure, sodium and potassium.",
    rules: all("No dose adjustment (mild, moderate or severe renal impairment)", "usual dose"),
  }),
  record({
    name: "Diclofenac and Misoprostol", route: "ORAL", setId: "0d6509a1-7af8-473b-8951-c19439274379", hint: "caution",
    section: "8.5 Renal Impairment; 5.6 Renal Toxicity",
    note: "The label gives no CrCl threshold for advanced renal disease.",
    rules: all("Advanced renal disease: avoid", "monitor renal function"),
  }),
  record({
    name: "Dihydroergotamine", route: "IV", setId: "07a9112c-8c04-4849-8cb3-9463f58731d2", hint: "caution",
    section: "Contraindications",
    note: "The label gives no CrCl threshold.",
    rules: all("Severely impaired renal function: contraindicated", "no CrCl threshold in the label"),
  }),
  record({
    name: "Dihydroergotamine", route: "SC", setId: "07a9112c-8c04-4849-8cb3-9463f58731d2", hint: "caution",
    section: "Contraindications",
    note: "The label gives no CrCl threshold.",
    rules: all("Severely impaired renal function: contraindicated", "no CrCl threshold in the label"),
  }),
  record({
    name: "Gemcitabine", route: "IV", setId: "22af3507-4b4f-4cad-9d61-89ffc4aabbc7", hint: "caution",
    section: "Dosage Modifications; 5.5 Hemolytic Uremic Syndrome",
    note: "The label gives no renal starting-dose adjustment.",
    rules: all("Hemolytic uremic syndrome or severe renal impairment during treatment: discontinue", "monitor renal function"),
  }),
  record({
    name: "Palonosetron", route: "ORAL", setId: "8e47618e-af46-4d82-94e8-1507c042252d",
    section: "8.7 Renal Impairment",
    note: "Oral netupitant/palonosetron (AKYNZEO) label.",
    rules: [
      band("gte", 30, Infinity, "No dosage adjustment", "mild to moderate renal impairment (CrCl 30–60)"),
      band("lt", 0, 30, "Avoid", "severe renal impairment or end-stage renal disease", "Severe renal impairment"),
    ],
  }),
  record({
    name: "Methazolamide", route: "ORAL", setId: "042586b3-4d49-c5ae-e063-6394a90aaa7c", hint: "caution",
    section: "Contraindications",
    note: "The label gives no CrCl threshold for 'marked' kidney disease.",
    rules: all("Marked kidney disease or dysfunction: contraindicated", "no renal dose table in the label"),
  }),
  record({
    name: "Methenamine Hippurate", route: "ORAL", setId: "131a1322-0182-7a4e-e063-6394a90accbf", hint: "caution",
    section: "Contraindications",
    note: "The label gives no CrCl threshold.",
    rules: all("Renal insufficiency: contraindicated", "no CrCl threshold in the label"),
  }),
  record({
    name: "Niacin", route: "ORAL", setId: "249e27ac-e1e7-42dc-84f6-cd32fd1d9dee", hint: "not-studied",
    section: "2.3 Dosage in Patients with Renal or Hepatic Impairment",
    note: "Niacin extended-release tablets.",
    rules: all("Renal impairment: not studied", "use with caution"),
  }),
  record({
    name: "Thiotepa", route: "IV", setId: "0def6a5e-4bf5-b1fd-47b7-0f17ecfd9bc2", hint: "caution",
    section: "Contraindications; Precautions",
    note: "Assess hepatic and renal function regularly if used.",
    rules: all("Existing renal damage: probably contraindicated", "if used, monitor renal function regularly"),
  }),
  record({
    name: "Amlodipine and Olmesartan Medoxomil", route: "ORAL", setId: "02f9b562-6f7f-4783-bb0d-67c318073e1c", hint: "not-studied",
    section: "8.7 Renal Impairment",
    note: "Monitor renal function and potassium in susceptible patients.",
    rules: all("Renal impairment: no studies of the combination", "use with caution"),
  }),
  record({
    name: "Glyburide and Metformin", route: "ORAL", setId: "2239742b-74e1-4bc2-b5a8-15c4758d6f7b", metric: "egfr",
    section: "2.4 Recommendations for Use in Renal Impairment",
    note: "Assess eGFR before starting and periodically.",
    rules: [
      band("gte", 45, Infinity, "Usual dose", "no renal adjustment"),
      band("range", 30, 44.99, "Starting not recommended; if already taking, assess benefit and risk", "eGFR 30–45 mL/min/1.73 m²", "Moderate renal impairment", "caution"),
      band("lt", 0, 30, "Do not use (contraindicated)", "eGFR < 30 mL/min/1.73 m²", "Severe renal impairment"),
    ],
  }),
  // ---- Batch 7 ----
  record({
    name: "Nalbuphine", route: "IV", setId: "28f274a4-62c4-4e54-e063-6394a90a2200", hint: "caution",
    section: "Precautions: Impaired Renal or Hepatic Function",
    note: "Excreted by the kidneys.",
    rules: all("Renal dysfunction: use with caution and give reduced amounts", "label gives no specific amount"),
  }),
  record({
    name: "Nalbuphine", route: "SC", setId: "28f274a4-62c4-4e54-e063-6394a90a2200", hint: "caution",
    section: "Precautions: Impaired Renal or Hepatic Function",
    note: "Excreted by the kidneys.",
    rules: all("Renal dysfunction: use with caution and give reduced amounts", "label gives no specific amount"),
  }),
  record({
    name: "Oxaprozin", route: "ORAL", setId: "284ce161-0a4a-8999-e063-6394a90aa60a", hint: "caution",
    section: "Dosage and Administration; Renal Toxicity",
    note: "Monitor renal function; NSAIDs can precipitate renal decompensation.",
    rules: all("Severe renal impairment or dialysis: start 600 mg once daily", "monitor renal function"),
  }),
  record({
    name: "Acitretin", route: "ORAL", setId: "08ce9fdd-1e84-4043-b085-91053f975b64", hint: "caution",
    section: "Contraindications",
    note: "The label gives no CrCl threshold.",
    rules: all("Severely impaired kidney function: contraindicated", "no CrCl threshold in the label"),
  }),
  record({
    name: "Amlodipine and Valsartan", route: "ORAL", setId: "35086164-bf92-4b3c-9845-f8cd7464c7d6", hint: "caution",
    section: "Warnings and Precautions",
    note: "Monitor renal function in susceptible patients.",
    rules: all("Dialysis: start therapy cautiously", "label gives no renal dose table"),
  }),
  record({
    name: "Butalbital and Acetaminophen", route: "ORAL", setId: "0a8a6a16-b23f-45d2-b5d4-540264e74d14", hint: "caution",
    section: "Precautions",
    note: "Monitor renal function with serial tests in severe renal disease.",
    rules: all("Severe renal impairment: prescribe with caution", "monitor effects with serial renal function tests"),
  }),
  record({
    name: "Ethacrynic Acid", route: "ORAL", setId: "358dd0c5-4d89-403e-9428-a785ec862869", hint: "caution",
    section: "Contraindications",
    note: "No renal dose table in the label.",
    rules: all("Contraindicated in anuria; stop if electrolyte imbalance, azotemia or oliguria worsen in severe progressive renal disease", "no renal dose table in the label"),
  }),
  record({
    name: "Ethacrynic Acid", route: "IV", setId: "f127598f-e6b3-4c35-800f-76e4217595ae", hint: "caution",
    section: "Contraindications",
    note: "No renal dose table in the label.",
    rules: all("Contraindicated in anuria; stop if electrolyte imbalance, azotemia or oliguria worsen in severe progressive renal disease", "no renal dose table in the label"),
  }),
  record({
    name: "Insulin Glargine", route: "SC", setId: "216f2167-c201-76fe-81ed-0d51fe53832f", hint: "caution",
    section: "Dosage and Administration; 8.6 Renal Impairment",
    note: "Hypoglycemia risk can rise as renal function declines.",
    rules: all("Changes in renal function: dose adjustments may be needed", "monitor glucose more frequently"),
  }),
  record({
    name: "Lamivudine and Zidovudine", route: "ORAL", setId: "005f1b9d-1950-4ef3-a9d6-c428a40a3630",
    section: "2.3 Not Recommended Due to Lack of Dosage Adjustment",
    note: "Fixed-dose tablet that cannot be dose adjusted; use the individual components instead.",
    rules: [
      band("gte", 50, Infinity, "1 tablet", "twice daily"),
      band("lt", 0, 50, "Not recommended", "CrCl < 50 mL/min (fixed-dose tablet)", "Renal impairment"),
    ],
  }),
  record({
    name: "Penicillin G", route: "IV", setId: "9e58122f-5c75-4905-a774-d3a4dae4ff8c",
    section: "Dosage and Administration: Renal Impairment",
    note: "Penicillin G potassium. Adjustments are generally needed only in severe renal impairment.",
    rules: [
      {
        type: "gte", min: 10, max: Infinity,
        variants: [
          { condition: "Not uremic", dose: "Usual dose", interval: "adjust generally only in severe renal impairment" },
          { condition: "Uremic, CrCl > 10 mL/min/1.73 m²", dose: "Full loading dose, then half the loading dose", interval: "every 4–5 hours" },
        ],
      },
      band("lt", 0, 10, "Full loading dose, then half the loading dose", "every 8–10 hours", "CrCl < 10 mL/min/1.73 m²"),
    ],
  }),
  record({
    name: "Spironolactone and Hydrochlorothiazide", route: "ORAL", setId: "0c8c973f-13a2-4883-8316-4006398e2931", hint: "caution",
    section: "Contraindications; Warnings",
    note: "Hyperkalemia risk with impaired renal function.",
    rules: all("Anuria, acute renal insufficiency or significant renal impairment: contraindicated", "use thiazides with caution in severe renal disease"),
  }),
  record({
    name: "Sulindac", route: "ORAL", setId: "0feabf47-8d0d-48c0-b263-43db4969f39e", hint: "caution",
    section: "Warnings: Renal Effects",
    note: "NSAIDs can precipitate renal decompensation in patients with impaired renal function.",
    rules: all("Impaired renal function: use with caution; monitor renal function", "label gives no specific dose"),
  }),
  record({
    name: "Rasagiline", route: "ORAL", setId: "2c5e3cde-1158-4b5a-9a2b-ea6c987a65e4",
    section: "8.7 Renal Impairment",
    note: "Plasma levels are not increased with moderate renal impairment.",
    rules: [
      band("gte", 30, Infinity, "No dose adjustment", "mild or moderate renal impairment"),
      band("lt", 0, 30, "Not studied", "severe renal impairment", "Severe renal impairment", "not-studied"),
    ],
  }),
  record({
    name: "Cefoxitin", route: "IV", setId: "4c6f7665-204f-6c69-7669-61204d756e6e",
    section: "Table 2: Maintenance Dosage in Adults with Reduced Renal Function",
    note: "Loading dose 1–2 g may be given. On hemodialysis, give the 1–2 g loading dose after each dialysis, then maintenance per the table.",
    rules: [
      band("gt", 50, Infinity, "Usual dose", "by infection"),
      band("range", 30, 50, "1–2 g", "every 8–12 hours", "Mild impairment (CrCl 30–50)"),
      band("range", 10, 29.99, "1–2 g", "every 12–24 hours", "Moderate impairment (CrCl 10–29)"),
      band("range", 5, 9.99, "0.5–1 g", "every 12–24 hours", "Severe impairment (CrCl 5–9)"),
      band("lt", 0, 5, "0.5–1 g", "every 24–48 hours", "Essentially no function (CrCl < 5)"),
    ],
  }),
  record({
    name: "Atenolol and Chlorthalidone", route: "ORAL", setId: "1494d5f7-8620-46da-8bca-69b76cd17635",
    section: "Dosage and Administration: renal impairment (maximum dosages)",
    note: "Atenolol accumulates below CrCl 35 mL/min/1.73 m².",
    rules: [
      band("gt", 35, Infinity, "Usual dose", "no renal adjustment"),
      band("range", 15, 35, "Maximum 50 mg daily (atenolol)", "once daily", "CrCl 15–35 mL/min/1.73 m²"),
      band("lt", 0, 15, "Maximum 50 mg (atenolol)", "every other day", "CrCl < 15 mL/min/1.73 m²"),
    ],
  }),
  record({
    name: "Balsalazide Disodium", route: "ORAL", setId: "029833fa-ec5c-6a39-e063-6294a90aa063", hint: "caution",
    section: "5.1 Renal Impairment",
    note: "Mesalamine-related renal adverse reactions.",
    rules: all("Known renal impairment: monitor renal function", "discontinue if renal function deteriorates"),
  }),
  record({
    name: "Clofarabine", route: "IV", setId: "0a273a2d-a1ff-412a-925e-696648730dae",
    section: "2.2 Recommended Dosage Reduction for Renal Impairment",
    note: "Monitor renal and hepatic function during the 5 days of administration.",
    rules: [
      band("gt", 60, Infinity, "Usual dose", "no renal adjustment"),
      band("range", 30, 60, "Reduce the dose by 50%", "CrCl 30–60 mL/min", "Moderate renal impairment"),
      band("lt", 0, 30, "Insufficient information for a dose", "CrCl < 30 mL/min", "Severe renal impairment", "not-studied"),
    ],
  }),
  record({
    name: "Etoposide", route: "ORAL", setId: "508a418e-985f-4208-9324-2230655bb5c2",
    section: "Precautions: Renal Impairment",
    note: "Measured CrCl; later doses by tolerance and clinical effect.",
    rules: [
      band("gt", 50, Infinity, "100% of dose", "per regimen"),
      band("range", 15, 50, "75% of dose", "initial dose; then by tolerance", "CrCl 15–50 mL/min"),
      band("lt", 0, 15, "No data", "CrCl < 15 mL/min", "Severe renal impairment", "not-studied"),
    ],
  }),
  record({
    name: "Fentanyl", route: "IV", setId: "0c10e465-4117-48ba-a454-23ccb7a3fcc7", hint: "caution",
    section: "8.7 Renal Impairment",
    note: "Fentanyl and metabolites are renally excreted.",
    rules: all("Kidney dysfunction: give with caution; reduce the dose as needed", "monitor for respiratory depression, sedation and hypotension"),
  }),
  record({
    name: "Foscarnet", route: "IV", setId: "335f7deb-a045-43cb-b319-d7b73bfda73c", hint: "caution",
    section: "Dosage and Administration: renal dose adjustment",
    note: "The label's table uses CrCl per kg body weight (mL/min/kg); hydrate before and with each infusion.",
    rules: all("Dose adjustment by creatinine clearance is required for every patient", "use the label's CrCl (mL/min/kg) table; monitor renal function closely"),
  }),
  record({
    name: "Maraviroc", route: "ORAL", setId: "09ec3e79-c0d3-4b8f-80d8-0a854c4ca339",
    section: "2.4 Recommended Dosage in Patients with Renal Impairment",
    note: "Dose depends on concomitant CYP3A inhibitors or inducers.",
    rules: [
      {
        type: "gte", min: 30, max: Infinity,
        variants: [
          { condition: "With potent CYP3A inhibitors", dose: "150 mg", interval: "twice daily" },
          { condition: "Noninteracting medications", dose: "300 mg", interval: "twice daily" },
          { condition: "With potent/moderate CYP3A inducers (no potent inhibitor)", dose: "600 mg", interval: "twice daily" },
        ],
      },
      {
        type: "lt", min: 0, max: 30,
        variants: [
          { condition: "With potent CYP3A inhibitors", dose: "Contraindicated", interval: "includes ESRD on hemodialysis" },
          { condition: "Noninteracting medications", dose: "300 mg", interval: "twice daily (reduce to 150 mg twice daily if postural hypotension)" },
          { condition: "With CYP3A inducers", dose: "Contraindicated", interval: "includes ESRD on hemodialysis" },
        ],
      },
    ],
  }),
  record({
    name: "Oxymorphone", route: "ORAL", setId: "06af7dff-c261-4c03-9cd9-0605c42507fa",
    section: "2.5 Dosage Modifications in Patients with Renal Impairment",
    note: "Titrate slowly while monitoring for adverse reactions.",
    rules: [
      band("gte", 50, Infinity, "Usual dose", "no renal adjustment"),
      band("lt", 0, 50, "Start with the lowest dose (e.g. 5 mg); titrate slowly", "use with caution", "CrCl < 50 mL/min"),
    ],
  }),
  record({
    name: "Polymyxin B", route: "IV", setId: "18daf0d1-b6f5-46f4-ab2f-01a594f3959c", hint: "caution",
    section: "Dosage and Administration; Precautions",
    note: "Check baseline renal function and monitor renal function and drug levels during therapy.",
    rules: all("Kidney impairment: reduce the dose downward from 15,000 units/kg/day", "label gives no specific amount"),
  }),
  record({
    name: "Telmisartan and Hydrochlorothiazide", route: "ORAL", setId: "0c1bd0f4-034e-486c-ae46-2855c8c9ebda", hint: "caution",
    section: "Warnings and Precautions",
    note: "The label gives no renal dose table.",
    rules: all("Impaired renal function: monitor renal function periodically", "no renal dose table in the label"),
  }),
  record({
    name: "Tolvaptan", route: "ORAL", setId: "5b14ba2b-9f80-41d6-9613-f16d3cf37d25",
    section: "8.7 Use in Patients with Renal Impairment",
    note: "Effect on serum sodium is likely lost at very low renal function.",
    rules: [
      band("gte", 10, Infinity, "No dose adjustment", "usual dose"),
      band("lt", 0, 10, "Not recommended", "CrCl < 10 mL/min (no trial data)", "Severe renal impairment"),
    ],
  }),
  record({
    name: "Micafungin", route: "IV", setId: "31e74606-bccd-4276-bb20-a1933ce4ca25",
    section: "8.6 Use in Patients with Renal Impairment",
    note: "No supplementary dose needed after hemodialysis.",
    rules: all("No dose adjustment", "usual dose"),
  }),
  record({
    name: "Chlorothiazide", route: "ORAL", setId: "bd936e35-1af8-42da-bcc0-f22489d68574", hint: "caution",
    section: "Warnings",
    note: "Thiazides may precipitate azotemia in renal disease.",
    rules: all("Severe renal disease: use with caution", "consider withholding or stopping if renal impairment progresses"),
  }),
  record({
    name: "Chlorothiazide", route: "IV", setId: "5b5d8a97-1428-4047-8e6c-b778429a26e4", hint: "caution",
    section: "Warnings",
    note: "Thiazides may precipitate azotemia in renal disease.",
    rules: all("Severe renal disease: use with caution", "consider withholding or stopping if renal impairment progresses"),
  }),
  record({
    name: "Dapagliflozin and Metformin", route: "ORAL", setId: "4f890458-be94-4baf-b606-83a097e1e23e", metric: "egfr",
    section: "Dosage and Administration: Renal Impairment",
    note: "Dapagliflozin is unlikely to improve glycemic control with eGFR < 45.",
    rules: [
      band("gte", 45, Infinity, "Usual dose", "once daily"),
      band("range", 30, 44.99, "Starting not recommended; if already taking, assess benefit and risk", "eGFR 30–45 mL/min/1.73 m²", "Moderate renal impairment", "caution"),
      band("lt", 0, 30, "Contraindicated (metformin)", "eGFR < 30 mL/min/1.73 m²", "Severe renal impairment"),
    ],
  }),
  record({
    name: "Empagliflozin", route: "ORAL", setId: "1782b947-4a72-4feb-a488-1469d9af82bd", metric: "egfr",
    section: "2 Dosage and Administration",
    note: "Correct volume depletion before starting. Recommendations differ by indication.",
    rules: [
      band("gte", 30, Infinity, "10 mg once daily (may increase to 25 mg for glycemic control)", "in the morning"),
      {
        type: "range", min: 20, max: 29.99,
        variants: [
          { condition: "Glycemic control", dose: "Not recommended", interval: "eGFR < 30" },
          { condition: "T2D with cardiovascular disease", dose: "Insufficient data", interval: "eGFR < 30" },
          { condition: "Heart failure", dose: "10 mg", interval: "once daily" },
        ],
      },
      {
        type: "lt", min: 0, max: 20,
        variants: [
          { condition: "Glycemic control", dose: "Not recommended", interval: "eGFR < 30" },
          { condition: "Heart failure or T2D with cardiovascular disease", dose: "Insufficient data", interval: "eGFR < 20" },
        ],
      },
    ],
  }),
];

// Exported for tests of the helpers.
export const _helpers = { record, all, band };
