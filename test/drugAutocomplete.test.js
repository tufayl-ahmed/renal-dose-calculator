import test from "node:test";
import assert from "node:assert/strict";
import {
  getDrugAutocompleteSuggestions,
  LOCAL_DRUG_AUTOCOMPLETE_COUNT,
} from "../src/drugAutocomplete.js";

test("local autocomplete keeps at least 1000 label-backed drug names", () => {
  assert.equal(LOCAL_DRUG_AUTOCOMPLETE_COUNT, 1000);
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
