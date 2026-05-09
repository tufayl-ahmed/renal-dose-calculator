# Verification Agent F: Additional Common Meds Final

Verified on 2026-05-06 against the current contents of:

- `src/data/renalRules/additional-common-meds.js`
- `docs/curation/additional-common-meds.md`

Scope was read-only for JS/data files. This report verifies the 30 current JS records, not the prior stale verification report.

## Summary

- Total JS records reviewed: 30
- Pass: 21
- Flag: 9
- Unable: 0
- Source family used: DailyMed FDA label pages. Where a stored DailyMed URL failed with a `version=` parameter, the same setid without `version` was checked to verify the label content.

## High-Risk Findings

1. Nonnumeric renal-dose categories are modeled as `type: "all"` for some dose reductions. This can surface a renal-reduced dose at any CrCl, even though the label language is limited to "severe renal impairment", "decreased renal function", or "renal impairment".
2. Two stored source URLs did not resolve during verification: Granisetron/SUSTOL and Atogepant/QULIPTA `lookup.cfm?...&version=` URLs. The same setids without `version` did resolve.
3. Tadalafil includes alias `adcirca`, but the encoded rule is explicitly for ED/BPH tadalafil, not PAH tadalafil/Adcirca-style dosing.
4. Vibegron uses eGFR thresholds from the label, while the rule engine shape is CrCl-based; the condition text says eGFR but the numeric matcher would still receive CrCl.

## Findings Table

| # | JS drugName | Status | Verification finding |
|---:|---|---|---|
| 1 | Cimetidine | FLAG | DailyMed confirms adult oral 300 mg every 12 hours for severely impaired renal function, with cautious frequency increases. Unsafe modeling issue: label has no numeric cutoff, but JS uses an all-CrCl rule for a reduced severe-impairment regimen. |
| 2 | Nizatidine | FLAG | DailyMed confirms active-treatment and maintenance CrCl bands: 20-50 and <20 mL/min. Boundary issue: JS first rule is `gte 50` with condition `CrCl >50`, before a 20-50 range; at exactly 50 mL/min the matcher can select no adjustment instead of the 20-50 reduced-dose band. |
| 3 | Esomeprazole magnesium | PASS | DailyMed confirms no dosage adjustment is necessary in renal insufficiency. H. pylori antibiotic co-therapy caveat is appropriately noted. |
| 4 | Lansoprazole | PASS | DailyMed confirms renal impairment patients do not require dosage adjustment. |
| 5 | Pantoprazole sodium | PASS | DailyMed confirms no dosage adjustment is necessary in renal impairment or hemodialysis. |
| 6 | Dexlansoprazole | PASS | DailyMed labeling supports no renal dosage adjustment; PK is not expected to change because parent drug is not recovered in urine. |
| 7 | Levocetirizine dihydrochloride | PASS | DailyMed confirms adult CrCl-based dose reductions and contraindication/avoidance in CLcr <10 mL/min or hemodialysis. |
| 8 | Fexofenadine hydrochloride | FLAG | DailyMed confirms 60 mg once daily as the adult starting dose in decreased renal function. Unsafe modeling issue: "decreased renal function" is nonnumeric but encoded as an all-CrCl dose-reduction rule. |
| 9 | Desloratadine | FLAG | DailyMed confirms 5 mg every other day starting dose in adult renal impairment. Unsafe modeling issue: renal impairment is not tied to a numeric cutoff but is encoded as an all-CrCl reduced regimen. |
| 10 | Montelukast sodium | PASS | DailyMed confirms no dosage adjustment is recommended in renal insufficiency. |
| 11 | Roflumilast | PASS | DailyMed confirms no dosage adjustment is necessary for renal impairment. |
| 12 | Tiotropium bromide | PASS | SPIRIVA HANDIHALER DailyMed label confirms no dosage adjustment, with close monitoring for anticholinergic effects in moderate/severe renal impairment. |
| 13 | Trospium chloride | PASS | Immediate-release DailyMed label confirms 20 mg twice daily usual dose and 20 mg once daily at bedtime when CrCl <30 mL/min. ER product non-recommended caveat is noted. |
| 14 | Vibegron | FLAG | DailyMed confirms no adjustment for eGFR 15 to <90 and not recommended for eGFR <15, with/without hemodialysis. Unsafe metric issue: JS stores eGFR thresholds in a CrCl-style numeric rules engine. |
| 15 | Ibandronate sodium | PASS | Oral tablet DailyMed label confirms not recommended in severe renal impairment, CrCl <30 mL/min. The >=30 branch is an inferred usual-dose branch, but the key not-recommended threshold is traceable. |
| 16 | Cinacalcet | PASS | DailyMed confirms no dosage adjustment is necessary for renal impairment, including hemodialysis/peritoneal dialysis PK comparability. |
| 17 | Ondansetron | PASS | DailyMed confirms renal dosage recommendation is the same as general population; label caveat about no experience beyond first-day administration is noted in JS. |
| 18 | Granisetron | FLAG | SUSTOL DailyMed label confirms 10 mg SC, q7 days normally, q14 days in CrCl 30-59, and avoid CrCl <30. Stored JS/docs source URL with `&version=10` did not resolve; same setid without `version` resolves. |
| 19 | Aprepitant | PASS | DailyMed confirms no dosage adjustment is necessary in renal impairment or ESRD undergoing hemodialysis. |
| 20 | Rimegepant | PASS | NURTEC ODT DailyMed label confirms no adjustment in mild/moderate/severe renal impairment and avoidance in ESRD/CLcr <15 or dialysis. |
| 21 | Ubrogepant | PASS | UBRELVY DailyMed label confirms severe renal impairment CLcr 15-29 dose reduction to 50 mg/50 mg and avoidance in CLcr <15. Search URL redirects to the exact label and resolves. |
| 22 | Atogepant | FLAG | QULIPTA DailyMed label confirms severe renal impairment/ESRD recommendations by migraine type, including post-dialysis preference. Stored JS/docs source URL with `&version=18` did not resolve; same setid without `version` resolves. |
| 23 | Ramelteon | PASS | DailyMed confirms no adjustment is required in renal impairment, including severe impairment and chronic hemodialysis. |
| 24 | Eszopiclone | PASS | DailyMed confirms no dose adjustment is necessary in any degree of renal impairment. |
| 25 | Zaleplon | FLAG | DailyMed confirms no dose adjustment in mild to moderate renal impairment and inadequate study in severe renal impairment. Unsafe modeling issue: JS encodes this as `CrCl >=30`, but the label statement itself is nonnumeric. |
| 26 | Suvorexant | PASS | BELSOMRA DailyMed label confirms no dose adjustment is required in renal impairment. |
| 27 | Lemborexant | PASS | DAYVIGO DailyMed label confirms no dose adjustment in mild, moderate, or severe renal impairment; somnolence risk caveat is represented. |
| 28 | Tadalafil | FLAG | DailyMed ED/BPH tadalafil label confirms the encoded CrCl bands for as-needed and once-daily use. Unsafe product/alias issue: alias `adcirca` can match PAH tadalafil, but JS explicitly does not encode PAH renal dosing. |
| 29 | Darifenacin | PASS | DailyMed confirms no dose adjustment is recommended for renal impairment. |
| 30 | Apremilast | PASS | OTEZLA DailyMed label confirms adult severe renal impairment CLcr <30 maintenance reduction to 30 mg once daily and AM-only titration. |

## Source URL Checks

- Resolving source URLs: 28/30 stored JS source URLs resolved or redirected to a DailyMed label during verification.
- Non-resolving stored URLs:
  - Granisetron: `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=f7c7ffdd-8270-4030-bc1e-a1cb28a6de56&version=10`
  - Atogepant: `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=8c8ab8f4-32bd-497a-befa-70c8a51d8d52&version=18`
- Alternate resolving URLs used for verification:
  - Granisetron: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f7c7ffdd-8270-4030-bc1e-a1cb28a6de56`
  - Atogepant: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8c8ab8f4-32bd-497a-befa-70c8a51d8d52`

## Documentation Cross-Check

`docs/curation/additional-common-meds.md` lists the same 30 current JS record names and the same source URLs. Its caveat about nonnumeric categories being encoded with `type: "all"` is present, but the final JS behavior still needs triage for records where an all-CrCl rule carries a reduced renal dose rather than a no-adjustment statement.
