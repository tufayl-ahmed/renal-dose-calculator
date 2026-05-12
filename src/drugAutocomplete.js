import { normalizeDrugKey } from "./drugNormalizer.js";
import { DRUG_AUTOCOMPLETE_ITEMS } from "./drugAutocompleteData.js";

const MAX_DEFAULT_SUGGESTIONS = 8;
const EXACT_ONLY_KEYS = new Set(["oxygen"]);
const NON_SYSTEMIC_AUTOCOMPLETE_PATTERN =
  /\b(?:topical|cream|ointment|gel|lotion|foam|shampoo|patch|transdermal|ophthalmic|otic|nasal|inhalation|vaginal|rectal|enema|suppository|rinse|mouthwash|toothpaste|fluoride|irrigation|oxygen|nitrogen|carbon dioxide|extract|allergen|antigen|pollen|leaf|root|flower|feather|hair|skin|homeopathic|technetium|diagnostic|device|test|assay|citrate phosphate|zinc oxide|calcium carbonate|citric acid|sodium citrate|sodium chloride|calcium chloride|magnesium chloride|phosphate|vitamin|mineral|fludeoxyglucose|gallium|gadolinium|gadoterate|gadobutrol|gadodiamide|iopidine|ammonia n 13|dry eye|ciprofolxacin|llevofloxacin|nalxone|araneus|bos taurus|sus scrofa|cairina|anemone|lytta|mercurius|goldenseal|gamboge|rhubarb|garlic|turmeric|black pepper|autolysate|thiamine|riboflavin|niacinamide|cobalamin|methylcobalamin|levomefolic|levomefolate|pantothenate|beta carotene|ascorbic acid|tocopherol|selenium|chromium|copper|cupric|manganese|molybdenum|vanadyl|zinc|arginine|choline|inulin|silicon dioxide|dextrose)\b/i;

const PRIORITY_ALIASES = [
  {
    label: "Piperacillin and tazobactam",
    value: "piperacillin and tazobactam",
    aliases: ["piptaz", "pip taz", "pip-taz", "pip/taz", "piptazo", "zosyn", "tazocin"],
  },
  {
    label: "Amoxicillin and clavulanate",
    value: "amoxicillin and clavulanate",
    aliases: ["augmentin", "amox clav", "amox-clav", "amoxyclav", "amoxiclav"],
  },
  {
    label: "Sulfamethoxazole and trimethoprim",
    value: "sulfamethoxazole and trimethoprim",
    aliases: ["bactrim", "septran", "tmp smx", "tmp-smx", "cotrimoxazole", "co-trimoxazole"],
  },
  {
    label: "Meropenem",
    value: "meropenem",
    aliases: ["mero", "meronem"],
  },
  {
    label: "Doxycycline",
    value: "doxycycline",
    aliases: ["doxy"],
  },
  {
    label: "Levofloxacin",
    value: "levofloxacin",
    aliases: ["levo", "levoflox", "levaquin"],
  },
  {
    label: "Vancomycin",
    value: "vancomycin",
    aliases: ["vanco", "vanc"],
  },
  {
    label: "Sitagliptin",
    value: "sitagliptin",
    aliases: ["januvia"],
  },
];

const LABEL_ENTRIES = DRUG_AUTOCOMPLETE_ITEMS.filter(isSystemicAutocompleteCandidate).map((item) => ({
  label: item.name,
  value: item.name,
  aliases: (item.aliases || []).filter((alias) => !NON_SYSTEMIC_AUTOCOMPLETE_PATTERN.test(alias)),
  source: item.source,
  count: item.count,
}));

const SEARCH_INDEX = buildSearchIndex([...PRIORITY_ALIASES, ...LABEL_ENTRIES]);

export const LOCAL_DRUG_AUTOCOMPLETE_COUNT = DRUG_AUTOCOMPLETE_ITEMS.length;
export const LOCAL_DRUG_AUTOCOMPLETE_SEARCHABLE_COUNT = LABEL_ENTRIES.length;

export function isSystemicAutocompleteCandidate(item) {
  const name = String(item?.name || "").trim();
  if (!name || NON_SYSTEMIC_AUTOCOMPLETE_PATTERN.test(name)) {
    return false;
  }

  const key = normalizeDrugKey(name);
  if (key.length < 3 || /^(?:sodium|potassium|calcium|magnesium|aluminum|silver|sulfur|phosphorus|helium|nitrogen|oxygen)$/.test(key)) {
    return false;
  }

  return true;
}

export function getDrugAutocompleteSuggestions(query, options = {}) {
  const limit = options.limit || MAX_DEFAULT_SUGGESTIONS;
  const trimmed = String(query || "").trim();
  if (!trimmed) {
    return [];
  }

  const queryKey = normalizeDrugKey(trimmed);
  const queryLower = trimmed.toLowerCase();
  if (!queryKey && queryLower.length < 2) {
    return [];
  }

  const scored = [];
  for (const entry of SEARCH_INDEX) {
    const match = scoreEntry(entry, queryKey, queryLower);
    if (!match.score) {
      continue;
    }
    scored.push({
      label: entry.label,
      value: entry.value,
      description: match.description,
      source: entry.source,
      score: match.score,
      count: entry.count,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map(({ score, count, ...suggestion }) => suggestion);
}

function buildSearchIndex(entries) {
  const seen = new Map();
  for (const entry of entries) {
    const label = entry.label || entry.name;
    const value = entry.value || label;
    const aliases = entry.aliases || [];
    const key = normalizeDrugKey(value);
    if (!key) {
      continue;
    }
    const existing = seen.get(key);
    if (existing) {
      existing.aliases = Array.from(new Set([...existing.aliases, ...aliases]));
      existing.aliasKeys = existing.aliases.map((alias) => normalizeDrugKey(alias)).filter(Boolean);
      existing.aliasLower = existing.aliases.map((alias) => alias.toLowerCase());
      existing.count = Math.max(existing.count || 0, entry.count || 0);
      continue;
    }
    seen.set(key, {
      label,
      value,
      aliases,
      source: entry.source || "alias",
      count: entry.count || 0,
      labelLower: label.toLowerCase(),
      valueLower: value.toLowerCase(),
      key,
      aliasKeys: aliases.map((alias) => normalizeDrugKey(alias)).filter(Boolean),
      aliasLower: aliases.map((alias) => alias.toLowerCase()),
    });
  }
  return Array.from(seen.values());
}

function scoreEntry(entry, queryKey, queryLower) {
  if (EXACT_ONLY_KEYS.has(entry.key) && entry.key !== queryKey) {
    return { score: 0, description: "" };
  }

  const aliasIndex = entry.aliasKeys.findIndex((aliasKey) => aliasKey === queryKey);
  if (aliasIndex >= 0) {
    return { score: 120, description: `Alias for ${entry.label}` };
  }

  if (entry.key === queryKey) {
    return { score: 115, description: sourceDescription(entry) };
  }

  const startsWithAlias = entry.aliasKeys.findIndex((aliasKey) => aliasKey.startsWith(queryKey));
  if (startsWithAlias >= 0 && queryKey.length >= 2) {
    return { score: 98, description: `Alias match: ${entry.aliasLower[startsWithAlias]}` };
  }

  if (entry.key.startsWith(queryKey)) {
    return { score: 90, description: sourceDescription(entry) };
  }

  if (entry.labelLower.split(/[^a-z0-9]+/).some((token) => token.startsWith(queryLower))) {
    return { score: 76, description: sourceDescription(entry) };
  }

  if (queryKey.length >= 3 && entry.key.includes(queryKey)) {
    return { score: 58, description: sourceDescription(entry) };
  }

  if (queryLower.length >= 3 && entry.valueLower.includes(queryLower)) {
    return { score: 44, description: sourceDescription(entry) };
  }

  return { score: 0, description: "" };
}

function sourceDescription(entry) {
  if (entry.source?.includes("brand")) {
    return "Local brand-name suggestion";
  }
  if (entry.source?.includes("generic")) {
    return "Local generic-name suggestion";
  }
  if (entry.source?.includes("substance")) {
    return "Local label-ingredient suggestion";
  }
  if (entry.source?.startsWith("rxnorm")) {
    return "Local RxNorm suggestion";
  }
  return "Local shorthand suggestion";
}
