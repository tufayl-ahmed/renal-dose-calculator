const RANGE_MARKER =
  /(?:(>=|≥|>|<=|≤|<)\s*(\d+(?:\.\d+)?)|(?:\b(greater than|more than|above|over|at least|less than|under|below|up to)\s*(\d+(?:\.\d+)?))|\b(>\s*)?(\d+(?:\.\d+)?)\s*(?:to|-|–|—)\s*(\d+(?:\.\d+)?)\b)/gi;

const RENAL_CONTEXT = [
  "creatinine clearance",
  "crcl",
  "clcr",
  "renal impairment",
  "renal function",
  "kidney function",
  "hemodialysis",
  "dialysis",
];

const DOSE_CONTEXT = ["dose", "dosage", "dosing", "administer", "recommended"];
const MAX_QUICK_RECOMMENDATION_LENGTH = 150;
const NON_DOSING_TEXT =
  /\b(?:study|studies|pharmacokinetic|subjects|volunteers|observed|adverse reactions?|contraindications?|warnings?)\b/i;
const NO_RENAL_ADJUSTMENT_TEXT =
  String.raw`\b(?:no\s+(?:renal\s+)?(?:dosage?|dose)\s+adjustment\s+(?:is\s+)?(?:necessary|required|recommended|needed)|(?:dosage?|dose)\s+adjustment\s+(?:is\s+)?not\s+(?:necessary|required|recommended|needed)|does\s+not\s+require\s+(?:dosage?|dose)\s+adjustment|no\s+adjustment\s+(?:is\s+)?(?:necessary|required|recommended|needed))\b`;
const NO_RENAL_ADJUSTMENT = new RegExp(NO_RENAL_ADJUSTMENT_TEXT, "i");
const NO_RENAL_ADJUSTMENT_GLOBAL = new RegExp(NO_RENAL_ADJUSTMENT_TEXT, "gi");
const RENAL_CAUTION =
  /\b(?:renal|kidney|creatinine clearance|crcl|clcr)\b[\s\S]{0,180}\b(?:use with caution|monitor(?:ing)? renal function|monitor(?:ing)? kidney function|reduce(?:d|ing)? (?:the )?(?:dose|dosage)|reduced? [\w\s]{0,40}doses?|dose(?:age)? decrease may be (?:needed|necessary)|dose(?:age)? reduction may be (?:needed|necessary)|lower individual doses|halve usual initial dose|discontinue(?:d)? if|not recommended|should not be used)\b|\b(?:use with caution|monitor(?:ing)? renal function|monitor(?:ing)? kidney function|reduce(?:d|ing)? (?:the )?(?:dose|dosage)|reduced? [\w\s]{0,40}doses?|dose(?:age)? decrease may be (?:needed|necessary)|dose(?:age)? reduction may be (?:needed|necessary)|lower individual doses|halve usual initial dose|discontinue(?:d)? if|not recommended|should not be used)\b[\s\S]{0,180}\b(?:renal|kidney|creatinine clearance|crcl|clcr)\b/i;

export function deriveRenalDoseGuidance({ label, crcl, route }) {
  if (!label || label.status !== "found") {
    return emptyGuidance("No matching human DailyMed label was found.");
  }

  const sourceSections = label.sections || [];
  const dosageSections = sourceSections.filter((section) => /dosage|administration/i.test(section.heading));
  const renalDosageSections = dosageSections.filter((section) => section.hasRenalKeyword);
  const renalSections = sourceSections.filter((section) => section.hasRenalKeyword);
  const searchableSections = renalDosageSections.length
    ? renalDosageSections
    : renalSections.length
      ? renalSections
      : sourceSections;
  const rows = searchableSections
    .filter(shouldParseDoseRows)
    .flatMap((section) => extractDoseRows(section.fullText || section.text, section.heading));
  const usableRows = rows.filter((row) => row.hasDoseContext && isCleanDoseRecommendation(row.recommendation));
  const selectedRow =
    usableRows.find((row) => isCrclInRow(crcl, row)) ||
    usableRows.find((row) => isCrclInRow(Math.round(crcl), row));

  if (selectedRow) {
    return {
      status: "matched",
      title: "Label-based renal dosing guidance",
      badge: "CrCl band matched",
      routeLabel: routeLabel(route),
      crclBand: formatBand(selectedRow),
      recommendation: selectedRow.recommendation,
      sourceHeading: selectedRow.sourceHeading,
      caveat:
        "Educational purpose only. Results are estimates and are not for prescribing.",
      rows: usableRows.slice(0, 8).map((row) => ({
        band: formatBand(row),
        recommendation: row.recommendation,
        selected: row === selectedRow,
      })),
    };
  }

  if (usableRows.length) {
    return {
      status: "needs_review",
      title: "Renal dose table found",
      badge: "Review table",
      routeLabel: routeLabel(route),
      crclBand: `CrCl ${formatNumber(crcl)} mL/min`,
      recommendation:
        "A renal dose table was found, but this CrCl did not clearly match one parsed band.",
      sourceHeading: usableRows[0].sourceHeading,
      caveat: "Educational purpose only. Results are estimates and are not for prescribing.",
      rows: usableRows.slice(0, 8).map((row) => ({
        band: formatBand(row),
        recommendation: row.recommendation,
        selected: false,
      })),
    };
  }

  if (renalSections.length) {
    const noAdjustmentSection = renalSections.find((section) =>
      hasNoRenalAdjustmentText(section.fullText || section.text, section.heading)
    );

    const contraindicationSection = renalSections.find((section) => hasRenalAvoidanceText(section.fullText || section.text));
    const cautionSection = renalSections.find((section) => hasRenalCautionText(section.fullText || section.text));

    return {
      status: "label_text",
      title: contraindicationSection ? "Renal restriction found" : cautionSection ? "Renal caution found" : noAdjustmentSection ? "Renal label note" : "Renal label text found",
      badge: contraindicationSection ? "Avoid/review" : cautionSection ? "Renal caution" : noAdjustmentSection ? "No adjustment" : "No table parsed",
      routeLabel: routeLabel(route),
      crclBand: `CrCl ${formatNumber(crcl)} mL/min`,
      recommendation: contraindicationSection
        ? "Label text contains renal avoidance or contraindication language; verify DailyMed source."
        : cautionSection
          ? "Label text contains renal caution, monitoring, or dose-reduction language."
          : noAdjustmentSection
            ? "No renal dose adjustment is described in the selected label text."
            : "Renal label text is present, but no clear CrCl-based dose line was parsed.",
      sourceHeading: contraindicationSection?.heading || cautionSection?.heading || noAdjustmentSection?.heading || renalSections[0].heading,
      caveat: "Educational purpose only. Results are estimates and are not for prescribing.",
      rows: [],
    };
  }

  return emptyGuidance("No renal dosing text was found in the selected label.");
}

export function extractDoseRows(text, sourceHeading = "Label") {
  const cleanText = compactText(text);
  if (!hasRenalContext(cleanText)) {
    return [];
  }

  const knownRows = extractKnownRenalTableRows(cleanText, sourceHeading);
  if (knownRows.length) {
    return knownRows;
  }

  const startIndex = findRenalTableStart(cleanText);
  const tableText = limitAdultRenalText(startIndex >= 0 ? cleanText.slice(startIndex) : cleanText);
  const tableUsesGramHeader = /\b(?:total\s+grams|total\s+g|grams\s+piperacillin)\b/i.test(tableText);
  const tableUsesMgHeader = /\b(?:dose\s+regimen\s*\(mg\)|dose\s*\(mg\)|total daily dose range\s*\(mg\/day\))\b/i.test(tableText);
  const tableUsesPercentHeader = /\b(?:recommended dose\s*\(%\)|dose\s*\(%\))\b/i.test(tableText);
  const markers = [...tableText.matchAll(RANGE_MARKER)].filter(
    (marker) => !isDurationMarker(tableText, marker) && !isAgeMarker(tableText, marker)
  );

  return markers
    .map((marker, index) => {
      const nextMarker = markers[index + 1];
      const recommendation = cleanupRecommendation(
        tableText.slice(marker.index + marker[0].length, nextMarker?.index),
        { tableUsesGramHeader, tableUsesMgHeader, tableUsesPercentHeader }
      );

      return {
        ...parseMarker(marker),
        recommendation,
        sourceHeading,
        hasDoseContext: hasDoseContext(recommendation),
      };
    })
    .filter((row) => row.recommendation.length > 0);
}

function extractKnownRenalTableRows(text, sourceHeading) {
  return [
    ...extractGabapentinRows(text, sourceHeading),
    ...extractLevetiracetamRows(text, sourceHeading),
    ...extractFluconazoleRows(text, sourceHeading),
  ];
}

function extractGabapentinRows(text, sourceHeading) {
  if (!/gabapentin dosage based on renal function/i.test(text)) {
    return [];
  }

  const rows = [];
  const normal = text.match(/(?:≥|>=)\s*60\s+900\s+to\s+3600\s+((?:\d+\s+TID\s*)+)/i);
  const moderate = text.match(/>\s*30\s+to\s+59\s+400\s+to\s+1400\s+((?:\d+\s+BID\s*)+)/i);
  const severe = text.match(/>\s*15\s+to\s+29\s+200\s+to\s+700\s+((?:\d+\s+QD\s*)+)/i);

  if (normal) {
    rows.push({
      type: "gte",
      min: 60,
      max: Infinity,
      recommendation: `900 to 3600 mg/day; ${formatDoseRegimens(normal[1])}`,
      sourceHeading,
      hasDoseContext: true,
    });
  }
  if (moderate) {
    rows.push({
      type: "range_gt",
      min: 30,
      max: 59,
      recommendation: `400 to 1400 mg/day; ${formatDoseRegimens(moderate[1])}`,
      sourceHeading,
      hasDoseContext: true,
    });
  }
  if (severe) {
    rows.push({
      type: "range_gt",
      min: 15,
      max: 29,
      recommendation: `200 to 700 mg/day; ${formatDoseRegimens(severe[1])}`,
      sourceHeading,
      hasDoseContext: true,
    });
  }

  return rows;
}

function extractFluconazoleRows(text, sourceHeading) {
  if (!/recommended dose\s*\(%\)/i.test(text)) {
    return [];
  }

  return [
    {
      type: "gt",
      min: 50,
      max: Infinity,
      recommendation: "100% of usual daily dose after loading dose",
      sourceHeading,
      hasDoseContext: true,
    },
    {
      type: "lte",
      min: 0,
      max: 50,
      recommendation: "50% of usual daily dose after loading dose",
      sourceHeading,
      hasDoseContext: true,
    },
  ];
}

function extractLevetiracetamRows(text, sourceHeading) {
  if (!/dosing adjustment regimen for adult patients with renal impairment/i.test(text)) {
    return [];
  }

  return [
    {
      type: "gt",
      min: 80,
      max: Infinity,
      recommendation: "500 to 1500 mg every 12 hours",
      sourceHeading,
      hasDoseContext: true,
    },
    {
      type: "range",
      min: 50,
      max: 80,
      recommendation: "500 to 1000 mg every 12 hours",
      sourceHeading,
      hasDoseContext: true,
    },
    {
      type: "range",
      min: 30,
      max: 50,
      recommendation: "250 to 750 mg every 12 hours",
      sourceHeading,
      hasDoseContext: true,
    },
    {
      type: "lt",
      min: 0,
      max: 30,
      recommendation: "250 to 500 mg every 12 hours",
      sourceHeading,
      hasDoseContext: true,
    },
  ];
}

function formatDoseRegimens(text) {
  return compactText(text).replace(/\b(\d+)\s+(QD|BID|TID|QID)\b/gi, "$1 mg $2");
}

function shouldParseDoseRows(section) {
  const text = compactText(section.fullText || section.text);
  if (!hasRenalContext(text)) {
    return false;
  }

  const hasClearance = hasClearanceMetric(text);

  if (/dosage|administration/i.test(section.heading)) {
    return hasClearance;
  }

  const lower = text.toLowerCase();
  const hasDoseTableSignal =
    /\b(?:recommended\s+(?:dosage|dose|dosing)|dosage\s+adjustments?|dose\s+adjustments?|dosing\s+adjustments?)\b/i.test(
      text
    );
  const hasMultipleRanges = countRangeMarkers(text) >= 2;
  const hasUnitAndInterval = /\b\d+(?:\.\d+)?\s*(?:mg|g|gram|grams|mcg|units?)\b.{0,70}\b(?:every|q\s*\d)/i.test(
    text
  );

  return (
    hasClearance &&
    hasDoseTableSignal &&
    (hasMultipleRanges || hasUnitAndInterval || lower.includes("table"))
  );
}

function countRangeMarkers(text) {
  return [...text.matchAll(RANGE_MARKER)].filter(
    (marker) => !isDurationMarker(text, marker) && !isAgeMarker(text, marker)
  ).length;
}

function isCleanDoseRecommendation(text) {
  const clean = compactText(text);
  if (!clean || clean.length > MAX_QUICK_RECOMMENDATION_LENGTH) {
    return false;
  }

  const sentenceMarks = clean.replace(/\b\d+\.\d+\b/g, "").match(/[.!?]/g) || [];
  if (sentenceMarks.length > 1 || NON_DOSING_TEXT.test(clean)) {
    return false;
  }

  return hasDoseContext(clean);
}

function isDurationMarker(text, marker) {
  const afterMarker = text
    .slice(marker.index + marker[0].length, marker.index + marker[0].length + 24)
    .toLowerCase();

  return /^\s*(?:minute|minutes|hour|hours)\b/.test(afterMarker);
}

function isAgeMarker(text, marker) {
  const afterMarker = text
    .slice(marker.index + marker[0].length, marker.index + marker[0].length + 32)
    .toLowerCase();

  return /^\s*(?:year|years|month|months|day|days)\b/.test(afterMarker);
}

function parseMarker(marker) {
  const symbolComparator = marker[1];
  if (symbolComparator) {
    const value = Number(marker[2]);
    if ([">", ">=", "≥"].includes(symbolComparator)) {
      return symbolComparator === ">" ? { type: "gt", min: value, max: Infinity } : { type: "gte", min: value, max: Infinity };
    }
    return symbolComparator === "<" ? { type: "lt", min: 0, max: value } : { type: "lte", min: 0, max: value };
  }

  const comparator = marker[3]?.toLowerCase();
  if (comparator) {
    const value = Number(marker[4]);
    if (["greater than", "more than", "above", "over"].includes(comparator)) {
      return { type: "gt", min: value, max: Infinity };
    }
    if (comparator === "at least") {
      return { type: "gte", min: value, max: Infinity };
    }
    return comparator === "up to" ? { type: "lte", min: 0, max: value } : { type: "lt", min: 0, max: value };
  }

  const lowerExclusive = Boolean(marker[5]);
  const first = Number(marker[6]);
  const second = Number(marker[7]);
  return {
    type: lowerExclusive ? "range_gt" : "range",
    min: Math.min(first, second),
    max: Math.max(first, second),
  };
}

function isCrclInRow(crcl, row) {
  if (!Number.isFinite(crcl)) {
    return false;
  }
  if (row.type === "gt") {
    return crcl > row.min;
  }
  if (row.type === "gte") {
    return crcl >= row.min;
  }
  if (row.type === "lt") {
    return crcl < row.max;
  }
  if (row.type === "lte") {
    return crcl <= row.max;
  }
  if (row.type === "range_gt") {
    return crcl > row.min && crcl <= row.max;
  }
  return crcl >= row.min && crcl <= row.max;
}

function formatBand(row) {
  if (row.type === "gt") {
    return `CrCl > ${formatNumber(row.min)} mL/min`;
  }
  if (row.type === "gte") {
    return `CrCl >= ${formatNumber(row.min)} mL/min`;
  }
  if (row.type === "lt") {
    return `CrCl < ${formatNumber(row.max)} mL/min`;
  }
  if (row.type === "lte") {
    return `CrCl <= ${formatNumber(row.max)} mL/min`;
  }
  if (row.type === "range_gt") {
    return `CrCl > ${formatNumber(row.min)}-${formatNumber(row.max)} mL/min`;
  }
  return `CrCl ${formatNumber(row.min)}-${formatNumber(row.max)} mL/min`;
}

function cleanupRecommendation(text, options = {}) {
  const cleaned = compactText(text)
    .replace(/^(?:creatinine clearance|mL\/min|dose|dosing interval|recommended dosage schedule)\b[:\s-]*/i, "")
    .replace(/^[|:;\s-]+/, "")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s*\(\s*\d+(?:\.\d+)?\s*\)\s*/g, " ")
    .replace(/\s+\b(?:CrCl|Clcr|Creatinine Clearance)\b\s*$/i, "")
    .trim();

  const withInheritedUnits = options.tableUsesGramHeader
    ? cleaned.replace(/\b(\d+(?:\.\d+)?)\s+(?=every\s+\d+\s+hours?\b)/gi, "$1 g ")
    : cleaned;

  const withMgUnits = options.tableUsesMgHeader
    ? withInheritedUnits
        .replace(/\b(\d+(?:\.\d+)?\s*(?:to|-|–|—)\s*\d+(?:\.\d+)?)\b(?!\s*(?:mg|g|mcg|%|percent|mL|min|hours?|days?))/gi, "$1 mg")
        .replace(/\b(\d+(?:\.\d+)?)\s+(?=(?:QD|BID|TID|QID)\b)/gi, "$1 mg ")
    : withInheritedUnits;

  const withPercentUnits = options.tableUsesPercentHeader
    ? withMgUnits.replace(/\b(\d+(?:\.\d+)?)\b(?!\s*(?:mg|g|mcg|%|percent|mL|min|hours?|days?))/i, "$1% of usual dose")
    : withMgUnits;

  return compactText(withPercentUnits)
    .replace(/\[[^\]]*\bsee\b[^\]]*\]/gi, "")
    .replace(/\bsee\s+Use\s+in\s+Specific\s+Populations\b/gi, "")
    .replace(/^[).,;:\s]+/, "")
    .slice(0, 360)
    .trim();
}

function findRenalTableStart(text) {
  const lower = text.toLowerCase();
  const adultRenalHeadingIndex = findLastIndexOfAny(lower, [
    "dosage in adult patients with renal impairment",
    "dosage adjustments in adult patients with renal impairment",
    "dosage adjustment in adult patients with renal impairment",
    "dosage adjustment in patients with renal impairment",
    "dosing in patients with renal impairment",
    "recommended dosage in patients with renal impairment",
    "adult patients with renal impairment",
    "adult patients with renal dysfunction",
  ]);

  if (adultRenalHeadingIndex >= 0) {
    return adultRenalHeadingIndex;
  }

  const renalDoseTableIndex = findFirstIndexOfAny(lower, [
    "recommended dosing",
    "recommended dosage",
    "recommended dose",
  ]);
  if (renalDoseTableIndex >= 0 && lower.slice(renalDoseTableIndex, renalDoseTableIndex + 220).includes("renal")) {
    return renalDoseTableIndex;
  }

  const creatinineClearanceIndex = lower.indexOf("creatinine clearance");
  if (creatinineClearanceIndex >= 0) {
    return creatinineClearanceIndex;
  }

  const clcrIndex = lower.indexOf("clcr");
  if (clcrIndex >= 0) {
    return clcrIndex;
  }

  const starts = RENAL_CONTEXT.map((phrase) => lower.indexOf(phrase)).filter((index) => index >= 0);
  return starts.length ? Math.min(...starts) : -1;
}

function findFirstIndexOfAny(text, phrases) {
  const indexes = phrases.map((phrase) => text.indexOf(phrase)).filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

function findLastIndexOfAny(text, phrases) {
  const indexes = phrases.map((phrase) => text.lastIndexOf(phrase)).filter((index) => index >= 0);
  return indexes.length ? Math.max(...indexes) : -1;
}

function limitAdultRenalText(text) {
  const lower = text.toLowerCase();
  const stopPhrases = [
    "pediatric patients",
    "paediatric patients",
    "for pediatric",
    "for paediatric",
    "recommended dosage schedule for pediatric",
    "recommended dosage schedule for paediatric",
  ];
  const stopIndexes = stopPhrases
    .map((phrase) => lower.indexOf(phrase))
    .filter((index) => index > 80);

  if (!stopIndexes.length) {
    return text;
  }

  return text.slice(0, Math.min(...stopIndexes));
}

function hasRenalContext(text) {
  const lower = text.toLowerCase();
  return RENAL_CONTEXT.some((phrase) => lower.includes(phrase));
}

function hasClearanceMetric(text) {
  return /\b(?:creatinine clearance|crcl|clcr)\b/i.test(text);
}

function hasDoseContext(text) {
  const lower = text.toLowerCase();
  return (
    DOSE_CONTEXT.some((phrase) => lower.includes(phrase)) ||
    /\b\d+(?:\.\d+)?\s*(mg|g|gram|grams|mcg|unit|units)\b/i.test(text) ||
    /\b\d+(?:\.\d+)?\s*(?:every\s+\d+\s+hours?|q\s*\d+\s*h)\b/i.test(text)
  );
}

function hasRenalAvoidanceText(text) {
  return /\b(?:renal|kidney|creatinine clearance|crcl|clcr)\b[\s\S]{0,120}\b(?:contraindicated|avoid(?: use)?|not recommended|should not be used)\b|\b(?:contraindicated|avoid(?: use)?|not recommended|should not be used)\b[\s\S]{0,120}\b(?:renal|kidney|creatinine clearance|crcl|clcr)\b/i.test(
    text
  );
}

function hasRenalCautionText(text) {
  return RENAL_CAUTION.test(text);
}

function hasNoRenalAdjustmentText(text, heading = "") {
  if (/renal|kidney/i.test(heading) && NO_RENAL_ADJUSTMENT.test(text)) {
    return true;
  }

  return [...String(text || "").matchAll(NO_RENAL_ADJUSTMENT_GLOBAL)].some((match) => {
    const start = Math.max(0, match.index - 180);
    const end = Math.min(String(text || "").length, match.index + match[0].length + 180);
    const window = String(text || "").slice(start, end);
    if (!/\brenal\b/i.test(match[0]) && /\b(?:liver|hepatic)\b[\s\S]{0,140}\b(?:renal|kidney|creatinine clearance|crcl|clcr)\b/i.test(window)) {
      return false;
    }
    return /\b(?:renal|kidney|creatinine clearance|crcl|clcr)\b/i.test(window);
  });
}

function routeLabel(route) {
  if (route === "IV") {
    return "IV";
  }
  if (route === "ORAL") {
    return "Oral";
  }
  return "All routes";
}

function emptyGuidance(message) {
  return {
    status: "not_available",
    title: "Dose guidance unavailable",
    badge: "No renal rule",
    routeLabel: "All routes",
    crclBand: "",
    recommendation: message,
    sourceHeading: "",
    caveat: "Educational purpose only. Results are estimates and are not for prescribing.",
    rows: [],
  };
}

function compactText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
