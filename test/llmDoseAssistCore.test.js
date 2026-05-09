import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AI_SOURCE_TEXT_LIMIT,
  buildAssistGuidance,
  buildLlmDosePrompt,
  parseAndValidateAssistResponse,
  validateAssistResponse,
} from "../src/llmDoseAssistCore.js";
import { buildAssistPayload as buildClientAssistPayload, normalizeAssistPayload } from "../src/llmDoseAssist.js";
import {
  buildOpenFdaSearches,
  buildMissingLabelSpecialResult,
  buildSpecialDrugResult,
  lookupDrugLabel,
} from "../functions/api/renal-dose/assist.js";
import { extractDoseRows } from "../src/doseGuidance.js";

const sourceText =
  "Recommended dosage schedule for adult patients with renal impairment. Creatinine Clearance 26 to 50 mL/min: 1 g every 12 hours. No dosage adjustment is recommended in mild renal impairment.";

test("LLM validator accepts supported clean dose JSON", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Examplemab",
      route: "IV",
      renalMetricUsed: "crcl",
      renalBand: "CrCl 26-50 mL/min",
      dose: "1 g",
      frequency: "every 12 hours",
      dialysisNote: "",
      importantCautions: [],
      sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test",
    },
    sourceText
  );

  assert.equal(result.status, "dose_found");
  assert.equal(result.dose, "1 g");
  assert.equal(result.frequency, "every 12 hours");
});

test("LLM validator flags unsupported AI dose but keeps usable output", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Examplemab",
      route: "IV",
      renalMetricUsed: "crcl",
      renalBand: "CrCl 26-50 mL/min",
      dose: "750 mg",
      frequency: "every 8 hours",
      dialysisNote: "",
      importantCautions: [],
      sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test",
    },
    sourceText
  );

  assert.equal(result.status, "dose_found");
  assert.equal(result.dose, "750 mg");
  assert.match(result.importantCautions.join(" "), /verify DailyMed/i);
});

test("LLM validator rejects dose when AI renal band does not include calculated CrCl", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Piperacillin and Tazobactam",
      route: "IV",
      renalMetricUsed: "crcl",
      renalBand: "20 to 40 mL/min",
      dose: "2.25 g",
      frequency: "every 6 hours",
      dialysisNote: "",
      importantCautions: [],
      sourceUrl: "https://wrong.example/ai-hallucinated-source",
    },
    "Creatinine clearance Greater than 40 mL/min 3.375 every 6 hours 20 to 40 mL/min 2.25 every 6 hours",
    {
      crcl: 44,
      sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=real",
      sourceSetId: "real",
    }
  );

  assert.equal(result.status, "review_source");
  assert.equal(result.sourceUrl, "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=real");
  assert.match(result.frequency, /renal band did not match/i);
});

test("LLM validator compares eGFR bands against eGFR instead of CrCl", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Sitagliptin",
      route: "Oral",
      renalMetricUsed: "egfr",
      renalBand: "eGFR 30-44 mL/min/1.73 m2",
      dose: "50 mg",
      frequency: "once daily",
      dialysisNote: "",
      importantCautions: [],
    },
    "For eGFR 30 to less than 45 mL/min/1.73 m2, the dose is 50 mg once daily.",
    { crcl: 62, egfr: 38 }
  );

  assert.equal(result.status, "dose_found");
});

test("LLM validator rejects eGFR band mismatch using eGFR value", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Metformin",
      route: "Oral",
      renalMetricUsed: "egfr",
      renalBand: "eGFR 30-44 mL/min/1.73 m2",
      dose: "500 mg",
      frequency: "twice daily",
      dialysisNote: "",
      importantCautions: [],
    },
    "eGFR 30 to 44 mL/min/1.73 m2 500 mg twice daily",
    { crcl: 38, egfr: 59 }
  );

  assert.equal(result.status, "review_source");
  assert.match(result.frequency, /calculated eGFR/i);
});

test("LLM validator rejects compact eGFR 30-<45 bands when eGFR is above band", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Metformin",
      route: "Oral",
      renalMetricUsed: "egfr",
      renalBand: "eGFR 30-<45",
      dose: "1000 mg",
      frequency: "twice daily",
      dialysisNote: "",
      importantCautions: [],
    },
    "eGFR 30-<45 1000 mg twice daily",
    { crcl: 64, egfr: 58 }
  );

  assert.equal(result.status, "review_source");
});

test("LLM validator accepts greater-than renal band for calculated CrCl", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Piperacillin and Tazobactam",
      route: "IV",
      renalMetricUsed: "crcl",
      renalBand: "Greater than 40 mL/min",
      dose: "3.375 g",
      frequency: "every 6 hours",
      dialysisNote: "",
      importantCautions: [],
    },
    "Creatinine clearance Greater than 40 mL/min 3.375 g every 6 hours",
    { crcl: 44 }
  );

  assert.equal(result.status, "dose_found");
});

test("LLM validator rejects unresolved recommended-dose wording", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Meropenem",
      route: "IV",
      renalMetricUsed: "crcl",
      renalBand: "CrCl 26-50 mL/min",
      dose: "Recommended dose",
      frequency: "every 12 hours",
      dialysisNote: "",
      importantCautions: [],
    },
    "CrCl 26 to 50 Recommended dose every 12 hours",
    { crcl: 44 }
  );

  assert.equal(result.status, "review_source");
  assert.match(result.frequency, /not specific enough/i);
});

test("LLM validator accepts percent-of-usual-dose interval adjustments", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Acyclovir",
      route: "IV",
      renalMetricUsed: "crcl",
      renalBand: "CrCl 25-50 mL/min",
      dose: "100% of usual dose by indication",
      frequency: "every 12 hours",
      dialysisNote: "",
      importantCautions: [],
    },
    "CrCl 25 to 50 mL/min 100% of usual dose every 12 hours",
    { crcl: 44, trustSourceEvidence: true }
  );

  assert.equal(result.status, "dose_found");
  assert.equal(result.dose, "100% of usual dose by indication");
});

test("LLM validator accepts source-supported renal action wording", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Metformin",
      route: "Oral",
      renalMetricUsed: "egfr",
      renalBand: "eGFR 30-44",
      dose: "Do not initiate",
      frequency: "If already taking, assess benefit/risk of continuation.",
      dialysisNote: "",
      importantCautions: [],
    },
    "eGFR between 30 and 45 mL/min/1.73 m2: initiating metformin is not recommended. Assess the benefits and risks of continuing therapy.",
    { egfr: 38, trustSourceEvidence: true }
  );

  assert.equal(result.status, "dose_found");
  assert.equal(result.dose, "Do not initiate");
});

test("LLM validator accepts clean parser renal-caution action cards", () => {
  const result = validateAssistResponse(
    {
      status: "dose_found",
      drugName: "Example",
      route: "Oral",
      renalMetricUsed: "crcl",
      renalBand: "CrCl 20-40 mL/min",
      dose: "Renal caution or dose-reduction language in label",
      frequency: "Use lower dose, slower titration, or monitoring as described in source.",
      dialysisNote: "",
      importantCautions: [],
      sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test",
    },
    "Renal impairment: dosage decrease may be necessary. Monitor renal function.",
    { crcl: 28, trustSourceEvidence: true }
  );

  assert.equal(result.status, "dose_found");
  assert.match(result.dose, /Renal caution/i);
});

test("LLM validator strips raw internal status tokens from model fields", () => {
  const review = validateAssistResponse(
    {
      status: "review_source",
      drugName: "Acyclovir",
      route: "IV",
      renalMetricUsed: "crcl",
      renalBand: "review_source",
      dose: "review_source",
      frequency: "review_source",
      dialysisNote: "review_source",
      importantCautions: ["no_renal_adjustment"],
    },
    sourceText,
    { crcl: 44, renalBand: "CrCl 44.0 mL/min" }
  );
  const noAdjustment = validateAssistResponse(
    {
      status: "no_renal_adjustment",
      drugName: "Doxycycline",
      route: "Oral",
      renalMetricUsed: "crcl",
      renalBand: "no_renal_adjustment",
      dose: "no_renal_adjustment",
      frequency: "no_renal_adjustment",
      dialysisNote: "no_renal_adjustment",
      importantCautions: [],
    },
    "No dose adjustment is recommended.",
    { crcl: 82.5, renalBand: "CrCl 82.5 mL/min" }
  );

  assert.equal(review.renalBand, "CrCl 44.0 mL/min");
  assert.equal(review.dose, "Review DailyMed source");
  assert.equal(review.frequency, "Source review required");
  assert.equal(review.dialysisNote, "");
  assert.deepEqual(review.importantCautions, []);
  assert.equal(noAdjustment.renalBand, "CrCl 82.5 mL/min");
  assert.match(noAdjustment.dose, /No renal dose adjustment/i);
  assert.equal(noAdjustment.dialysisNote, "");
});

test("LLM validator handles no-adjustment and invalid JSON paths", () => {
  const noAdjustment = validateAssistResponse(
    {
      status: "no_renal_adjustment",
      drugName: "Examplemab",
      route: "Oral",
      renalMetricUsed: "crcl",
      renalBand: "CrCl 44 mL/min",
      dose: "",
      frequency: "",
      dialysisNote: "",
      importantCautions: [],
    },
    sourceText
  );
  const invalidJson = parseAndValidateAssistResponse("not json", sourceText, {
    drugName: "Examplemab",
    route: "Oral",
  });

  assert.equal(noAdjustment.status, "no_renal_adjustment");
  assert.match(noAdjustment.dose, /No renal dose adjustment/i);
  assert.equal(invalidJson.status, "review_source");
});

test("assist guidance maps statuses to AI dose card labels", () => {
  const guidance = buildAssistGuidance(
    {
      status: "dose_found",
      drugName: "Examplemab",
      route: "IV",
      renalMetricUsed: "crcl",
      renalBand: "CrCl 26-50 mL/min",
      dose: "1 g",
      frequency: "every 12 hours",
      importantCautions: [],
    },
    { crcl: 44, route: "IV" }
  );

  assert.equal(guidance.status, "ai_assisted_matched");
  assert.equal(guidance.badge, "AI-assisted DailyMed summary");
  assert.match(guidance.caveat, /AI-assisted output may be wrong/i);
});

test("LLM client payload keeps patient and renal context for backend", () => {
  const payload = buildClientAssistPayload({
    drug: "piptaz",
    route: "IV",
    crcl: 44,
    egfr: 38.8,
    age: 45,
    sex: "male",
    weight: 70,
    height: 170,
    normalizedDrug: { searchTerm: "piperacillin and tazobactam" },
  });

  assert.equal(payload.drug, "piptaz");
  assert.equal(payload.route, "IV");
  assert.equal(payload.crcl, 44);
  assert.equal(payload.normalizedDrug.searchTerm, "piperacillin and tazobactam");
});

test("LLM client trusts backend DailyMed parser result for percent dosing", () => {
  const assist = normalizeAssistPayload(
    {
      sourceMode: "dailymed-table-parser",
      sourceText: "Creatinine Clearance <=50 mL/min Recommended Dose 50",
      result: {
        status: "dose_found",
        drugName: "Fluconazole",
        route: "Oral",
        renalMetricUsed: "crcl",
        renalBand: "CrCl <= 50 mL/min",
        dose: "50% of usual daily dose after loading dose",
        frequency: "daily dose by indication",
        dialysisNote: "",
        importantCautions: [],
        sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fluconazole",
      },
    },
    { drug: "fluconazole", route: "ORAL", crcl: 31, egfr: 35 }
  );

  assert.equal(assist.result.status, "dose_found");
  assert.equal(assist.guidance.reviewLevel, "clean-dose");
  assert.match(assist.guidance.badge, /DailyMed renal table/i);
});

test("LLM prompt includes renal values and source text only in user payload", () => {
  const prompt = buildLlmDosePrompt({
    patient: {
      drug: "Examplemab",
      crcl: 44,
      egfr: 38.8,
      route: "IV",
    },
    label: {
      sections: [
        {
          heading: "Dosage And Administration",
          fullText: sourceText,
        },
      ],
    },
  });

  assert.equal(prompt.messages.length, 2);
  assert.match(prompt.messages[0].content, /Do not use memory/i);
  assert.match(prompt.messages[1].content, /\"crcl\": 44/);
  assert.match(prompt.messages[1].content, /1 g every 12 hours/);
});

test("LLM prompt uses compact renal snippets instead of whole labels", () => {
  const longNonRenalText = "Background ".repeat(3000);
  const prompt = buildLlmDosePrompt({
    patient: {
      drug: "Examplemab",
      crcl: 44,
      egfr: 38.8,
      route: "IV",
    },
    label: {
      sections: [
        {
          heading: "Dosage And Administration",
          hasRenalKeyword: true,
          fullText: `${longNonRenalText} ${sourceText}`,
          text: sourceText,
        },
      ],
    },
  });

  assert.ok(prompt.sourceText.length <= AI_SOURCE_TEXT_LIMIT);
  assert.match(prompt.sourceText, /1 g every 12 hours/);
  assert.doesNotMatch(prompt.sourceText, /Background Background Background/);
});

test("client preserves backend free-mode metadata for the UI", () => {
  const normalized = normalizeAssistPayload(
    {
      result: {
        status: "review_source",
        drugName: "Examplemab",
        route: "IV",
        renalMetricUsed: "crcl",
        renalBand: "CrCl 44.0 mL/min",
        dose: "Review DailyMed source",
        frequency: "Free AI daily request guard reached.",
        dialysisNote: "",
        importantCautions: [],
        sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test",
      },
      sourceMode: "free-quota-guard",
      freeModeRemaining: 0,
    },
    { drug: "Examplemab", crcl: 44, route: "IV" }
  );

  assert.equal(normalized.sourceMode, "free-quota-guard");
  assert.equal(normalized.freeModeRemaining, 0);
  assert.equal(normalized.guidance.reviewLevel, "manual-review");
});

test("backend openFDA search filters human prescription labels", () => {
  const searches = buildOpenFdaSearches("meropenem");

  assert.ok(searches.length >= 1);
  assert.match(searches[0], /HUMAN PRESCRIPTION DRUG/);
  assert.match(searches[0], /openfda\.generic_name/);
});

test("backend openFDA search prioritizes explicit IV route when selected", () => {
  const searches = buildOpenFdaSearches("levofloxacin", "IV");

  assert.match(searches[0], /openfda\.route:"INTRAVENOUS"/);
  assert.match(searches[0], /openfda\.generic_name/);
});

test("backend openFDA search retries without dosage-form qualifiers", () => {
  const searches = buildOpenFdaSearches("acyclovir injection", "IV");
  const strippedRouteIndex = searches.findIndex((search) =>
    search.includes('openfda.generic_name:"acyclovir"') && search.includes('openfda.route:"INTRAVENOUS"')
  );
  const originalUnroutedIndex = searches.findIndex((search) =>
    search.includes('openfda.generic_name:"acyclovir injection"') && !search.includes("openfda.route")
  );

  assert.ok(searches.some((search) => search.includes('openfda.generic_name:"acyclovir"')));
  assert.ok(strippedRouteIndex >= 0);
  assert.ok(originalUnroutedIndex >= 0);
  assert.ok(strippedRouteIndex < originalUnroutedIndex);
  assert.ok(searches.some((search) => /HUMAN OTC DRUG/.test(search)));
});

test("backend route lookup can find IV label before oral labels for same drug", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes('openfda.route%3A%22INTRAVENOUS%22')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              dosage_and_administration: ["Levofloxacin injection renal adjustment text."],
              openfda: {
                product_type: ["HUMAN PRESCRIPTION DRUG"],
                route: ["INTRAVENOUS"],
                generic_name: ["LEVOFLOXACIN"],
                brand_name: ["Levofloxacin"],
                spl_set_id: ["levofloxacin-iv-set"],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        results: [
          {
            openfda: {
              product_type: ["HUMAN PRESCRIPTION DRUG"],
              route: ["ORAL"],
              generic_name: ["LEVOFLOXACIN"],
              brand_name: ["Levofloxacin"],
              spl_set_id: ["levofloxacin-oral-set"],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const label = await lookupDrugLabel({ drug: "levofloxacin", route: "IV" });
    assert.equal(label.status, "found");
    assert.equal(label.route, "IV");
    assert.equal(label.sourceUrl, "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=levofloxacin-iv-set");
    assert.match(requestedUrls[0], /openfda\.route%3A%22INTRAVENOUS%22/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backend route lookup keeps searching after wrong-route results", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes('openfda.generic_name%3A%22fludarabine%22') && String(url).includes('openfda.route%3A%22ORAL%22')) {
      return new Response(
        JSON.stringify({
          results: [
            {
              dosage_and_administration: ["Fludarabine tablet renal impairment text."],
              openfda: {
                product_type: ["HUMAN PRESCRIPTION DRUG"],
                route: ["ORAL"],
                generic_name: ["FLUDARABINE PHOSPHATE"],
                brand_name: ["Fludarabine Phosphate Tablets"],
                dosage_form: ["TABLET"],
                spl_set_id: ["fludarabine-oral-set"],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (String(url).includes("fludarabine")) {
      return new Response(
        JSON.stringify({
          results: [
            {
              openfda: {
                product_type: ["HUMAN PRESCRIPTION DRUG"],
                route: ["INTRAVENOUS"],
                generic_name: ["FLUDARABINE PHOSPHATE"],
                brand_name: ["Fludarabine Phosphate Injection"],
                spl_set_id: ["fludarabine-iv-set"],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ results: [] }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const label = await lookupDrugLabel({ drug: "fludarabine tablets", route: "ORAL" });
    assert.equal(label.status, "found");
    assert.equal(label.route, "ORAL");
    assert.equal(label.sourceUrl, "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fludarabine-oral-set");
    assert.ok(requestedUrls.length >= 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backend missing-label fallback covers oral fludarabine tablets", () => {
  const fallback = buildMissingLabelSpecialResult({
    drug: "fludarabine tablets",
    route: "ORAL",
    crcl: 26.4,
    normalizedDrug: {
      searchTerm: "fludarabine tablets",
      displayName: "Fludarabine phosphate tablets",
    },
  });

  assert.ok(fallback);
  assert.equal(fallback.result.status, "dose_found");
  assert.equal(fallback.result.route, "Oral");
  assert.equal(fallback.result.renalBand, "CrCl < 30 mL/min/1.73 m2");
  assert.match(fallback.result.dose, /50%/);
  assert.equal(fallback.label.setId, "ac76aca8-e718-4232-92ab-399166ce9e46");
  assert.match(fallback.sourceText, /Oral dose is different than intravenous dose/i);
});

test("backend label ranking prefers single-ingredient label over combination product", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            dosage_and_administration: ["Combination product label."],
            openfda: {
              product_type: ["HUMAN PRESCRIPTION DRUG"],
              route: ["ORAL"],
              generic_name: ["EMPAGLIFLOZIN, LINAGLIPTIN, AND METFORMIN HYDROCHLORIDE"],
              brand_name: ["TRIJARDY XR"],
              substance_name: ["EMPAGLIFLOZIN", "LINAGLIPTIN", "METFORMIN HYDROCHLORIDE"],
              spl_set_id: ["combo-set"],
            },
          },
          {
            dosage_and_administration: ["Empagliflozin single ingredient label."],
            openfda: {
              product_type: ["HUMAN PRESCRIPTION DRUG"],
              route: ["ORAL"],
              generic_name: ["EMPAGLIFLOZIN"],
              brand_name: ["JARDIANCE"],
              substance_name: ["EMPAGLIFLOZIN"],
              spl_set_id: ["mono-set"],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    const label = await lookupDrugLabel({ drug: "empagliflozin", route: "ORAL" });
    assert.equal(label.status, "found");
    assert.equal(label.title, "JARDIANCE");
    assert.equal(label.sourceUrl, "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=mono-set");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backend label ranking prefers morphine sulfate over opium products containing morphine", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            dosage_and_administration: ["Opium tincture label."],
            openfda: {
              product_type: ["HUMAN PRESCRIPTION DRUG"],
              route: ["ORAL"],
              generic_name: ["OPIUM TINCTURE"],
              brand_name: ["Opium Tincture Deodorized"],
              substance_name: ["MORPHINE"],
              spl_set_id: ["opium-set"],
            },
          },
          {
            dosage_and_administration: ["Morphine sulfate label."],
            openfda: {
              product_type: ["HUMAN PRESCRIPTION DRUG"],
              route: ["ORAL"],
              generic_name: ["MORPHINE SULFATE"],
              brand_name: ["Morphine"],
              substance_name: ["MORPHINE"],
              spl_set_id: ["morphine-set"],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    const label = await lookupDrugLabel({ drug: "morphine", route: "ORAL" });
    assert.equal(label.status, "found");
    assert.equal(label.title, "Morphine");
    assert.equal(label.sourceUrl, "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=morphine-set");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backend route lookup can use human OTC DailyMed labels as fallback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("HUMAN%20PRESCRIPTION%20DRUG")) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        results: [
          {
            dosage_and_administration: ["Fexofenadine renal impairment text."],
            openfda: {
              product_type: ["HUMAN OTC DRUG"],
              route: ["ORAL"],
              generic_name: ["FEXOFENADINE HYDROCHLORIDE"],
              brand_name: ["Fexofenadine"],
              spl_set_id: ["fexofenadine-otc-set"],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const label = await lookupDrugLabel({ drug: "fexofenadine", route: "ORAL" });
    assert.equal(label.status, "found");
    assert.equal(label.productType, "HUMAN OTC DRUG");
    assert.equal(label.sourceUrl, "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fexofenadine-otc-set");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backend route lookup does not fallback to another route for explicit route", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            openfda: {
              product_type: ["HUMAN PRESCRIPTION DRUG"],
              route: ["INTRAVENOUS"],
              generic_name: ["MEROPENEM"],
              brand_name: ["MEROPENEM"],
              spl_set_id: ["meropenem-set"],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    const label = await lookupDrugLabel({ drug: "meropenem", route: "ORAL" });
    assert.equal(label.status, "route_not_found");
    assert.match(label.message, /No oral/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backend special handler expands meropenem renal bands to concrete doses", () => {
  const label = {
    title: "Meropenem",
    genericName: "meropenem",
    setId: "meropenem-set",
    sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=meropenem-set",
  };

  const moderate = buildSpecialDrugResult({
    label,
    patient: { drug: "meropenem", route: "IV", crcl: 44 },
  });
  const severe = buildSpecialDrugResult({
    label,
    patient: { drug: "meropenem", route: "IV", crcl: 20 },
  });
  const verySevere = buildSpecialDrugResult({
    label,
    patient: { drug: "meropenem", route: "IV", crcl: 8 },
  });

  assert.equal(moderate.status, "dose_found");
  assert.match(moderate.dose, /500 mg/);
  assert.match(moderate.dose, /1 g/);
  assert.equal(moderate.frequency, "every 12 hours");
  assert.match(severe.dose, /250 mg/);
  assert.match(severe.dose, /500 mg/);
  assert.equal(severe.frequency, "every 12 hours");
  assert.equal(verySevere.frequency, "every 24 hours");
});

test("backend special handler expands piperacillin-tazobactam aliases to concrete doses", () => {
  const result = buildSpecialDrugResult({
    label: {
      title: "Piperacillin and Tazobactam",
      genericName: "piperacillin sodium and tazobactam sodium",
      sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=piptaz",
    },
    patient: {
      drug: "piperacillin tazobactam",
      route: "IV",
      crcl: 15.9,
    },
  });

  assert.equal(result.status, "dose_found");
  assert.equal(result.renalBand, "CrCl < 20 mL/min");
  assert.equal(result.dose, "2.25 g");
  assert.match(result.frequency, /every 8 hours/);
});

test("backend special handler returns clean levofloxacin renal options for IV or oral labels", () => {
  const label = {
    title: "Levofloxacin",
    genericName: "levofloxacin",
    setId: "levofloxacin-set",
    sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=levofloxacin-set",
  };

  const moderate = buildSpecialDrugResult({
    label,
    patient: { drug: "levofloxacin", route: "IV", crcl: 34 },
  });
  const severe = buildSpecialDrugResult({
    label,
    patient: { drug: "levofloxacin", route: "ORAL", crcl: 15 },
  });

  assert.equal(moderate.status, "dose_found");
  assert.equal(moderate.renalBand, "CrCl 20-49 mL/min");
  assert.match(moderate.dose, /750 mg q48h/);
  assert.match(moderate.dose, /500 mg once then 250 mg q24h/);
  assert.equal(severe.renalBand, "CrCl 10-19 mL/min");
  assert.match(severe.dose, /250 mg q48h/);
});

test("backend special handlers cover common QA renal band failures", () => {
  const sourceUrl = "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test";

  const cipro = buildSpecialDrugResult({
    label: { title: "Ciprofloxacin", genericName: "ciprofloxacin", sourceUrl },
    patient: { drug: "ciprofloxacin", route: "IV", crcl: 30.8 },
  });
  const oseltamivir = buildSpecialDrugResult({
    label: { title: "Tamiflu", genericName: "oseltamivir", sourceUrl },
    patient: { drug: "oseltamivir", route: "ORAL", crcl: 24.3 },
  });
  const tmpSmx = buildSpecialDrugResult({
    label: { title: "Sulfamethoxazole and trimethoprim", genericName: "sulfamethoxazole and trimethoprim", sourceUrl },
    patient: { drug: "bactrim", route: "ORAL", crcl: 35.5 },
  });
  const famotidine = buildSpecialDrugResult({
    label: { title: "Famotidine", genericName: "famotidine", sourceUrl },
    patient: { drug: "famotidine", route: "ORAL", crcl: 29.2 },
  });
  const digoxin = buildSpecialDrugResult({
    label: { title: "Digoxin", genericName: "digoxin", sourceUrl },
    patient: { drug: "digoxin", route: "ORAL", crcl: 35.9 },
  });
  const levetiracetam = buildSpecialDrugResult({
    label: { title: "Levetiracetam", genericName: "levetiracetam", sourceUrl },
    patient: { drug: "levetiracetam", route: "ORAL", crcl: 28.1 },
  });
  const topiramate = buildSpecialDrugResult({
    label: { title: "Topiramate", genericName: "topiramate", sourceUrl },
    patient: { drug: "topiramate", route: "ORAL", crcl: 34.9 },
  });
  const lisinopril = buildSpecialDrugResult({
    label: { title: "Lisinopril", genericName: "lisinopril", sourceUrl },
    patient: { drug: "lisinopril", route: "ORAL", crcl: 61.8 },
  });
  const tadalafil = buildSpecialDrugResult({
    label: { title: "Tadalafil", genericName: "tadalafil", sourceUrl },
    patient: { drug: "tadalafil", route: "ORAL", crcl: 64.4 },
  });
  const oxcarbazepine = buildSpecialDrugResult({
    label: { title: "Oxcarbazepine", genericName: "oxcarbazepine", sourceUrl },
    patient: { drug: "oxcarbazepine", route: "ORAL", crcl: 15.9 },
  });
  const lovastatin = buildSpecialDrugResult({
    label: { title: "Lovastatin", genericName: "lovastatin", sourceUrl },
    patient: { drug: "lovastatin", route: "ORAL", crcl: 32.7 },
  });

  assert.equal(cipro.status, "no_renal_adjustment");
  assert.equal(cipro.renalBand, "CrCl > 30 mL/min");
  assert.equal(oseltamivir.renalBand, "CrCl > 10-30 mL/min");
  assert.match(oseltamivir.frequency, /once daily/i);
  assert.equal(tmpSmx.status, "no_renal_adjustment");
  assert.equal(famotidine.renalBand, "CrCl < 30 mL/min");
  assert.match(famotidine.dose, /reduce/i);
  assert.equal(digoxin.status, "review_source");
  assert.match(digoxin.dose, /level-based/i);
  assert.equal(levetiracetam.status, "dose_found");
  assert.match(levetiracetam.dose, /250-500 mg/);
  assert.equal(topiramate.status, "dose_found");
  assert.match(topiramate.dose, /50% of usual dose/i);
  assert.equal(lisinopril.status, "no_renal_adjustment");
  assert.match(lisinopril.frequency, /usual adult initial dose/i);
  assert.equal(tadalafil.status, "no_renal_adjustment");
  assert.match(tadalafil.frequency, /product/i);
  assert.equal(oxcarbazepine.status, "dose_found");
  assert.equal(oxcarbazepine.dose, "300 mg/day");
  assert.equal(lovastatin.status, "no_renal_adjustment");
});

test("backend special handlers cover 30-case antibiotic QA warnings", () => {
  const sourceUrl = "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test";
  const cases = [
    ["amoxicillin", "Amoxicillin", 114.4, /No renal dose adjustment/i, /usual adult/i],
    ["cefazolin", "Cefazolin", 31.5, /50% of usual dose/i, /every 12 hours/i],
    ["ampicillin sulbactam", "Ampicillin and sulbactam", 61.8, /1\.5-3 g/i, /every 6 to 8 hours/i],
    ["cefuroxime axetil", "Cefuroxime Axetil", 28.1, /100% of usual individual oral dose/i, /every 24 hours/i],
    ["ceftriaxone", "Ceftriaxone", 15.9, /No renal dose adjustment/i, /usual adult/i],
    ["cefpodoxime", "Cefpodoxime Proxetil", 128.6, /No renal dose adjustment/i, /usual adult/i],
    ["cefixime", "Cefixime", 94.8, /No renal dose adjustment/i, /usual adult/i],
    ["cefprozil", "Cefprozil", 29.5, /50% of standard/i, /standard interval/i],
    ["cefotetan", "Cefotetan", 32.7, /1-2 g/i, /every 12 hours/i],
    ["ceftolozane tazobactam", "Ceftolozane and tazobactam", 114.4, /1\.5 g.*3 g/i, /every 8 hours/i],
    ["ceftazidime avibactam", "Ceftazidime and avibactam", 64.4, /2\.5 g IV/i, /every 8 hours/i],
    ["cefiderocol", "Fetroja", 61.8, /2 g IV/i, /every 8 hours/i],
    ["aztreonam", "Aztreonam", 31.5, /No renal dose adjustment/i, /usual adult/i],
    ["imipenem cilastatin", "Imipenem and cilastatin", 28.1, /200 mg q6h/i, /susceptibility/i],
    ["moxifloxacin", "Moxifloxacin", 16.7, /No renal dose adjustment/i, /usual adult/i],
  ];

  for (const [drug, title, crcl, dosePattern, frequencyPattern] of cases) {
    const result = buildSpecialDrugResult({
      label: { title, genericName: drug, sourceUrl },
      patient: { drug, route: drug.includes("cefuroxime axetil") || drug.includes("cefpodoxime") || drug.includes("cefixime") || drug.includes("cefprozil") || drug.includes("moxifloxacin") ? "ORAL" : "IV", crcl },
    });
    assert.ok(result, `${drug} should return a deterministic result`);
    assert.notEqual(result.status, "review_source", `${drug} should avoid source-review fallback`);
    assert.match(result.dose, dosePattern, drug);
    assert.match(result.frequency, frequencyPattern, drug);
    assert.doesNotMatch(`${result.dose} ${result.frequency}`, /recommended dose|review_source|dose_found|no_renal_adjustment/i);
  }
});

test("backend special handlers avoid raw review tokens for no-adjustment drugs", () => {
  const sourceUrl = "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test";
  const doxy = buildSpecialDrugResult({
    label: { title: "Doxycycline", genericName: "doxycycline", sourceUrl },
    patient: { drug: "doxy", route: "ORAL", crcl: 82.5 },
  });
  const clindamycin = buildSpecialDrugResult({
    label: { title: "Clindamycin", genericName: "clindamycin", sourceUrl },
    patient: { drug: "clindamycin", route: "IV", crcl: 60.2 },
  });
  const azithromycin = buildSpecialDrugResult({
    label: { title: "Azithromycin", genericName: "azithromycin", sourceUrl },
    patient: { drug: "azithromycin", route: "ORAL", crcl: 112.5 },
  });
  const acyclovir = buildSpecialDrugResult({
    label: { title: "Acyclovir", genericName: "acyclovir", sourceUrl },
    patient: { drug: "acyclovir", route: "IV", crcl: 44.4 },
  });

  assert.equal(doxy.status, "no_renal_adjustment");
  assert.equal(clindamycin.status, "no_renal_adjustment");
  assert.equal(azithromycin.status, "no_renal_adjustment");
  assert.equal(acyclovir.renalBand, "CrCl 25-50 mL/min");
  assert.match(acyclovir.dose, /100% of usual dose/i);
  assert.equal(acyclovir.frequency, "every 12 hours");
  assert.doesNotMatch(`${doxy.dose} ${clindamycin.dose} ${azithromycin.dose} ${acyclovir.dose}`, /review_source|no_renal_adjustment/);
});

test("backend special handlers force review for indication-sensitive anticoagulants and morphine", () => {
  const sourceUrl = "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test";
  const rivaroxaban = buildSpecialDrugResult({
    label: { title: "Xarelto", genericName: "rivaroxaban", sourceUrl },
    patient: { drug: "rivaroxaban", route: "ORAL", crcl: 47.8 },
  });
  const dabigatran = buildSpecialDrugResult({
    label: { title: "Pradaxa", genericName: "dabigatran", sourceUrl },
    patient: { drug: "dabigatran", route: "ORAL", crcl: 35.1 },
  });
  const morphine = buildSpecialDrugResult({
    label: { title: "Morphine", genericName: "morphine sulfate", sourceUrl },
    patient: { drug: "morphine", route: "ORAL", crcl: 21.2 },
  });

  assert.equal(rivaroxaban.status, "review_source");
  assert.match(rivaroxaban.dose, /Indication-specific/i);
  assert.equal(dabigatran.status, "review_source");
  assert.match(dabigatran.dose, /P-gp/i);
  assert.equal(morphine.status, "review_source");
  assert.match(morphine.dose, /Renal impairment caution/i);
});

test("backend special handler keeps metformin logic scoped to requested metformin", () => {
  const result = buildSpecialDrugResult({
    label: {
      title: "Trijardy XR",
      genericName: "empagliflozin, linagliptin, and metformin hydrochloride",
      sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=combo",
    },
    patient: { drug: "empagliflozin", route: "ORAL", egfr: 47.5 },
  });

  assert.equal(result.renalMetricUsed, "egfr");
  assert.doesNotMatch(result.frequency, /Metformin renal guidance/i);
});

test("parser cleanup removes leading label-reference fragments", () => {
  const rows = extractDoseRows(
    "Creatinine clearance 15 to 50 ) [see Use in Specific Populations] . 15 mg once daily Take with evening meal. Creatinine clearance below 15 avoid use.",
    "Dosage And Administration"
  );

  assert.ok(rows.length >= 1);
  assert.equal(rows[0].recommendation, "15 mg once daily Take with evening meal.");
});

test("backend special handler avoids fake levofloxacin dose below CrCl 10", () => {
  const result = buildSpecialDrugResult({
    label: {
      title: "Levofloxacin",
      genericName: "levofloxacin",
      sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=levofloxacin-set",
    },
    patient: { drug: "levofloxacin", route: "IV", crcl: 8 },
  });

  assert.equal(result.status, "review_source");
  assert.match(result.dose, /dialysis-specific/i);
});

test("backend special handler returns eGFR-specific metformin actions", () => {
  const label = {
    title: "Metformin",
    genericName: "metformin hydrochloride",
    setId: "metformin-set",
    sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=metformin-set",
  };

  const normal = buildSpecialDrugResult({
    label,
    patient: { drug: "metformin", route: "ORAL", egfr: 58 },
  });
  const moderate = buildSpecialDrugResult({
    label,
    patient: { drug: "metformin", route: "ORAL", egfr: 38 },
  });
  const severe = buildSpecialDrugResult({
    label,
    patient: { drug: "metformin", route: "ORAL", egfr: 24 },
  });

  assert.equal(normal.status, "no_renal_adjustment");
  assert.match(normal.dose, /No renal dose adjustment/i);
  assert.match(normal.importantCautions.join(" "), /contrast/i);
  assert.equal(moderate.status, "dose_found");
  assert.match(moderate.dose, /Do not initiate/i);
  assert.match(moderate.frequency, /benefit\/risk/i);
  assert.equal(severe.status, "dose_found");
  assert.match(severe.dose, /Contraindicated/i);
  assert.match(severe.frequency, /Do not use/i);
});

test("app runtime does not import or call curated guidance", async () => {
  const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.doesNotMatch(appSource, /curatedDoseRules/);
  assert.doesNotMatch(appSource, /findCuratedRenalDoseGuidance/);
  assert.doesNotMatch(appSource, /getCuratedDrugOptions/);
});
