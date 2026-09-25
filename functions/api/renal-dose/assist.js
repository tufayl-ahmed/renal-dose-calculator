import {
  buildLlmDosePrompt,
  createNoLabelAssistResult,
  parseAndValidateAssistResponse,
} from "../../../src/llmDoseAssistCore.js";
import { reserveFreeAiCall, runWorkersAi } from "../../../server/renalDose/ai.js";
import {
  ASSIST_CACHE_TTL_SECONDS,
  buildAssistCacheKey,
  readJsonCache,
  writeJsonCache,
} from "../../../server/renalDose/cache.js";
import { formatNumber, routeDisplayName } from "../../../server/renalDose/format.js";
import { corsHeaders, jsonResponse } from "../../../server/renalDose/http.js";
import { lookupDrugLabel, toPublicLabel, toPublicSections } from "../../../server/renalDose/openfda.js";
import {
  buildParserFallbackResult,
  buildReviewSourceResult,
  buildSpecialPayloadFromMissingLabel,
  createRouteUnavailableAssistResult,
  isCleanParserResult,
  sanitizePatient,
  shouldUseParserFallback,
} from "../../../server/renalDose/results.js";
import { buildMissingLabelSpecialResult, buildSpecialDrugResult } from "../../../server/renalDose/specialDrugs.js";

export async function onRequestPost(context) {
  try {
    const requestBody = await context.request.json();
    const patient = sanitizePatient(requestBody);
    const lookupTerm = patient.normalizedDrug?.searchTerm || patient.drug;
    const label = await lookupDrugLabel({ drug: lookupTerm, route: patient.route });

    if (label.status === "route_not_found") {
      const missingLabelSpecial = buildMissingLabelSpecialResult(patient);
      if (missingLabelSpecial) {
        return jsonResponse(buildSpecialPayloadFromMissingLabel(missingLabelSpecial), 200);
      }
      const result = createRouteUnavailableAssistResult({
        drugName: patient.drug,
        route: patient.route,
        sourceUrl: label.sourceUrl,
        message: label.message,
      });
      return jsonResponse(
        {
          result,
          label,
          sourceSections: [],
          sourceText: "",
          sourceUrl: label.sourceUrl,
          sourceMode: "route-not-found",
        },
        200
      );
    }

    if (label.status !== "found") {
      const missingLabelSpecial = buildMissingLabelSpecialResult(patient);
      if (missingLabelSpecial) {
        return jsonResponse(buildSpecialPayloadFromMissingLabel(missingLabelSpecial), 200);
      }
      const result = createNoLabelAssistResult({
        drugName: patient.drug,
        route: patient.route,
        sourceUrl: label.sourceUrl,
      });
      return jsonResponse({ ...result, result, label, sourceMode: "not-found" }, 200);
    }

    const { messages, sourceText } = buildLlmDosePrompt({
      label,
      patient: {
        drug: patient.drug,
        normalizedDrug: patient.normalizedDrug,
        route: patient.route,
        crcl: patient.crcl,
        egfr: patient.egfr,
        dialysis: patient.dialysis,
        indication: patient.indication,
        formulation: patient.formulation,
      },
    });

    const assistCacheKey = buildAssistCacheKey({ patient, label });
    const parserResult = buildParserFallbackResult({ label, patient });
    const specialResult = buildSpecialDrugResult({ label, patient });
    if (specialResult) {
      const specialPayload = {
        result: specialResult,
        label: toPublicLabel(label),
        sourceSections: toPublicSections(label.sections),
        sourceText,
        sourceUrl: label.sourceUrl,
        sourceMode: "dailymed-special-review",
        modelUsed: "",
        freeMode: true,
        freeModeRemaining: null,
      };
      await writeJsonCache(assistCacheKey, specialPayload, ASSIST_CACHE_TTL_SECONDS);
      return jsonResponse(specialPayload, 200);
    }
    if (isCleanParserResult(parserResult)) {
      const parserPayload = {
        result: parserResult,
        label: toPublicLabel(label),
        sourceSections: toPublicSections(label.sections),
        sourceText,
        sourceUrl: label.sourceUrl,
        sourceMode: "dailymed-table-parser",
        modelUsed: "",
        freeMode: true,
        freeModeRemaining: null,
      };
      await writeJsonCache(assistCacheKey, parserPayload, ASSIST_CACHE_TTL_SECONDS);
      return jsonResponse(parserPayload, 200);
    }

    const cachedAssist = await readJsonCache(assistCacheKey);
    if (cachedAssist?.result) {
      return jsonResponse(
        {
          ...cachedAssist,
          label: toPublicLabel(label),
          sourceSections: toPublicSections(label.sections),
          sourceText,
          sourceUrl: label.sourceUrl,
          sourceMode: "cache",
        },
        200
      );
    }

    const quota = await reserveFreeAiCall(context.env);
    if (!quota.allowed) {
      const result = buildReviewSourceResult({
        patient,
        label,
        reason: quota.reason,
      });
      return jsonResponse(
        {
          result,
          label: toPublicLabel(label),
          sourceSections: toPublicSections(label.sections),
          sourceText,
          sourceUrl: label.sourceUrl,
          sourceMode: "free-quota-guard",
        },
        200
      );
    }

    const ai = await runWorkersAi(context.env, messages);
    const aiRaw = ai.raw;
    const aiResult = parseAndValidateAssistResponse(aiRaw, sourceText, {
      drugName: label.title,
      route: routeDisplayName(patient.route),
      renalBand: `CrCl ${formatNumber(patient.crcl)} mL/min`,
      crcl: patient.crcl,
      egfr: patient.egfr,
      sourceSetId: label.setId,
      sourceUrl: label.sourceUrl,
    });
    const parserFallback = parserResult;
    const result = shouldUseParserFallback(aiResult, parserFallback) ? parserFallback : aiResult;
    const sourceMode =
      result === parserFallback
        ? "dailymed-table-parser-fallback"
        : ai.sourceMode || quota.sourceMode || (context.env?.AI ? "cloudflare-ai" : "no-ai-binding");

    const responsePayload = {
      result,
      label: toPublicLabel(label),
      sourceSections: toPublicSections(label.sections),
      sourceText,
      sourceUrl: label.sourceUrl,
      sourceMode,
      modelUsed: ai.modelUsed || "",
      freeMode: quota.freeMode,
      freeModeRemaining: quota.remaining,
    };
    await writeJsonCache(assistCacheKey, responsePayload, ASSIST_CACHE_TTL_SECONDS);
    return jsonResponse(responsePayload, 200);
  } catch (error) {
    return jsonResponse(
      {
        result: {
          status: "review_source",
          drugName: "Selected drug",
          route: "All routes",
          renalMetricUsed: "crcl",
          renalBand: "",
          dose: "Review DailyMed source",
          frequency: error?.message || "AI-assisted backend failed.",
          dialysisNote: "",
          importantCautions: [],
          sourceSetId: "",
          sourceUrl: "",
        },
        sourceMode: "error",
      },
      200
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
