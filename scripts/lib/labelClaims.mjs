// Shared by scripts/verify-rules-against-labels.mjs and test/labelTextClaims.test.js:
// turns a curated record into checkable numeric claims and looks them up in
// normalised label text.

const KIDNEY_TERM = /creatinine clearance|crcl|clcr|e?gfr|renal|kidney|dialy|esrd|eskd|end[- ]stage/;
const KIDNEY_WINDOW = 300;

// Thresholds that are standard impairment categories rather than numbers the
// label must print: a band at 15 named "ESRD", 30 named "severe", 60 named
// "moderate"/"mild", 90 named "mild"/"normal". The label states the category.
const CATEGORY_THRESHOLDS = [
  { value: 15, pattern: /end[- ]stage|esrd|eskd|kidney failure|dialysis/i },
  { value: 30, pattern: /severe/i },
  { value: 60, pattern: /moderate|mild/i },
  { value: 90, pattern: /mild|normal|no renal impairment|any renal/i },
];

const UNIT_WORDS = {
  mg: "(?:mg|milligrams?)",
  g: "(?:g|grams?)",
  mcg: "(?:mcg|µg|micrograms?)",
  unit: "(?:units?)",
  ml: "(?:ml|milliliters?)",
  "%": "(?:%|percent)",
};

export function normalizeLabelText(text) {
  return ` ${String(text)
    .toLowerCase()
    .replace(/(\d),(\d{3})\b/g, "$1$2")
    .replace(/[–—−]/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/\s+/g, " ")} `;
}

/**
 * Claims for one record:
 *  - threshold: a band bound (29.99 → 30, 30.01 → 30) that must appear near a kidney term
 *  - amount: "0.3 mg", "50%" in dose/interval text
 *  - interval: "every 48 hours"
 */
export function extractClaims(record) {
  const claims = [];
  const ruleText = (rule) => rule.variants.map((v) => `${v.condition} ${v.dose} ${v.interval}`).join(" ");
  for (const rule of record.rules) {
    for (const bound of [rule.min, rule.max]) {
      if (!Number.isFinite(bound) || bound <= 0) {
        continue;
      }
      const value = roundBound(bound);
      // A threshold is shared by the bands on both sides; the category word
      // ("severe", "end-stage") usually sits in the lower one.
      const touching = record.rules
        .filter((other) => [other.min, other.max].some((b) => Number.isFinite(b) && roundBound(b) === value))
        .map(ruleText)
        .join(" ");
      if (CATEGORY_THRESHOLDS.some((c) => c.value === value && c.pattern.test(touching))) {
        continue;
      }
      claims.push({ type: "threshold", value, key: `t:${value}`, label: `threshold ${value}` });
    }
    for (const variant of rule.variants) {
      const text = `${variant.dose} ${variant.interval}`.replace(/(\d),(\d{3})\b/g, "$1$2");
      // "mL/min" is a clearance unit, not an amount.
      for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*(mg|g|mcg|units?|ml|%)(?![a-z]|\/min)/gi)) {
        const unit = match[2].toLowerCase().replace(/^units?$/, "unit");
        const value = match[1];
        claims.push({ type: "amount", value, unit, key: `a:${value}${unit}`, label: `${value} ${unit}` });
      }
      for (const match of text.matchAll(/every (\d+) hours?/gi)) {
        claims.push({ type: "interval", value: match[1], key: `i:${match[1]}h`, label: `every ${match[1]} hours` });
      }
    }
  }
  const seen = new Set();
  return claims.filter((claim) => !seen.has(claim.key) && seen.add(claim.key));
}

export function findClaim(normalized, claim) {
  if (claim.type === "threshold") {
    // Labels write ranges inclusively ("30 to 89"), so 90 may appear as 89.
    const candidates = Number.isInteger(claim.value) ? [claim.value, claim.value - 1] : [claim.value];
    return candidates.some((value) => {
      const pattern = new RegExp(`(?<![\\d.])${escape(String(value))}(?![\\d]|\\.\\d)`, "g");
      for (const match of normalized.matchAll(pattern)) {
        const window = normalized.slice(Math.max(0, match.index - KIDNEY_WINDOW), match.index + KIDNEY_WINDOW);
        if (KIDNEY_TERM.test(window)) {
          return true;
        }
      }
      return false;
    });
  }
  if (claim.type === "amount") {
    const value = escape(claim.value).replace(/^0\\\./, "0?\\.");
    return new RegExp(`(?<![\\d.])${value}\\s*-?\\s*${UNIT_WORDS[claim.unit]}(?![a-z])`).test(normalized);
  }
  const hours = escape(claim.value);
  return new RegExp(`(?:every|q)\\s*${hours}\\s*-?\\s*(?:hours?|hrs?|h)\\b|${hours}[- ]hours?`).test(normalized);
}

function roundBound(bound) {
  const fraction = bound - Math.floor(bound);
  if (fraction > 0.9) {
    return Math.ceil(bound);
  }
  if (fraction > 0 && fraction < 0.1) {
    return Math.floor(bound);
  }
  return bound;
}

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
