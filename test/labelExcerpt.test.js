import test from "node:test";
import assert from "node:assert/strict";
import { extractKidneySentences } from "../server/renalDose/labelExcerpt.js";
import { buildDoseView, buildShareText } from "../src/doseView.js";

const label = (text) => ({ sections: [{ heading: "Label", fullText: text }] });

test("kidney guidance sentences are kept, incidental kidney mentions are not", () => {
  const sentences = extractKidneySentences(
    label(
      "Nephrosis and corticosteroids decrease TBG concentration. " +
        "Although these reactions are rare, they may be serious, involving the lung, kidney, or liver. " +
        "In general, use caution reflecting the greater frequency of decreased hepatic, renal, or cardiac function. " +
        "Acute renal failure has been reported in postmarketing use. " +
        "Patients with moderate to severe renal impairment may be able to only tolerate lower doses."
    )
  );
  assert.deepEqual(sentences, [
    "Patients with moderate to severe renal impairment may be able to only tolerate lower doses.",
  ]);
});

test("a label without kidney guidance yields no sentences", () => {
  assert.deepEqual(
    extractKidneySentences(label("Take 10 mg once daily with food. Hepatic impairment: start at 5 mg.")),
    []
  );
});

test("numbered headings run into the previous sentence are split off", () => {
  const sentences = extractKidneySentences(
    label(
      "Restart at 1.5 mg twice a day [see Warnings (5.1)]. 8.6 Renal Impairment Reduce the dose in severe renal impairment."
    )
  );
  assert.deepEqual(sentences, ["8.6 Renal Impairment Reduce the dose in severe renal impairment."]);
});

test("long sentences are cut around the kidney phrase", () => {
  const filler =
    "Use with caution in ulcerative colitis, diverticulitis, peptic ulcer, osteoporosis and myasthenia gravis, ".repeat(
      4
    );
  const [sentence] = extractKidneySentences(label(`${filler}renal insufficiency and hypertension.`));
  assert.ok(sentence.includes("renal insufficiency"));
  assert.ok(sentence.length <= 302);
});

test("a silent label is labelled as such and excerpts reach the share text", () => {
  const silent = buildDoseView(
    {
      sourceMode: "label-silent",
      result: { status: "no_renal_text", drugName: "Silentamine", dose: "No kidney dosing guidance in the label" },
    },
    { drug: "silentamine", crcl: 25 }
  );
  assert.equal(silent.decision.id, "silent");
  assert.equal(silent.tier.label, "Label text");

  const excerpt = buildDoseView(
    {
      sourceMode: "label-excerpt",
      result: {
        status: "review_source",
        drugName: "Examplostat",
        dose: "Read the label's kidney guidance",
        labelExcerpt: ["Reduce the dose in severe renal impairment."],
      },
    },
    { drug: "examplostat", crcl: 25 }
  );
  assert.deepEqual(excerpt.excerpt, ["Reduce the dose in severe renal impairment."]);
  const text = buildShareText({
    patient: { age: 70, sex: "male", creatinine: 2.6, weight: 70 },
    renal: { egfr: 24, crcl: 25, stage: { stage: "G4" } },
    views: [excerpt],
  });
  assert.match(text, /Label: "Reduce the dose in severe renal impairment\."/);
});

async function withLabel(text, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            set_id: "example-set",
            openfda: {
              product_type: ["HUMAN PRESCRIPTION DRUG"],
              route: ["ORAL"],
              generic_name: ["EXAMPLOSTAT"],
              brand_name: ["Examplostat"],
              substance_name: ["EXAMPLOSTAT"],
            },
            dosage_and_administration: [text],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const patient = {
  drug: "examplostat",
  route: "ORAL",
  crcl: 25,
  egfr: 24,
  age: 70,
  sex: "male",
  weight: 70,
  creatinine: 2.6,
  dialysis: "none",
  indication: "any",
  formulation: "any",
};

test("the AI is not called for silent or excerpt-only labels", async () => {
  const { resolveDosePayload } = await import("../server/renalDose/pipeline.js");
  let aiCalls = 0;
  const env = {
    AI: {
      run: async () => {
        aiCalls += 1;
        return { response: "{}" };
      },
    },
    AI_FREE_MODE: "false",
  };

  const silent = await withLabel("Take 10 mg once daily with food.", () => resolveDosePayload({ patient, env }));
  assert.equal(silent.sourceMode, "label-silent");
  assert.equal(silent.result.status, "no_renal_text");

  const excerpt = await withLabel(
    "Take 10 mg once daily. Patients with severe renal impairment may only tolerate lower doses.",
    () => resolveDosePayload({ patient, env })
  );
  assert.equal(excerpt.sourceMode, "label-excerpt");
  assert.match(excerpt.result.labelExcerpt[0], /only tolerate lower doses/);
  assert.equal(aiCalls, 0);
});

test("a label with a kidney dose table still reaches the AI tier", async () => {
  const { resolveDosePayload } = await import("../server/renalDose/pipeline.js");
  let aiCalls = 0;
  const env = {
    AI: {
      run: async () => {
        aiCalls += 1;
        return { response: "{}" };
      },
    },
    AI_FREE_MODE: "false",
  };
  await withLabel(
    "Dosage adjustment in renal impairment: creatinine clearance 30 to 50 mL/min: give the recommended dose at longer intervals; creatinine clearance 10 to 29 mL/min: reduce the dose; less than 10 mL/min: avoid.",
    () => resolveDosePayload({ patient: { ...patient, drug: "examplostat-table" }, env })
  );
  assert.ok(aiCalls >= 1);
});
