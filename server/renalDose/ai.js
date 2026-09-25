const PRIMARY_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

const FALLBACK_MODEL = "@cf/google/gemma-3-12b-it";

const DEFAULT_FREE_AI_DAILY_REQUEST_LIMIT = 200;

export async function runWorkersAi(env, messages) {
  if (!env?.AI) {
    return {
      raw: JSON.stringify({
        status: "review_source",
        drugName: "Selected drug",
        route: "All routes",
        renalMetricUsed: "crcl",
        renalBand: "",
        dose: "Review DailyMed source",
        frequency: "Cloudflare Workers AI binding is not configured.",
        dialysisNote: "",
        importantCautions: [],
        sourceSetId: "",
        sourceUrl: "",
      }),
      modelUsed: "",
      sourceMode: "no-ai-binding",
    };
  }

  const schema = {
    type: "object",
    properties: {
      status: { type: "string" },
      drugName: { type: "string" },
      route: { type: "string" },
      renalMetricUsed: { type: "string" },
      renalBand: { type: "string" },
      dose: { type: "string" },
      frequency: { type: "string" },
      dialysisNote: { type: "string" },
      importantCautions: { type: "array", items: { type: "string" } },
      sourceSetId: { type: "string" },
      sourceUrl: { type: "string" },
    },
    required: [
      "status",
      "drugName",
      "route",
      "renalMetricUsed",
      "renalBand",
      "dose",
      "frequency",
      "dialysisNote",
      "importantCautions",
      "sourceSetId",
      "sourceUrl",
    ],
  };

  try {
    const primary = await env.AI.run(PRIMARY_MODEL, {
      messages,
      temperature: 0,
      max_tokens: 420,
      guided_json: schema,
    });
    return {
      raw: primary.response || primary,
      modelUsed: PRIMARY_MODEL,
      sourceMode: "cloudflare-ai-small-model",
    };
  } catch {
    const fallback = await env.AI.run(FALLBACK_MODEL, {
      messages,
      temperature: 0,
      max_tokens: 420,
    });
    return {
      raw: fallback.response || fallback,
      modelUsed: FALLBACK_MODEL,
      sourceMode: "cloudflare-ai-fallback-model",
    };
  }
}

export async function reserveFreeAiCall(env) {
  if (!env?.AI) {
    return { allowed: true, freeMode: true, remaining: null, sourceMode: "no-ai-binding" };
  }

  const freeMode = String(env.AI_FREE_MODE || "true").toLowerCase() !== "false";
  if (!freeMode) {
    return { allowed: true, freeMode: false, remaining: null, sourceMode: "cloudflare-ai" };
  }

  const limit = parsePositiveInteger(env.FREE_AI_DAILY_REQUEST_LIMIT, DEFAULT_FREE_AI_DAILY_REQUEST_LIMIT);
  if (!env.AI_USAGE) {
    return {
      allowed: true,
      freeMode: true,
      remaining: null,
      sourceMode: "cloudflare-ai-small-model",
      reason: "AI_USAGE KV is not configured; using compact prompts and cache-only cost control.",
    };
  }

  const key = `ai-usage:${new Date().toISOString().slice(0, 10)}`;
  const current = parsePositiveInteger(await env.AI_USAGE.get(key), 0);
  if (current >= limit) {
    return {
      allowed: false,
      freeMode: true,
      remaining: 0,
      sourceMode: "free-quota-guard",
      reason: "Free AI daily request guard reached. Review the DailyMed source.",
    };
  }

  await env.AI_USAGE.put(key, String(current + 1), { expirationTtl: 60 * 60 * 48 });
  return {
    allowed: true,
    freeMode: true,
    remaining: Math.max(limit - current - 1, 0),
    sourceMode: "cloudflare-ai-free-guard",
  };
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
