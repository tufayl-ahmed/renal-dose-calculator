# Remediation: Antivirals/Immunology and Cardio/Anticoag Flags

Worker: Remediation Worker R2  
Date: 2026-05-06  
Source policy: DailyMed FDA label pages only.  
Status: draft source extraction only; no records were promoted to verified.

## Flagged Records Remediated

| Drug | Remediation |
| --- | --- |
| Valacyclovir | Added genital-herpes suppressive therapy rows for immunocompetent, alternate-dose, HIV-1-infected, and reduction-of-transmission contexts across renal bands. |
| Famciclovir | Added missing suppression and HIV-associated recurrent herpes rows for higher renal-function bands and added hemodialysis rows from the label table. |
| Oseltamivir | Added CAPD treatment/prophylaxis and ESRD not-on-dialysis not-recommended branches. |
| Peramivir | Added chronic hemodialysis after-dialysis timing branch. |
| Rivaroxaban | Added NVAF CrCl <15/dialysis avoid-use, orthopedic/medical prophylaxis rows, and CAD/PAD no-CrCl-adjustment rows. |
| Dabigatran etexilate | Added explicit DVT/PE no-recommendation and P-gp inhibitor avoid-use branches where the label separates them from NVAF. |
| Edoxaban | Added CrCl <15 not-recommended branches for NVAF and DVT/PE contexts. |
| Enoxaparin sodium | Expanded severe renal impairment table to include ACS/non-Q-wave MI and STEMI age-specific rows. |
| Sotalol | Added AFIB/AFL >60 and 40-59 dosing interval rows while retaining AFIB/AFL <40 contraindication. |
| Ramipril | Replaced the non-resolving DailyMed source URL with a resolvable DailyMed label URL containing the same renal dosing language. |
| Spironolactone | Normalized source URL and added eGFR <30 no-label-initiation-recommendation/manual-review branch. |
| Torsemide | Retained as renal-disease indication dosing and labeled as manual review, not a clean renal dose-adjustment rule. |
| Metolazone | Retained as renal-disease indication dosing and labeled as manual review, not a clean renal dose-adjustment rule. |
| Eptifibatide | Added dependency-on-renal-dialysis contraindication branch. |
| Cardio markdown | Kept 36-record count and updated manual-review/source notes for remediated records. |

## Still Requiring Manual Clinical Review

All records remain `confidence: "draft-source-extracted"`. Higher-priority manual review remains for anticoagulants with indication-specific dosing, sotalol initiation/QT monitoring, eptifibatide dialysis handling, spironolactone eGFR <30 handling, and torsemide/metolazone because they are renal-disease indication dosing rather than renal adjustment.

## Schema Limitations

The current rule schema does not have structured fields for dialysis modality, ESRD not on dialysis, indication-dose versus renal-adjustment rule type, interacting-drug modifiers, age/weight modifiers, or monitoring requirements. Those distinctions are therefore encoded in `condition`, `dose`, and `interval` text.
