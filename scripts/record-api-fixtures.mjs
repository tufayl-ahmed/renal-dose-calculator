// Records openFDA/RxNav responses and API output for a fixed smoke-case panel.
// Usage: node scripts/record-api-fixtures.mjs [--handler=path/to/assist.js] [--out=file] [--replay]
// The fixtures let tests replay the dose API without network access.
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { calculateCockcroftGault, calculateEgfrCkdEpi2021 } from "../src/renal.js";
import { normalizeDrugQuery } from "../src/drugNormalizer.js";
import { SMOKE_CASES } from "../test/fixtures/smokeCases.js";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")));
const handlerPath = path.resolve(args.handler || "functions/api/renal-dose/assist.js");
const outputPath = args.out || "test/fixtures/api-smoke.json.gz";
const { onRequestPost } = await import(pathToFileURL(handlerPath).href);

// --replay re-runs the cases against the recorded responses (no network),
// refreshing only the expected outputs after an intentional change.
const replay = args.replay === "true" || args.replay === "";
const previous = replay ? JSON.parse(gunzipSync(await readFile(outputPath)).toString("utf8")) : null;
const recorded = replay ? previous.fetches : {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  if (replay) {
    const url = String(input.url || input);
    const hit = recorded[url];
    if (!hit) {
      throw new Error(`No recorded response for ${url}`);
    }
    return new Response(hit.body, { status: hit.status });
  }
  const url = String(input.url || input);
  const response = await realFetch(input, init);
  const body = await response.text();
  recorded[url] = { status: response.status, body: url.includes("api.fda.gov") ? trimOpenFdaBody(body) : body };
  return new Response(body, { status: response.status, headers: response.headers });
};

const outputs = [];
for (const smokeCase of SMOKE_CASES) {
  const payload = replay ? previous.outputs.find((output) => output.id === smokeCase.id).payload : await buildPayload(smokeCase);
  const request = new Request("https://local/api/renal-dose/assist", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const response = await onRequestPost({ request, env: {} });
  outputs.push({ id: smokeCase.id, payload, response: await response.json() });
  console.log(smokeCase.id, outputs.at(-1).response.sourceMode, outputs.at(-1).response.result?.status);
}

await writeFile(outputPath, gzipSync(JSON.stringify({ fetches: recorded, outputs })));

// Keep only the label fields the dose pipeline reads so fixtures stay small.
function trimOpenFdaBody(body) {
  const keep = new Set([
    "set_id",
    "id",
    "effective_time",
    "spl_product_data_elements",
    "package_label_principal_display_panel",
    "openfda",
    "title",
    "renal_impairment",
    "dosage_and_administration",
    "dosage_forms_and_strengths",
    "use_in_specific_populations",
    "warnings",
    "warnings_and_cautions",
    "contraindications",
    "indications_and_usage",
    "boxed_warning",
  ]);
  const openfdaKeep = new Set([
    "generic_name",
    "brand_name",
    "route",
    "product_type",
    "substance_name",
    "spl_set_id",
    "manufacturer_name",
  ]);
  try {
    const data = JSON.parse(body);
    if (!Array.isArray(data.results)) {
      return body;
    }
    data.results = data.results.map((label) => {
      const trimmed = Object.fromEntries(Object.entries(label).filter(([key]) => keep.has(key)));
      if (trimmed.openfda) {
        trimmed.openfda = Object.fromEntries(Object.entries(trimmed.openfda).filter(([key]) => openfdaKeep.has(key)));
      }
      return trimmed;
    });
    return JSON.stringify(data);
  } catch {
    return body;
  }
}

export async function buildPayload({ drug, route, age, sex, creatinine, weight, height = null }) {
  return {
    drug,
    normalizedDrug: await normalizeDrugQuery(drug),
    route,
    crcl: calculateCockcroftGault({ age, sex, creatinine, weight }),
    egfr: calculateEgfrCkdEpi2021({ age, sex, creatinine }),
    age,
    sex,
    weight,
    creatinine,
    height,
    dialysis: "none",
    indication: "any",
    formulation: "any",
  };
}
