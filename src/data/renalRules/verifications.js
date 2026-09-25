// Clinician verification of curated renal rules.
//
// Keys are record ids from curatedRecordId() ("<search-term>:<ROUTES>").
// Only a clinician should add entries here, normally via
// scripts/import-rule-verifications.mjs after reviewing the exported CSV.
//
// status: "verified" (approved for display as verified) or "retired"
// (hidden from dose lookup, kept for audit history).
export const RULE_VERIFICATIONS = {};
