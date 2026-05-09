import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const RULE_DIR = join(process.cwd(), "src/data/renalRules");
const VALID_TYPES = new Set(["all", "gt", "gte", "lt", "range"]);
const VALID_ROUTES = new Set(["IV", "IM", "ORAL", "SC", "SUBQ", "INHALATION"]);
const VALID_CONFIDENCE = new Set(["draft-source-extracted", "starter-verified", "verified"]);

test("curated renal rule files follow the draft schema", async () => {
  const files = await listRuleFiles();

  for (const file of files) {
    const module = await import(pathToFileURL(join(RULE_DIR, file)).href);
    const exportedRuleArrays = Object.entries(module).filter(
      ([name, value]) => name.endsWith("Rules") && Array.isArray(value)
    );

    assert.ok(exportedRuleArrays.length > 0, `${file} must export at least one *Rules array`);

    for (const [exportName, records] of exportedRuleArrays) {
      records.forEach((record, index) => validateRecord({ record, file, exportName, index }));
    }
  }
});

async function listRuleFiles() {
  try {
    const entries = await readdir(RULE_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function validateRecord({ record, file, exportName, index }) {
  const label = `${file}:${exportName}[${index}]`;

  assert.equal(typeof record.drugName, "string", `${label} drugName is required`);
  assert.ok(record.drugName.trim(), `${label} drugName cannot be blank`);
  assert.equal(typeof record.searchTerm, "string", `${label} searchTerm is required`);
  assert.ok(record.searchTerm.trim(), `${label} searchTerm cannot be blank`);
  assert.ok(Array.isArray(record.aliases), `${label} aliases must be an array`);
  assert.ok(Array.isArray(record.routes), `${label} routes must be an array`);
  assert.ok(record.routes.length > 0, `${label} must have at least one route`);
  record.routes.forEach((route) => assert.ok(VALID_ROUTES.has(route), `${label} invalid route ${route}`));
  assert.equal(record.adultOnly, true, `${label} must be adultOnly`);
  assert.equal(typeof record.indicationNote, "string", `${label} indicationNote is required`);
  assert.ok(record.indicationNote.trim(), `${label} indicationNote cannot be blank`);
  assert.equal(typeof record.sourceLabel, "string", `${label} sourceLabel is required`);
  assert.ok(record.sourceLabel.trim(), `${label} sourceLabel cannot be blank`);
  assert.equal(typeof record.sourceUrl, "string", `${label} sourceUrl is required`);
  assert.match(
    record.sourceUrl,
    /^https:\/\/(?:www\.)?dailymed\.nlm\.nih\.gov\//,
    `${label} must use DailyMed source URL`
  );
  assert.equal(record.reviewedBy, "Codex curation draft", `${label} reviewedBy must stay draft`);
  assert.match(record.reviewedOn, /^\d{4}-\d{2}-\d{2}$/, `${label} reviewedOn must be ISO date`);
  assert.ok(VALID_CONFIDENCE.has(record.confidence), `${label} invalid confidence`);
  assert.notEqual(record.confidence, "verified", `${label} should not be verified by draft workers`);
  assert.ok(Array.isArray(record.rules), `${label} rules must be an array`);
  assert.ok(record.rules.length > 0, `${label} must include at least one rule`);

  record.rules.forEach((rule, ruleIndex) => validateRule({ rule, label: `${label}.rules[${ruleIndex}]` }));
}

function validateRule({ rule, label }) {
  assert.ok(VALID_TYPES.has(rule.type), `${label} invalid type`);
  assert.equal(typeof rule.min, "number", `${label} min must be numeric`);
  assert.equal(typeof rule.max, "number", `${label} max must be numeric`);
  assert.ok(Array.isArray(rule.variants), `${label} variants must be an array`);
  assert.ok(rule.variants.length > 0, `${label} must include at least one variant`);

  if (rule.type === "range") {
    assert.ok(rule.min < rule.max, `${label} range min must be less than max`);
  }
  if (rule.type === "gt" || rule.type === "gte") {
    assert.equal(rule.max, Infinity, `${label} greater-than rules should use max Infinity`);
  }
  if (rule.type === "lt") {
    assert.equal(rule.min, 0, `${label} less-than rules should use min 0`);
  }
  if (rule.type === "all") {
    assert.equal(rule.min, 0, `${label} all rules should use min 0`);
    assert.equal(rule.max, Infinity, `${label} all rules should use max Infinity`);
  }

  rule.variants.forEach((variant, variantIndex) => {
    const variantLabel = `${label}.variants[${variantIndex}]`;
    assert.equal(typeof variant.condition, "string", `${variantLabel} condition is required`);
    assert.ok(variant.condition.trim(), `${variantLabel} condition cannot be blank`);
    assert.equal(typeof variant.dose, "string", `${variantLabel} dose is required`);
    assert.ok(variant.dose.trim(), `${variantLabel} dose cannot be blank`);
    assert.equal(typeof variant.interval, "string", `${variantLabel} interval is required`);
    assert.ok(variant.interval.trim(), `${variantLabel} interval cannot be blank`);
  });
}
