# Oncology/Rheum/Specialty Remediation Notes

Remediation Worker R4, 2026-05-06. Scope limited to records flagged in `docs/curation/verification-oncology-rheum-specialty.md`. Sources remained DailyMed FDA label pages only. All remediated JS records remain `confidence: "draft-source-extracted"` and are not verified.

## Flagged Records Remediated

| Record | DailyMed source | Remediation |
| --- | --- | --- |
| Capecitabine | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=29885ada-b743-419c-8f15-edd4247c76ca | Replaced the CLcr <30 interval text that implied a do-not-use instruction with the label-limited statement that dosage has not been established and a manual-review source-summary interval. |
| Topotecan injection | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b6019088-cd94-43b4-b5ce-ba20b6b8021e | Added an explicit CLcr <20 mL/min evidence-gap band because the label states insufficient data are available to provide a dosage recommendation. |
| Talazoparib | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=13839d4f-6acf-4ffb-a128-79df59319273 | Preserved moderate/severe CLcr dose reductions and added a CLcr <15 mL/min or hemodialysis not-studied source-summary band. Severe renal dosing variants now state not requiring hemodialysis. |
| Mycophenolate mofetil | https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8015f042-54fb-4a7a-a10b-6219e1a450c8 | Removed the unsupported IV route for the oral tablet/capsule source and removed the overgeneralized GFR >=25 no-modification band. Kept the kidney-transplant severe chronic graft impairment cap. |
| Darolutamide | https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=1a7cb212-56e4-4b9d-a73d-bfee7fe4735e | Changed CrCl language to eGFR, preserved the not-receiving-hemodialysis limitation for eGFR 15-29 mL/min/1.73 m2, and added an eGFR <15 or hemodialysis source-summary band. |

## Still Requiring Manual Clinical Review

- Capecitabine with CLcr <30 mL/min.
- Topotecan injection with CLcr <20 mL/min.
- Talazoparib with CLcr <15 mL/min or hemodialysis.
- Mycophenolate mofetil renal use outside the oral tablet/capsule kidney-transplant severe chronic graft impairment cap, including IV product use unless a separate FDA IV label is curated.
- Darolutamide with eGFR <15 mL/min/1.73 m2 or hemodialysis.

## Schema Limitation

The current rule schema is numeric-range oriented and does not have first-class fields for renal metric type, dialysis status, transplant context, product formulation/source route, or evidence-gap/manual-review state. These are encoded in `condition`, `dose`, and `interval` text for this remediation pass.
