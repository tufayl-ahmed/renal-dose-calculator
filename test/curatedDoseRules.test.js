import test from "node:test";
import assert from "node:assert/strict";
import {
  findCuratedRenalDoseGuidance,
  getCuratedDrugOptions,
  getCuratedRuleCount,
} from "../src/curatedDoseRules.js";

test("returns curated piptaz guidance before DailyMed fallback is needed", () => {
  const guidance = findCuratedRenalDoseGuidance({
    drugQuery: "piptaz",
    normalizedDrug: {
      searchTerm: "piperacillin and tazobactam",
      displayName: "Piperacillin and tazobactam",
    },
    crcl: 44,
    egfr: 38.8,
    route: "ALL",
    dialysis: "none",
    indication: "other",
  });

  assert.equal(guidance.status, "curated_matched");
  assert.equal(guidance.drugName, "Piperacillin and tazobactam");
  assert.equal(guidance.routeLabel, "IV");
  assert.equal(guidance.crclBand, "CrCl > 40 mL/min");
  assert.equal(guidance.dose, "3.375 g");
  assert.equal(guidance.interval, "every 6 hours");
});

test("returns curated meropenem renal band by CrCl", () => {
  const guidance = findCuratedRenalDoseGuidance({
    drugQuery: "mero",
    normalizedDrug: { searchTerm: "meropenem", displayName: "Meropenem" },
    crcl: 44,
    egfr: 38.8,
    route: "IV",
  });

  assert.equal(guidance.status, "curated_matched");
  assert.equal(guidance.crclBand, "CrCl 26-50 mL/min");
  assert.equal(guidance.recommendation, "Recommended dose every 12 hours (2 times/day)");
});

test("skips curated rule when selected route does not match", () => {
  const guidance = findCuratedRenalDoseGuidance({
    drugQuery: "piptaz",
    normalizedDrug: { searchTerm: "piperacillin and tazobactam" },
    crcl: 44,
    egfr: 38.8,
    route: "ORAL",
  });

  assert.equal(guidance, null);
});

test("returns draft curated rules for expanded table drugs", () => {
  const guidance = findCuratedRenalDoseGuidance({
    drugQuery: "ampicillin sulbactam",
    normalizedDrug: { searchTerm: "ampicillin sulbactam", displayName: "Ampicillin and sulbactam" },
    crcl: 44,
    egfr: 38.8,
    route: "ALL",
  });

  assert.equal(guidance.status, "curated_draft_matched");
  assert.equal(guidance.drugName, "Ampicillin and sulbactam");
  assert.match(guidance.badge, /Curated draft/);
  assert.ok(getCuratedRuleCount() >= 200);
});

test("returns manual-review curated summary for vancomycin instead of raw label parsing", () => {
  const guidance = findCuratedRenalDoseGuidance({
    drugQuery: "vanco",
    normalizedDrug: { searchTerm: "vancomycin", displayName: "Vancomycin" },
    crcl: 44,
    egfr: 38.8,
    route: "IV",
  });

  assert.equal(guidance.status, "curated_needs_review");
  assert.equal(guidance.drugName, "Vancomycin hydrochloride");
  assert.match(guidance.recommendation, /serum concentrations/i);
  assert.match(guidance.recommendation, /AUC\/trough/i);
});

test("returns piptaz hemodialysis supplement when dialysis context is selected", () => {
  const guidance = findCuratedRenalDoseGuidance({
    drugQuery: "piptaz",
    normalizedDrug: { searchTerm: "piperacillin and tazobactam" },
    crcl: 12,
    egfr: 10,
    route: "ALL",
    dialysis: "hd",
    indication: "other",
  });

  assert.equal(guidance.status, "curated_matched");
  assert.equal(guidance.dose, "2.25 g plus 0.75 g after each HD session");
  assert.match(guidance.interval, /post-HD supplement/);
});

test("cefepime separates CAPD and hemodialysis context", () => {
  const capd = findCuratedRenalDoseGuidance({
    drugQuery: "cefepime",
    normalizedDrug: { searchTerm: "cefepime", displayName: "Cefepime" },
    crcl: 8,
    egfr: 8,
    route: "IV",
    dialysis: "capd",
    indication: "usual-1g-q12",
  });
  const hd = findCuratedRenalDoseGuidance({
    drugQuery: "cefepime",
    normalizedDrug: { searchTerm: "cefepime", displayName: "Cefepime" },
    crcl: 8,
    egfr: 8,
    route: "IV",
    dialysis: "hd",
    indication: "usual-1g-q12",
  });

  assert.equal(capd.dose, "1 g");
  assert.equal(capd.interval, "every 48 hours");
  assert.equal(hd.dose, "1 g on day 1, then 500 mg");
  assert.match(hd.interval, /after HD/);
});

test("oseltamivir distinguishes HD, CAPD, and ESRD not on dialysis", () => {
  const hd = findCuratedRenalDoseGuidance({
    drugQuery: "oseltamivir",
    normalizedDrug: { searchTerm: "oseltamivir" },
    crcl: 6,
    egfr: 6,
    route: "ORAL",
    dialysis: "hd",
    indication: "treatment",
  });
  const capd = findCuratedRenalDoseGuidance({
    drugQuery: "oseltamivir",
    normalizedDrug: { searchTerm: "oseltamivir" },
    crcl: 6,
    egfr: 6,
    route: "ORAL",
    dialysis: "capd",
    indication: "treatment",
  });
  const esrd = findCuratedRenalDoseGuidance({
    drugQuery: "oseltamivir",
    normalizedDrug: { searchTerm: "oseltamivir" },
    crcl: 6,
    egfr: 6,
    route: "ORAL",
    dialysis: "esrd-not-on-dialysis",
    indication: "treatment",
  });

  assert.match(hd.dose, /after each HD cycle/);
  assert.equal(capd.interval, "single dose immediately");
  assert.equal(esrd.reviewLevel, "manual-review");
  assert.equal(esrd.dose, "Not recommended");
});

test("rivaroxaban indication-specific rows do not collapse into one generic dose", () => {
  const nvaf = findCuratedRenalDoseGuidance({
    drugQuery: "rivaroxaban",
    normalizedDrug: { searchTerm: "rivaroxaban" },
    crcl: 44,
    egfr: 40,
    route: "ORAL",
    dialysis: "none",
    indication: "nvaf",
  });
  const dvtInitial = findCuratedRenalDoseGuidance({
    drugQuery: "rivaroxaban",
    normalizedDrug: { searchTerm: "rivaroxaban" },
    crcl: 44,
    egfr: 40,
    route: "ORAL",
    dialysis: "none",
    indication: "dvt-pe-initial",
  });

  assert.equal(nvaf.dose, "15 mg");
  assert.match(nvaf.interval, /evening meal/);
  assert.equal(dvtInitial.dose, "15 mg");
  assert.match(dvtInitial.interval, /twice daily/);
});

test("drug options expose only useful structured selectors", () => {
  const options = getCuratedDrugOptions({
    drugQuery: "piptaz",
    normalizedDrug: { searchTerm: "piperacillin and tazobactam" },
    route: "ALL",
  });

  assert.equal(options.dialysis.length, 3);
  assert.equal(options.indications.length, 2);
  assert.equal(options.formulations.length, 0);
});

test("acyclovir IV route uses the injection record, not oral regimen rows", () => {
  const guidance = findCuratedRenalDoseGuidance({
    drugQuery: "acyclovir iv",
    normalizedDrug: { searchTerm: "acyclovir iv", displayName: "Acyclovir IV" },
    crcl: 44,
    egfr: 40,
    route: "IV",
  });

  assert.equal(guidance.drugName, "Acyclovir sodium");
  assert.equal(guidance.routeLabel, "IV");
  assert.equal(guidance.dose, "100% of recommended dose");
  assert.equal(guidance.interval, "every 12 hours");
});

test("valacyclovir indication selector keeps zoster separate from cold sore dosing", () => {
  const zoster = findCuratedRenalDoseGuidance({
    drugQuery: "valacyclovir",
    normalizedDrug: { searchTerm: "valacyclovir" },
    crcl: 24,
    egfr: 24,
    route: "ORAL",
    dialysis: "none",
    indication: "zoster",
  });
  const coldSores = findCuratedRenalDoseGuidance({
    drugQuery: "valacyclovir",
    normalizedDrug: { searchTerm: "valacyclovir" },
    crcl: 24,
    egfr: 24,
    route: "ORAL",
    dialysis: "none",
    indication: "cold-sores",
  });

  assert.equal(zoster.dose, "1 g");
  assert.equal(zoster.interval, "every 24 hours");
  assert.equal(coldSores.dose, "500 mg twice in 1 day");
  assert.equal(coldSores.interval, "12 hours apart");
});

test("famciclovir hemodialysis context returns post-dialysis regimen", () => {
  const guidance = findCuratedRenalDoseGuidance({
    drugQuery: "famciclovir",
    normalizedDrug: { searchTerm: "famciclovir" },
    crcl: 12,
    egfr: 12,
    route: "ORAL",
    dialysis: "hd",
    indication: "zoster",
  });

  assert.equal(guidance.dose, "250 mg");
  assert.equal(guidance.interval, "following each dialysis");
});

test("ciprofloxacin dialysis row does not collapse into severe non-dialysis interval", () => {
  const severe = findCuratedRenalDoseGuidance({
    drugQuery: "cipro",
    normalizedDrug: { searchTerm: "ciprofloxacin" },
    crcl: 12,
    egfr: 12,
    route: "ORAL",
    dialysis: "none",
  });
  const hd = findCuratedRenalDoseGuidance({
    drugQuery: "cipro",
    normalizedDrug: { searchTerm: "ciprofloxacin" },
    crcl: 12,
    egfr: 12,
    route: "ORAL",
    dialysis: "hd",
  });

  assert.equal(severe.interval, "every 18 hours");
  assert.equal(hd.interval, "every 24 hours after dialysis");
});

test("expanded structured drugs return clean context-specific lines", () => {
  const amoxClavHd = findCuratedRenalDoseGuidance({
    drugQuery: "augmentin",
    normalizedDrug: { searchTerm: "amoxicillin clavulanate" },
    crcl: 8,
    egfr: 8,
    route: "ORAL",
    dialysis: "hd",
  });
  const cefpodoximeHd = findCuratedRenalDoseGuidance({
    drugQuery: "cefpodoxime",
    normalizedDrug: { searchTerm: "cefpodoxime" },
    crcl: 18,
    egfr: 18,
    route: "ORAL",
    dialysis: "hd",
  });
  const pregabalinHd = findCuratedRenalDoseGuidance({
    drugQuery: "pregabalin",
    normalizedDrug: { searchTerm: "pregabalin" },
    crcl: 18,
    egfr: 18,
    route: "ORAL",
    dialysis: "hd",
  });
  const levetiracetamHd = findCuratedRenalDoseGuidance({
    drugQuery: "levetiracetam",
    normalizedDrug: { searchTerm: "levetiracetam" },
    crcl: 18,
    egfr: 18,
    route: "ALL",
    dialysis: "hd",
  });

  assert.match(amoxClavHd.recommendation, /extra doses during and after HD/i);
  assert.equal(cefpodoximeHd.interval, "3 times/week after HD");
  assert.equal(pregabalinHd.reviewLevel, "source-summary");
  assert.match(levetiracetamHd.recommendation, /supplement after dialysis/i);
});

test("anticoagulant structured selectors avoid generic collapsed doses", () => {
  const apixabanReduced = findCuratedRenalDoseGuidance({
    drugQuery: "apixaban",
    normalizedDrug: { searchTerm: "apixaban" },
    crcl: 44,
    egfr: 40,
    route: "ORAL",
    dialysis: "none",
    indication: "nvaf-reduced",
  });
  const edoxabanHighCrcl = findCuratedRenalDoseGuidance({
    drugQuery: "edoxaban",
    normalizedDrug: { searchTerm: "edoxaban" },
    crcl: 110,
    egfr: 100,
    route: "ORAL",
    indication: "nvaf",
  });
  const fondaparinuxContraindicated = findCuratedRenalDoseGuidance({
    drugQuery: "fondaparinux",
    normalizedDrug: { searchTerm: "fondaparinux" },
    crcl: 24,
    egfr: 24,
    route: "ALL",
  });

  assert.equal(apixabanReduced.dose, "2.5 mg");
  assert.match(edoxabanHighCrcl.dose, /Do not use/i);
  assert.equal(edoxabanHighCrcl.reviewLevel, "manual-review");
  assert.match(fondaparinuxContraindicated.dose, /Do not use/i);
});

test("new general medicine structured rules expose clean outputs", () => {
  const famotidine = findCuratedRenalDoseGuidance({
    drugQuery: "famotidine",
    normalizedDrug: { searchTerm: "famotidine" },
    crcl: 22,
    egfr: 22,
    route: "ORAL",
    indication: "gerd",
  });
  const apremilast = findCuratedRenalDoseGuidance({
    drugQuery: "apremilast",
    normalizedDrug: { searchTerm: "apremilast" },
    crcl: 22,
    egfr: 22,
    route: "ORAL",
  });
  const atogepant = findCuratedRenalDoseGuidance({
    drugQuery: "atogepant",
    normalizedDrug: { searchTerm: "atogepant" },
    crcl: 22,
    egfr: 22,
    route: "ORAL",
    indication: "chronic-migraine",
  });

  assert.equal(famotidine.dose, "20 mg");
  assert.match(famotidine.interval, /every other day/);
  assert.equal(apremilast.interval, "once daily after AM-only titration");
  assert.equal(atogepant.reviewLevel, "manual-review");
  assert.equal(atogepant.dose, "Not recommended");
});
