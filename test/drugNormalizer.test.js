import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDrugKey, normalizeDrugQuery } from "../src/drugNormalizer.js";

test("normalizes piptaz shorthand to piperacillin and tazobactam", async () => {
  const result = await normalizeDrugQuery("piptaz");

  assert.equal(result.searchTerm, "piperacillin and tazobactam");
  assert.equal(result.displayName, "Piperacillin and tazobactam");
  assert.equal(result.source, "local-alias");
  assert.equal(result.changed, true);
});

test("normalizes common piperacillin tazobactam separators", async () => {
  const result = await normalizeDrugQuery("pip-taz");

  assert.equal(result.searchTerm, "piperacillin and tazobactam");
  assert.equal(normalizeDrugKey("piperacillin/tazobactam"), "piperacillintazobactam");
});

test("normalizes meropenem shorthand without using the network", async () => {
  const result = await normalizeDrugQuery("mero");

  assert.equal(result.searchTerm, "meropenem");
  assert.equal(result.source, "local-alias");
});

test("normalizes doxy shorthand without using the network", async () => {
  const result = await normalizeDrugQuery("doxy");

  assert.equal(result.searchTerm, "doxycycline");
  assert.equal(result.displayName, "Doxycycline");
  assert.equal(result.source, "local-alias");
});

test("normalizes levoflox shorthand without using the network", async () => {
  const result = await normalizeDrugQuery("levoflox");

  assert.equal(result.searchTerm, "levofloxacin");
  assert.equal(result.displayName, "Levofloxacin");
  assert.equal(result.source, "local-alias");
});

test("normalizes sitagliptin to a cleaner single-drug DailyMed search", async () => {
  const result = await normalizeDrugQuery("sitagliptin");

  assert.equal(result.searchTerm, "januvia");
  assert.equal(result.displayName, "Sitagliptin");
  assert.equal(result.source, "local-alias");
});
