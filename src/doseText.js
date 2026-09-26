// Intervals that read as part of the dose ("400 mg once daily"). Anything else
// is a reason or note ("Contraindicated — CrCl < 50 mL/min").
const SCHEDULE_START =
  /^(?:every|once|twice|thrice|three|four|five|six|daily|weekly|monthly|per|divided|single|continuous|after|before|at|on|over|for|with|then|plus|following|immediately|subcutaneously|qd|bid|tid|qid|q\d|\d|\()/i;

/** Joins a dose and its interval: a space for schedules, a dash for notes. */
export function joinDoseText(dose, interval) {
  const left = String(dose ?? "").trim();
  const right = String(interval ?? "").trim();
  if (!right) {
    return left;
  }
  if (!left) {
    return right;
  }
  if (SCHEDULE_START.test(right) || /[:(]$/.test(left)) {
    return `${left} ${right}`;
  }
  return `${left} — ${lowerFirstWord(right)}`;
}

// Proper names that stay capitalized mid-sentence.
const KEEP_CAPITALIZED = new Set(["Child", "Cockcroft", "Kaposi", "Parkinson", "Alzheimer"]);

/** "Use usual schedule" → "use usual schedule"; "CrCl < 30" and "ESRD" stay. */
function lowerFirstWord(text) {
  const word = text.match(/^[A-Z][a-z]+(?=[\s,;:.)]|$)/)?.[0];
  return word && !KEEP_CAPITALIZED.has(word) ? word.toLowerCase() + text.slice(word.length) : text;
}
