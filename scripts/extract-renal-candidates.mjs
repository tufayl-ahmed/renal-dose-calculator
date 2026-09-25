// Builds auto-extracted renal dosing candidates for drugs that have no
// hand-curated record, using the app's own deterministic label pipeline.
//
//   npm run candidates:extract -- --limit=150
//   OPENFDA_API_KEY=... npm run candidates:extract -- --limit=2000
//
// For each generic drug in the autocomplete list and each route (oral, IV):
//   1. fetch the DailyMed/openFDA label (cached in .cache/labels/)
//   2. run the deterministic label pipeline (drug handlers + table parser,
//      no AI) at a sweep of CrCl/eGFR values
//   3. collapse the answers into renal bands; keep the drug only if every
//      probe gave a clean, band-consistent answer
//
// openFDA allows ~1,000 requests/day without a key (free keys allow far more).
// The script stops cleanly when rate limited; re-run it to continue.
// Output: src/data/renalRules/candidates.js and
//         docs/curation/candidate-extraction-report.md
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DRUG_AUTOCOMPLETE_ITEMS } from "../src/drugAutocompleteData.js";
import { findCuratedRenalDoseGuidance } from "../src/curatedDoseRules.js";
import { lookupDrugLabel } from "../server/renalDose/openfda.js";
import { resolveDeterministicLabelResult } from "../server/renalDose/pipeline.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  })
);
const LIMIT = Number(args.limit || 150);
const ROUTES = (args.routes || "ORAL,IV").split(",");
const CACHE_DIR = path.join(root, ".cache", "labels");
const OUTPUT = path.join(root, "src", "data", "renalRules", "candidates.js");
const REPORT = path.join(root, "docs", "curation", "candidate-extraction-report.md");
const PROBES = [4, 8, 12, 17, 22, 27, 33, 38, 43, 48, 53, 58, 65, 75, 85, 100, 130];
const TODAY = new Date().toLocaleDateString("en-CA");
// Bump when the label fields fetched by server/renalDose/openfda.js change.
// Labels cached under an older version only contribute table/handler results.
const LABEL_FIELDS_VERSION = 2;
const SIGNIFICANT_NAME_WORD = /^[a-z]{4,}$/;
const NAME_STOP_WORDS = new Set(["with", "sodium", "potassium", "calcium", "hydrochloride", "extended", "release"]);

let requestCount = 0;
let rateLimited = false;
installFetchGuard();

const existing = await loadExistingCandidates();
const drugs = selectDrugs();
const report = { extracted: [], partial: [], noRenalData: [], noLabel: [], skippedCurated: 0 };
const records = new Map(existing.map((record) => [recordKey(record), record]));

for (const drug of drugs) {
  if (rateLimited) {
    break;
  }
  for (const route of ROUTES) {
    if (isCurated(drug.name, route)) {
      report.skippedCurated += 1;
      continue;
    }
    let label;
    try {
      label = await cachedLabelLookup(drug.name, route);
    } catch (error) {
      if (rateLimited) {
        break;
      }
      report.noLabel.push(`${drug.name} (${route}): ${error.message}`);
      continue;
    }
    if (label.status !== "found") {
      report.noLabel.push(`${drug.name} (${route}): ${label.status}`);
      continue;
    }

    const outcome = extractCandidate(drug, route, label);
    if (outcome.record) {
      records.set(recordKey(outcome.record), outcome.record);
      report.extracted.push(`${drug.name} (${route}): ${outcome.summary}`);
    } else if (outcome.reason === "no-renal-data") {
      report.noRenalData.push(`${drug.name} (${route})`);
    } else {
      report.partial.push(`${drug.name} (${route}): ${outcome.reason}`);
    }
  }
}

const sorted = [...records.values()].sort((a, b) => a.drugName.localeCompare(b.drugName) || a.routes[0].localeCompare(b.routes[0]));
await writeCandidates(sorted);
await writeReport(sorted);
console.log(
  `Processed ${drugs.length} drugs with ${requestCount} openFDA requests${rateLimited ? " (stopped: rate limited)" : ""}.`
);
console.log(
  `Candidates: ${sorted.length} total, ${report.extracted.length} new/updated this run; ` +
    `${report.partial.length} partial, ${report.noRenalData.length} without renal data, ${report.noLabel.length} without a label.`
);

function selectDrugs() {
  const seen = new Set();
  return DRUG_AUTOCOMPLETE_ITEMS.filter((item) => item.source === "generic" || item.source === "label-generic")
    .filter((item) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(Number(args.offset || 0), Number(args.offset || 0) + LIMIT);
}

function isCurated(name, route) {
  return Boolean(
    findCuratedRenalDoseGuidance({
      drugQuery: name,
      normalizedDrug: { searchTerm: name.toLowerCase(), displayName: name },
      crcl: 40,
      egfr: 40,
      route,
    })
  );
}

async function cachedLabelLookup(name, route) {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${slug(name)}.${route}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    // Not cached yet.
  }
  if (args.offline === "true") {
    throw new Error("not cached (offline run)");
  }
  const label = await lookupDrugLabel({ drug: name.toLowerCase(), route });
  if (rateLimited) {
    throw new Error("rate limited");
  }
  label.labelFieldsVersion = LABEL_FIELDS_VERSION;
  await writeFile(file, JSON.stringify(label));
  return label;
}

function extractCandidate(drug, route, label) {
  if (!labelMatchesDrug(label, drug.name)) {
    return { reason: `label "${label.title}" does not match the drug name` };
  }
  const answers = PROBES.map((value) => {
    const patient = {
      drug: drug.name.toLowerCase(),
      normalizedDrug: { searchTerm: drug.name.toLowerCase(), displayName: drug.name },
      route,
      crcl: value,
      egfr: value,
      age: 60,
      sex: "male",
      weight: 70,
      creatinine: 1,
      height: null,
      dialysis: "none",
      indication: "any",
      formulation: "any",
    };
    const outcome = resolveDeterministicLabelResult({ label, patient });
    return { value, outcome };
  });

  if (answers.every(({ outcome }) => !outcome)) {
    return { reason: "no-renal-data" };
  }
  const missing = answers.filter(({ outcome }) => !outcome || outcome.result.status === "review_source");
  if (missing.length) {
    return { reason: `no clean answer at ${missing.map(({ value }) => value).join(", ")}` };
  }

  const silent = answers.find(({ outcome }) => /described in label/i.test(outcome.result.dose));
  if (silent) {
    // "The label does not mention the kidney" is not reliable enough to store.
    return { reason: "label silent on renal dosing in the sections checked" };
  }
  const vague = answers.find(({ outcome }) => !isConcreteDose(outcome.result.dose));
  if (vague) {
    return { reason: `non-specific guidance "${vague.outcome.result.dose}"` };
  }

  const texts = answers.map(({ outcome }) => doseText(outcome.result));
  if (answers.every(({ outcome }) => outcome.result.status === "no_renal_adjustment") && new Set(texts).size === 1) {
    if ((label.labelFieldsVersion || 1) < LABEL_FIELDS_VERSION && answers[0].outcome.sourceMode !== "dailymed-special-review") {
      return { reason: "cached label predates Precautions parsing; re-fetch to confirm no adjustment" };
    }
    return buildRecord(drug, route, label, answers, [
      { type: "all", min: 0, max: Infinity, variants: [variantFor(answers[0].outcome.result)] },
    ]);
  }

  const groups = new Map();
  for (const answer of answers) {
    const band = parseBand(answer.outcome.result.renalBand);
    if (!band) {
      return { reason: `unbanded answer at ${answer.value} (${answer.outcome.result.renalBand})` };
    }
    if (!valueInBand(answer.value, band)) {
      return { reason: `band ${answer.outcome.result.renalBand} does not contain probe ${answer.value}` };
    }
    const key = `${band.metric}|${band.type}|${band.min}|${band.max}`;
    const text = doseText(answer.outcome.result);
    if (groups.has(key) && groups.get(key).text !== text) {
      return { reason: `different answers inside ${answer.outcome.result.renalBand}` };
    }
    groups.set(key, { band, text, result: answer.outcome.result });
  }
  const metrics = new Set([...groups.values()].map(({ band }) => band.metric));
  if (metrics.size > 1) {
    return { reason: "mixes CrCl and eGFR bands" };
  }

  const rules = [...groups.values()]
    .sort((a, b) => b.band.min - a.band.min)
    .map(({ band, result }) => ({ type: band.type, min: band.min, max: band.max, variants: [variantFor(result)] }));
  return buildRecord(drug, route, label, answers, rules, [...metrics][0]);
}

function buildRecord(drug, route, label, answers, rules, metric = "crcl") {
  const first = answers[0].outcome;
  const record = {
    drugName: drug.name,
    searchTerm: drug.name.toLowerCase(),
    aliases: (drug.aliases || []).map((alias) => alias.toLowerCase()),
    routes: [route],
    adultOnly: true,
    renalMetric: metric,
    indicationNote: `Auto-extracted from the DailyMed label${metric === "egfr" ? " (eGFR-based)" : ""}; not clinician reviewed. Check indication-specific dosing in the label.`,
    sourceLabel: `DailyMed label (${first.sourceMode === "dailymed-special-review" ? "renal label logic" : "renal table"})`,
    sourceUrl: label.sourceUrl,
    reviewedBy: "Auto-extraction",
    reviewedOn: TODAY,
    confidence: "auto-extracted",
    extraction: {
      method: first.sourceMode,
      labelTitle: label.title,
      labelSetId: label.setId || "",
      labelEffectiveTime: label.effectiveTime || "",
    },
    rules,
  };
  const summary = rules.map((rule) => `${rule.type} ${rule.min}-${rule.max}`).join("; ");
  return { record, summary };
}

function labelMatchesDrug(label, name) {
  const haystack = `${label.title || ""} ${label.genericName || ""} ${label.brandName || ""}`.toLowerCase();
  const words = name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => SIGNIFICANT_NAME_WORD.test(word) && !NAME_STOP_WORDS.has(word));
  return words.length > 0 && words.every((word) => haystack.includes(word));
}

function isConcreteDose(dose) {
  return /\d/.test(dose) || /^(?:no renal dose adjustment|avoid|contraindicated|do not use|not recommended)\b/i.test(dose);
}

function variantFor(result) {
  return {
    condition: "Adult dosing per DailyMed label",
    dose: result.dose,
    interval: [result.frequency, ...(result.importantCautions || [])].filter(Boolean).join(". "),
  };
}

function doseText(result) {
  return `${result.status}|${result.dose}|${result.frequency}`;
}

function parseBand(text) {
  const value = String(text || "").trim();
  const metric = /^eGFR/i.test(value) ? "egfr" : /^(?:CrCl|CLcr)/i.test(value) ? "crcl" : "";
  if (!metric) {
    return null;
  }
  const body = value.replace(/^(?:CrCl|CLcr|eGFR)\s*/i, "").replace(/\s*mL\/min.*$/i, "");
  let match = body.match(/^(>=|≥|>|<=|≤|<)\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    const number = Number(match[2]);
    return {
      metric,
      ...{
        ">": { type: "gt", min: number, max: Infinity },
        ">=": { type: "gte", min: number, max: Infinity },
        "≥": { type: "gte", min: number, max: Infinity },
        "<": { type: "lt", min: 0, max: number },
        "<=": { type: "range", min: 0, max: number },
        "≤": { type: "range", min: 0, max: number },
      }[match[1]],
    };
  }
  match = body.match(/^(>\s*)?(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)$/);
  if (match) {
    // "> 30-59" means above 30 up to 59; store as an inclusive range just above the lower bound.
    const min = Number(match[2]) + (match[1] ? 0.01 : 0);
    return { metric, type: "range", min, max: Number(match[3]) };
  }
  return null;
}

function valueInBand(value, band) {
  if (band.type === "gt") return value > band.min;
  if (band.type === "gte") return value >= band.min;
  if (band.type === "lt") return value < band.max;
  return value >= band.min && value <= band.max;
}

function recordKey(record) {
  return `${record.searchTerm}|${record.routes.join(",")}`;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function loadExistingCandidates() {
  if (args.fresh === "true") {
    return [];
  }
  const module = await import(`${new URL("../src/data/renalRules/candidates.js", import.meta.url).href}?t=${Date.now()}`);
  return module.candidateRenalDoseRules;
}

async function writeCandidates(list) {
  const header = (await readFile(OUTPUT, "utf8")).split("export const")[0];
  const json = JSON.stringify(list, (key, value) => (value === Infinity ? "__INFINITY__" : value), 2).replaceAll(
    '"__INFINITY__"',
    "Infinity"
  );
  await writeFile(OUTPUT, `${header}export const candidateRenalDoseRules = ${json};\n`);
}

async function writeReport(list) {
  const lines = [
    "# Auto-extracted renal dosing candidates",
    "",
    `Generated ${TODAY} by \`scripts/extract-renal-candidates.mjs\`. Candidates are unreviewed`,
    "snapshots of the app's deterministic DailyMed label pipeline (drug handlers and renal",
    "table parser, no AI). They are served after hand-curated records and labelled",
    '"Auto-extracted from label" until a clinician verifies them via `npm run rules:export`.',
    "",
    `- Candidate records in the database: **${list.length}**`,
    `- Extracted or refreshed this run: ${report.extracted.length}`,
    `- Already hand-curated (skipped): ${report.skippedCurated}`,
    `- Partial extraction (needs manual curation): ${report.partial.length}`,
    `- Label found but no renal dosing logic applied: ${report.noRenalData.length}`,
    `- No human label for the route: ${report.noLabel.length}`,
    "",
    "## Needs manual curation",
    "",
    "The label pipeline could not give a clean answer across the whole CrCl range for these:",
    "",
    ...report.partial.map((line) => `- ${line}`),
    "",
    "## Label found, no renal dosing extracted",
    "",
    ...report.noRenalData.map((line) => `- ${line}`),
    "",
  ];
  await mkdir(path.dirname(REPORT), { recursive: true });
  await writeFile(REPORT, lines.join("\n"));
}

function installFetchGuard() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    let url = String(input.url || input);
    if (url.includes("api.fda.gov")) {
      if (rateLimited) {
        throw new Error("openFDA rate limit reached");
      }
      requestCount += 1;
      if (process.env.OPENFDA_API_KEY) {
        url += `${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(process.env.OPENFDA_API_KEY)}`;
      }
      const response = await realFetch(url, init);
      if (response.status === 429) {
        rateLimited = true;
        console.warn("openFDA rate limit reached; stopping. Re-run later or set OPENFDA_API_KEY.");
      }
      return response;
    }
    return realFetch(input, init);
  };
}
