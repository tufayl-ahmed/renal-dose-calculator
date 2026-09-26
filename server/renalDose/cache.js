export const ASSIST_CACHE_TTL_SECONDS = 60 * 60 * 24;

export const LABEL_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const ASSIST_CACHE_VERSION = "v27-output-quality";

export function buildAssistCacheKey({ patient, label }) {
  const crclBand = Number.isFinite(patient.crcl) ? Math.floor(patient.crcl / 5) * 5 : "unknown";
  const params = new URLSearchParams({
    version: ASSIST_CACHE_VERSION,
    drug: label.setId || patient.normalizedDrug?.searchTerm || patient.drug,
    route: patient.route || "ALL",
    crclBand: String(crclBand),
    // Some labels dose by serum creatinine, so answers differ by SCr too.
    scr: Number.isFinite(patient.creatinine) ? patient.creatinine.toFixed(1) : "unknown",
    dialysis: patient.dialysis || "none",
    indication: patient.indication || "any",
    formulation: patient.formulation || "any",
  });
  return `https://renal-dose.local/cache/assist?${params.toString()}`;
}

export async function readJsonCache(key) {
  if (typeof caches === "undefined" || !caches.default) {
    return null;
  }
  try {
    const cached = await caches.default.match(new Request(key, { method: "GET" }));
    return cached ? cached.json() : null;
  } catch {
    return null;
  }
}

export async function writeJsonCache(key, value, ttlSeconds) {
  if (typeof caches === "undefined" || !caches.default) {
    return;
  }
  try {
    const response = new Response(JSON.stringify(value), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttlSeconds}`,
      },
    });
    await caches.default.put(new Request(key, { method: "GET" }), response);
  } catch {
    // Cache failures should never block clinical source review.
  }
}
