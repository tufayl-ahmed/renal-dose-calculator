import { onRequestPost as renalDoseAssist } from "../renal-dose/assist.js";
import { buildCalculatorReplyFromText, limitText } from "../../../src/botReply.js";

const DEFAULT_GRAPH_VERSION = "v23.0";
const MAX_WHATSAPP_TEXT_LENGTH = 3900;
const MESSAGE_DEDUPE_TTL_SECONDS = 24 * 60 * 60;

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") || "";

  if (mode === "subscribe" && verifyToken && verifyToken === context.env?.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return jsonResponse({ ok: false, error: "WhatsApp webhook verification failed." }, 403);
}

export async function onRequestPost(context) {
  const rawBody = await context.request.text();
  const signatureHeader = context.request.headers.get("x-hub-signature-256") || "";

  if (!(await verifyMetaSignature(rawBody, signatureHeader, context.env?.WHATSAPP_APP_SECRET))) {
    return jsonResponse({ ok: false, error: "Invalid WhatsApp webhook signature." }, 401);
  }

  const payload = safeJsonParse(rawBody);
  if (!payload) {
    return jsonResponse({ ok: false, error: "Invalid WhatsApp webhook payload." }, 400);
  }

  const messages = extractWhatsAppTextMessages(payload);
  const deliveries = [];

  for (const message of messages) {
    if (await isDuplicateMessage(context.env, message.id)) {
      deliveries.push({ id: message.id, from: message.from, skipped: true, reason: "duplicate" });
      continue;
    }

    const body = await buildDoseReplyFromText(message.text, context);
    const delivery = await sendWhatsAppText({
      env: context.env,
      to: message.from,
      body,
      replyMessageId: message.id,
    });
    deliveries.push({ id: message.id, from: message.from, ...delivery });
  }

  return jsonResponse({ ok: true, received: messages.length, deliveries }, 200);
}

export async function buildDoseReplyFromText(text, context, options = {}) {
  return buildCalculatorReplyFromText(text, context, {
    ...options,
    assistRequester: options.assistRequester || requestDoseAssist,
    maxLength: MAX_WHATSAPP_TEXT_LENGTH,
    platform: "WhatsApp",
  });
}

export function extractWhatsAppTextMessages(payload) {
  const messages = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field && change.field !== "messages") {
        continue;
      }
      const value = change?.value || {};
      for (const message of value.messages || []) {
        const text = extractMessageText(message);
        if (!text) {
          continue;
        }
        messages.push({
          id: message.id || "",
          from: message.from || "",
          text,
          timestamp: message.timestamp || "",
        });
      }
    }
  }
  return messages;
}

export async function sendWhatsAppText({ env, to, body, replyMessageId = "" }) {
  return sendWhatsAppPayload({
    env,
    payload: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: limitText(body, MAX_WHATSAPP_TEXT_LENGTH),
      },
      ...(replyMessageId ? { context: { message_id: replyMessageId } } : {}),
    },
  });
}

async function sendWhatsAppPayload({ env, payload }) {
  const accessToken = env?.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = env?.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return {
      ok: false,
      skipped: true,
      reason: "WhatsApp credentials are not configured.",
    };
  }

  const version = sanitizeGraphVersion(env?.WHATSAPP_GRAPH_VERSION || DEFAULT_GRAPH_VERSION);
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return {
    ok: response.ok,
    status: response.status,
    response: await safeResponseJson(response),
  };
}

async function requestDoseAssist(values, context) {
  const url = new URL("/api/renal-dose/assist", context.request.url);
  const request = new Request(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const response = await renalDoseAssist({ ...context, request });
  return response.json();
}

function extractMessageText(message) {
  if (message?.type === "text") {
    return message.text?.body || "";
  }
  if (message?.type === "button") {
    return message.button?.text || "";
  }
  if (message?.type === "interactive") {
    return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "";
  }
  return "";
}

async function isDuplicateMessage(env, messageId) {
  if (!messageId || !env?.WHATSAPP_DEDUPE) {
    return false;
  }
  const key = `wa-message:${messageId}`;
  if (await env.WHATSAPP_DEDUPE.get(key)) {
    return true;
  }
  await env.WHATSAPP_DEDUPE.put(key, "1", { expirationTtl: MESSAGE_DEDUPE_TTL_SECONDS });
  return false;
}

async function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) {
    return true;
  }
  if (!signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = `sha256=${arrayBufferToHex(signature)}`;
  return timingSafeEqual(signatureHeader, expected);
}

function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function sanitizeGraphVersion(value) {
  const version = String(value || DEFAULT_GRAPH_VERSION).trim();
  return /^v\d+\.\d+$/.test(version) ? version : DEFAULT_GRAPH_VERSION;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function safeResponseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function jsonResponse(value, status) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
