import { corsHeaders, jsonResponse } from "../../../server/renalDose/http.js";
import { resolveDosePayload } from "../../../server/renalDose/pipeline.js";
import { sanitizePatient } from "../../../server/renalDose/results.js";

export async function onRequestPost(context) {
  try {
    const patient = sanitizePatient(await context.request.json());
    return jsonResponse(await resolveDosePayload({ patient, env: context.env }), 200);
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
          frequency: error?.message || "Renal dose backend failed.",
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
