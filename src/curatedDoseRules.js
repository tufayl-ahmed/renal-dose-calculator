import { normalizeDrugKey } from "./drugNormalizer.js";
import { draftRenalDoseRules } from "./data/renalRules/index.js";

const STARTER_RENAL_RULES = [
  {
    drugName: "Piperacillin and tazobactam",
    searchTerm: "piperacillin and tazobactam",
    aliases: [
      "piptaz",
      "pip taz",
      "pip-taz",
      "zosyn",
      "tazocin",
      "piperacillin tazobactam",
      "piperacillin and tazobactam",
    ],
    routes: ["IV"],
    indicationNote: "Adult IV infusion over 30 minutes; indication-specific columns retained from label.",
    sourceLabel: "DailyMed label section 2.3 Dosage in Adult Patients with Renal Impairment",
    sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9b682c66-61c6-4ade-baf4-9d68911a16b8",
    reviewedBy: "Dr. Tufayl (Cortex Labs)",
    reviewedOn: "2026-05-06",
    confidence: "starter-verified",
    rules: [
      {
        type: "gt",
        min: 40,
        max: Infinity,
        variants: [
          { condition: "All indications except nosocomial pneumonia", dose: "3.375 g", interval: "every 6 hours" },
          { condition: "Nosocomial pneumonia", dose: "4.5 g", interval: "every 6 hours" },
        ],
      },
      {
        type: "range",
        min: 20,
        max: 40,
        variants: [
          { condition: "Not receiving hemodialysis; all indications except nosocomial pneumonia", dose: "2.25 g", interval: "every 6 hours" },
          { condition: "Not receiving hemodialysis; nosocomial pneumonia", dose: "3.375 g", interval: "every 6 hours" },
        ],
      },
      {
        type: "lt",
        min: 0,
        max: 20,
        variants: [
          { condition: "Not receiving hemodialysis; all indications except nosocomial pneumonia", dose: "2.25 g", interval: "every 8 hours" },
          { condition: "Not receiving hemodialysis; nosocomial pneumonia", dose: "2.25 g", interval: "every 6 hours" },
          { condition: "Hemodialysis; all indications except nosocomial pneumonia", dose: "2.25 g plus 0.75 g after each hemodialysis session", interval: "every 12 hours plus post-HD supplement" },
          { condition: "Hemodialysis; nosocomial pneumonia", dose: "2.25 g plus 0.75 g after each hemodialysis session", interval: "every 8 hours plus post-HD supplement" },
          { condition: "CAPD; all indications except nosocomial pneumonia", dose: "2.25 g", interval: "every 12 hours" },
          { condition: "CAPD; nosocomial pneumonia", dose: "2.25 g", interval: "every 8 hours" },
        ],
      },
    ],
  },
  {
    drugName: "Meropenem",
    searchTerm: "meropenem",
    aliases: ["mero", "meronem", "meropenem"],
    routes: ["IV"],
    indicationNote: "Adult IV dosing adjustment; actual dose depends on infection type.",
    sourceLabel: "DailyMed label adult renal impairment table",
    sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=meropenem",
    reviewedBy: "Dr. Tufayl (Cortex Labs)",
    reviewedOn: "2026-05-06",
    confidence: "starter-verified",
    rules: [
      {
        type: "gt",
        min: 50,
        max: Infinity,
        variants: [{ condition: "Adult renal table", dose: "Recommended dose", interval: "every 8 hours" }],
      },
      {
        type: "range",
        min: 26,
        max: 50,
        variants: [{ condition: "Adult renal table", dose: "Recommended dose", interval: "every 12 hours" }],
      },
      {
        type: "range",
        min: 10,
        max: 25,
        variants: [{ condition: "Adult renal table", dose: "One-half recommended dose", interval: "every 12 hours" }],
      },
      {
        type: "lt",
        min: 0,
        max: 10,
        variants: [{ condition: "Adult renal table", dose: "One-half recommended dose", interval: "every 24 hours" }],
      },
    ],
  },
];

const DIALYSIS_OPTIONS = {
  none: { value: "none", label: "Not on dialysis" },
  hd: { value: "hd", label: "Hemodialysis" },
  capd: { value: "capd", label: "CAPD/PD" },
  esrd: { value: "esrd-not-on-dialysis", label: "ESRD not on dialysis" },
};

const STRUCTURED_RENAL_RULES = [
  {
    searchTerm: "piperacillin tazobactam",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd, DIALYSIS_OPTIONS.capd],
      indications: [
        { value: "other", label: "All except nosocomial pneumonia" },
        { value: "nosocomial-pneumonia", label: "Nosocomial pneumonia" },
      ],
    },
    rules: [
      structuredRule({ type: "gt", min: 40, dialysis: "none", indication: "other", dose: "3.375 g", interval: "every 6 hours" }),
      structuredRule({ type: "gt", min: 40, dialysis: "none", indication: "nosocomial-pneumonia", dose: "4.5 g", interval: "every 6 hours" }),
      structuredRule({ min: 20, max: 40, dialysis: "none", indication: "other", dose: "2.25 g", interval: "every 6 hours" }),
      structuredRule({ min: 20, max: 40, dialysis: "none", indication: "nosocomial-pneumonia", dose: "3.375 g", interval: "every 6 hours" }),
      structuredRule({ type: "lt", max: 20, dialysis: "none", indication: "other", dose: "2.25 g", interval: "every 8 hours" }),
      structuredRule({ type: "lt", max: 20, dialysis: "none", indication: "nosocomial-pneumonia", dose: "2.25 g", interval: "every 6 hours" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "other", dose: "2.25 g plus 0.75 g after each HD session", interval: "every 12 hours plus post-HD supplement" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "nosocomial-pneumonia", dose: "2.25 g plus 0.75 g after each HD session", interval: "every 8 hours plus post-HD supplement" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "other", dose: "2.25 g", interval: "every 12 hours" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "nosocomial-pneumonia", dose: "2.25 g", interval: "every 8 hours" }),
    ],
  },
  {
    searchTerm: "cefepime",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd, DIALYSIS_OPTIONS.capd],
      indications: [
        { value: "usual-500-q12", label: "Usual 500 mg q12h regimen" },
        { value: "usual-1g-q12", label: "Usual 1 g q12h regimen" },
        { value: "usual-2g-q12", label: "Usual 2 g q12h regimen" },
        { value: "usual-2g-q8", label: "Usual 2 g q8h / febrile neutropenia" },
      ],
    },
    rules: [
      structuredRule({ type: "gte", min: 60, dialysis: "none", indication: "usual-500-q12", dose: "500 mg", interval: "every 12 hours" }),
      structuredRule({ type: "gte", min: 60, dialysis: "none", indication: "usual-1g-q12", dose: "1 g", interval: "every 12 hours" }),
      structuredRule({ type: "gte", min: 60, dialysis: "none", indication: "usual-2g-q12", dose: "2 g", interval: "every 12 hours" }),
      structuredRule({ type: "gte", min: 60, dialysis: "none", indication: "usual-2g-q8", dose: "2 g", interval: "every 8 hours" }),
      structuredRule({ min: 30, max: 59, dialysis: "none", indication: "usual-500-q12", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ min: 30, max: 59, dialysis: "none", indication: "usual-1g-q12", dose: "1 g", interval: "every 24 hours" }),
      structuredRule({ min: 30, max: 59, dialysis: "none", indication: "usual-2g-q12", dose: "2 g", interval: "every 24 hours" }),
      structuredRule({ min: 30, max: 59, dialysis: "none", indication: "usual-2g-q8", dose: "2 g", interval: "every 12 hours" }),
      structuredRule({ min: 11, max: 29, dialysis: "none", indication: "usual-500-q12", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ min: 11, max: 29, dialysis: "none", indication: "usual-1g-q12", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ min: 11, max: 29, dialysis: "none", indication: "usual-2g-q12", dose: "1 g", interval: "every 24 hours" }),
      structuredRule({ min: 11, max: 29, dialysis: "none", indication: "usual-2g-q8", dose: "2 g", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 11, dialysis: "none", indication: "usual-500-q12", dose: "250 mg", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 11, dialysis: "none", indication: "usual-1g-q12", dose: "250 mg", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 11, dialysis: "none", indication: "usual-2g-q12", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 11, dialysis: "none", indication: "usual-2g-q8", dose: "1 g", interval: "every 24 hours" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "usual-500-q12", dose: "500 mg", interval: "every 48 hours" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "usual-1g-q12", dose: "1 g", interval: "every 48 hours" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "usual-2g-q12", dose: "2 g", interval: "every 48 hours" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "usual-2g-q8", dose: "2 g", interval: "every 48 hours" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "usual-2g-q8", dose: "1 g", interval: "every 24 hours after HD on dialysis days" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "any", dose: "1 g on day 1, then 500 mg", interval: "every 24 hours after HD on dialysis days" }),
    ],
  },
  {
    searchTerm: "levofloxacin",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd, DIALYSIS_OPTIONS.capd],
      indications: [
        { value: "usual-750-q24", label: "Normal regimen 750 mg q24h" },
        { value: "usual-500-q24", label: "Normal regimen 500 mg q24h" },
        { value: "usual-250-q24", label: "Normal regimen 250 mg q24h" },
      ],
    },
    rules: [
      structuredRule({ type: "gte", min: 50, dialysis: "none", indication: "any", dose: "No dosage adjustment", interval: "usual adult schedule by indication" }),
      structuredRule({ min: 20, max: 49, dialysis: "none", indication: "usual-750-q24", dose: "750 mg", interval: "every 48 hours" }),
      structuredRule({ min: 20, max: 49, dialysis: "none", indication: "usual-500-q24", dose: "500 mg once, then 250 mg", interval: "every 24 hours" }),
      structuredRule({ min: 20, max: 49, dialysis: "none", indication: "usual-250-q24", dose: "No dosage adjustment", interval: "usual 250 mg schedule" }),
      structuredRule({ min: 10, max: 19, dialysis: "none", indication: "usual-750-q24", dose: "750 mg once, then 500 mg", interval: "every 48 hours" }),
      structuredRule({ min: 10, max: 19, dialysis: "none", indication: "usual-500-q24", dose: "500 mg once, then 250 mg", interval: "every 48 hours" }),
      structuredRule({ min: 10, max: 19, dialysis: "none", indication: "usual-250-q24", dose: "250 mg", interval: "every 48 hours; no adjustment for uncomplicated UTI" }),
      structuredRule({ type: "lt", max: 10, dialysis: "none", indication: "any", dose: "DailyMed table is dialysis-specific below 10 mL/min", interval: "manual clinical review required", reviewLevel: "manual-review" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "usual-750-q24", dose: "750 mg once, then 500 mg", interval: "every 48 hours" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "usual-500-q24", dose: "500 mg once, then 250 mg", interval: "every 48 hours" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "usual-250-q24", dose: "No clean adjustment row", interval: "review label", reviewLevel: "manual-review" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "usual-750-q24", dose: "750 mg once, then 500 mg", interval: "every 48 hours" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "usual-500-q24", dose: "500 mg once, then 250 mg", interval: "every 48 hours" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "usual-250-q24", dose: "No clean adjustment row", interval: "review label", reviewLevel: "manual-review" }),
    ],
  },
  {
    searchTerm: "oseltamivir",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd, DIALYSIS_OPTIONS.capd, DIALYSIS_OPTIONS.esrd],
      indications: [
        { value: "treatment", label: "Influenza treatment" },
        { value: "prophylaxis", label: "Influenza prophylaxis" },
      ],
    },
    rules: [
      structuredRule({ type: "gt", min: 60, dialysis: "none", indication: "treatment", dose: "75 mg", interval: "twice daily for 5 days" }),
      structuredRule({ type: "gt", min: 60, dialysis: "none", indication: "prophylaxis", dose: "75 mg", interval: "once daily" }),
      structuredRule({ min: 30, max: 60, dialysis: "none", indication: "treatment", dose: "30 mg", interval: "twice daily for 5 days" }),
      structuredRule({ min: 30, max: 60, dialysis: "none", indication: "prophylaxis", dose: "30 mg", interval: "once daily" }),
      structuredRule({ min: 10, max: 30, dialysis: "none", indication: "treatment", dose: "30 mg", interval: "once daily for 5 days" }),
      structuredRule({ min: 10, max: 30, dialysis: "none", indication: "prophylaxis", dose: "30 mg", interval: "every other day" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "treatment", dose: "30 mg immediately, then 30 mg after each HD cycle", interval: "treatment duration not to exceed 5 days" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "prophylaxis", dose: "30 mg immediately, then 30 mg after alternate HD cycles", interval: "per prophylaxis duration" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "treatment", dose: "30 mg", interval: "single dose immediately" }),
      structuredRule({ type: "all", dialysis: "capd", indication: "prophylaxis", dose: "30 mg immediately, then 30 mg", interval: "once weekly" }),
      structuredRule({ type: "all", dialysis: "esrd-not-on-dialysis", indication: "any", dose: "Not recommended", interval: "not applicable", reviewLevel: "manual-review" }),
    ],
  },
  {
    searchTerm: "amoxicillin clavulanate",
    renalMetric: "crcl",
    routes: ["ORAL"],
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
    },
    rules: [
      structuredRule({ type: "gt", min: 30, dialysis: "none", dose: "No renal dose adjustment", interval: "usual adult schedule by indication" }),
      structuredRule({ min: 10, max: 30, dialysis: "none", dose: "250/125 mg or 500/125 mg", interval: "every 12 hours" }),
      structuredRule({ type: "lt", max: 10, dialysis: "none", dose: "250/125 mg or 500/125 mg", interval: "every 24 hours" }),
      structuredRule({ type: "all", dialysis: "hd", dose: "250/125 mg or 500/125 mg plus extra doses during and after HD", interval: "every 24 hours plus dialysis supplements" }),
    ],
  },
  {
    searchTerm: "ciprofloxacin",
    renalMetric: "crcl",
    routes: ["ORAL"],
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd, DIALYSIS_OPTIONS.capd],
    },
    rules: [
      structuredRule({ type: "gt", min: 50, dialysis: "none", dose: "See usual dose", interval: "by indication" }),
      structuredRule({ min: 30, max: 50, dialysis: "none", dose: "250-500 mg", interval: "every 12 hours" }),
      structuredRule({ min: 5, max: 29, dialysis: "none", dose: "250-500 mg", interval: "every 18 hours" }),
      structuredRule({ type: "all", dialysis: "hd", dose: "250-500 mg", interval: "every 24 hours after dialysis" }),
      structuredRule({ type: "all", dialysis: "capd", dose: "250-500 mg", interval: "every 24 hours after dialysis" }),
    ],
  },
  {
    searchTerm: "acyclovir oral",
    drugName: "Acyclovir",
    renalMetric: "crcl",
    routes: ["ORAL"],
    controls: {
      formulations: [
        { value: "usual-200-q4h", label: "200 mg q4h, 5x/day regimen" },
        { value: "usual-400-q12h", label: "400 mg q12h regimen" },
        { value: "usual-800-q4h", label: "800 mg q4h, 5x/day regimen" },
      ],
    },
    rules: [
      structuredRule({ type: "gt", min: 25, formulation: "usual-200-q4h", dose: "200 mg", interval: "every 4 hours, 5 times daily" }),
      structuredRule({ type: "gt", min: 25, formulation: "usual-400-q12h", dose: "400 mg", interval: "every 12 hours" }),
      structuredRule({ type: "gt", min: 25, formulation: "usual-800-q4h", dose: "800 mg", interval: "every 4 hours, 5 times daily" }),
      structuredRule({ min: 10, max: 25, formulation: "usual-200-q4h", dose: "200 mg", interval: "every 4 hours, 5 times daily" }),
      structuredRule({ min: 10, max: 25, formulation: "usual-400-q12h", dose: "400 mg", interval: "every 12 hours" }),
      structuredRule({ min: 10, max: 25, formulation: "usual-800-q4h", dose: "800 mg", interval: "every 8 hours" }),
      structuredRule({ type: "lt", max: 10, formulation: "usual-200-q4h", dose: "200 mg", interval: "every 12 hours" }),
      structuredRule({ type: "lt", max: 10, formulation: "usual-400-q12h", dose: "200 mg", interval: "every 12 hours" }),
      structuredRule({ type: "lt", max: 10, formulation: "usual-800-q4h", dose: "800 mg", interval: "every 12 hours" }),
    ],
  },
  {
    searchTerm: "acyclovir injection",
    drugName: "Acyclovir sodium",
    renalMetric: "crcl",
    routes: ["IV"],
    rules: [
      structuredRule({ type: "gt", min: 50, dose: "100% of recommended dose", interval: "every 8 hours" }),
      structuredRule({ min: 25, max: 50, dose: "100% of recommended dose", interval: "every 12 hours" }),
      structuredRule({ min: 10, max: 25, dose: "100% of recommended dose", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 10, dose: "50% of recommended dose", interval: "every 24 hours" }),
    ],
  },
  {
    searchTerm: "valacyclovir",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
      indications: [
        { value: "cold-sores", label: "Cold sores" },
        { value: "initial-genital-herpes", label: "Initial genital herpes" },
        { value: "recurrent-genital-herpes", label: "Recurrent genital herpes" },
        { value: "genital-suppression", label: "Genital herpes suppression" },
        { value: "transmission-reduction", label: "Transmission reduction" },
        { value: "zoster", label: "Herpes zoster" },
      ],
    },
    rules: [
      structuredRule({ type: "gte", min: 50, dialysis: "none", indication: "cold-sores", dose: "2 g twice in 1 day", interval: "12 hours apart" }),
      structuredRule({ type: "gte", min: 50, dialysis: "none", indication: "initial-genital-herpes", dose: "1 g", interval: "every 12 hours" }),
      structuredRule({ type: "gte", min: 50, dialysis: "none", indication: "recurrent-genital-herpes", dose: "500 mg", interval: "every 12 hours" }),
      structuredRule({ type: "gte", min: 50, dialysis: "none", indication: "genital-suppression", dose: "500 mg to 1 g", interval: "every 24 hours" }),
      structuredRule({ type: "gte", min: 50, dialysis: "none", indication: "transmission-reduction", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ type: "gte", min: 50, dialysis: "none", indication: "zoster", dose: "1 g", interval: "every 8 hours" }),
      structuredRule({ min: 30, max: 49, dialysis: "none", indication: "cold-sores", dose: "1 g twice in 1 day", interval: "12 hours apart" }),
      structuredRule({ min: 30, max: 49, dialysis: "none", indication: "zoster", dose: "1 g", interval: "every 12 hours" }),
      structuredRule({ min: 30, max: 49, dialysis: "none", indication: "any", dose: "No reduction", interval: "usual adult schedule by indication" }),
      structuredRule({ min: 10, max: 29, dialysis: "none", indication: "cold-sores", dose: "500 mg twice in 1 day", interval: "12 hours apart" }),
      structuredRule({ min: 10, max: 29, dialysis: "none", indication: "initial-genital-herpes", dose: "1 g", interval: "every 24 hours" }),
      structuredRule({ min: 10, max: 29, dialysis: "none", indication: "recurrent-genital-herpes", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ min: 10, max: 29, dialysis: "none", indication: "genital-suppression", dose: "500 mg", interval: "every 24 to 48 hours by suppression regimen" }),
      structuredRule({ min: 10, max: 29, dialysis: "none", indication: "transmission-reduction", dose: "500 mg", interval: "every 48 hours" }),
      structuredRule({ min: 10, max: 29, dialysis: "none", indication: "zoster", dose: "1 g", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 10, dialysis: "none", indication: "cold-sores", dose: "500 mg", interval: "single dose" }),
      structuredRule({ type: "lt", max: 10, dialysis: "none", indication: "initial-genital-herpes", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 10, dialysis: "none", indication: "recurrent-genital-herpes", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 10, dialysis: "none", indication: "genital-suppression", dose: "500 mg", interval: "every 24 to 48 hours by suppression regimen" }),
      structuredRule({ type: "lt", max: 10, dialysis: "none", indication: "transmission-reduction", dose: "500 mg", interval: "every 48 hours" }),
      structuredRule({ type: "lt", max: 10, dialysis: "none", indication: "zoster", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "any", dose: "Use renal-adjusted dose for CrCl band; give after HD on dialysis days", interval: "review selected indication", reviewLevel: "source-summary" }),
    ],
  },
  {
    searchTerm: "famciclovir",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
      indications: [
        { value: "recurrent-genital-herpes", label: "Recurrent genital herpes" },
        { value: "herpes-labialis", label: "Herpes labialis" },
        { value: "zoster", label: "Herpes zoster" },
        { value: "genital-suppression", label: "Genital suppression" },
        { value: "hiv-recurrent-herpes", label: "HIV recurrent herpes" },
      ],
    },
    rules: [
      structuredRule({ type: "gte", min: 60, dialysis: "none", indication: "recurrent-genital-herpes", dose: "1000 mg", interval: "every 12 hours for 1 day" }),
      structuredRule({ type: "gte", min: 60, dialysis: "none", indication: "herpes-labialis", dose: "1500 mg", interval: "single dose" }),
      structuredRule({ type: "gte", min: 60, dialysis: "none", indication: "zoster", dose: "500 mg", interval: "every 8 hours" }),
      structuredRule({ type: "gte", min: 60, dialysis: "none", indication: "genital-suppression", dose: "250 mg", interval: "every 12 hours" }),
      structuredRule({ type: "gte", min: 60, dialysis: "none", indication: "hiv-recurrent-herpes", dose: "500 mg", interval: "every 12 hours" }),
      structuredRule({ min: 40, max: 59, dialysis: "none", indication: "recurrent-genital-herpes", dose: "500 mg", interval: "every 12 hours for 1 day" }),
      structuredRule({ min: 40, max: 59, dialysis: "none", indication: "herpes-labialis", dose: "750 mg", interval: "single dose" }),
      structuredRule({ min: 40, max: 59, dialysis: "none", indication: "zoster", dose: "500 mg", interval: "every 12 hours" }),
      structuredRule({ min: 40, max: 59, dialysis: "none", indication: "genital-suppression", dose: "250 mg", interval: "every 12 hours" }),
      structuredRule({ min: 40, max: 59, dialysis: "none", indication: "hiv-recurrent-herpes", dose: "500 mg", interval: "every 12 hours" }),
      structuredRule({ min: 20, max: 39, dialysis: "none", indication: "recurrent-genital-herpes", dose: "500 mg", interval: "single dose" }),
      structuredRule({ min: 20, max: 39, dialysis: "none", indication: "herpes-labialis", dose: "500 mg", interval: "single dose" }),
      structuredRule({ min: 20, max: 39, dialysis: "none", indication: "zoster", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ min: 20, max: 39, dialysis: "none", indication: "genital-suppression", dose: "125 mg", interval: "every 12 hours" }),
      structuredRule({ min: 20, max: 39, dialysis: "none", indication: "hiv-recurrent-herpes", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 20, dialysis: "none", indication: "recurrent-genital-herpes", dose: "250 mg", interval: "single dose" }),
      structuredRule({ type: "lt", max: 20, dialysis: "none", indication: "herpes-labialis", dose: "250 mg", interval: "single dose" }),
      structuredRule({ type: "lt", max: 20, dialysis: "none", indication: "zoster", dose: "250 mg", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 20, dialysis: "none", indication: "genital-suppression", dose: "125 mg", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 20, dialysis: "none", indication: "hiv-recurrent-herpes", dose: "250 mg", interval: "every 24 hours" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "recurrent-genital-herpes", dose: "250 mg", interval: "single dose following dialysis" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "herpes-labialis", dose: "250 mg", interval: "single dose following dialysis" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "zoster", dose: "250 mg", interval: "following each dialysis" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "genital-suppression", dose: "125 mg", interval: "following each dialysis" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "hiv-recurrent-herpes", dose: "250 mg", interval: "following each dialysis" }),
    ],
  },
  {
    searchTerm: "gabapentin",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
    },
    rules: [
      structuredRule({ type: "gte", min: 60, dialysis: "none", dose: "900-3600 mg/day", interval: "divided TID" }),
      structuredRule({ min: 30, max: 59.99, dialysis: "none", dose: "400-1400 mg/day", interval: "divided BID" }),
      structuredRule({ min: 15, max: 29.99, dialysis: "none", dose: "200-700 mg/day", interval: "once daily" }),
      structuredRule({ type: "lt", max: 15, dialysis: "none", dose: "100-300 mg/day at CrCl 15; reduce proportionally below 15", interval: "once daily" }),
      structuredRule({ type: "all", dialysis: "hd", dose: "Maintenance dose by CrCl plus 125-350 mg supplement", interval: "after each 4 hours of HD", reviewLevel: "source-summary" }),
    ],
  },
  {
    searchTerm: "pregabalin",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
    },
    rules: [
      structuredRule({ type: "gte", min: 60, dialysis: "none", dose: "150-600 mg/day", interval: "divided BID or TID" }),
      structuredRule({ min: 30, max: 59.99, dialysis: "none", dose: "75-300 mg/day", interval: "divided BID or TID" }),
      structuredRule({ min: 15, max: 29.99, dialysis: "none", dose: "25-150 mg/day", interval: "once daily or divided BID" }),
      structuredRule({ type: "lt", max: 15, dialysis: "none", dose: "25-75 mg/day", interval: "once daily" }),
      structuredRule({ type: "all", dialysis: "hd", dose: "Renal-adjusted daily dose plus 25-150 mg supplement", interval: "immediately after each 4-hour HD", reviewLevel: "source-summary" }),
    ],
  },
  {
    searchTerm: "levetiracetam",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
    },
    rules: [
      structuredRule({ type: "gt", min: 80, dialysis: "none", dose: "500-1500 mg", interval: "every 12 hours" }),
      structuredRule({ min: 50, max: 80, dialysis: "none", dose: "500-1000 mg", interval: "every 12 hours" }),
      structuredRule({ min: 30, max: 49.99, dialysis: "none", dose: "250-750 mg", interval: "every 12 hours" }),
      structuredRule({ type: "lt", max: 30, dialysis: "none", dose: "250-500 mg", interval: "every 12 hours" }),
      structuredRule({ type: "all", dialysis: "hd", dose: "500-1000 mg plus 250-500 mg supplement", interval: "every 24 hours; supplement after dialysis" }),
    ],
  },
  {
    searchTerm: "topiramate",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
    },
    rules: [
      structuredRule({ type: "gte", min: 70, dialysis: "none", dose: "No renal dose adjustment", interval: "usual adult schedule by indication" }),
      structuredRule({ type: "lt", max: 70, dialysis: "none", dose: "One-half usual adult dose", interval: "usual interval by indication" }),
      structuredRule({ type: "all", dialysis: "hd", dose: "One-half usual adult dose plus possible supplemental dose", interval: "individualize to dialysis parameters", reviewLevel: "source-summary" }),
    ],
  },
  {
    searchTerm: "rivaroxaban",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
      indications: [
        { value: "nvaf", label: "NVAF stroke prevention" },
        { value: "dvt-pe-initial", label: "DVT/PE treatment, first 21 days" },
        { value: "dvt-pe-maintenance", label: "DVT/PE treatment after 21 days" },
        { value: "recurrent-risk", label: "Recurrent DVT/PE risk reduction" },
        { value: "hip-prophylaxis", label: "Hip replacement prophylaxis" },
        { value: "knee-prophylaxis", label: "Knee replacement prophylaxis" },
        { value: "cad-pad", label: "CAD/PAD vascular event reduction" },
      ],
    },
    rules: [
      structuredRule({ type: "gt", min: 50, dialysis: "none", indication: "nvaf", dose: "20 mg", interval: "once daily with evening meal" }),
      structuredRule({ min: 15, max: 50, dialysis: "none", indication: "nvaf", dose: "15 mg", interval: "once daily with evening meal" }),
      structuredRule({ type: "gte", min: 15, dialysis: "none", indication: "dvt-pe-initial", dose: "15 mg", interval: "twice daily with food" }),
      structuredRule({ type: "gte", min: 15, dialysis: "none", indication: "dvt-pe-maintenance", dose: "20 mg", interval: "once daily with food" }),
      structuredRule({ type: "gte", min: 15, dialysis: "none", indication: "recurrent-risk", dose: "10 mg", interval: "once daily with or without food" }),
      structuredRule({ type: "gte", min: 15, dialysis: "none", indication: "hip-prophylaxis", dose: "10 mg", interval: "once daily for 35 days" }),
      structuredRule({ type: "gte", min: 15, dialysis: "none", indication: "knee-prophylaxis", dose: "10 mg", interval: "once daily for 12 days" }),
      structuredRule({ type: "all", dialysis: "none", indication: "cad-pad", dose: "2.5 mg plus aspirin 75-100 mg", interval: "twice daily" }),
      structuredRule({ type: "lt", max: 15, dialysis: "any", indication: "any", dose: "Avoid use", interval: "review label for indication", reviewLevel: "manual-review" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "any", dose: "Avoid use / no clean dosing row", interval: "manual clinical review required", reviewLevel: "manual-review" }),
    ],
  },
  {
    searchTerm: "apixaban",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
      indications: [
        { value: "nvaf-usual", label: "NVAF, fewer than 2 reduction criteria" },
        { value: "nvaf-reduced", label: "NVAF, at least 2 reduction criteria" },
        { value: "dvt-pe", label: "DVT/PE treatment" },
        { value: "recurrent-risk", label: "Recurrent DVT/PE risk reduction" },
        { value: "hip-knee-prophylaxis", label: "Hip/knee prophylaxis" },
      ],
    },
    rules: [
      structuredRule({ type: "all", dialysis: "none", indication: "nvaf-usual", dose: "5 mg", interval: "twice daily" }),
      structuredRule({ type: "all", dialysis: "none", indication: "nvaf-reduced", dose: "2.5 mg", interval: "twice daily" }),
      structuredRule({ type: "all", dialysis: "none", indication: "dvt-pe", dose: "10 mg twice daily for 7 days, then 5 mg", interval: "twice daily" }),
      structuredRule({ type: "all", dialysis: "none", indication: "recurrent-risk", dose: "2.5 mg", interval: "twice daily after at least 6 months treatment" }),
      structuredRule({ type: "all", dialysis: "none", indication: "hip-knee-prophylaxis", dose: "2.5 mg", interval: "twice daily" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "any", dose: "Dialysis dosing requires product-label review", interval: "manual clinical review required", reviewLevel: "manual-review" }),
    ],
  },
  {
    searchTerm: "edoxaban",
    renalMetric: "crcl",
    controls: {
      indications: [
        { value: "nvaf", label: "NVAF" },
        { value: "dvt-pe", label: "DVT/PE after parenteral anticoagulant" },
        { value: "dvt-pe-low-weight-pgp", label: "DVT/PE with <=60 kg or selected P-gp inhibitor" },
      ],
    },
    rules: [
      structuredRule({ type: "gt", min: 95, indication: "nvaf", dose: "Do not use; use another anticoagulant", interval: "not applicable", reviewLevel: "manual-review" }),
      structuredRule({ min: 50, max: 95, indication: "nvaf", dose: "60 mg", interval: "once daily" }),
      structuredRule({ min: 15, max: 50, indication: "nvaf", dose: "30 mg", interval: "once daily" }),
      structuredRule({ type: "lt", max: 15, indication: "nvaf", dose: "Not recommended", interval: "not applicable", reviewLevel: "manual-review" }),
      structuredRule({ type: "gt", min: 50, indication: "dvt-pe", dose: "60 mg", interval: "once daily" }),
      structuredRule({ type: "gt", min: 50, indication: "dvt-pe-low-weight-pgp", dose: "30 mg", interval: "once daily" }),
      structuredRule({ min: 15, max: 50, indication: "dvt-pe", dose: "30 mg", interval: "once daily" }),
      structuredRule({ min: 15, max: 50, indication: "dvt-pe-low-weight-pgp", dose: "30 mg", interval: "once daily" }),
      structuredRule({ type: "lt", max: 15, indication: "dvt-pe", dose: "Not recommended", interval: "not applicable", reviewLevel: "manual-review" }),
      structuredRule({ type: "lt", max: 15, indication: "dvt-pe-low-weight-pgp", dose: "Not recommended", interval: "not applicable", reviewLevel: "manual-review" }),
    ],
  },
  {
    searchTerm: "dabigatran",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
      indications: [
        { value: "nvaf", label: "NVAF" },
        { value: "nvaf-pgp", label: "NVAF with selected P-gp inhibitor" },
        { value: "dvt-pe", label: "DVT/PE treatment or recurrence reduction" },
        { value: "dvt-pe-pgp", label: "DVT/PE with P-gp inhibitor" },
      ],
    },
    rules: [
      structuredRule({ type: "gt", min: 30, dialysis: "none", indication: "nvaf", dose: "150 mg", interval: "twice daily" }),
      structuredRule({ min: 15, max: 30, dialysis: "none", indication: "nvaf", dose: "75 mg", interval: "twice daily" }),
      structuredRule({ min: 30, max: 50, dialysis: "none", indication: "nvaf-pgp", dose: "75 mg", interval: "twice daily" }),
      structuredRule({ type: "lt", max: 30, dialysis: "none", indication: "nvaf-pgp", dose: "Avoid coadministration", interval: "not applicable", reviewLevel: "manual-review" }),
      structuredRule({ type: "gt", min: 30, dialysis: "none", indication: "dvt-pe", dose: "150 mg", interval: "twice daily" }),
      structuredRule({ type: "lte-placeholder", max: 30, dialysis: "none", indication: "dvt-pe", dose: "Dosing recommendations cannot be provided", interval: "not applicable", reviewLevel: "manual-review" }),
      structuredRule({ type: "lt", max: 50, dialysis: "none", indication: "dvt-pe-pgp", dose: "Avoid coadministration", interval: "not applicable", reviewLevel: "manual-review" }),
      structuredRule({ type: "all", dialysis: "hd", indication: "any", dose: "Dosing recommendations cannot be provided", interval: "not applicable", reviewLevel: "manual-review" }),
    ],
  },
  {
    searchTerm: "fondaparinux",
    renalMetric: "crcl",
    routes: ["SC"],
    rules: [
      structuredRule({ type: "lt", max: 30, dose: "Do not use; contraindicated", interval: "not applicable", reviewLevel: "manual-review" }),
      structuredRule({ min: 30, max: 50, dose: "Use with caution", interval: "usual adult schedule by indication", reviewLevel: "source-summary" }),
      structuredRule({ type: "gt", min: 50, dose: "No renal dose adjustment in label renal section", interval: "usual adult schedule by indication" }),
    ],
  },
  {
    searchTerm: "enoxaparin",
    renalMetric: "crcl",
    controls: {
      indications: [
        { value: "prophylaxis", label: "DVT prophylaxis" },
        { value: "dvt-treatment", label: "DVT/PE treatment" },
        { value: "ua-nstemi", label: "UA/NSTEMI with aspirin" },
        { value: "stemi-under-75", label: "STEMI, age under 75" },
        { value: "stemi-75-plus", label: "STEMI, age 75 or older" },
      ],
    },
    rules: [
      structuredRule({ type: "gte", min: 30, indication: "any", dose: "No renal dose adjustment", interval: "usual adult schedule by indication; observe bleeding" }),
      structuredRule({ type: "lt", max: 30, indication: "prophylaxis", dose: "30 mg", interval: "once daily" }),
      structuredRule({ type: "lt", max: 30, indication: "dvt-treatment", dose: "1 mg/kg", interval: "once daily" }),
      structuredRule({ type: "lt", max: 30, indication: "ua-nstemi", dose: "1 mg/kg", interval: "once daily" }),
      structuredRule({ type: "lt", max: 30, indication: "stemi-under-75", dose: "30 mg IV bolus plus 1 mg/kg SC, then 1 mg/kg SC", interval: "once daily" }),
      structuredRule({ type: "lt", max: 30, indication: "stemi-75-plus", dose: "1 mg/kg SC; no initial bolus", interval: "once daily" }),
    ],
  },
  {
    searchTerm: "sotalol",
    renalMetric: "crcl",
    controls: {
      indications: [
        { value: "ventricular", label: "Ventricular arrhythmia" },
        { value: "afib-afl", label: "AFIB/AFL" },
      ],
    },
    rules: [
      structuredRule({ type: "gt", min: 60, indication: "ventricular", dose: "Initial 80 mg and subsequent doses", interval: "every 12 hours" }),
      structuredRule({ min: 30, max: 59, indication: "ventricular", dose: "Initial 80 mg and subsequent doses", interval: "every 24 hours" }),
      structuredRule({ min: 10, max: 29, indication: "ventricular", dose: "Initial 80 mg and subsequent doses", interval: "every 36 to 48 hours" }),
      structuredRule({ type: "lt", max: 10, indication: "ventricular", dose: "Individualize dose", interval: "specialist monitoring", reviewLevel: "manual-review" }),
      structuredRule({ type: "gt", min: 60, indication: "afib-afl", dose: "Initial 80 mg and subsequent doses", interval: "every 12 hours" }),
      structuredRule({ min: 40, max: 60, indication: "afib-afl", dose: "Initial 80 mg and subsequent doses", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 40, indication: "afib-afl", dose: "Contraindicated", interval: "not applicable", reviewLevel: "manual-review" }),
    ],
  },
  {
    searchTerm: "tadalafil",
    renalMetric: "crcl",
    controls: {
      formulations: [
        { value: "ed-prn", label: "ED as needed" },
        { value: "daily-ed-bph", label: "Once-daily ED/BPH" },
        { value: "pah", label: "PAH/ADCIRCA" },
      ],
    },
    rules: [
      structuredRule({ type: "gt", min: 50, formulation: "ed-prn", dose: "No renal dose adjustment", interval: "usual ED as-needed schedule" }),
      structuredRule({ type: "gt", min: 50, formulation: "daily-ed-bph", dose: "No renal dose adjustment", interval: "once daily" }),
      structuredRule({ min: 30, max: 50, formulation: "ed-prn", dose: "Start 5 mg; maximum 10 mg", interval: "not more than once daily; max 10 mg every 48 hours" }),
      structuredRule({ min: 30, max: 50, formulation: "daily-ed-bph", dose: "Start 2.5 mg; may increase to 5 mg", interval: "once daily based on response" }),
      structuredRule({ type: "lt", max: 30, formulation: "ed-prn", dose: "Do not exceed 5 mg", interval: "every 72 hours" }),
      structuredRule({ type: "lt", max: 30, formulation: "daily-ed-bph", dose: "Not recommended", interval: "do not use", reviewLevel: "manual-review" }),
      structuredRule({ type: "all", formulation: "pah", dose: "PAH/ADCIRCA not encoded in this ED/BPH record", interval: "review product-specific label", reviewLevel: "manual-review" }),
    ],
  },
  {
    searchTerm: "cefuroxime axetil",
    drugName: "Cefuroxime axetil",
    renalMetric: "crcl",
    routes: ["ORAL"],
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
    },
    rules: [
      structuredRule({ type: "gte", min: 30, dialysis: "none", dose: "No renal dose adjustment", interval: "usual adult schedule by indication" }),
      structuredRule({ min: 10, max: 29, dialysis: "none", dose: "Standard individual dose", interval: "every 24 hours" }),
      structuredRule({ type: "lt", max: 10, dialysis: "none", dose: "Standard individual dose", interval: "every 48 hours" }),
      structuredRule({ type: "all", dialysis: "hd", dose: "Standard individual dose plus post-HD dose", interval: "give after HD", reviewLevel: "source-summary" }),
    ],
  },
  {
    searchTerm: "cefuroxime injection",
    drugName: "Cefuroxime",
    renalMetric: "crcl",
    routes: ["IV", "IM"],
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
    },
    rules: [
      structuredRule({ type: "gt", min: 20, dialysis: "none", dose: "750 mg to 1.5 g", interval: "every 8 hours" }),
      structuredRule({ min: 10, max: 20, dialysis: "none", dose: "750 mg", interval: "every 12 hours" }),
      structuredRule({ type: "lt", max: 10, dialysis: "none", dose: "750 mg", interval: "every 24 hours" }),
      structuredRule({ type: "all", dialysis: "hd", dose: "750 mg further dose", interval: "at the end of dialysis in addition to reduced schedule", reviewLevel: "source-summary" }),
    ],
  },
  {
    searchTerm: "ceftazidime",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd, DIALYSIS_OPTIONS.capd],
    },
    rules: [
      structuredRule({ type: "gt", min: 50, dialysis: "none", dose: "No renal dose adjustment", interval: "usual adult schedule by indication" }),
      structuredRule({ min: 31, max: 50, dialysis: "none", dose: "1 g", interval: "every 12 hours" }),
      structuredRule({ min: 16, max: 30, dialysis: "none", dose: "1 g", interval: "every 24 hours" }),
      structuredRule({ min: 6, max: 15, dialysis: "none", dose: "500 mg", interval: "every 24 hours" }),
      structuredRule({ min: 0, max: 5, dialysis: "none", dose: "500 mg", interval: "every 48 hours" }),
      structuredRule({ type: "all", dialysis: "hd", dose: "1 g loading dose, then 1 g", interval: "after each HD period" }),
      structuredRule({ type: "all", dialysis: "capd", dose: "1 g loading dose, then 500 mg", interval: "every 24 hours" }),
    ],
  },
  {
    searchTerm: "cefpodoxime",
    renalMetric: "crcl",
    controls: {
      dialysis: [DIALYSIS_OPTIONS.none, DIALYSIS_OPTIONS.hd],
    },
    rules: [
      structuredRule({ type: "gte", min: 30, dialysis: "none", dose: "No renal dose adjustment", interval: "usual adult schedule by indication" }),
      structuredRule({ type: "lt", max: 30, dialysis: "none", dose: "Usual individual dose", interval: "every 24 hours" }),
      structuredRule({ type: "all", dialysis: "hd", dose: "Usual individual dose", interval: "3 times/week after HD" }),
    ],
  },
  {
    searchTerm: "famotidine",
    renalMetric: "crcl",
    controls: {
      indications: [
        { value: "ulcer", label: "Active duodenal/gastric ulcer" },
        { value: "gerd", label: "Symptomatic non-erosive GERD" },
        { value: "erosive-20-bid", label: "Erosive esophagitis, usual 20 mg BID" },
        { value: "erosive-40-bid", label: "Erosive esophagitis, usual 40 mg BID" },
        { value: "du-recurrence", label: "Duodenal ulcer recurrence reduction" },
        { value: "hypersecretory", label: "Pathological hypersecretory condition" },
      ],
    },
    rules: [
      structuredRule({ type: "gte", min: 60, indication: "any", dose: "No renal dose adjustment", interval: "usual adult schedule by indication" }),
      structuredRule({ min: 30, max: 59.99, indication: "ulcer", dose: "20 mg daily or 40 mg every other day", interval: "maximum renal regimen" }),
      structuredRule({ min: 30, max: 59.99, indication: "gerd", dose: "20 mg", interval: "once daily" }),
      structuredRule({ min: 30, max: 59.99, indication: "erosive-20-bid", dose: "20 mg daily or 40 mg every other day", interval: "maximum renal regimen" }),
      structuredRule({ min: 30, max: 59.99, indication: "erosive-40-bid", dose: "40 mg", interval: "once daily" }),
      structuredRule({ min: 30, max: 59.99, indication: "du-recurrence", dose: "20 mg", interval: "every other day" }),
      structuredRule({ min: 30, max: 59.99, indication: "hypersecretory", dose: "Avoid use", interval: "manual review", reviewLevel: "manual-review" }),
      structuredRule({ type: "lt", max: 30, indication: "ulcer", dose: "20 mg", interval: "every other day; 10 mg daily needs another formulation" }),
      structuredRule({ type: "lt", max: 30, indication: "gerd", dose: "20 mg", interval: "every other day; 10 mg daily needs another formulation" }),
      structuredRule({ type: "lt", max: 30, indication: "erosive-20-bid", dose: "20 mg", interval: "every other day; 10 mg daily needs another formulation" }),
      structuredRule({ type: "lt", max: 30, indication: "erosive-40-bid", dose: "20 mg", interval: "once daily" }),
      structuredRule({ type: "lt", max: 30, indication: "du-recurrence", dose: "10 mg", interval: "every other day; needs another formulation" }),
      structuredRule({ type: "lt", max: 30, indication: "hypersecretory", dose: "Avoid use", interval: "manual review", reviewLevel: "manual-review" }),
    ],
  },
  {
    searchTerm: "apremilast",
    renalMetric: "crcl",
    rules: [
      structuredRule({ type: "gte", min: 30, dose: "30 mg", interval: "twice daily after titration" }),
      structuredRule({ type: "lt", max: 30, dose: "30 mg", interval: "once daily after AM-only titration" }),
    ],
  },
  {
    searchTerm: "atogepant",
    renalMetric: "crcl",
    controls: {
      indications: [
        { value: "episodic-migraine", label: "Episodic migraine prevention" },
        { value: "chronic-migraine", label: "Chronic migraine prevention" },
      ],
    },
    rules: [
      structuredRule({ type: "gte", min: 30, indication: "any", dose: "No renal dose adjustment", interval: "usual adult preventive schedule" }),
      structuredRule({ type: "lt", max: 30, indication: "episodic-migraine", dose: "10 mg", interval: "once daily; after dialysis on dialysis days" }),
      structuredRule({ type: "lt", max: 30, indication: "chronic-migraine", dose: "Not recommended", interval: "do not use", reviewLevel: "manual-review" }),
    ],
  },
  {
    searchTerm: "vancomycin",
    renalMetric: "crcl",
    rules: [
      structuredRule({
        type: "all",
        dose: "Use at least 15 mg/kg initial dose, then individualize",
        interval: "serum concentrations / local AUC/trough protocol",
        reviewLevel: "source-summary",
      }),
    ],
  },
];

const CURATED_RENAL_RULES = buildCuratedRuleSet();

export function findCuratedRenalDoseGuidance({
  drugQuery,
  normalizedDrug,
  crcl,
  egfr,
  route,
  dialysis,
  indication,
  formulation,
}) {
  const record = findCuratedRecord(drugQuery, normalizedDrug, route);
  if (!record) {
    return null;
  }

  const structuredGuidance = findStructuredGuidance({
    record,
    crcl,
    egfr,
    route,
    dialysis,
    indication,
    formulation,
  });
  if (structuredGuidance) {
    return structuredGuidance;
  }

  const routeRules = record.rules;
  const selectedRule = routeRules.find((rule) => {
    const metric = inferRuleMetric(record, rule);
    const value = metric.value === "egfr" ? egfr : crcl;
    return isRenalValueInRule(value, rule);
  });
  const routeLabel = route === "ALL" ? record.routes.join(", ") : routeDisplayName(route);
  const badge = buildBadge(record);
  const status = selectedRule ? getMatchedStatus(record, selectedRule) : "curated_needs_review";

  if (!selectedRule) {
    const fallbackMetric = inferRecordMetric(record);
    const fallbackValue = fallbackMetric.value === "egfr" ? egfr : crcl;
    return {
      status: "curated_needs_review",
      title: "Curated renal dose rule",
      badge,
      drugName: record.drugName,
      routeLabel,
      renalBandLabel: `${fallbackMetric.label} value`,
      crclBand: `${fallbackMetric.label} ${formatNumber(fallbackValue)} ${fallbackMetric.unit}`,
      recommendation: "Curated rules exist, but this renal value did not match a stored band. Review source.",
      sourceHeading: record.sourceLabel,
      sourceUrl: record.sourceUrl,
      sourceLabel: record.sourceLabel,
      indicationNote: record.indicationNote,
      reviewedBy: record.reviewedBy,
      reviewedOn: record.reviewedOn,
      caveat: "Educational purpose only. Results are estimates and are not for prescribing.",
      rows: routeRules.map((rule) => ({
        band: formatBand(rule, inferRuleMetric(record, rule)),
        recommendation: formatVariants(rule.variants),
        selected: false,
      })),
    };
  }

  const selectedMetric = inferRuleMetric(record, selectedRule);
  return {
    status,
    title: "Curated renal dose rule",
    badge,
    drugName: record.drugName,
    routeLabel,
    renalBandLabel: `${selectedMetric.label} band`,
    crclBand: formatBand(selectedRule, selectedMetric),
    recommendation: formatVariants(selectedRule.variants),
    sourceHeading: record.sourceLabel,
    sourceUrl: record.sourceUrl,
    sourceLabel: record.sourceLabel,
    indicationNote: record.indicationNote,
    reviewedBy: record.reviewedBy,
    reviewedOn: record.reviewedOn,
    caveat: "Educational purpose only. Results are estimates and are not for prescribing.",
    rows: routeRules.map((rule) => ({
      band: formatBand(rule, inferRuleMetric(record, rule)),
      recommendation: formatVariants(rule.variants),
      selected: rule === selectedRule,
    })),
  };
}

export function getCuratedDrugOptions({ drugQuery, normalizedDrug, route }) {
  const record = findCuratedRecord(drugQuery, normalizedDrug, route);
  if (!record?.structured) {
    return null;
  }

  return {
    drugName: record.drugName,
    dialysis: visibleOptions(record.structured.controls?.dialysis),
    indications: visibleOptions(record.structured.controls?.indications),
    formulations: visibleOptions(record.structured.controls?.formulations),
  };
}

export function getCuratedRuleCount() {
  return CURATED_RENAL_RULES.length;
}

function findCuratedRecord(drugQuery, normalizedDrug, route) {
  const keys = [
    drugQuery,
    normalizedDrug?.searchTerm,
    normalizedDrug?.displayName,
    normalizedDrug?.original,
  ]
    .filter(Boolean)
    .map(normalizeDrugKey);

  const queryLiteralKeys = [
    drugQuery,
    normalizedDrug?.searchTerm,
    normalizedDrug?.displayName,
    normalizedDrug?.original,
  ]
    .filter(Boolean)
    .map(literalDrugKey);

  const candidates = CURATED_RENAL_RULES.map((record) => {
    const recordKeys = [record.drugName, record.searchTerm, ...record.aliases].map(normalizeDrugKey);
    const recordLiteralKeys = [record.drugName, record.searchTerm, ...record.aliases].map(literalDrugKey);
    const normalizedMatch = keys.some((key) => recordKeys.includes(key));
    const literalScore = queryLiteralKeys.some((key) => recordLiteralKeys.includes(key)) ? 10 : 0;
    const routeHintScore = scoreRouteHint(queryLiteralKeys, record);
    return normalizedMatch ? { record, score: literalScore + routeHintScore } : null;
  })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.record);

  if (!route || route === "ALL") {
    return candidates[0] || null;
  }

  return candidates.find((record) => routeMatches(record, route)) || null;
}

function buildCuratedRuleSet() {
  const starterKeys = new Set(STARTER_RENAL_RULES.map((record) => normalizeDrugKey(record.searchTerm || record.drugName)));
  const draftRecords = draftRenalDoseRules.filter((record) => {
    const key = normalizeDrugKey(record.searchTerm || record.drugName);
    return !starterKeys.has(key);
  });

  return [...STARTER_RENAL_RULES, ...draftRecords].map(addStructuredOverlay);
}

function routeMatches(record, route) {
  if (!route || route === "ALL") {
    return true;
  }
  return record.routes.includes(route);
}

function isRenalValueInRule(value, rule) {
  if (!Number.isFinite(value)) {
    return false;
  }
  if (rule.type === "gt") {
    return value > rule.min;
  }
  if (rule.type === "gte") {
    return value >= rule.min;
  }
  if (rule.type === "lt") {
    return value < rule.max;
  }
  if (rule.type === "all") {
    return true;
  }
  return value >= rule.min && value <= rule.max;
}

function findStructuredGuidance({ record, crcl, egfr, route, dialysis, indication, formulation }) {
  if (!record.structured) {
    return null;
  }

  const controls = normalizeStructuredControls(record.structured, { dialysis, indication, formulation });
  const metric = RENAL_METRICS[record.structured.renalMetric] || inferRecordMetric(record);
  const renalValue = metric.value === "egfr" ? egfr : crcl;
  const matchingRules = record.structured.rules
    .filter((rule) => structuredRuleMatches(rule, controls, renalValue))
    .sort((a, b) => scoreStructuredRule(b, controls) - scoreStructuredRule(a, controls));
  const selectedRule = matchingRules[0];
  const routeLabel = route === "ALL" ? record.routes.join(", ") : routeDisplayName(route);
  const badge = buildBadge(record);
  const rows = record.structured.rules
    .filter((rule) => structuredContextMatches(rule, controls, { allowAny: true }))
    .map((rule) => ({
      band: formatBand(rule, metric),
      recommendation: formatStructuredRuleRecommendation(rule),
      selected: rule === selectedRule,
    }));

  if (!selectedRule) {
    return {
      status: "curated_needs_review",
      title: "Curated renal dose rule",
      badge,
      drugName: record.drugName,
      routeLabel,
      renalBandLabel: `${metric.label} value`,
      crclBand: `${metric.label} ${formatNumber(renalValue)} ${metric.unit}`,
      recommendation: "No structured rule matched this context. Review the DailyMed source.",
      reviewLevel: "manual-review",
      sourceHeading: record.sourceLabel,
      sourceUrl: record.sourceUrl,
      sourceLabel: record.sourceLabel,
      indicationNote: record.indicationNote,
      reviewedBy: record.reviewedBy,
      reviewedOn: record.reviewedOn,
      caveat: "Educational purpose only. Results are estimates and are not for prescribing.",
      options: getCuratedDrugOptions({ drugQuery: record.searchTerm, normalizedDrug: null, route }),
      selectedControls: controls,
      rows,
    };
  }

  const reviewLevel = selectedRule.reviewLevel || "clean-dose";
  return {
    status: structuredStatus(record, reviewLevel),
    title: "Curated renal dose rule",
    badge: structuredBadge(record, reviewLevel, badge),
    drugName: record.drugName,
    routeLabel,
    renalBandLabel: `${metric.label} band`,
    crclBand: formatBand(selectedRule, metric),
    recommendation: formatStructuredRuleRecommendation(selectedRule),
    dose: selectedRule.dose,
    interval: selectedRule.interval,
    reviewLevel,
    sourceHeading: record.sourceLabel,
    sourceUrl: record.sourceUrl,
    sourceLabel: record.sourceLabel,
    indicationNote: buildStructuredNote(record, selectedRule, controls),
    reviewedBy: record.reviewedBy,
    reviewedOn: record.reviewedOn,
    caveat: "Educational purpose only. Results are estimates and are not for prescribing.",
    options: getCuratedDrugOptions({ drugQuery: record.searchTerm, normalizedDrug: null, route }),
    selectedControls: controls,
    rows,
  };
}

function addStructuredOverlay(record) {
  const recordKeys = [record.drugName, record.searchTerm, ...record.aliases].map(normalizeDrugKey);
  const structured = STRUCTURED_RENAL_RULES.find((entry) => {
    const matchesSearchTerm = recordKeys.includes(normalizeDrugKey(entry.searchTerm));
    const matchesDrugName = !entry.drugName || normalizeDrugKey(entry.drugName) === normalizeDrugKey(record.drugName);
    const matchesRoutes = !entry.routes?.length || entry.routes.some((route) => record.routes.includes(route));
    return matchesSearchTerm && matchesDrugName && matchesRoutes;
  });
  return structured ? { ...record, structured } : record;
}

function literalDrugKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreRouteHint(queryLiteralKeys, record) {
  const query = queryLiteralKeys.join(" ");
  if (/\b(?:iv|intravenous|injection|injectable)\b/.test(query) && routeMatches(record, "IV")) {
    return 6;
  }
  if (/\b(?:oral|po|tablet|capsule)\b/.test(query) && routeMatches(record, "ORAL")) {
    return 6;
  }
  if (/\b(?:subcutaneous|subcut|subq|sc)\b/.test(query) && routeMatches(record, "SC")) {
    return 6;
  }
  return 0;
}

function structuredRule(input) {
  const type = input.type === "lte-placeholder" ? "range" : input.type || "range";
  const max = input.type === "gt" || input.type === "gte" ? Infinity : input.max;
  const min = input.min ?? 0;

  return {
    type,
    min,
    max: max ?? Infinity,
    dialysis: input.dialysis || "any",
    indication: input.indication || "any",
    formulation: input.formulation || "any",
    dose: input.dose,
    interval: input.interval,
    reviewLevel: input.reviewLevel || "clean-dose",
  };
}

function normalizeStructuredControls(structured, values) {
  return {
    dialysis: normalizeControlValue(values.dialysis, structured.controls?.dialysis, "none"),
    indication: normalizeControlValue(values.indication, structured.controls?.indications, "any"),
    formulation: normalizeControlValue(values.formulation, structured.controls?.formulations, "any"),
  };
}

function normalizeControlValue(value, options, fallback) {
  const validOptions = visibleOptions(options);
  if (!validOptions.length) {
    return fallback;
  }
  return validOptions.some((option) => option.value === value) ? value : validOptions[0].value;
}

function visibleOptions(options) {
  return Array.isArray(options) && options.length > 1 ? options : [];
}

function structuredRuleMatches(rule, controls, renalValue) {
  return isRenalValueInRule(renalValue, rule) && structuredContextMatches(rule, controls, { allowAny: true });
}

function structuredContextMatches(rule, controls, { allowAny }) {
  return (
    controlMatches(rule.dialysis, controls.dialysis, allowAny) &&
    controlMatches(rule.indication, controls.indication, allowAny) &&
    controlMatches(rule.formulation, controls.formulation, allowAny)
  );
}

function controlMatches(ruleValue, selectedValue, allowAny) {
  return ruleValue === selectedValue || (allowAny && ruleValue === "any");
}

function scoreStructuredRule(rule, controls) {
  return (
    controlScore(rule.dialysis, controls.dialysis, 4) +
    controlScore(rule.indication, controls.indication, 3) +
    controlScore(rule.formulation, controls.formulation, 2)
  );
}

function controlScore(ruleValue, selectedValue, weight) {
  if (ruleValue === selectedValue) {
    return weight;
  }
  return ruleValue === "any" ? 0 : -weight;
}

function structuredStatus(record, reviewLevel) {
  if (reviewLevel === "source-summary" || reviewLevel === "manual-review") {
    return "curated_needs_review";
  }
  return record.confidence === "starter-verified" ? "curated_matched" : "curated_draft_matched";
}

function structuredBadge(record, reviewLevel, fallbackBadge) {
  if (reviewLevel === "manual-review") {
    return "Needs review";
  }
  if (reviewLevel === "source-summary") {
    return "Source summary";
  }
  return fallbackBadge || buildBadge(record);
}

function formatStructuredRuleRecommendation(rule) {
  return `${rule.dose} ${formatInterval(rule.interval)}`;
}

function buildStructuredNote(record, rule, controls) {
  const context = [
    controls.dialysis && controls.dialysis !== "none" ? `Dialysis: ${formatControlValue(controls.dialysis)}.` : "",
    controls.indication && controls.indication !== "any" ? `Indication: ${formatControlValue(controls.indication)}.` : "",
    controls.formulation && controls.formulation !== "any" ? `Product/formulation: ${formatControlValue(controls.formulation)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [record.indicationNote, context, rule.reviewLevel !== "clean-dose" ? "This result needs source review." : ""]
    .filter(Boolean)
    .join(" ");
}

function formatControlValue(value) {
  return String(value).replaceAll("-", " ");
}

function formatBand(rule, metric = RENAL_METRICS.crcl) {
  if (rule.type === "all") {
    return `All ${metric.shortLabel} values`;
  }
  if (rule.type === "gt") {
    return `${metric.label} > ${formatNumber(rule.min)} ${metric.unit}`;
  }
  if (rule.type === "gte") {
    return `${metric.label} >= ${formatNumber(rule.min)} ${metric.unit}`;
  }
  if (rule.type === "lt") {
    return `${metric.label} < ${formatNumber(rule.max)} ${metric.unit}`;
  }
  return `${metric.label} ${formatNumber(rule.min)}-${formatNumber(rule.max)} ${metric.unit}`;
}

function formatVariants(variants) {
  if (variants.length === 1) {
    return `${variants[0].dose} ${formatInterval(variants[0].interval)}`;
  }

  return variants
    .map((variant) => `${variant.condition}: ${variant.dose} ${formatInterval(variant.interval)}`)
    .join("; ");
}

function formatInterval(interval) {
  const cleanInterval = String(interval || "").trim();
  const hourlyMatch = cleanInterval.match(/^every\s+(\d+)\s+hours?$/i);

  if (!hourlyMatch) {
    return cleanInterval;
  }

  const hours = Number(hourlyMatch[1]);
  if (!Number.isFinite(hours) || hours <= 0 || 24 % hours !== 0) {
    return cleanInterval;
  }

  const timesPerDay = 24 / hours;
  const label = timesPerDay === 1 ? "1 time/day" : `${timesPerDay} times/day`;
  return `${cleanInterval} (${label})`;
}

function routeDisplayName(route) {
  if (route === "IV") {
    return "IV";
  }
  if (route === "ORAL") {
    return "Oral";
  }
  if (route === "IM") {
    return "IM";
  }
  if (route === "SC" || route === "SUBQ") {
    return "Subcutaneous";
  }
  if (route === "INHALATION") {
    return "Inhalation";
  }
  return "All routes";
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const RENAL_METRICS = {
  crcl: {
    value: "crcl",
    label: "CrCl",
    shortLabel: "CrCl",
    unit: "mL/min",
  },
  egfr: {
    value: "egfr",
    label: "eGFR",
    shortLabel: "eGFR",
    unit: "mL/min/1.73 m2",
  },
};

function inferRuleMetric(record, rule) {
  const ruleText = [
    rule.variants?.map((variant) => variant.condition).join(" "),
    rule.variants?.map((variant) => `${variant.dose} ${variant.interval}`).join(" "),
  ].join(" ");

  return inferMetricFromText(ruleText) || inferRecordMetric(record);
}

function inferRecordMetric(record) {
  const recordText = [
    record.indicationNote,
    record.sourceLabel,
    record.sourceNote,
    record.rules?.flatMap((rule) => rule.variants?.map((variant) => variant.condition) || []).join(" "),
  ].join(" ");

  return inferMetricFromText(recordText) || RENAL_METRICS.crcl;
}

function inferMetricFromText(text) {
  const value = String(text || "");
  if (/\beGFR\b|\bMDRD\b/i.test(value)) {
    return RENAL_METRICS.egfr;
  }
  if (/\bGFR\b/i.test(value) && !/\b(?:CrCl|CLcr|CCr|creatinine clearance)\b/i.test(value)) {
    return RENAL_METRICS.egfr;
  }
  if (/\b(?:CrCl|CLcr|CCr|creatinine clearance)\b/i.test(value)) {
    return RENAL_METRICS.crcl;
  }
  return null;
}

function buildBadge(record) {
  if (record.confidence === "starter-verified") {
    return "Starter verified";
  }
  return `Curated draft ${CURATED_RENAL_RULES.length} drugs`;
}

function getMatchedStatus(record, rule) {
  const text = `${record.sourceNote || ""} ${record.indicationNote || ""} ${formatVariants(rule.variants)}`;
  if (/review|not studied|not established|not recommended|contraindicated|avoid|specialist/i.test(text)) {
    return "curated_needs_review";
  }
  return record.confidence === "starter-verified" ? "curated_matched" : "curated_draft_matched";
}
