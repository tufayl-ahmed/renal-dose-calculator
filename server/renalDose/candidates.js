import { findCandidateRenalDoseGuidance } from "../../src/curatedDoseRules.js";
import { toCuratedPayload } from "./curated.js";

/**
 * Step 2 of the dose pipeline: auto-extracted label candidates. These are
 * snapshots of the deterministic label pipeline, so they give the same answer
 * as a live label lookup without the network call, and they can be verified
 * by a clinician like curated records.
 */
export function resolveCandidatePayload(patient) {
  const guidance = findCandidateRenalDoseGuidance({
    drugQuery: patient.drug,
    normalizedDrug: patient.normalizedDrug,
    crcl: patient.crcl,
    egfr: patient.egfr,
    route: patient.route,
  });
  if (!guidance || !guidance.rows?.some((row) => row.selected)) {
    return null;
  }
  const verified = guidance.verification.status === "verified";
  return toCuratedPayload(guidance, patient, [], verified ? "curated-verified" : "label-extracted");
}
