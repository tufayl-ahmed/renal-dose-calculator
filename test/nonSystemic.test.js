import test from "node:test";
import assert from "node:assert/strict";
import { lookupDrugLabel } from "../server/renalDose/openfda.js";
import { buildDoseView } from "../src/doseView.js";
import { getDrugCoverage } from "../src/drugAutocomplete.js";
import { describeNonSystemicRoutes } from "../src/data/nonSystemicRoutes.js";

function label(setId, routes, text = "Apply a thin film twice daily.", packageText = "") {
  return {
    set_id: setId,
    openfda: {
      product_type: ["HUMAN PRESCRIPTION DRUG"],
      ...(routes ? { route: routes } : {}),
      generic_name: ["EXAMPLASONE"],
      brand_name: ["Examplasone"],
      substance_name: ["EXAMPLASONE"],
    },
    dosage_and_administration: [text],
    ...(packageText ? { package_label_principal_display_panel: [packageText] } : {}),
  };
}

async function withResults(results, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const patient = {
  drug: "examplasone",
  route: "ORAL",
  crcl: 25,
  egfr: 24,
  age: 70,
  sex: "male",
  weight: 70,
  creatinine: 2.6,
  dialysis: "none",
  indication: "any",
  formulation: "any",
};

test("a drug found only in topical/eye/inhaled forms is reported as non-systemic", async () => {
  const found = await withResults([label("a", ["TOPICAL"]), label("b", ["OPHTHALMIC"]), label("c", null)], () =>
    lookupDrugLabel({ drug: "examplasone", route: "ORAL" })
  );
  assert.equal(found.status, "non_systemic");
  assert.deepEqual(found.nonSystemicRoutes.sort(), ["OPHTHALMIC", "TOPICAL"]);
});

test("'Not for oral use' on a topical package does not make it an oral product", async () => {
  const found = await withResults(
    [label("a", ["TOPICAL"], undefined, "For topical use only. Not for ophthalmic, oral, or intravaginal use.")],
    () => lookupDrugLabel({ drug: "examplasone", route: "ORAL" })
  );
  assert.equal(found.status, "non_systemic");
});

test("a drug with oral and topical forms still uses its oral label", async () => {
  const found = await withResults(
    [
      label("topical", ["TOPICAL"], undefined, "Not for oral use."),
      label("oral", ["ORAL"], "Take one tablet by mouth daily."),
    ],
    () => lookupDrugLabel({ drug: "examplasone", route: "ORAL" })
  );
  assert.equal(found.status, "found");
  assert.equal(found.setId, "oral");
});

test("transdermal and vaginal products are not treated as non-systemic", async () => {
  for (const route of ["TRANSDERMAL", "VAGINAL"]) {
    const found = await withResults([label("a", [route])], () =>
      lookupDrugLabel({ drug: "examplasone", route: "ORAL" })
    );
    assert.equal(found.status, "route_not_found", route);
  }
});

test("nasal or inhaled products made to act systemically are not 'not applicable'", async () => {
  const spravato = label("a", ["NASAL"]);
  spravato.openfda.substance_name = ["ESKETAMINE HYDROCHLORIDE"];
  const found = await withResults([spravato], () => lookupDrugLabel({ drug: "examplasone", route: "ORAL" }));
  assert.equal(found.status, "route_not_found");
});

test("non-systemic labels without kidney text are 'not applicable'; with it, the text is shown", async () => {
  const { resolveDosePayload } = await import("../server/renalDose/pipeline.js");
  const silent = await withResults([label("a", ["NASAL"])], () => resolveDosePayload({ patient, env: {} }));
  assert.equal(silent.result.status, "not_applicable");
  assert.equal(silent.sourceMode, "label-non-systemic");
  assert.equal(silent.result.route, "Nasal");
  assert.equal(silent.modelUsed, "");
  // Full label text stays on the server, as for any other label.
  assert.ok(silent.label.sections.every((section) => !("fullText" in section)));

  const advised = await withResults(
    [
      label(
        "b",
        ["RESPIRATORY (INHALATION)"],
        "Monitor patients with moderate to severe renal impairment closely for anticholinergic effects."
      ),
    ],
    () => resolveDosePayload({ patient: { ...patient, drug: "examplasone-inh" }, env: {} })
  );
  assert.equal(advised.sourceMode, "label-excerpt");
  assert.match(advised.result.dose, /Only inhaled forms found/);
  assert.match(advised.result.labelExcerpt[0], /renal impairment/);
});

test("a not-applicable result shows the 'Not applicable' decision", () => {
  const view = buildDoseView(
    {
      sourceMode: "label-non-systemic",
      result: { status: "not_applicable", drugName: "Examplasone", dose: "Kidney dosing not applicable" },
    },
    { drug: "examplasone", crcl: 25 }
  );
  assert.equal(view.decision.id, "na");
  assert.equal(view.tier.label, "Label text");
});

test("route words read naturally on the card", () => {
  assert.equal(describeNonSystemicRoutes(["NASAL", "RESPIRATORY (INHALATION)", "INHALATION"]), "nasal/inhaled");
  assert.equal(describeNonSystemicRoutes(["SOMETHING ELSE"]), "non-systemic");
});

test("autocomplete marks known non-systemic drugs 'not applicable' and keeps rule records first", () => {
  assert.equal(getDrugCoverage("Latanoprost")?.status, "not-applicable");
  assert.equal(getDrugCoverage("Fluticasone Propionate")?.status, "not-applicable");
  // Timolol has an oral record, so its eye drops do not hide it.
  assert.equal(getDrugCoverage("Timolol")?.status, "curated");
});
