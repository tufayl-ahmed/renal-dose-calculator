const RXNAV_APPROXIMATE_URL = "https://rxnav.nlm.nih.gov/REST/approximateTerm.json";
const RXNAV_TIMEOUT_MS = 2200;
const RXNAV_CACHE_PREFIX = "renal-dose-rxnav:";
const RXNAV_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ALIAS_GROUPS = [
  {
    searchTerm: "piperacillin and tazobactam",
    displayName: "Piperacillin and tazobactam",
    aliases: [
      "piptaz",
      "pip taz",
      "pip-taz",
      "pip/taz",
      "piptazo",
      "pip tazo",
      "pip-tazo",
      "pip/tazo",
      "zosyn",
      "tazocin",
      "piperacillin tazobactam",
      "piperacillin-tazobactam",
      "piperacillin/tazobactam",
      "piperacillin and tazobactam",
    ],
  },
  {
    searchTerm: "meropenem",
    displayName: "Meropenem",
    aliases: ["mero", "meronem", "meropenem"],
  },
  {
    searchTerm: "doxycycline",
    displayName: "Doxycycline",
    aliases: ["doxy", "doxycycline"],
  },
  {
    searchTerm: "levofloxacin",
    displayName: "Levofloxacin",
    aliases: ["levo", "levoflox", "levaquin", "levofloxacin"],
  },
  {
    searchTerm: "vancomycin",
    displayName: "Vancomycin",
    aliases: ["vanco", "vanc", "vancomycin"],
  },
  {
    searchTerm: "januvia",
    displayName: "Sitagliptin",
    aliases: ["sitagliptin", "januvia"],
  },
  {
    searchTerm: "amoxicillin and clavulanate",
    displayName: "Amoxicillin and clavulanate",
    aliases: [
      "augmentin",
      "amox clav",
      "amox-clav",
      "amoxyclav",
      "amoxiclav",
      "amoxicillin clavulanate",
      "amoxicillin and clavulanate",
    ],
  },
  {
    searchTerm: "sulfamethoxazole and trimethoprim",
    displayName: "Sulfamethoxazole and trimethoprim",
    aliases: ["bactrim", "septran", "tmp smx", "tmp-smx", "co-trimoxazole", "cotrimoxazole"],
  },
];

const FORM_WORDS = new Set([
  "cap",
  "capsule",
  "capsules",
  "inj",
  "injection",
  "iv",
  "oral",
  "po",
  "tab",
  "tablet",
  "tablets",
]);

const ALIASES = new Map(
  ALIAS_GROUPS.flatMap((group) =>
    group.aliases.map((alias) => [
      normalizeDrugKey(alias),
      {
        searchTerm: group.searchTerm,
        displayName: group.displayName,
      },
    ])
  )
);

export async function normalizeDrugQuery(input) {
  const original = compactDrugName(input);
  if (!original) {
    return null;
  }

  const alias = ALIASES.get(normalizeDrugKey(original));
  if (alias) {
    return buildNormalizationResult({
      original,
      searchTerm: alias.searchTerm,
      displayName: alias.displayName,
      source: "local-alias",
    });
  }

  const rxNormMatch = await findRxNormMatch(original);
  if (rxNormMatch) {
    return buildNormalizationResult({
      original,
      searchTerm: rxNormMatch.searchTerm,
      displayName: rxNormMatch.displayName,
      source: "rxnorm",
      rxcui: rxNormMatch.rxcui,
    });
  }

  return buildNormalizationResult({
    original,
    searchTerm: original,
    displayName: original,
    source: "input",
  });
}

export function normalizeDrugKey(value) {
  return compactDrugName(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((part) => part && part !== "and" && !FORM_WORDS.has(part))
    .join("");
}

function buildNormalizationResult({ original, searchTerm, displayName, source, rxcui = "" }) {
  const changed = normalizeDrugKey(original) !== normalizeDrugKey(searchTerm);

  return {
    original,
    searchTerm,
    displayName,
    source,
    rxcui,
    changed,
  };
}

async function findRxNormMatch(drug) {
  if (!shouldUseRxNorm(drug) || typeof fetch !== "function") {
    return null;
  }

  const cacheKey = drug.toLowerCase();
  const cached = readRxNormCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      term: drug,
      maxEntries: "5",
      option: "1",
    });
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller
      ? globalThis.setTimeout(() => controller.abort(), RXNAV_TIMEOUT_MS)
      : null;

    const response = await fetch(`${RXNAV_APPROXIMATE_URL}?${params.toString()}`, {
      signal: controller?.signal,
    });

    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const match = pickRxNormCandidate(json);
    writeRxNormCache(cacheKey, match);
    return match;
  } catch {
    return null;
  }
}

function shouldUseRxNorm(drug) {
  if (typeof window === "undefined") {
    return false;
  }

  const cleaned = compactDrugName(drug);
  return cleaned.length >= 3 && /[a-z]/i.test(cleaned);
}

function pickRxNormCandidate(json) {
  const candidates = json?.approximateGroup?.candidate;
  if (!Array.isArray(candidates)) {
    return null;
  }

  const namedCandidates = candidates
    .filter((candidate) => candidate?.name && candidate?.rxcui)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  const candidate = namedCandidates[0];
  if (!candidate) {
    return null;
  }

  const searchTerm = simplifyRxNormName(candidate.name);
  if (!searchTerm) {
    return null;
  }

  return {
    searchTerm,
    displayName: toTitleCase(searchTerm),
    rxcui: candidate.rxcui,
  };
}

function simplifyRxNormName(name) {
  const withoutBrand = String(name || "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|gram|grams|ml|meq|unit|units|%)\b/gi, " ")
    .replace(/\b(?:oral|intravenous|subcutaneous|tablet|capsule|solution|suspension|injection|powder|vial|syringe|extended release)\b/gi, " ");

  return compactDrugName(withoutBrand)
    .replace(/\s*\/\s*/g, " and ")
    .replace(/\s*,\s*/g, " and ")
    .replace(/\bwith\b/gi, "and")
    .replace(/\s+and\s+and\s+/gi, " and ")
    .trim();
}

function compactDrugName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(value) {
  return compactDrugName(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function readRxNormCache(key) {
  try {
    const raw = window.localStorage.getItem(`${RXNAV_CACHE_PREFIX}${key}`);
    if (!raw) {
      return null;
    }
    const entry = JSON.parse(raw);
    if (Date.now() - entry.createdAt > RXNAV_CACHE_TTL_MS) {
      window.localStorage.removeItem(`${RXNAV_CACHE_PREFIX}${key}`);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

function writeRxNormCache(key, value) {
  if (!value) {
    return;
  }

  try {
    window.localStorage.setItem(
      `${RXNAV_CACHE_PREFIX}${key}`,
      JSON.stringify({
        createdAt: Date.now(),
        value,
      })
    );
  } catch {
    // RxNorm cache is an optional speed-up.
  }
}
