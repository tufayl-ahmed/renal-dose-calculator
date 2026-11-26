// openFDA `route` values whose products do not reach the bloodstream in
// amounts that need kidney dosing, with the word the card uses for each.
//
// Transdermal, buccal, sublingual, rectal and vaginal are left out on purpose:
// many of those products are systemic by design (fentanyl and clonidine
// patches, buprenorphine films, diazepam rectal gel, contraceptive and
// estradiol vaginal rings). A drug sold only in those forms still gets the
// normal "no oral label" answer.
export const NON_SYSTEMIC_ROUTES = {
  TOPICAL: "topical",
  CUTANEOUS: "topical",
  OPHTHALMIC: "eye",
  INTRAOCULAR: "eye",
  "AURICULAR (OTIC)": "ear",
  OTIC: "ear",
  NASAL: "nasal",
  "RESPIRATORY (INHALATION)": "inhaled",
  INHALATION: "inhaled",
  DENTAL: "dental",
};

// Ingredients whose nasal, inhaled or skin products are made to act on the
// whole body (Spravato, Baqsimi, Afrezza, Natesto, Narcan, Nascobal, TOBI...).
// Their labels are never treated as non-systemic, whatever the route.
const SYSTEMIC_BY_DESIGN = new Set([
  "AMIKACIN",
  "AZTREONAM",
  "BUTORPHANOL",
  "CALCITONIN",
  "CYANOCOBALAMIN",
  "DESMOPRESSIN",
  "DIAZEPAM",
  "DIHYDROERGOTAMINE",
  "EPINEPHRINE",
  "ESKETAMINE",
  "ESTRADIOL",
  "FENTANYL",
  "GLUCAGON",
  "ILOPROST",
  "INSULIN",
  "KETOROLAC",
  "LEVODOPA",
  "LOXAPINE",
  "MIDAZOLAM",
  "NALMEFENE",
  "NALOXONE",
  "NICOTINE",
  "PENTAMIDINE",
  "RIBAVIRIN",
  "SUMATRIPTAN",
  "TESTOSTERONE",
  "TOBRAMYCIN",
  "TREPROSTINIL",
  "ZANAMIVIR",
  "ZAVEGEPANT",
  "ZOLMITRIPTAN",
]);

/** True when there is at least one route and every route is non-systemic. */
export function areAllRoutesNonSystemic(routes = []) {
  return routes.length > 0 && routes.every((route) => Object.hasOwn(NON_SYSTEMIC_ROUTES, route.toUpperCase()));
}

/** True when any ingredient name contains a systemic-by-design ingredient. */
export function isSystemicByDesign(ingredientNames = []) {
  return ingredientNames.some((name) =>
    String(name)
      .toUpperCase()
      .split(/[^A-Z]+/)
      .some((word) => SYSTEMIC_BY_DESIGN.has(word))
  );
}

/** "nasal/inhaled" for ["NASAL", "RESPIRATORY (INHALATION)"]. */
export function describeNonSystemicRoutes(routes = []) {
  const words = routes.map((route) => NON_SYSTEMIC_ROUTES[String(route).toUpperCase()]).filter(Boolean);
  return words.length ? [...new Set(words)].join("/") : "non-systemic";
}
