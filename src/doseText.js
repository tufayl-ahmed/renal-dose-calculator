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
  return SCHEDULE_START.test(right) || /[:(]$/.test(left) ? `${left} ${right}` : `${left} — ${right}`;
}
