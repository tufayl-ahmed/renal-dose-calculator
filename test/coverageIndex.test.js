import assert from "node:assert/strict";
import test from "node:test";
import { buildCoverageIndex } from "../scripts/lib/coverageIndex.mjs";
import { COVERAGE_INDEX } from "../src/data/coverageIndex.js";

test("coverage index is up to date with the rule database (run npm run coverage:index)", () => {
  assert.deepEqual(COVERAGE_INDEX, buildCoverageIndex());
});

test("coverage index marks verified, curated and aliases", () => {
  assert.equal(COVERAGE_INDEX.meropenem.s, "v");
  assert.equal(COVERAGE_INDEX.sitagliptin.s, "c");
  assert.equal(COVERAGE_INDEX.piptaz.s, "v");
  assert.deepEqual(COVERAGE_INDEX.meropenem.r, ["IV"]);
});
