// Kidney-related sentences from a label, for cards where no dose rule could be
// derived. Stricter than the section keyword filter in openfda.js, which also
// matches "hepatic impairment" and the generic geriatric boilerplate.

// Kidney *function* terms; bare "renal"/"kidney" also appears in adverse-event
// and anatomy text ("extra-renal manifestations", "involving the kidney").
const KIDNEY =
  /\b(?:renal (?:impairment|function|insufficiency|failure|disease|dysfunction|damage)|kidney (?:impairment|function|disease|failure)|impaired renal|creatinine clearance|crcl|clcr|e?gfr|dialy\w*|hemodialysis|esrd|end[- ]stage renal)\b/i;
// Guidance, not description.
const ACTION =
  /\b(?:dose|doses|dosage|dosing|adjust\w*|reduc\w*|not recommended|contraindicated|avoid|caution|monitor\w*|titrat\w*|initiat\w*|start\w*|maximum|should not|do not|discontinu\w*|lower)\b/i;
const NOISE = [
  // Geriatric boilerplate present on most labels.
  /greater frequency of decreased hepatic,? renal,? (?:or|and) cardiac function/i,
  /elderly patients are more likely to have decreased renal function/i,
  /\b(?:animal|rats?|mice|rabbits?|dogs?|fetal|fetus|neonat\w*|pregnan\w*|lactation|breast[- ]?fe\w*)\b/i,
  // Adverse-event and case reports, not dosing guidance.
  /\b(?:adverse reactions?|were reported|have been reported|postmarketing|case series)\b/i,
];
const MAX_SENTENCES = 5;
const MAX_LENGTH = 300;

/** Up to five kidney sentences, dosing-relevant ones first. */
export function extractKidneySentences(label) {
  const sentences = (label?.sections || [])
    .flatMap((section) => splitSentences(section.fullText || section.text || ""))
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(
      (sentence) =>
        sentence.length > 20 &&
        KIDNEY.test(sentence) &&
        ACTION.test(sentence) &&
        !NOISE.some((pattern) => pattern.test(sentence))
    );
  const unique = [...new Set(sentences)];
  return unique
    .map((sentence, index) => ({ sentence, index, score: score(sentence) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_SENTENCES)
    .map(({ sentence }) => windowAroundKidneyTerm(sentence));
}

function score(sentence) {
  let value = 0;
  if (/\b(?:creatinine clearance|crcl|clcr|e?gfr)\b/i.test(sentence)) {
    value += 3;
  }
  if (/\d/.test(sentence)) {
    value += 2;
  }
  if (
    /\b(?:dose|dosage|dosing|reduce|adjust|not recommended|contraindicated|avoid|caution|monitor)\b/i.test(sentence)
  ) {
    value += 2;
  }
  return value;
}

function splitSentences(text) {
  // Also split before numbered headings ("8.6 Renal Impairment"), which
  // openFDA runs into the previous sentence.
  return String(text).split(/(?<=[.!?\]])\s+(?=[A-Z(•])|\s+(?=\d{1,2}\.\d{1,2}\s+[A-Z])/);
}

/** Long sentences are cut around the kidney phrase so it stays visible. */
function windowAroundKidneyTerm(sentence) {
  if (sentence.length <= MAX_LENGTH) {
    return sentence;
  }
  const at = sentence.search(KIDNEY);
  const start = Math.max(0, Math.min(at - MAX_LENGTH / 3, sentence.length - MAX_LENGTH));
  const slice = sentence.slice(start, start + MAX_LENGTH).trim();
  return `${start > 0 ? "…" : ""}${slice}${start + MAX_LENGTH < sentence.length ? "…" : ""}`;
}
