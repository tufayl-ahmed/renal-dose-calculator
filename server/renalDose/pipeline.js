import {
  buildLlmDosePrompt,
  createNoLabelAssistResult,
  parseAndValidateAssistResponse,
} from "../../src/llmDoseAssistCore.js";
import { reserveFreeAiCall, runWorkersAi } from "./ai.js";
import { ASSIST_CACHE_TTL_SECONDS, buildAssistCacheKey, readJsonCache, writeJsonCache } from "./cache.js";
import { resolveCandidatePayload } from "./candidates.js";
import { resolveCuratedPayload } from "./curated.js";
import { formatNumber, routeDisplayName } from "./format.js";
import { annotateKidneyContext, prepareKidneyContext } from "./kidneyContext.js";
import { lookupDrugLabel, toPublicLabel, toPublicSections } from "./openfda.js";
import {
  buildParserFallbackResult,
  buildReviewSourceResult,
  buildSpecialPayloadFromMissingLabel,
  createRouteUnavailableAssistResult,
  isCleanParserResult,
  shouldUseParserFallback,
} from "./results.js";
import { buildMissingLabelSpecialResult, buildSpecialDrugResult } from "./specialDrugs.js";

/**
 * Renal dose pipeline, in order of trust:
 *   1. Curated rule database (hand-curated, draft or clinician-verified)
 *   2. Auto-extracted label candidates (snapshot of step 3, unreviewed)
 *   3. DailyMed/openFDA label: deterministic drug handlers, then table parser
 *   4. Workers AI summary of the label text (validated against the source)
 *   5. Source review fallback
 */
export async function resolveDosePayload({ patient: requestPatient, env }) {
  const context = prepareKidneyContext(requestPatient);
  const payload = await resolveForPatient({ patient: context.lookupPatient, env });
  return annotateKidneyContext(payload, requestPatient, context);
}

async function resolveForPatient({ patient, env }) {
  const curatedPayload = resolveCuratedPayload(patient);
  if (curatedPayload) {
    return curatedPayload;
  }

  const candidatePayload = resolveCandidatePayload(patient);
  if (candidatePayload) {
    return candidatePayload;
  }

  const lookupTerm = patient.normalizedDrug?.searchTerm || patient.drug;
  const label = await lookupDrugLabel({ drug: lookupTerm, route: patient.route });

  if (label.status === "route_not_found") {
    const missingLabelSpecial = buildMissingLabelSpecialResult(patient);
    if (missingLabelSpecial) {
      return buildSpecialPayloadFromMissingLabel(missingLabelSpecial);
    }
    const result = createRouteUnavailableAssistResult({
      drugName: patient.drug,
      route: patient.route,
      sourceUrl: label.sourceUrl,
      message: label.message,
    });
    return {
      result,
      label,
      sourceSections: [],
      sourceText: "",
      sourceUrl: label.sourceUrl,
      sourceMode: "route-not-found",
    };
  }

  if (label.status !== "found") {
    const missingLabelSpecial = buildMissingLabelSpecialResult(patient);
    if (missingLabelSpecial) {
      return buildSpecialPayloadFromMissingLabel(missingLabelSpecial);
    }
    const result = createNoLabelAssistResult({
      drugName: patient.drug,
      route: patient.route,
      sourceUrl: label.sourceUrl,
    });
    return { ...result, result, label, sourceMode: "not-found" };
  }

  const { messages, sourceText } = buildLlmDosePrompt({
    label,
    patient: {
      drug: patient.drug,
      normalizedDrug: patient.normalizedDrug,
      route: patient.route,
      crcl: patient.crcl,
      egfr: patient.egfr,
      // Some labels dose by serum creatinine (e.g. tranexamic acid) or weight.
      serumCreatinineMgDl: Number.isFinite(patient.creatinine) ? patient.creatinine : null,
      ageYears: Number.isFinite(patient.age) ? patient.age : null,
      sex: patient.sex || null,
      weightKg: Number.isFinite(patient.weight) ? patient.weight : null,
      dialysis: patient.dialysis,
      indication: patient.indication,
      formulation: patient.formulation,
    },
  });
  const labelFields = {
    label: toPublicLabel(label),
    sourceSections: toPublicSections(label.sections),
    sourceText,
    sourceUrl: label.sourceUrl,
  };

  const assistCacheKey = buildAssistCacheKey({ patient, label });
  const deterministic = resolveDeterministicLabelResult({ label, patient });
  if (deterministic) {
    const payload = {
      result: deterministic.result,
      ...labelFields,
      sourceMode: deterministic.sourceMode,
      modelUsed: "",
      freeMode: true,
      freeModeRemaining: null,
    };
    await writeJsonCache(assistCacheKey, payload, ASSIST_CACHE_TTL_SECONDS);
    return payload;
  }

  const cachedAssist = await readJsonCache(assistCacheKey);
  if (cachedAssist?.result) {
    return { ...cachedAssist, ...labelFields, sourceMode: "cache" };
  }

  const quota = await reserveFreeAiCall(env);
  if (!quota.allowed) {
    return {
      result: buildReviewSourceResult({ patient, label, reason: quota.reason }),
      ...labelFields,
      sourceMode: "free-quota-guard",
    };
  }

  const parserFallback = buildParserFallbackResult({ label, patient });
  const ai = await runWorkersAi(env, messages);
  const aiResult = parseAndValidateAssistResponse(ai.raw, sourceText, {
    drugName: label.title,
    route: routeDisplayName(patient.route),
    renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
    crcl: patient.crcl,
    egfr: patient.egfr,
    creatinine: patient.creatinine,
    sourceSetId: label.setId,
    sourceUrl: label.sourceUrl,
  });
  const result = shouldUseParserFallback(aiResult, parserFallback) ? parserFallback : aiResult;
  const sourceMode =
    result === parserFallback
      ? "dailymed-table-parser-fallback"
      : ai.sourceMode || quota.sourceMode || (env?.AI ? "cloudflare-ai" : "no-ai-binding");

  const payload = {
    result,
    ...labelFields,
    sourceMode,
    modelUsed: ai.modelUsed || "",
    freeMode: quota.freeMode,
    freeModeRemaining: quota.remaining,
  };
  await writeJsonCache(assistCacheKey, payload, ASSIST_CACHE_TTL_SECONDS);
  return payload;
}

/**
 * Step 3: deterministic label logic only (no AI). Returns null when neither a
 * drug-specific handler nor a clean renal table row applies.
 */
export function resolveDeterministicLabelResult({ label, patient }) {
  const specialResult = buildSpecialDrugResult({ label, patient });
  if (specialResult) {
    return { result: specialResult, sourceMode: "dailymed-special-review" };
  }
  const parserResult = buildParserFallbackResult({ label, patient });
  if (isCleanParserResult(parserResult)) {
    return { result: parserResult, sourceMode: "dailymed-table-parser" };
  }
  return null;
}
