import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { onRequestPost } from "../functions/api/renal-dose/assist.js";

// Replays recorded openFDA/RxNav responses (scripts/record-api-fixtures.mjs)
// so the dose API can be checked end to end without network access.
const fixture = JSON.parse(
  gunzipSync(await readFile(new URL("./fixtures/api-smoke.json.gz", import.meta.url))).toString("utf8")
);

function installFetchReplay() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input.url || input);
    const recorded = fixture.fetches[url];
    if (!recorded) {
      throw new Error(`No recorded response for ${url}`);
    }
    return new Response(recorded.body, { status: recorded.status });
  };
  return () => {
    globalThis.fetch = realFetch;
  };
}

for (const { id, payload, response: expected } of fixture.outputs) {
  test(`dose API smoke case: ${id}`, async () => {
    const restore = installFetchReplay();
    try {
      const request = new Request("https://local/api/renal-dose/assist", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const response = await onRequestPost({ request, env: {} });
      const actual = await response.json();
      assert.deepEqual(stripVolatile(actual), stripVolatile(expected));
    } finally {
      restore();
    }
  });
}

function stripVolatile(payload) {
  // Label section text is trimmed in fixtures; compare the decision fields.
  const { result, sourceMode, sourceUrl, modelUsed } = payload;
  return { result, sourceMode, sourceUrl, modelUsed, labelTitle: payload.label?.title, setId: payload.label?.setId };
}
