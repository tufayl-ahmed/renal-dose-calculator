import test from "node:test";
import assert from "node:assert/strict";
import { lookupDrugLabel } from "../server/renalDose/openfda.js";

function label(setId, { generic, brand, substance }) {
  return {
    openfda: {
      product_type: ["HUMAN PRESCRIPTION DRUG"],
      route: ["ORAL"],
      generic_name: [generic],
      brand_name: [brand],
      substance_name: substance,
      spl_set_id: [setId],
    },
  };
}

const NP_THYROID = label("np-thyroid-set", {
  generic: "LEVOTHYROXINE, LIOTHYRONINE",
  brand: "NP Thyroid 30",
  substance: ["LEVOTHYROXINE", "LIOTHYRONINE"],
});
const LEVOTHYROXINE = label("levothyroxine-set", {
  generic: "LEVOTHYROXINE SODIUM",
  brand: "Levothyroxine sodium",
  substance: ["LEVOTHYROXINE SODIUM"],
});
const HYDROCODONE_APAP = label("hydrocodone-apap-set", {
  generic: "HYDROCODONE BITARTRATE AND ACETAMINOPHEN",
  brand: "Hydrocodone Bitartrate and Acetaminophen",
  substance: ["HYDROCODONE BITARTRATE", "ACETAMINOPHEN"],
});
const HYDROCODONE_ER = label("hydrocodone-er-set", {
  generic: "HYDROCODONE BITARTRATE",
  brand: "Hydrocodone Bitartrate",
  substance: ["HYDROCODONE BITARTRATE"],
});
const PIP_TAZO = label("pip-tazo-set", {
  generic: "PIPERACILLIN AND TAZOBACTAM",
  brand: "Piperacillin and Tazobactam",
  substance: ["PIPERACILLIN SODIUM", "TAZOBACTAM SODIUM"],
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Serves label searches, count queries and exact generic_name searches. */
async function withOpenFda({ results, counts = [], exact = {} }, run) {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input.url || input));
    requests.push(url);
    const search = url.searchParams.get("search") || "";
    if (url.searchParams.get("count")) {
      return counts.length ? json({ results: counts }) : json({ error: { code: "NOT_FOUND" } }, 404);
    }
    const exactTerm = search.match(/generic_name\.exact:"([^"]+)"/)?.[1];
    if (exactTerm) {
      return exact[exactTerm] ? json({ results: exact[exactTerm] }) : json({ error: { code: "NOT_FOUND" } }, 404);
    }
    return json({ results });
  };
  try {
    return await run(requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("a comma-separated combination does not outrank the single-ingredient label", async () => {
  await withOpenFda({ results: [NP_THYROID, LEVOTHYROXINE] }, async () => {
    const found = await lookupDrugLabel({ drug: "levothyroxine", route: "ORAL" });
    assert.match(found.sourceUrl, /setid=levothyroxine-set/);
  });
});

test("an all-combination first page falls back to the single-ingredient product", async () => {
  await withOpenFda(
    {
      results: [HYDROCODONE_APAP],
      counts: [
        { term: "HYDROCODONE BITARTRATE AND ACETAMINOPHEN", count: 150 },
        { term: "HYDROCODONE BITARTRATE", count: 12 },
      ],
      exact: { "HYDROCODONE BITARTRATE": [HYDROCODONE_ER] },
    },
    async () => {
      const found = await lookupDrugLabel({ drug: "hydrocodone", route: "ORAL" });
      assert.match(found.sourceUrl, /setid=hydrocodone-er-set/);
    }
  );
});

test("a drug sold only in combination keeps the combination label", async () => {
  await withOpenFda(
    { results: [PIP_TAZO], counts: [{ term: "PIPERACILLIN AND TAZOBACTAM", count: 40 }] },
    async (requests) => {
      const found = await lookupDrugLabel({ drug: "piperacillin", route: "ORAL" });
      assert.match(found.sourceUrl, /setid=pip-tazo-set/);
      assert.ok(!requests.some((url) => /generic_name\.exact/.test(url.searchParams.get("search") || "")));
    }
  );
});

test("a combination query is not redirected to a single ingredient", async () => {
  await withOpenFda({ results: [HYDROCODONE_APAP, HYDROCODONE_ER] }, async (requests) => {
    const found = await lookupDrugLabel({ drug: "hydrocodone and acetaminophen", route: "ORAL" });
    assert.match(found.sourceUrl, /setid=hydrocodone-apap-set/);
    assert.ok(!requests.some((url) => url.searchParams.get("count")));
  });
});
