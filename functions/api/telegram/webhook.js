import { APP_URL, limitText } from "../../../src/botReply.js";

const MAX_TELEGRAM_TEXT_LENGTH = 3900;
const MINI_APP_URL = `${APP_URL}/?telegram=1`;

export async function onRequestGet() {
  return jsonResponse({
    ok: true,
    service: "telegram-miniapp-launcher",
    miniAppUrl: MINI_APP_URL,
  });
}

export async function onRequestPost(context) {
  const secret = context.env?.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = context.request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (secret && headerSecret !== secret) {
    return jsonResponse({ ok: false, error: "Invalid Telegram webhook secret." }, 401);
  }

  let update;
  try {
    update = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid Telegram webhook payload." }, 400);
  }

  const message = update.message || update.edited_message || null;
  if (!message?.chat?.id) {
    return jsonResponse({ ok: true, deliveries: [] });
  }

  const delivery = await sendMiniAppLauncher({
    env: context.env,
    chatId: message.chat.id,
    replyToMessageId: message.message_id || "",
  });

  return jsonResponse({ ok: true, deliveries: [delivery] });
}

export async function sendMiniAppLauncher({ env, chatId, replyToMessageId = "" }) {
  return sendTelegramMessage({
    env,
    chatId,
    replyToMessageId,
    text: buildMiniAppLauncherText(),
    replyMarkup: miniAppKeyboard(),
  });
}

export async function sendTelegramMessage({ env, chatId, text, replyToMessageId = "", replyMarkup = null }) {
  if (!env?.TELEGRAM_BOT_TOKEN) {
    return {
      ok: false,
      skipped: true,
      reason: "Telegram bot token is not configured.",
    };
  }

  const payload = {
    chat_id: chatId,
    text: limitText(text, MAX_TELEGRAM_TEXT_LENGTH),
    disable_web_page_preview: true,
    ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };

  const response = await fetch(telegramApiUrl(env, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    ok: response.ok,
    status: response.status,
    response: await safeResponseJson(response),
  };
}

export function buildMiniAppLauncherText() {
  return [
    "Renal Dose Calculator",
    "",
    "Open the Telegram Mini App to calculate adult eGFR, Cockcroft-Gault CrCl, and DailyMed renal-dose guidance.",
    "",
    "Educational only. Results are estimates and are not for prescribing.",
    "Made by Dr. Tufayl (Cortex Labs)",
  ].join("\n");
}

export function miniAppKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "Open Renal Dose Calculator",
          web_app: { url: MINI_APP_URL },
        },
      ],
    ],
  };
}

function telegramApiUrl(env, method) {
  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

async function safeResponseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
