// Adjusts a dose lookup for dialysis and unstable creatinine, and annotates
// the result so the UI can explain what was assumed.

const DIALYSIS_LABELS = { hd: "hemodialysis", pd: "peritoneal dialysis", crrt: "CRRT" };
// Curated structured rules name peritoneal dialysis "capd".
const STRUCTURED_DIALYSIS = { hd: "hd", pd: "capd" };
// Creatinine-based clearance is not valid on intermittent dialysis; labels
// place these patients in their lowest band.
const DIALYSIS_CLEARANCE = 5;

export function prepareKidneyContext(patient) {
  const dialysis = DIALYSIS_LABELS[patient.dialysis] ? patient.dialysis : "none";
  const intermittent = dialysis === "hd" || dialysis === "pd";
  return {
    dialysis,
    lookupPatient: {
      ...patient,
      dialysis: STRUCTURED_DIALYSIS[dialysis] || (patient.dialysis === "none" ? "none" : patient.dialysis),
      crcl: intermittent ? DIALYSIS_CLEARANCE : patient.crcl,
      egfr: intermittent ? DIALYSIS_CLEARANCE : patient.egfr,
    },
  };
}

export function annotateKidneyContext(payload, patient, context) {
  const cautions = [];
  let reviewRequired = false;
  const curated = payload.curated;
  const dialysisSpecific =
    Boolean(curated?.options?.dialysis?.some((option) => option.value === STRUCTURED_DIALYSIS[context.dialysis])) &&
    curated?.selectedControls?.dialysis === STRUCTURED_DIALYSIS[context.dialysis];

  if (context.dialysis === "hd" || context.dialysis === "pd") {
    const name = DIALYSIS_LABELS[context.dialysis];
    cautions.push(
      dialysisSpecific
        ? `Patient on ${name}: the label's ${name} rule is shown.`
        : `Patient on ${name}: no ${name}-specific rule was found, so the lowest renal band is shown. Check the label for dosing after dialysis and supplemental doses.`
    );
    reviewRequired = !dialysisSpecific && payload.result?.status === "dose_found";
  }
  if (context.dialysis === "crrt") {
    cautions.push(
      "Patient on CRRT: creatinine-based bands do not apply. Dose by CRRT effluent rate with pharmacy or a CRRT dosing reference."
    );
    reviewRequired = true;
  }
  if (patient.unstable) {
    cautions.push(
      "Creatinine not stable: CrCl may overestimate kidney function. Consider the next lower band and re-check as creatinine changes."
    );
  }
  if (!cautions.length) {
    return payload;
  }
  return {
    ...payload,
    result: payload.result
      ? { ...payload.result, importantCautions: [...cautions, ...(payload.result.importantCautions || [])] }
      : payload.result,
    curated: curated ? { ...curated, indicationNote: [...cautions, curated.indicationNote].filter(Boolean).join(" ") } : curated,
    kidneyContext: { dialysis: context.dialysis, unstable: Boolean(patient.unstable), reviewRequired },
  };
}
