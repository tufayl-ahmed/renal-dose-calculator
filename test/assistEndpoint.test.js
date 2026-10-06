import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/renal-dose/assist.js";

const post = (body) =>
  onRequestPost({
    request: new Request("https://example.test/api/renal-dose/assist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env: {},
  });

test("malformed JSON is rejected, not answered", async () => {
  const response = await post('{"drug":"x","crcl":,}');
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.result, undefined);
  assert.match(data.error, /JSON/);
});

test("a request without a drug or a numeric CrCl is rejected", async () => {
  assert.equal((await post({ route: "ORAL", crcl: 30 })).status, 400);
  assert.equal((await post({ drug: "meropenem", route: "IV" })).status, 400);
  assert.equal((await post({ drug: "meropenem", route: "NASAL", crcl: 30 })).status, 400);
});

test("a valid curated request still answers", async () => {
  const response = await post({
    drug: "meropenem",
    route: "IV",
    crcl: 20,
    egfr: 20,
    age: 60,
    sex: "male",
    weight: 70,
    creatinine: 2,
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.result.status, "dose_found");
});
