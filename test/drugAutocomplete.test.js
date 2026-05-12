import test from "node:test";
import assert from "node:assert/strict";
import {
  getDrugAutocompleteSuggestions,
  LOCAL_DRUG_AUTOCOMPLETE_COUNT,
  LOCAL_DRUG_AUTOCOMPLETE_SEARCHABLE_COUNT,
  isSystemicAutocompleteCandidate,
} from "../src/drugAutocomplete.js";

test("local autocomplete keeps 2000 distinct drug names", () => {
  assert.equal(LOCAL_DRUG_AUTOCOMPLETE_COUNT, 2000);
});

test("autocomplete suggests common renal-dose drugs by generic prefix", () => {
  const suggestions = getDrugAutocompleteSuggestions("met", { limit: 6 });
  assert.ok(suggestions.some((suggestion) => /metformin/i.test(suggestion.label)));
});

test("autocomplete supports shorthand aliases", () => {
  const suggestions = getDrugAutocompleteSuggestions("piptaz", { limit: 3 });
  assert.equal(suggestions[0].value, "piperacillin and tazobactam");
});

test("autocomplete supports brand-style aliases", () => {
  const suggestions = getDrugAutocompleteSuggestions("januvia", { limit: 3 });
  assert.equal(suggestions[0].value, "sitagliptin");
});

test("autocomplete folds salt variants into one canonical suggestion", () => {
  const suggestions = getDrugAutocompleteSuggestions("metformin hydro", { limit: 5 });
  assert.equal(suggestions[0].label, "Metformin");
  assert.ok(!suggestions.some((suggestion) => /metformin hydrochloride/i.test(suggestion.label)));
});

test("autocomplete searches hidden aliases merged into shorthand entries", () => {
  const suggestions = getDrugAutocompleteSuggestions("doxycycline h", { limit: 5 });
  assert.equal(suggestions[0].label, "Doxycycline");
});

test("autocomplete hides non-systemic DailyMed noise while preserving free-text ability", () => {
  assert.ok(LOCAL_DRUG_AUTOCOMPLETE_SEARCHABLE_COUNT < LOCAL_DRUG_AUTOCOMPLETE_COUNT);
  assert.equal(isSystemicAutocompleteCandidate({ name: "Fludeoxyglucose F 18" }), false);
  assert.equal(isSystemicAutocompleteCandidate({ name: "Oxygen Nitrogen Mixture" }), false);
  assert.equal(isSystemicAutocompleteCandidate({ name: "Dry Eye Test" }), false);
  assert.equal(isSystemicAutocompleteCandidate({ name: "Araneus Diadematus" }), false);
  assert.equal(isSystemicAutocompleteCandidate({ name: "Ciprofolxacin" }), false);
  assert.equal(isSystemicAutocompleteCandidate({ name: "Metformin" }), true);

  assert.equal(getDrugAutocompleteSuggestions("fludeoxyglucose", { limit: 5 }).length, 0);
  assert.equal(getDrugAutocompleteSuggestions("iopidine", { limit: 5 }).length, 0);
  assert.equal(getDrugAutocompleteSuggestions("dry eye", { limit: 5 }).length, 0);
  assert.equal(getDrugAutocompleteSuggestions("ciprofolxacin", { limit: 5 }).length, 0);
});
