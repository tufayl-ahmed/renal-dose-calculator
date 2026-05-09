# Remediation Notes: Endocrine, Neuro, General

Remediation worker: R3
Date: 2026-05-06

Scope:
- `src/data/renalRules/endocrine-neuro-general.js`
- `docs/curation/endocrine-neuro-general.md`

Source constraint: DailyMed FDA label sources only. Confidence remains `draft-source-extracted`; no record was promoted to verified.

## Flagged Records Remediated

1. Gabapentin - retained renal table and added hemodialysis source-summary wording for maintenance-by-CrCl plus 125-350 mg post-HD supplement after each 4 hours of hemodialysis.
2. Pregabalin - clarified target-dose mapping and added hemodialysis supplement wording for 25-150 mg after each 4-hour HD treatment, selected by daily regimen.
3. Levetiracetam - split the low renal band into severe non-dialysis dosing and ESRD dialysis dosing: 500-1000 mg every 24 hours with 250-500 mg post-dialysis supplement.
4. Topiramate - kept the CrCl <70 half-usual-dose rule and added manual-review hemodialysis supplementation language because the label requires individualized adjustment.
5. Memantine - added an explicit CrCl <5 mL/min manual-review band because the label target dose is stated for CrCl 5-29 mL/min.
6. Risperidone - removed the unsupported broad CrCl >=30 no-adjustment row; added CrCl 30-59 manual dose-reduction guidance, CrCl 15-29 severe starting regimen, and CrCl <15/dialysis manual review.
7. Lurasidone - replaced the inaccessible DailyMed lookup URL with an accessible current DailyMed label URL.
8. Acamprosate - made CrCl exactly 30 mL/min select the contraindicated row before the reduced-dose row; reduced-dose wording now says it applies only when CrCl is >30 to 50 mL/min.
9. Ropinirole - separated ESRD hemodialysis dosing for Parkinson disease and RLS; added severe non-dialysis "not studied" manual-review wording.
10. Febuxostat - added CrCl <15/dialysis manual-review wording because ESRD patients on dialysis were not studied.
11. Famotidine - expanded renal variants by indication, added low-dose formulation caveats, pathological hypersecretory-condition avoidance, and CNS/QT renal warning notes.
12. Glimepiride - kept the record but reframed it as conservative initiation/retitration guidance, not a renal maintenance dose cap.

## Still Requiring Manual Clinical Review

- Gabapentin, Pregabalin, Levetiracetam, and Topiramate: dialysis guidance is label-derived but the schema cannot select by dialysis status, dialysis duration, or exact post-HD regimen context.
- Memantine: CrCl <5 mL/min is out of the clean label dosing band and remains manual review.
- Risperidone: CrCl 30-59 mL/min has a label-supported need for dose reduction but no fixed numeric renal regimen.
- Ropinirole: severe renal impairment without regular dialysis was not studied; ESRD HD dosing requires indication selection.
- Febuxostat: CrCl <15 mL/min or dialysis has no clean label regimen.
- Famotidine: pathological hypersecretory conditions and 10 mg regimens require manual review or a formulation-specific pathway.

## Schema Limitations

- No dialysis-status dimension exists, so HD/CAPD variants must be encoded as condition text inside CrCl bands.
- No indication selector exists, so indication-specific variants are bundled in the same renal band.
- No formulation selector exists, so famotidine 10 mg oral-suspension/lower-dose requirements are preserved as text.
- Range matching is numeric only and selected by first matching rule, so Acamprosate uses row order plus explicit dose wording to make CrCl exactly 30 mL/min contraindicated.
