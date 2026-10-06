import { corsHeaders, jsonResponse } from "../../../server/renalDose/http.js";
import { resolveDosePayload } from "../../../server/renalDose/pipeline.js";
import { sanitizePatient, validatePatient } from "../../../server/renalDose/results.js";

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: "Request body must be JSON." }, 400);
  }
  const patient = sanitizePatient(body || {});
  const problem = validatePatient(patient);
  if (problem) {
    return jsonResponse({ error: problem }, 400);
  }
  try {
    return jsonResponse(await resolveDosePayload({ patient, env: context.env }), 200);
  } catch (error) {
    // A failure must not look like a clinical answer: the client retries 5xx
    // and then shows "Unavailable".
    console.error("renal-dose assist failed:", error?.message);
    return jsonResponse({ error: "The dose service failed. Please retry." }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
