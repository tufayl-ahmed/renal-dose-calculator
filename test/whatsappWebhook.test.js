import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDoseReplyFromText,
  extractWhatsAppStatuses,
  extractWhatsAppTextMessages,
  onRequestGet,
  onRequestPost,
  sendWhatsAppText,
} from "../functions/api/whatsapp/webhook.js";

test("WhatsApp webhook GET verifies Meta challenge token", async () => {
  const request = new Request(
    "https://renal-dose-calculator.pages.dev/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-token&hub.challenge=abc123"
  );

  const response = await onRequestGet({
    request,
    env: { WHATSAPP_VERIFY_TOKEN: "test-token" },
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "abc123");
});

test("WhatsApp webhook GET rejects the wrong verification token", async () => {
  const request = new Request(
    "https://renal-dose-calculator.pages.dev/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123"
  );

  const response = await onRequestGet({
    request,
    env: { WHATSAPP_VERIFY_TOKEN: "test-token" },
  });

  assert.equal(response.status, 403);
});

test("extracts inbound WhatsApp text messages from webhook payload", () => {
  const messages = extractWhatsAppTextMessages({
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              messages: [
                {
                  id: "wamid.1",
                  from: "911234567890",
                  timestamp: "1710000000",
                  type: "text",
                  text: { body: "45 M 2.1 70 meropenem IV" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.deepEqual(messages, [
    {
      id: "wamid.1",
      from: "911234567890",
      text: "45 M 2.1 70 meropenem IV",
      timestamp: "1710000000",
    },
  ]);
});

test("extracts WhatsApp status callbacks for delivery debugging", () => {
  const statuses = extractWhatsAppStatuses({
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              statuses: [
                {
                  id: "wamid.out",
                  recipient_id: "911234567890",
                  status: "failed",
                  timestamp: "1710000001",
                  errors: [
                    {
                      code: 131047,
                      title: "Re-engagement message",
                      message: "More than 24 hours have passed.",
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.deepEqual(statuses, [
    {
      id: "wamid.out",
      recipientId: "911234567890",
      status: "failed",
      timestamp: "1710000001",
      errorCode: 131047,
      errorTitle: "Re-engagement message",
      errorMessage: "More than 24 hours have passed.",
    },
  ]);
});

test("WhatsApp reply returns kidney-only values when no drug is supplied", async () => {
  const reply = await buildDoseReplyFromText("45 M 2.1 70", {
    request: new Request("https://renal-dose-calculator.pages.dev/api/whatsapp/webhook"),
    env: {},
  });

  assert.match(reply, /\*Patient\*/);
  assert.match(reply, /Kidney/);
  assert.match(reply, /\*eGFR:\* 38\.8/);
  assert.match(reply, /\*CrCl:\* 44\.0/);
  assert.doesNotMatch(reply, /Made by Dr\. Tufayl/);
});

test("WhatsApp hi reply explains the bot and includes the form option", async () => {
  const reply = await buildDoseReplyFromText("hi", {
    request: new Request("https://renal-dose-calculator.pages.dev/api/whatsapp/webhook"),
    env: {},
  });

  assert.match(reply, /Adult eGFR \+ Cockcroft-Gault CrCl/);
  assert.match(reply, /\*FORM:\* copy-paste template/);
  assert.match(reply, /```45 M 2\.1 70 meropenem IV```/);
  assert.match(reply, /Made by Dr\. Tufayl \(Cortex Labs\)/);
});

test("WhatsApp form reply sends a copy-paste renal calculator template", async () => {
  const reply = await buildDoseReplyFromText("form", {
    request: new Request("https://renal-dose-calculator.pages.dev/api/whatsapp/webhook"),
    env: {},
  });

  assert.match(reply, /Age:/);
  assert.match(reply, /\*S\. Creatinine mg\/dL:\*/);
  assert.match(reply, /\*Drug:\* optional/);
  assert.match(reply, /\*Route:\* Oral\/IV optional/);
  assert.match(reply, /```Age: 45/);
  assert.match(reply, /Made by Dr\. Tufayl \(Cortex Labs\)/);
});

test("WhatsApp reply parses a filled copy-paste form", async () => {
  const reply = await buildDoseReplyFromText(
    `
    Age: 45
    Sex: Male
    S. Creatinine mg/dL: 2.1
    Weight kg: 70
    Height cm: 170
    Drug: meropenem
    Route: IV
    `,
    {
      request: new Request("https://renal-dose-calculator.pages.dev/api/whatsapp/webhook"),
      env: {},
    },
    {
      assistRequester: async () => ({
        result: {
          status: "dose_found",
          drugName: "Meropenem",
          route: "IV",
          renalBand: "CrCl 26-50 mL/min",
          dose: "500 mg or 1 g depending on indication",
          frequency: "every 12 hours",
          importantCautions: [],
          sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test",
        },
      }),
    }
  );

  assert.match(reply, /\*Drug:\* Meropenem/);
  assert.match(reply, /\*Route:\* IV/);
  assert.match(reply, /\*Kidney Function\*/);
  assert.match(reply, /\*eGFR:\* 38\.8/);
  assert.match(reply, /\*Dose:\* 500 mg/);
  assert.match(reply, /\*Frequency:\* q12h/);
  assert.doesNotMatch(reply, /Made by Dr\. Tufayl/);
});

test("WhatsApp reply uses renal dose assist output for drug messages", async () => {
  const reply = await buildDoseReplyFromText(
    "45 M 2.1 70 piptaz IV",
    {
      request: new Request("https://renal-dose-calculator.pages.dev/api/whatsapp/webhook"),
      env: {},
    },
    {
      assistRequester: async () => ({
        result: {
          status: "dose_found",
          drugName: "Piperacillin and tazobactam",
          route: "IV",
          renalMetricUsed: "crcl",
          renalBand: "CrCl > 40 mL/min",
          dose: "3.375 g; or 4.5 g for nosocomial pneumonia",
          frequency: "every 6 hours",
          dialysisNote: "",
          importantCautions: ["Dose option differs for nosocomial pneumonia."],
          sourceSetId: "test",
          sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=piptaz",
        },
      }),
    }
  );

  assert.match(reply, /\*Drug:\* Piperacillin and tazobactam/);
  assert.match(reply, /\*Route:\* IV/);
  assert.match(reply, /\*Dose:\* 3\.375 g/);
  assert.match(reply, /\*Frequency:\* q6h/);
  assert.match(reply, /\*DailyMed:\*/);
  assert.doesNotMatch(reply, /Made by Dr\. Tufayl/);
});

test("WhatsApp reply keeps drug messages compact for doctors", async () => {
  const reply = await buildDoseReplyFromText(
    "45 M 2.1 70 meropenem IV",
    {
      request: new Request("https://renal-dose-calculator.pages.dev/api/whatsapp/webhook"),
      env: {},
    },
    {
      assistRequester: async () => ({
        result: {
          status: "dose_found",
          drugName: "Meropenem",
          route: "IV",
          renalBand: "CrCl 26-50 mL/min",
          dose: "500 mg for cSSSI; 1 g for intra-abdominal infection",
          frequency: "every 12 hours",
          dialysisNote: "Review source for dialysis.",
          importantCautions: ["Use clinical severity and organism susceptibility."],
          sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test",
        },
      }),
    }
  );

  assert.match(reply, /\*eGFR:\* 38\.8/);
  assert.match(reply, /\*Renal band:\* CrCl 26-50 mL\/min/);
  assert.match(reply, /\*Dose:\* 500 mg/);
  assert.match(reply, /\*Frequency:\* q12h/);
  assert.match(reply, /\*Notes\*/);
  assert.match(reply, /_- Dialysis:/);
  assert.ok(reply.length < 900);
});

test("WhatsApp review-source replies show an action instead of fake dose", async () => {
  const reply = await buildDoseReplyFromText(
    "68 F 1.9 54 rivaroxaban oral",
    {
      request: new Request("https://renal-dose-calculator.pages.dev/api/whatsapp/webhook"),
      env: {},
    },
    {
      assistRequester: async () => ({
        result: {
          status: "review_source",
          drugName: "Rivaroxaban",
          route: "Oral",
          renalBand: "CrCl 20 mL/min",
          dose: "Review DailyMed source",
          frequency: "Indication-specific dosing requires source review.",
          importantCautions: ["Dose differs by indication."],
          sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=test",
        },
      }),
    }
  );

  assert.match(reply, /\*Action:\* Review DailyMed source/);
  assert.match(reply, /\*Details:\* Indication-specific dosing requires source review/);
  assert.doesNotMatch(reply, /\*Dose:\* Review DailyMed source/);
});

test("sendWhatsAppText skips safely until credentials are configured", async () => {
  const result = await sendWhatsAppText({
    env: {},
    to: "911234567890",
    body: "Test",
  });

  assert.equal(result.skipped, true);
  assert.match(result.reason, /credentials/);
});

test("sendWhatsAppText posts a text reply to the WhatsApp Cloud API", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedBody = null;
  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedBody = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, "Bearer token");
    return new Response(JSON.stringify({ messages: [{ id: "wamid.out" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await sendWhatsAppText({
      env: {
        WHATSAPP_ACCESS_TOKEN: "token",
        WHATSAPP_PHONE_NUMBER_ID: "12345",
        WHATSAPP_GRAPH_VERSION: "v23.0",
      },
      to: "911234567890",
      body: "Dose reply",
      replyMessageId: "wamid.in",
    });

    assert.equal(result.ok, true);
    assert.equal(capturedUrl, "https://graph.facebook.com/v23.0/12345/messages");
    assert.equal(capturedBody.messaging_product, "whatsapp");
    assert.equal(capturedBody.to, "911234567890");
    assert.equal(capturedBody.text.body, "Dose reply");
    assert.equal(capturedBody.context.message_id, "wamid.in");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("POST webhook accepts a kidney-only inbound message and returns 200", async () => {
  const request = new Request("https://renal-dose-calculator.pages.dev/api/whatsapp/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  {
                    id: "wamid.2",
                    from: "911234567890",
                    type: "text",
                    text: { body: "45 M 2.1 70" },
                  },
                ],
              },
            },
          ],
        },
      ],
    }),
  });

  const response = await onRequestPost({ request, env: {} });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.received, 1);
  assert.equal(data.deliveries[0].skipped, true);
});

test("POST webhook rejects unsigned payloads when an app secret is configured", async () => {
  const request = new Request("https://renal-dose-calculator.pages.dev/api/whatsapp/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry: [] }),
  });

  const response = await onRequestPost({
    request,
    env: { WHATSAPP_APP_SECRET: "secret" },
  });

  assert.equal(response.status, 401);
});

test("POST webhook skips duplicate WhatsApp message ids when KV is configured", async () => {
  const store = new Map();
  const env = {
    WHATSAPP_DEDUPE: {
      get: async (key) => store.get(key) || null,
      put: async (key, value) => store.set(key, value),
    },
  };
  const request = new Request("https://renal-dose-calculator.pages.dev/api/whatsapp/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  {
                    id: "wamid.duplicate",
                    from: "911234567890",
                    type: "text",
                    text: { body: "45 M 2.1 70" },
                  },
                  {
                    id: "wamid.duplicate",
                    from: "911234567890",
                    type: "text",
                    text: { body: "45 M 2.1 70" },
                  },
                ],
              },
            },
          ],
        },
      ],
    }),
  });

  const response = await onRequestPost({ request, env });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.deliveries.length, 2);
  assert.equal(data.deliveries[0].reason, "WhatsApp credentials are not configured.");
  assert.equal(data.deliveries[1].reason, "duplicate");
});
