# Renal Rules Database Status

Updated: 2026-05-06

## Executive Summary

The curated draft renal-dose database now contains 209 adult medication records. The initial subagent curation produced 207 DailyMed-backed records; doxycycline hyclate and vancomycin hydrochloride were added afterward so common shorthands such as `doxy`, `vanco`, and `vancomycin` can return clean curated output instead of raw label fallback.

All records remain `confidence: "draft-source-extracted"` unless they are one of the two starter rules in `src/curatedDoseRules.js`. The database is preserved in the repo as a parked reviewed-data asset, but the live calculator currently bypasses curated rules and uses the DailyMed/openFDA plus assisted summary pathway.

## Verification Status

Initial independent verification reviewed 207 records:

| Initial status | Count |
| --- | ---: |
| Pass | 151 |
| Flag | 56 |
| Unable to verify | 0 |
| Total reviewed | 207 |

All 56 initially flagged records were remediated without deletion and then independently rechecked:

| Remediation recheck | Count |
| --- | ---: |
| Remediated flag records passed recheck | 56 |
| Production-blocking remediation issues | 0 |

Some remediated records intentionally display `Source summary only`, `manual clinical review required`, `not studied`, `not recommended`, or similar text because the current schema cannot safely collapse dialysis modality, indication, formulation, interacting drugs, or nonnumeric renal categories into one numeric CrCl line.

## Batch Summary

| Batch | Current draft records | Initial verification | Initial pass | Initial flag | Remediation recheck |
| --- | ---: | --- | ---: | ---: | --- |
| Antiinfectives: beta-lactams | 24 | `verification-antiinfectives.md` | included below | included below | 18/18 antiinfective flags passed |
| Antiinfectives: non-beta | 30 | `verification-antiinfectives.md` | included below | included below | includes doxycycline and vancomycin post-review additions |
| Antiinfectives total | 54 | `verification-antiinfectives.md` | 34 | 18 | PASS |
| Antivirals/immunology | 24 | `verification-antivirals-cardio.md` | included below | included below | 14/14 antiviral/cardio flags passed |
| Cardio/anticoag | 36 | `verification-antivirals-cardio.md` | included below | included below | stale cardio doc count corrected |
| Antivirals + cardio total | 60 | `verification-antivirals-cardio.md` | 46 | 14 | PASS |
| Endocrine/neuro/general | 35 | `verification-endocrine-neuro-general.md` | 23 | 12 | 12/12 flags plus glimepiride reframe passed |
| Oncology/rheum/specialty | 30 | `verification-oncology-rheum-specialty.md` | 25 | 5 | 5/5 flags passed |
| Additional common meds | 30 | `verification-additional-common-meds-final.md` | 21 | 9 | 9/9 flags passed |

## Draft Data Files

- `src/data/renalRules/antiinfectives-beta-lactams.js`
- `src/data/renalRules/antiinfectives-nonbeta.js`
- `src/data/renalRules/antivirals-immunology.js`
- `src/data/renalRules/cardio-anticoag.js`
- `src/data/renalRules/endocrine-neuro-general.js`
- `src/data/renalRules/oncology-rheum-specialty.js`
- `src/data/renalRules/additional-common-meds.js`
- `src/data/renalRules/index.js`

## Main Safety Themes

- Dialysis status is still encoded in text, not as a first-class input.
- Some drugs are indication-specific, especially anticoagulants, antivirals, oncology drugs, SGLT2 inhibitors, urology drugs, and GI drugs.
- Some labels use eGFR, GFR, CLcr, or Cockcroft-Gault CrCl differently. The lookup now infers eGFR when label text clearly uses eGFR, but a structured `renalMetric` field is still the safer next schema step.
- Some records are formulation- or product-specific, such as ER vs IR, oral vs IV, ED/BPH tadalafil vs PAH tadalafil, or branded oncology/urology labels.
- Records with unresolved label gaps are kept, but shown as source-summary/manual-review guidance instead of invented dose bands.

## Current Product Boundary

If the curated table is re-enabled later, it should still be presented as draft label extraction, not final prescribing guidance. The footer and dose card warnings remain: educational purpose only, results are estimates, and not for prescribing.

## Structured UX Layer

The live calculator now has a structured selector layer for high-impact drugs. This layer adds dialysis, indication, and formulation matching without requiring a full rewrite of all 209 draft records.

Structured drugs:

- Piperacillin/tazobactam
- Amoxicillin/clavulanate
- Cefepime
- Cefuroxime axetil
- Cefuroxime injection
- Ceftazidime
- Cefpodoxime
- Ciprofloxacin
- Levofloxacin
- Acyclovir oral
- Acyclovir injection
- Oseltamivir
- Valacyclovir
- Famciclovir
- Gabapentin
- Pregabalin
- Levetiracetam
- Topiramate
- Famotidine
- Rivaroxaban
- Apixaban
- Edoxaban
- Dabigatran
- Enoxaparin
- Fondaparinux
- Sotalol
- Tadalafil
- Apremilast
- Atogepant
- Vancomycin

For these records, the app can show context controls only when useful. Source-summary/manual-review records, such as vancomycin, renal supplemental dialysis dosing, and high-risk anticoagulant edge cases, are displayed as review cards rather than fake fixed CrCl-dose cards.

Recommended next implementation steps:

1. Continue converting high-impact records to structured fields for `renalMetric`, dialysis modality, indication, formulation/product, and manual-review status.
2. Expand UI selectors only where they change dosing, especially dialysis and indication for high-risk drugs.
3. Keep DailyMed/openFDA fallback for drugs outside the draft table.
4. Move records from `draft-source-extracted` to a stronger status only after clinician review.
