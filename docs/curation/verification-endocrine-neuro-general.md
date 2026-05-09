# Verification Agent C Report: Endocrine, Neuro, General

Verification date: 2026-05-06

Scope reviewed:
- `src/data/renalRules/endocrine-neuro-general.js`
- `docs/curation/endocrine-neuro-general.md`

Method: independent source spot-check against FDA-label content on DailyMed/openFDA-accessible DailyMed pages where possible. I checked each JS record for drug name, route, renal metric/bands, dose, interval, indication note, source URL, and confidence metadata, then checked whether the cited or an equivalent current DailyMed FDA label contains explicit renal dosing language, renal dosing table, contraindication, or no-adjustment statement.

## Summary Counts

- Records reviewed: 35
- PASS: 23
- FLAG: 12
- Unable to verify: 0

## Findings Table

| file | drug | status | issue | recommended action |
|---|---:|:---:|---|---|
| `src/data/renalRules/endocrine-neuro-general.js` | Metformin | PASS | eGFR thresholds, non-initiation at 30-45, contraindication below 30, and discontinuation below 30 are traceable to DailyMed renal impairment language. Contrast-procedure renal caveat exists but is outside this rule shape. | Keep, with UI/source note that metformin is eGFR-based and has contrast/surgery interruption caveats. |
| `src/data/renalRules/endocrine-neuro-general.js` | Sitagliptin | PASS | eGFR bands and 100/50/25 mg once-daily doses match label renal dosing, including dialysis timing. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Saxagliptin | PASS | eGFR >=45 usual dose and eGFR <45/ESRD 2.5 mg daily after hemodialysis match label. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Alogliptin | PASS | CrCl >=60, 30-<60, severe/ESRD dosing is traceable to label. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Linagliptin | PASS | Label explicitly says no renal dose adjustment. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Glimepiride | PASS | Label supports 1 mg starting dose and slow titration for renal impairment/hypoglycemia risk. This is not a CrCl-banded rule, but the renal-risk statement is explicit. | Keep only as conservative initiation guidance; do not display as a maintenance renal dose cap. |
| `src/data/renalRules/endocrine-neuro-general.js` | Dapagliflozin | PASS | eGFR >=45 glycemic-control guidance, eGFR <45 glycemic-control not recommended, eGFR >=25 for other adult indications, and continuation below 25 are traceable. | Keep; ensure UI can show indication-specific branches. |
| `src/data/renalRules/endocrine-neuro-general.js` | Canagliflozin | PASS | eGFR 30-<60 maximum 100 mg, eGFR <30 non-initiation, and albuminuric continuation condition are traceable. | Keep; preserve albuminuria/indication caveat. |
| `src/data/renalRules/endocrine-neuro-general.js` | Gabapentin | FLAG | CrCl dose bands match the label table, but the record omits the explicit post-hemodialysis supplemental-dose table. In dialysis patients, the current all-renal band could be incomplete. | Add a dialysis-specific variant or clearly suppress guidance when dialysis is present until HD support exists. |
| `src/data/renalRules/endocrine-neuro-general.js` | Pregabalin | FLAG | Daily dose bands are traceable, but the label table is target-dose based and includes mandatory post-hemodialysis supplemental doses that are omitted. | Add HD supplemental-dose handling and clarify that listed ranges are selected from normal-target-dose rows, not one universal target. |
| `src/data/renalRules/endocrine-neuro-general.js` | Levetiracetam | FLAG | Non-dialysis CrCl bands match, but ESRD on dialysis has a separate 500-1000 mg every 24 hours regimen plus post-dialysis supplement. Current `<30` q12h band could overdose ESRD dialysis patients. | Add a separate ESRD/hemodialysis rule or block dialysis display. Critical before verification. |
| `src/data/renalRules/endocrine-neuro-general.js` | Topiramate | FLAG | CrCl <70 half-usual-adult-dose language is traceable, but the label has a distinct hemodialysis supplemental-dose caveat that is not represented. | Add HD caveat/variant; otherwise mark as non-dialysis guidance only. |
| `src/data/renalRules/endocrine-neuro-general.js` | Lacosamide | PASS | Label supports no adjustment in mild/moderate renal impairment, max 300 mg/day for CrCl <=30/ESRD, cautious titration, and up-to-50% post-HD supplement. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Oxcarbazepine | PASS | Label supports CrCl <30 initiation at one-half usual starting dose, 300 mg/day divided BID, and slow increase. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Memantine | FLAG | Severe renal impairment target dose is traceable only for CrCl 5-29. The JS record has no band for CrCl/eGFR <5, so very low values may return no guidance. | Add explicit `<5 mL/min` unable/consult-label band or define app behavior for out-of-label renal function. |
| `src/data/renalRules/endocrine-neuro-general.js` | Galantamine | PASS | CrCl 9-59 max 16 mg/day and CrCl <9 not recommended match label. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Duloxetine | PASS | Avoidance at GFR <30 is explicit. No adjustment above that threshold is not table-based but is consistent with label framing. | Keep with "avoid severe renal impairment" emphasis. |
| `src/data/renalRules/endocrine-neuro-general.js` | Desvenlafaxine | PASS | Moderate, severe, and ESRD renal maximums match label; no post-dialysis supplement is explicit. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Venlafaxine | PASS | Mild/moderate 25%-50% reduction and severe/HD 50% or more reduction match label. | Keep; note ER tablet source has formulation-strength limitations. |
| `src/data/renalRules/endocrine-neuro-general.js` | Paliperidone | PASS | Oral ER mild, moderate/severe, and CrCl <10 not-recommended bands match label. | Keep; maintain oral-ER-only note. |
| `src/data/renalRules/endocrine-neuro-general.js` | Risperidone | FLAG | Severe CrCl <30 starting dose is traceable, but label also says moderate-to-severe renal disease with CrCl 15-59 has reduced clearance and doses should be reduced. Current `CrCl >=30 no adjustment` is unsupported and likely unsafe for CrCl 30-59. | Replace broad no-adjustment band with label-supported renal-disease reduction guidance; this is a critical blocker. |
| `src/data/renalRules/endocrine-neuro-general.js` | Lurasidone | FLAG | Renal dose content is traceable on DailyMed, but the exact source URL in JS returned an internal DailyMed error during verification. | Update source URL to an accessible current DailyMed label URL/setid before marking verified. |
| `src/data/renalRules/endocrine-neuro-general.js` | Acamprosate | FLAG | Label says CrCl 30-50 gets 333 mg TID but CrCl <=30 is contraindicated. JS has a boundary ambiguity: CrCl exactly 30 may match the 30-50 dosing band depending on range semantics. | Make the contraindicated band include `<=30` unambiguously and start the dose-reduction band above 30 if evaluator semantics require it. Critical boundary issue. |
| `src/data/renalRules/endocrine-neuro-general.js` | Varenicline | PASS | Mild/moderate no adjustment, severe start/max, and ESRD hemodialysis max match label. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Pramipexole | PASS | Parkinson disease renal table is traceable; very severe impairment/hemodialysis not adequately studied is represented as manual review. | Keep with Parkinson-disease-only note; do not reuse for restless legs syndrome. |
| `src/data/renalRules/endocrine-neuro-general.js` | Ropinirole | FLAG | Label has different ESRD hemodialysis dosing for Parkinson disease versus restless legs syndrome. JS uses the RLS-style 0.25 mg once daily/max 3 mg/day but has a general immediate-release note. It also leaves severe non-dialysis impairment not studied/gapped. | Split Parkinson vs RLS rules or restrict this record to RLS; add severe non-dialysis "not studied" handling. Critical before verification. |
| `src/data/renalRules/endocrine-neuro-general.js` | Tramadol | PASS | CrCl <30 q12h and max 200 mg/day are explicit; dialysis-day regular dosing is a source caveat. | Keep; consider adding dialysis caveat if UI supports it. |
| `src/data/renalRules/endocrine-neuro-general.js` | Tapentadol | PASS | No adjustment for CrCl 30-90 and not recommended below 30 match label. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Allopurinol | PASS | Adult gout initial eGFR table matches label. Indication note correctly limits this to initial gout dosing and titration/monitoring. | Keep; do not apply to cancer-therapy hyperuricemia or stones without separate rules. |
| `src/data/renalRules/endocrine-neuro-general.js` | Febuxostat | FLAG | CrCl 30-89 no adjustment and CrCl 15-29 40 mg/day limit are traceable, but label states ESRD/dialysis not studied and JS has no `<15`/dialysis band. | Add `<15`/dialysis unable/not-studied band or block guidance there. |
| `src/data/renalRules/endocrine-neuro-general.js` | Famotidine | FLAG | Some renal maximums are traceable, but the label table is indication-specific and includes active gastric ulcer, erosive esophagitis, hypersecretory conditions, DU recurrence, lower-dose formulation notes, plus CNS/QT renal warnings. Current variants are incomplete and may overgeneralize CrCl <30 as 20 mg every other day. | Expand indication-specific variants or restrict display to the exact included indications; add renal CNS/QT warning note. |
| `src/data/renalRules/endocrine-neuro-general.js` | Metoclopramide | PASS | GERD and diabetic-gastroparesis renal dose reductions match the label tables for CrCl <=60/ESRD; boxed TD duration caveat is present in source but not renal-specific. | Keep; consider displaying boxed warning/duration caveat elsewhere. |
| `src/data/renalRules/endocrine-neuro-general.js` | Alendronate | PASS | Label renal statement supports no adjustment for CrCl 35-60 and not recommended below 35. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Risedronate | PASS | Label supports no adjustment at CrCl >=30 and not recommended below 30. | Keep. |
| `src/data/renalRules/endocrine-neuro-general.js` | Zoledronic acid | PASS | Reclast label supports CrCl calculation before each dose, contraindication below 35 or acute renal impairment, and no dose adjustment at/above 35. | Keep; retain Reclast-only/non-oncology note. |

## Top Critical Blockers

1. Levetiracetam: ESRD on dialysis is not a subset of the `<30 q12h` rule. FDA labeling uses every-24-hour ESRD dosing plus a post-dialysis supplement.
2. Risperidone: the `CrCl >=30 no adjustment` line conflicts with label pharmacokinetic guidance for moderate-to-severe renal disease (CrCl 15-59), where dose reduction is recommended.
3. Ropinirole: ESRD hemodialysis dosing differs by indication. The current entry appears to mix general immediate-release use with the RLS ESRD regimen.
4. Acamprosate: CrCl exactly 30 is a dangerous boundary because the label contraindicates CrCl <=30 while also naming moderate impairment 30-50 for reduced dosing.
5. Dialysis omissions: gabapentin, pregabalin, topiramate, and levetiracetam all have explicit hemodialysis supplemental-dose language that is absent or insufficiently represented.

## Source Notes

- DailyMed labels were available and traceable for all records. One exact JS URL (`Lurasidone`) returned an internal DailyMed error, but equivalent current DailyMed lurasidone labels show the same renal dose language.
- Records using eGFR rather than Cockcroft-Gault CrCl are appropriate where the label itself uses eGFR: metformin, sitagliptin, saxagliptin, dapagliflozin, canagliflozin, and allopurinol gout initial dosing.
- The strongest clean table matches were sitagliptin, saxagliptin, alogliptin, gabapentin, pregabalin, levetiracetam non-ESRD, paliperidone, pramipexole Parkinson disease, allopurinol gout initial dosing, famotidine, and metoclopramide.
- Several PASS records still need UI caveats rather than data correction: indication-specific SGLT2 rules, ER/immediate-release distinctions, titration-to-response drugs, and product-specific bisphosphonate/zoledronic acid indications.
- Direct DailyMed sources spot-checked included: metformin, sitagliptin, saxagliptin, alogliptin, linagliptin, glimepiride, dapagliflozin, canagliflozin, gabapentin, pregabalin, levetiracetam, topiramate, lacosamide, oxcarbazepine, memantine, galantamine, duloxetine, desvenlafaxine, venlafaxine, paliperidone, risperidone, lurasidone, acamprosate, varenicline, pramipexole, ropinirole, tramadol, tapentadol, allopurinol, febuxostat, famotidine, metoclopramide, alendronate, risedronate, and zoledronic acid.
