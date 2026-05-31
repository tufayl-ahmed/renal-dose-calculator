import { onRequestPost as renalDoseAssist } from "../renal-dose/assist.js";
import { buildCalculatorReplyFromText, limitText } from "../../../src/botReply.js";

const MAX_OPENWA_TEXT_LENGTH = 3900;
const MESSAGE_DEDUPE_TTL_SECONDS = 24 * 60 * 60;

export async function onRequestGet(context) {
  return jsonResponse(
    {
      ok: true,
      service: "openwa-experimental-webhook",
      enabled: isExperimentEnabled(context.env),
      route: "/api/openwa/webhook",
    },
    200
  );
}

export async function onRequestPost(context) {
  if (!isExperimentEnabled(context.env)) {
    return jsonResponse(
      {
        ok: false,
        disabled: true,
        error: "OpenWA experiment is disabled. Set OPENWA_EXPERIMENT_ENABLED=true to use it.",
      },
      403
    );
  }

  const rawBody = await context.request.text();
  if (!(await verifyOpenWaRequest(context.request, rawBody, context.env))) {
    return jsonResponse({ ok: false, error: "Invalid OpenWA webhook secret or signature." }, 401);
  }

  const payload = safeJsonParse(rawBody);
  if (!payload) {
    return jsonResponse({ ok: false, error: "Invalid OpenWA webhook payload." }, 400);
  }

  const messages = extractOpenWaTextMessages(payload, {
    allowGroups: isTruthy(context.env?.OPENWA_ALLOW_GROUPS),
  });
  const deliveries = [];

  for (const message of messages) {
    if (await isDuplicateMessage(context.env, message.id)) {
      deliveries.push({ id: message.id, chatId: message.chatId, skipped: true, reason: "duplicate" });
      continue;
    }

    if (message.isGroup && !isTruthy(context.env?.OPENWA_ALLOW_GROUPS)) {
      deliveries.push({ id: message.id, chatId: message.chatId, skipped: true, reason: "group chat ignored" });
      continue;
    }

    const body = await buildOpenWaDoseReplyFromText(message.text, context);
    const delivery = await sendOpenWaText({
      env: context.env,
      chatId: message.chatId,
      body,
      sessionId: message.sessionId,
    });
    deliveries.push({ id: message.id, chatId: message.chatId, ...delivery });
  }

  logOpenWaDeliveries(messages, deliveries);

  return jsonResponse({ ok: true, received: messages.length, deliveries }, 200);
}

export async function buildOpenWaDoseReplyFromText(text, context, options = {}) {
  return buildCalculatorReplyFromText(text, context, {
    ...options,
    assistRequester: options.assistRequester || requestDoseAssist,
    maxLength: MAX_OPENWA_TEXT_LENGTH,
    platform: "WhatsApp",
  });
}

export function extractOpenWaTextMessages(payload, options = {}) {
  const candidates = collectMessageCandidates(payload);
  const messages = [];

  for (const candidate of candidates) {
    if (isOutgoingMessage(candidate)) {
      continue;
    }

    const text = extractCandidateText(candidate);
    const chatId = extractCandidateChatId(candidate);
    if (!text || !chatId) {
      continue;
    }

    const isGroup = /@g\.us$/i.test(chatId);
    if (isGroup && !options.allowGroups) {
      messages.push({
        id: extractCandidateId(candidate),
        chatId,
        text,
        sessionId: extractCandidateSessionId(candidate, payload),
        timestamp: extractCandidateTimestamp(candidate),
        isGroup,
      });
      continue;
    }

    messages.push({
      id: extractCandidateId(candidate),
      chatId,
      text,
      sessionId: extractCandidateSessionId(candidate, payload),
      timestamp: extractCandidateTimestamp(candidate),
      isGroup,
    });
  }

  return messages;
}

export async function sendOpenWaText({ env, chatId, body, sessionId = "" }) {
  const apiBaseUrl = normalizeApiBaseUrl(env?.OPENWA_API_BASE_URL);
  const apiKey = env?.OPENWA_API_KEY;
  const resolvedSessionId = encodeURIComponent(sessionId || env?.OPENWA_SESSION_ID || "");

  if (!apiBaseUrl || !apiKey || !resolvedSessionId) {
    return {
      ok: false,
      skipped: true,
      reason: "OpenWA API URL, API key, or session ID is not configured.",
    };
  }

  const response = await fetch(`${apiBaseUrl}/sessions/${resolvedSessionId}/messages/send-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      chatId,
      text: limitText(body, MAX_OPENWA_TEXT_LENGTH),
    }),
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

function collectMessageCandidates(payload) {
  const candidates = [];
  const push = (value) => {
    if (value && typeof value === "object") {
      candidates.push(value);
    }
  };

  if (Array.isArray(payload?.messages)) {
    payload.messages.forEach(push);
  }
  if (Array.isArray(payload?.data?.messages)) {
    payload.data.messages.forEach(push);
  }
  if (payload?.data?.messages && !Array.isArray(payload.data.messages)) {
    push(payload.data.messages);
  }
  if (payload?.message) {
    push(payload.message);
  }
  if (payload?.data?.message) {
    push(payload.data.message);
  }
  if (payload?.data && looksLikeMessage(payload.data)) {
    push(payload.data);
  }
  if (looksLikeMessage(payload)) {
    push(payload);
  }

  return candidates;
}

function looksLikeMessage(value) {
  return Boolean(
    value?.body ||
      value?.text ||
      value?.messageBody ||
      value?.conversation ||
      value?.message?.conversation ||
      value?.message?.extendedTextMessage?.text ||
      value?.chatId ||
      value?.from ||
      value?.key?.remoteJid
  );
}

function isOutgoingMessage(message) {
  return Boolean(message?.fromMe || message?.key?.fromMe || message?._data?.id?.fromMe);
}

function extractCandidateText(message) {
  return compactText(
    message?.body ||
      message?.text ||
      message?.messageBody ||
      message?.conversation ||
      message?.content ||
      message?.caption ||
      message?.message?.conversation ||
      message?.message?.extendedTextMessage?.text ||
      message?._data?.body ||
      message?._data?.caption
  );
}

function extractCandidateChatId(message) {
  return compactText(
    message?.chatId ||
      message?.from ||
      message?.sender ||
      message?.to ||
      message?.key?.remoteJid ||
      message?._data?.from ||
      message?._data?.to
  );
}

function extractCandidateId(message) {
  return compactText(message?.id || message?.messageId || message?.key?.id || message?._data?.id?.id);
}

function extractCandidateTimestamp(message) {
  return compactText(message?.timestamp || message?.t || message?._data?.t);
}

function extractCandidateSessionId(message, payload) {
  return compactText(
    message?.sessionId ||
      message?.session ||
      message?.instanceId ||
      payload?.sessionId ||
      payload?.session ||
      payload?.instanceId ||
      payload?.data?.sessionId
  );
}

async function verifyOpenWaRequest(request, rawBody, env) {
  const secret = env?.OPENWA_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) {
    return true;
  }

  const authorization = request.headers.get("authorization") || "";
  if (authorization === `Bearer ${secret}`) {
    return true;
  }

  const directSecret =
    request.headers.get("x-openwa-secret") ||
    request.headers.get("x-webhook-secret") ||
    request.headers.get("x-renaldose-secret") ||
    "";
  if (directSecret === secret) {
    return true;
  }

  const signature =
    request.headers.get("x-openwa-signature") ||
    request.headers.get("x-webhook-signature") ||
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("x-signature") ||
    "";
  const timestamp = request.headers.get("x-openwa-timestamp") || request.headers.get("x-webhook-timestamp") || "";
  return verifyHmacSignature(rawBody, signature, secret, timestamp);
}

async function verifyHmacSignature(rawBody, signatureHeader, secret, timestamp = "") {
  if (!signatureHeader) {
    return false;
  }

  const payloads = timestamp ? [rawBody, `${timestamp}.${rawBody}`] : [rawBody];
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const normalized = signatureHeader.trim();

  for (const payload of payloads) {
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const expectedHex = arrayBufferToHex(signature);
    const expectedBase64 = arrayBufferToBase64(signature);
    const matches = [expectedHex, `sha256=${expectedHex}`, expectedBase64, `sha256=${expectedBase64}`].some(
      (expected) => timingSafeEqual(normalized, expected)
    );
    if (matches) {
      return true;
    }
  }
  return false;
}

async function isDuplicateMessage(env, messageId) {
  if (!messageId || !env?.WHATSAPP_DEDUPE) {
    return false;
  }
  const key = `openwa-message:${messageId}`;
  if (await env.WHATSAPP_DEDUPE.get(key)) {
    return true;
  }
  await env.WHATSAPP_DEDUPE.put(key, "1", { expirationTtl: MESSAGE_DEDUPE_TTL_SECONDS });
  return false;
}

function logOpenWaDeliveries(messages, deliveries) {
  try {
    console.log(
      "openwa_delivery",
      JSON.stringify({
        received: messages.length,
        deliveries: deliveries.map((delivery) => ({
          id: tailId(delivery.id),
          chatId: tailId(delivery.chatId),
          ok: Boolean(delivery.ok),
          skipped: Boolean(delivery.skipped),
          status: delivery.status || null,
          reason: delivery.reason || "",
        })),
      })
    );
  } catch {
    console.log("openwa_delivery", JSON.stringify({ received: messages.length, logError: true }));
  }
}

function normalizeApiBaseUrl(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text) {
    return "";
  }
  return text.endsWith("/api") ? text : `${text}/api`;
}

function isExperimentEnabled(env) {
  return isTruthy(env?.OPENWA_EXPERIMENT_ENABLED);
}

function isTruthy(value) {
  return /^(?:1|true|yes|on)$/i.test(String(value || "").trim());
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function tailId(value) {
  const text = String(value || "");
  if (!text) {
    return "";
  }
  return text.length <= 8 ? text : `...${text.slice(-8)}`;
}

function arrayBufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function arrayBufferToBase64(buffer) {
  const bytes = [...new Uint8Array(buffer)];
  const binary = bytes.map((byte) => String.fromCharCode(byte)).join("");
  return btoa(binary);
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
