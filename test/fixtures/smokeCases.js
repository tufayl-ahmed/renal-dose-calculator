// Smoke-case panel from docs/PRODUCTION_CHECKLIST.md plus extra renal bands.
const base = { age: 45, sex: "male", creatinine: 2.1, weight: 70, height: 170 };
const low = { age: 78, sex: "female", creatinine: 3.2, weight: 52, height: 158 };
const normal = { age: 35, sex: "male", creatinine: 0.9, weight: 80, height: 180 };

export const SMOKE_CASES = [
  { id: "piptaz-iv", drug: "piptaz", route: "IV", ...base },
  { id: "meropenem-iv", drug: "meropenem", route: "IV", ...base },
  { id: "meropenem-iv-low", drug: "meropenem", route: "IV", ...low },
  { id: "cefepime-iv", drug: "cefepime", route: "IV", ...base },
  { id: "vancomycin-iv", drug: "vancomycin", route: "IV", ...base },
  { id: "doxy-oral", drug: "doxy", route: "ORAL", ...base },
  { id: "apixaban-oral", drug: "apixaban", route: "ORAL", ...base },
  { id: "famotidine-oral", drug: "famotidine", route: "ORAL", ...base },
  { id: "metformin-oral-low", drug: "metformin", route: "ORAL", ...low },
  { id: "gabapentin-oral", drug: "gabapentin", route: "ORAL", ...base },
  { id: "levofloxacin-oral-low", drug: "levofloxacin", route: "ORAL", ...low },
  { id: "acyclovir-iv", drug: "acyclovir", route: "IV", ...base },
  { id: "cefixime-oral", drug: "cefixime", route: "ORAL", ...base },
  { id: "sitagliptin-oral", drug: "sitagliptin", route: "ORAL", ...base },
  { id: "nitrofurantoin-oral-low", drug: "nitrofurantoin", route: "ORAL", ...low },
  { id: "atorvastatin-oral", drug: "atorvastatin", route: "ORAL", ...normal },
  { id: "enoxaparin-low", drug: "enoxaparin", route: "ALL", ...low },
  { id: "meropenem-oral-route-missing", drug: "meropenem", route: "ORAL", ...base },
  { id: "unknown-drug", drug: "zzqxnotadrug", route: "ORAL", ...base },
];
