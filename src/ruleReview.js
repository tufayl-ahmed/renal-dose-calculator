// Shared by scripts/export-rules-for-review.mjs and the in-app review page:
// turns a curated/candidate record into one row of the clinician review CSV.

export const REVIEW_HEADER = [
  "id",
  "drug",
  "routes",
  "label_rules",
  "structured_rules",
  "notes_from_extraction",
  "dailymed_url",
  "current_status",
  "current_reviewer",
  "decision",
  "reviewer",
  "review_date",
  "notes",
];

export function recordToReviewRow(record, { id, verification }, decision = {}) {
  return [
    id,
    record.drugName,
    record.routes.join(", "),
    record.rules.map((rule) => `${formatRuleBand(rule)}: ${formatVariants(rule.variants)}`).join("\n"),
    (record.structured?.rules || [])
      .map((rule) => `${formatRuleBand(rule)} [${contextLabel(rule)}]: ${rule.dose} ${rule.interval}`)
      .join("\n"),
    record.indicationNote,
    record.sourceUrl,
    verification.status,
    verification.verifiedBy,
    decision.decision || "",
    decision.reviewer || "",
    decision.date || "",
    decision.notes || "",
  ];
}

export function formatRuleBand(rule) {
  if (rule.type === "all") return "All values";
  if (rule.type === "gt") return `> ${rule.min}`;
  if (rule.type === "gte") return `>= ${rule.min}`;
  if (rule.type === "lt") return `< ${rule.max}`;
  return `${rule.min}-${rule.max}`;
}

export function formatVariants(variants) {
  return variants
    .map((variant) => [variant.condition, `${variant.dose} ${variant.interval}`.trim()].filter(Boolean).join(": "))
    .join(" | ");
}

export function contextLabel(rule) {
  return (
    ["dialysis", "indication", "formulation"]
      .map((key) => (rule[key] && rule[key] !== "any" ? `${key}=${rule[key]}` : ""))
      .filter(Boolean)
      .join(", ") || "any"
  );
}
