import { additionalCommonMedRules } from "./additional-common-meds.js";
import { antiinfectiveBetaLactamRules } from "./antiinfectives-beta-lactams.js";
import { antiinfectiveNonBetaRules } from "./antiinfectives-nonbeta.js";
import { antiviralImmunologyRules } from "./antivirals-immunology.js";
import { cardioAnticoagRules } from "./cardio-anticoag.js";
import { endocrineNeuroGeneralRules } from "./endocrine-neuro-general.js";
import { oncologyRheumSpecialtyRules } from "./oncology-rheum-specialty.js";

export const draftRenalDoseRules = [
  ...antiinfectiveBetaLactamRules,
  ...antiinfectiveNonBetaRules,
  ...antiviralImmunologyRules,
  ...cardioAnticoagRules,
  ...endocrineNeuroGeneralRules,
  ...oncologyRheumSpecialtyRules,
  ...additionalCommonMedRules,
];
