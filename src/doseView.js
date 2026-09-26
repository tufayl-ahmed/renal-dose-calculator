// Turns a normalized dose API response into the view model the UI renders:
// one shape for every source tier (curated, auto-extracted, label logic, AI).

const TIERS = {
  "curated-verified": {
    id: "verified",
    label: "Clinician-verified",
    tone: "good",
    description: "Curated renal rule reviewed by a clinician.",
  },
  "curated-draft": {
    id: "curated",
    label: "Curated · draft",
    tone: "info",
    description: "Hand-curated from the DailyMed label; pending clinician review.",
  },
  "label-extracted": {
    id: "extracted",
    label: "Auto-extracted",
    tone: "info",
    description: "Extracted automatically from the DailyMed label; not yet reviewed.",
  },
  "dailymed-special-review": {
    id: "label",
    label: "Label logic",
    tone: "info",
    description: "Deterministic rules applied to the live DailyMed label.",
  },
  "dailymed-table-parser": {
    id: "label",
    label: "Label table",
    tone: "info",
    description: "Renal dose table parsed from the live DailyMed label.",
  },
  "dailymed-table-parser-fallback": {
    id: "label",
    label: "Label table",
    tone: "info",
    description: "Renal dose table parsed from the live DailyMed label.",
  },
  ai: {
    id: "ai",
    label: "AI summary",
    tone: "warn",
    description: "AI summary of DailyMed label text. It may be wrong; check the source.",
  },
  review: {
    id: "review",
    label: "Review source",
    tone: "neutral",
    description: "No reliable automatic answer. Review the DailyMed label.",
  },
};

const AVOID = /\b(?:contraindicated|do not use|do not initiate|discontinue|avoid|not recommended)\b/i;
const NO_ADJUSTMENT = /\bno (?:renal )?(?:dose |dosage )?(?:adjustment|reduction)\b/i;

export function getSourceTier(sourceMode = "") {
  if (TIERS[sourceMode]) {
    return TIERS[sourceMode];
  }
  if (/^cloudflare-ai|^cache$/.test(sourceMode)) {
    return TIERS.ai;
  }
  return TIERS.review;
}

/**
 * @param {object} assist normalized payload from normalizeAssistPayload()
 * @param {object} values patient values (crcl, egfr, route, drug)
 */
export function buildDoseView(assist, values = {}) {
  const guidance = assist.guidance || {};
  const result = assist.result || {};
  const tier = getSourceTier(assist.sourceMode);
  const reviewOnly = tier.id === "review" || result.status === "review_source" || result.status === "not_found";
  const band = cleanBand(guidance.crclBand || result.renalBand);
  const metricText = `${guidance.renalBandLabel || ""} ${guidance.crclBand || ""} ${result.renalMetricUsed || ""}`;
  const metric = /egfr/i.test(metricText) ? "eGFR" : /\bscr\b|serum creatinine/i.test(metricText) ? "SCr" : "CrCl";
  const cautions = splitCautions(guidance.indicationNote || result.importantCautions?.join(" ") || "");
  const dose = reviewOnly ? result.dose || "Review DailyMed source" : guidance.dose || result.dose || "";
  const frequency = reviewOnly ? result.frequency || "" : guidance.interval || result.frequency || "";

  return {
    drugName: guidance.drugName || result.drugName || values.drug || "Selected drug",
    routeLabel: guidance.routeLabel || result.route || "",
    tier,
    decision: assist.kidneyContext?.reviewRequired
      ? {
          id: "review",
          label: assist.kidneyContext.dialysis === "crrt" ? "Review for CRRT" : "Review for dialysis",
          tone: "warn",
        }
      : getDecision({ result, dose, frequency, band, tier, reviewOnly }),
    metric,
    band,
    dose: cleanFrequencyLabel(dose),
    frequency:
      isPlaceholder(frequency) ||
      cleanFrequencyLabel(dose).toLowerCase().endsWith(cleanFrequencyLabel(frequency).toLowerCase())
        ? ""
        : cleanFrequencyLabel(frequency),
    cautions,
    defaultedControls: ["indication", "formulation"].filter((key) =>
      cautions.some((caution) =>
        caution.startsWith(`${key === "indication" ? "Indication" : "Product/formulation"} not selected`)
      )
    ),
    rows: guidance.rows || [],
    options: guidance.options || null,
    selectedControls: guidance.selectedControls || null,
    verification: guidance.verification || null,
    sourceUrl: assist.sourceUrl || guidance.sourceUrl || result.sourceUrl || "",
    source: {
      heading: guidance.sourceHeading || "",
      label: assist.label || null,
      sections: (assist.sourceSections || []).filter((section) => section.hasRenalKeyword).slice(0, 3),
    },
    sourceMode: assist.sourceMode || "",
  };
}

function getDecision({ result, dose, frequency, band, tier, reviewOnly }) {
  const text = `${dose} ${frequency}`;
  if (result.status === "not_found") {
    return { id: "unavailable", label: "Not found", tone: "neutral" };
  }
  // Curated records from labels that give cautions rather than doses.
  if (result.decisionHint === "caution") {
    return { id: "caution", label: "Use with caution", tone: "warn" };
  }
  if (result.decisionHint === "not-studied") {
    return { id: "not-studied", label: "Not studied", tone: "neutral" };
  }
  if (AVOID.test(text)) {
    return { id: "avoid", label: "Avoid / restrict", tone: "danger" };
  }
  if (reviewOnly) {
    return { id: "review", label: "Review source", tone: "neutral" };
  }
  if (result.status === "no_renal_adjustment" || NO_ADJUSTMENT.test(text)) {
    return { id: "no-change", label: "No renal adjustment", tone: "good" };
  }
  if (/^All\b/i.test(band)) {
    return { id: "label-dose", label: "Label dose", tone: "info" };
  }
  if (/^(?:>|>=|≥)/.test(band)) {
    return { id: "usual", label: "Usual-range dose", tone: "good" };
  }
  if (tier.id === "ai") {
    return { id: "adjust", label: "Adjust (AI)", tone: "warn" };
  }
  return { id: "adjust", label: "Adjust dose", tone: "warn" };
}

export function cleanBand(value) {
  return String(value || "")
    .replace(/^All (?:CrCl|eGFR) values$/i, "All values")
    .replace(/^(?:CrCl|CLcr|eGFR)\s*/i, "")
    .replace(/\s*mL\/min(?:\/1\.73\s*m(?:2|²))?\s*$/i, "")
    .trim();
}

function isPlaceholder(value) {
  return /^(?:source review required|by indication)$/i.test(String(value || "").trim());
}

function cleanFrequencyLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCautions(text) {
  return (
    String(text || "")
      .split(/(?<=\.)\s+(?=[A-Z])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      // Internal context echoes from the rule engine ("Indication: nvaf reduced.").
      .filter((sentence) => !/^(?:Dialysis|Indication|Product\/formulation): [\w -]+\.$/.test(sentence))
      .filter((sentence, index, all) => all.indexOf(sentence) === index)
      .slice(0, 5)
  );
}

/** Plain-text summary of a whole check, for copy/share. */
export function buildShareText({ patient, renal, views }) {
  const lines = [
    "Renal Dose Calculator",
    `Patient: ${patient.age} y ${patient.sex}, SCr ${patient.creatinine} mg/dL${
      patient.creatinineUnit === "umol" ? ` (${patient.creatinineInput} µmol/L)` : ""
    }, weight ${patient.weight} kg${patient.height ? `, height ${patient.height} cm` : ""}`,
    `eGFR (CKD-EPI 2021): ${renal.egfr.toFixed(1)} mL/min/1.73 m² (${renal.stage.stage})`,
    `CrCl (Cockcroft-Gault, ${renal.crclWeight?.basis || "actual"} weight): ${renal.crcl.toFixed(1)} mL/min`,
  ];
  if (patient.dialysis && patient.dialysis !== "none") {
    lines.push(
      `Dialysis: ${{ hd: "intermittent hemodialysis", pd: "peritoneal dialysis", crrt: "CRRT" }[patient.dialysis]}`
    );
  }
  if (patient.unstable) {
    lines.push("Creatinine not stable (AKI or changing): estimates may overestimate kidney function.");
  }
  for (const view of views) {
    lines.push(
      "",
      `${view.drugName}${view.routeLabel ? ` (${view.routeLabel})` : ""} — ${view.decision.label} [${view.tier.label}]`,
      `${view.band ? `${view.metric} ${view.band}: ` : ""}${[view.dose, view.frequency].filter(Boolean).join(", ")}`
    );
    view.cautions.slice(0, 2).forEach((caution) => lines.push(`Note: ${caution}`));
    if (view.sourceUrl) {
      lines.push(`DailyMed: ${view.sourceUrl}`);
    }
  }
  lines.push("", "Educational purpose only. Results are estimates and are not for prescribing.");
  return lines.join("\n");
}
