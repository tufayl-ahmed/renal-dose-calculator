import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildOpenWaDoseReplyFromText,
  extractOpenWaTextMessages,
  onRequestGet,
  onRequestPost,
  sendOpenWaText,
} from "../functions/api/openwa/webhook.js";

test("OpenWA experimental webhook health reports disabled by default", async () => {
  const response = await onRequestGet({
    request: new Request("https://renal-dose-calculator.pages.dev/api/openwa/webhook"),
    env: {},
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.service, "openwa-experimental-webhook");
  assert.equal(data.enabled, false);
});

test("OpenWA experimental webhook rejects POST while disabled", async () => {
  const request = new Request("https://renal-dose-calculator.pages.dev/api/openwa/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "message.received" }),
  });

  const response = await onRequestPost({ request, env: {} });
  const data = await response.json();

  assert.equal(response.status, 403);
  assert.equal(data.disabled, true);
});

test("extracts OpenWA message.received payloads", () => {
  const messages = extractOpenWaTextMessages({
    event: "message.received",
    sessionId: "renal-test",
    data: {
      message: {
        id: "openwa-1",
        chatId: "911234567890@c.us",
        body: "45 M 2.1 70 meropenem IV",
        fromMe: false,
        timestamp: 1710000000,
      },
    },
  });

  assert.deepEqual(messages, [
    {
      id: "openwa-1",
      chatId: "911234567890@c.us",
      text: "45 M 2.1 70 meropenem IV",
      sessionId: "renal-test",
      timestamp: "1710000000",
      isGroup: false,
    },
  ]);
});

test("extracts Baileys-style OpenWA message payloads", () => {
  const messages = extractOpenWaTextMessages({
    event: "messages.received",
    data: {
      messages: {
        key: {
          id: "baileys-1",
          fromMe: false,
          remoteJid: "911234567890@s.whatsapp.net",
        },
        messageBody: "45 M 2.1 70",
      },
    },
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, "baileys-1");
  assert.equal(messages[0].chatId, "911234567890@s.whatsapp.net");
  assert.equal(messages[0].text, "45 M 2.1 70");
});

test("OpenWA bot reply reuses the WhatsApp clinical text format", async () => {
  const reply = await buildOpenWaDoseReplyFromText("45 M 2.1 70", {
    request: new Request("https://renal-dose-calculator.pages.dev/api/openwa/webhook"),
    env: {},
  });

  assert.match(reply, /\*Patient\*/);
  assert.match(reply, /\*eGFR:\* 38\.8/);
  assert.match(reply, /\*CrCl:\* 44\.0/);
});

test("sendOpenWaText skips safely until OpenWA API config exists", async () => {
  const result = await sendOpenWaText({
    env: {},
    chatId: "911234567890@c.us",
    body: "Dose reply",
  });

  assert.equal(result.skipped, true);
  assert.match(result.reason, /OpenWA API URL/);
});

test("sendOpenWaText posts to OpenWA send-text endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedBody = null;
  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedBody = JSON.parse(options.body);
    assert.equal(options.headers["X-API-Key"], "openwa-key");
    return new Response(JSON.stringify({ id: "out-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await sendOpenWaText({
      env: {
        OPENWA_API_BASE_URL: "https://openwa.example.com",
        OPENWA_API_KEY: "openwa-key",
        OPENWA_SESSION_ID: "renal-test",
      },
      chatId: "911234567890@c.us",
      body: "Dose reply",
    });

    assert.equal(result.ok, true);
    assert.equal(capturedUrl, "https://openwa.example.com/api/sessions/renal-test/messages/send-text");
    assert.deepEqual(capturedBody, {
      chatId: "911234567890@c.us",
      text: "Dose reply",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("POST webhook accepts an enabled OpenWA message and sends a reply", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody = null;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://openwa.example.com/api/sessions/renal-test/messages/send-text");
    capturedBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: "out-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const request = new Request("https://renal-dose-calculator.pages.dev/api/openwa/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-openwa-secret": "webhook-secret",
      },
      body: JSON.stringify({
        event: "message.received",
        sessionId: "renal-test",
        data: {
          message: {
            id: "openwa-in-1",
            chatId: "911234567890@c.us",
            body: "45 M 2.1 70",
            fromMe: false,
          },
        },
      }),
    });

    const response = await onRequestPost({
      request,
      env: {
        OPENWA_EXPERIMENT_ENABLED: "true",
        OPENWA_WEBHOOK_SECRET: "webhook-secret",
        OPENWA_API_BASE_URL: "https://openwa.example.com",
        OPENWA_API_KEY: "openwa-key",
      },
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.received, 1);
    assert.equal(data.deliveries[0].ok, true);
    assert.equal(capturedBody.chatId, "911234567890@c.us");
    assert.match(capturedBody.text, /\*CrCl:\* 44\.0/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("POST webhook rejects wrong OpenWA webhook secret", async () => {
  const request = new Request("https://renal-dose-calculator.pages.dev/api/openwa/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-openwa-secret": "wrong",
    },
    body: JSON.stringify({ event: "message.received", data: { message: { body: "hi", chatId: "1@c.us" } } }),
  });

  const response = await onRequestPost({
    request,
    env: {
      OPENWA_EXPERIMENT_ENABLED: "true",
      OPENWA_WEBHOOK_SECRET: "correct",
    },
  });

  assert.equal(response.status, 401);
});

test("POST webhook accepts HMAC signed OpenWA payloads", async () => {
  const body = JSON.stringify({
    event: "message.received",
    data: { message: { id: "signed-1", body: "hi", chatId: "911234567890@c.us" } },
  });
  const signature = createHmac("sha256", "webhook-secret").update(body).digest("hex");
  const request = new Request("https://renal-dose-calculator.pages.dev/api/openwa/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-openwa-signature": `sha256=${signature}`,
    },
    body,
  });

  const response = await onRequestPost({
    request,
    env: {
      OPENWA_EXPERIMENT_ENABLED: "true",
      OPENWA_WEBHOOK_SECRET: "webhook-secret",
    },
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.received, 1);
  assert.equal(data.deliveries[0].skipped, true);
});
