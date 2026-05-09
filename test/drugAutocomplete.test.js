import test from "node:test";
import assert from "node:assert/strict";
import {
  getDrugAutocompleteSuggestions,
  LOCAL_DRUG_AUTOCOMPLETE_COUNT,
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
