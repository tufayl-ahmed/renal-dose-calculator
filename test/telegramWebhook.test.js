import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMiniAppLauncherText,
  miniAppKeyboard,
  onRequestGet,
  onRequestPost,
  sendMiniAppLauncher,
  sendTelegramMessage,
} from "../functions/api/telegram/webhook.js";

test("Telegram webhook GET returns Mini App launcher health JSON", async () => {
  const response = await onRequestGet();
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.service, "telegram-miniapp-launcher");
  assert.equal(data.miniAppUrl, "https://renal-dose-calculator.pages.dev/?telegram=1");
});

test("Telegram webhook rejects wrong secret token", async () => {
  const request = new Request("https://renal-dose-calculator.pages.dev/api/telegram/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-api-secret-token": "wrong",
    },
    body: JSON.stringify({ message: { chat: { id: 1 }, text: "/start" } }),
  });

  const response = await onRequestPost({
    request,
    env: { TELEGRAM_WEBHOOK_SECRET: "correct" },
  });

  assert.equal(response.status, 401);
});

test("Telegram launcher text only points users to the Mini App", () => {
  const text = buildMiniAppLauncherText();

  assert.match(text, /Open the Telegram Mini App/);
  assert.match(text, /Made by Dr\. Tufayl \(Cortex Labs\)/);
  assert.doesNotMatch(text, /\/calc|FORM|copy-paste|guided/i);
});

test("Telegram launcher keyboard uses a web_app button", () => {
  const keyboard = miniAppKeyboard();
  const button = keyboard.inline_keyboard[0][0];

  assert.equal(button.text, "Open Renal Dose Calculator");
  assert.deepEqual(button.web_app, {
    url: "https://renal-dose-calculator.pages.dev/?telegram=1",
  });
  assert.equal(button.callback_data, undefined);
  assert.equal(button.url, undefined);
});

test("sendTelegramMessage skips safely until token is configured", async () => {
  const result = await sendTelegramMessage({
    env: {},
    chatId: 123,
    text: "Hello",
  });

  assert.equal(result.skipped, true);
  assert.match(result.reason, /token/);
});

test("sendMiniAppLauncher posts Mini App button to Telegram", async () => {
  const calls = await withMockFetch(async () => {
    const result = await sendMiniAppLauncher({
      env: { TELEGRAM_BOT_TOKEN: "telegram-token" },
      chatId: 123,
      replyToMessageId: 55,
    });

    assert.equal(result.ok, true);
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.telegram.org/bottelegram-token/sendMessage");
  assert.equal(calls[0].body.chat_id, 123);
  assert.equal(calls[0].body.reply_to_message_id, 55);
  assert.match(calls[0].body.text, /Open the Telegram Mini App/);
  assert.equal(calls[0].body.reply_markup.inline_keyboard[0][0].web_app.url, "https://renal-dose-calculator.pages.dev/?telegram=1");
});

test("Telegram webhook replies with Mini App launcher for any user message", async () => {
  const calls = await withMockFetch(async () => {
    const response = await onRequestPost({
      request: telegramMessageRequest("45 M 2.1 70 meropenem IV"),
      env: { TELEGRAM_BOT_TOKEN: "telegram-token" },
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].body.text, /Open the Telegram Mini App/);
  assert.doesNotMatch(calls[0].body.text, /eGFR\s+38\.8|CrCl\s+44\.0|Dose:/);
  assert.equal(calls[0].body.reply_markup.inline_keyboard[0][0].web_app.url, "https://renal-dose-calculator.pages.dev/?telegram=1");
});

test("Telegram webhook ignores callback-only updates", async () => {
  const response = await onRequestPost({
    request: new Request("https://renal-dose-calculator.pages.dev/api/telegram/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query: {
          id: "callback-id",
          data: "old:callback",
          message: { message_id: 45, chat: { id: 123 } },
        },
      }),
    }),
    env: { TELEGRAM_BOT_TOKEN: "telegram-token" },
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(data.deliveries, []);
});

function telegramMessageRequest(text) {
  return new Request("https://renal-dose-calculator.pages.dev/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        message_id: 44,
        chat: { id: 123 },
        text,
      },
    }),
  });
}

async function withMockFetch(callback) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      body: options.body ? JSON.parse(options.body) : null,
    });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 100 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await callback();
    return calls;
  } finally {
    globalThis.fetch = originalFetch;
  }
}
