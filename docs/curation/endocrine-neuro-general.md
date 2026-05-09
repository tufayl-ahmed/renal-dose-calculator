# Endocrine, Neuro, Psychiatric, Analgesic, Gout, GI, and General Renal Rules

Draft curated by Worker 5 on 2026-05-06 and remediated by R3 on 2026-05-06. Sources were limited to DailyMed FDA label pages surfaced during these passes. Records in `src/data/renalRules/endocrine-neuro-general.js` are all marked `draft-source-extracted`; none are marked verified.

## Completed JS Records

35 records were added:

1. Metformin - eGFR cutoffs for use, non-initiation, and discontinuation.
2. Sitagliptin - eGFR-based 100 mg, 50 mg, and 25 mg once-daily dosing.
3. Saxagliptin - eGFR cutoff for 2.5 mg once daily.
4. Alogliptin - CrCl-based 25 mg, 12.5 mg, and 6.25 mg once-daily dosing.
5. Linagliptin - explicit no renal dose adjustment statement.
6. Glimepiride - renal impairment/hypoglycemia-risk starting dose of 1 mg daily, encoded as initiation/retitration guidance rather than a maintenance renal dose cap.
7. Dapagliflozin - eGFR rules separated by glycemic versus cardiorenal indications.
8. Canagliflozin - eGFR maximum-dose and non-initiation guidance.
9. Gabapentin - renal function table by total daily dose and interval, with hemodialysis supplement wording retained.
10. Pregabalin - renal function table by target daily dose and interval, with hemodialysis supplement wording retained.
11. Levetiracetam - adult immediate-release renal adjustment table, including distinct ESRD hemodialysis dosing and post-HD supplement.
12. Topiramate - CrCl <70 mL/min/1.73 m2 one-half usual adult dose, with individualized hemodialysis supplement caveat.
13. Lacosamide - severe renal impairment/ESRD maximum 300 mg/day.
14. Oxcarbazepine - CrCl <30 mL/min one-half usual starting dose.
15. Memantine - severe renal impairment target dose for immediate-release tablets, plus CrCl <5 manual-review band.
16. Galantamine - CrCl 9-59 mL/min maximum 16 mg/day; avoid CrCl <9.
17. Duloxetine - avoid GFR <30 mL/min.
18. Desvenlafaxine - CrCl-based maximum doses.
19. Venlafaxine - percentage dose reductions by CrCl band.
20. Paliperidone - oral ER CrCl-based starts and maximums.
21. Risperidone - severe renal impairment starting dose and moderate renal disease manual dose-reduction guidance.
22. Lurasidone - moderate/severe renal impairment starting and maximum dose; source URL remediated to an accessible DailyMed label.
23. Acamprosate - CrCl >30-50 dose reduction and CrCl <=30 contraindication, with exact-30 boundary handled conservatively.
24. Varenicline - severe renal impairment and ESRD maximums.
25. Pramipexole - Parkinson disease renal table.
26. Ropinirole - moderate impairment no adjustment, severe non-dialysis not-studied wording, and indication-specific ESRD hemodialysis dosing for Parkinson disease versus RLS.
27. Tramadol - CrCl <30 interval extension and max daily dose.
28. Tapentadol - severe renal impairment not recommended.
29. Allopurinol - eGFR-based initial gout dosing table.
30. Febuxostat - CrCl 30-89 no adjustment, CrCl 15-29 40 mg/day limit, and CrCl <15/dialysis not-studied manual-review wording.
31. Famotidine - indication-specific renal maximum doses for tablet indications, including formulation caveats and CNS/QT renal warnings.
32. Metoclopramide - oral renal dose reductions for GERD and diabetic gastroparesis.
33. Alendronate - not recommended below CrCl 35 mL/min.
34. Risedronate - not recommended below CrCl 30 mL/min.
35. Zoledronic acid - Reclast product contraindicated below CrCl 35 mL/min.

## Source URLs Used

- Metformin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a2e762ea-732b-a590-e053-2a95a90aa5e5
- Sitagliptin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6a970e80-b753-48fa-9fff-87e7a5044982
- Saxagliptin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f3ea58bb-0002-4a5d-9213-7e9066e3dc9c
- Alogliptin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b25f155a-1259-47c2-aa3b-7c1356e4c7f6
- Linagliptin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=cbdbd4b2-c07b-00e1-e053-2995a90a5fc9
- Glimepiride: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=26cd0240-245f-554a-e063-6394a90a6919
- Dapagliflozin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=17586ec6-0104-4b08-ad87-12a837568d6c
- Canagliflozin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4e946ba3-02c4-4a10-9d5e-f2d87b534dc3
- Gabapentin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=59a01ec3-97d4-c099-e053-2a91aa0af754
- Pregabalin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8fb45a78-b2d8-45dd-b844-0de21d1fdde9
- Levetiracetam: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1d67cb3c-1173-4dce-a79b-a3c36934ab2e
- Topiramate: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=41a5a961-8756-464c-aef3-22f2c9047609
- Lacosamide: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1310e776-65c8-413d-aab5-81a8c15719c5
- Oxcarbazepine: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=867eaf99-3e31-4f75-bfae-2898804d956d
- Memantine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=becb09dc-174d-4817-88d4-f38c8adcd309
- Galantamine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=e80ec152-3616-4a13-9266-715550a8c398
- Duloxetine: https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4121bd3f-2d6d-3bdd-e063-6294a90a3088
- Desvenlafaxine: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=25bdfc41-c7cb-4d16-b6a8-f102f9b8c984
- Venlafaxine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=e81a2daf-b8b2-7c05-b532-bc775700b100&version=4
- Paliperidone: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=463db841-297f-7692-e063-6394a90a8c14
- Risperidone: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a6347895-5f16-43b4-92a0-b9904ac81937
- Lurasidone: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fa9f0d28-c525-4a1e-acec-84c82e10b9a2
- Acamprosate: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=ae6e79c0-a307-4888-b647-1b7be4cb9127&version=4
- Varenicline: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0004a0bb-87c0-46f8-b36a-95c98107395d
- Pramipexole: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=04bf2b80-5371-4641-bbf5-e19587c0e9cf
- Ropinirole: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1cdb9d61-5bbc-4026-a449-fec8c9ce5c65
- Tramadol: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=cabccc8a-6f9f-414c-93f0-6dec331ed74b
- Tapentadol: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=863f3fd3-1e8d-41b0-855f-8f9a29237cda
- Allopurinol: https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4f5c4fbc-3d31-5068-e063-6294a90ab315
- Febuxostat: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=54de10ef-fe5f-4930-b91d-6bbb04c664bd
- Famotidine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=a06502d9-7903-4f37-833e-e5763d502def
- Metoclopramide: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=7eeaa7bc-c94f-47d0-94e5-e35ccadca19e
- Alendronate: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4323d3aa-cbb0-41e2-aba7-7a94a0516993
- Risedronate: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=a42a35e6-3e08-4b4f-ae56-47d4aec2322a
- Zoledronic acid: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=16fcf8c9-ef8a-4e93-9ee6-acfadd35a861

## Needs Manual Review

- R3 remediation details are captured in `docs/curation/remediation-endocrine-neuro-general.md`.
- Gabapentin, pregabalin, levetiracetam, and topiramate: hemodialysis guidance is now represented in text, but the current rule schema cannot choose by dialysis status, dialysis duration, or post-HD dose context.
- Memantine: CrCl <5 mL/min is explicitly retained as manual review because the clean DailyMed target dose covers CrCl 5-29 mL/min.
- Risperidone: CrCl 30-59 mL/min requires dose reduction per label, but DailyMed does not provide a fixed numeric renal regimen for that whole band.
- Ropinirole: ESRD hemodialysis dosing requires indication selection; severe renal impairment without regular dialysis was not studied.
- Febuxostat: CrCl <15 mL/min or dialysis remains manual review because ESRD patients on dialysis were not studied.
- Famotidine: pathological hypersecretory conditions and 10 mg regimens require manual clinical/formulation review.
- Insulin products: renal impairment affects insulin requirements, but I did not find a clean fixed adult CrCl/eGFR dose rule suitable for this JS format.
- Empagliflozin: label renal thresholds vary across older glycemic-control text and newer HF/CKD indications; needs a dedicated current-label pass before adding.
- Colchicine: explicit renal language exists, but dosing differs for gout prophylaxis, gout flare treatment, FMF, dialysis, and interacting drugs. Keep out of JS until indication-specific rule handling is designed.
- Lithium: renal use is driven by serum levels, toxicity monitoring, and avoidance in severe impairment rather than a clean fixed CrCl/eGFR dose line.
- Rivastigmine: label language supports cautious titration in renal impairment but not a clean fixed CrCl/eGFR adjustment.
- Morphine and hydromorphone: labels emphasize accumulation/toxicity and cautious dosing; no clean adult CrCl/eGFR table was added.
- Ranitidine: not added because ranitidine products have been removed from the U.S. market; any legacy support should be handled separately.
- Celecoxib: severe renal insufficiency/advanced renal disease warnings are explicit, but the label text found did not provide a numeric CrCl/eGFR threshold for a clean rule.
- Tizanidine and buspirone: renal impairment warnings are explicit, but the dose changes are not a clean fixed adult CrCl/eGFR regimen.
- Pramipexole for restless legs syndrome: Parkinson disease renal table was added; RLS dosing should be checked separately because the regimen differs.
- Zoledronic acid oncology formulations: only the Reclast 5 mg osteoporosis/Paget product was added; oncology dosing requires separate product-specific curation.

## Caveats

- Some records use eGFR rather than Cockcroft-Gault CrCl because the FDA label uses eGFR. The `condition` text identifies the metric.
- Several records contain indication-specific variants inside the same CrCl/eGFR band. These should remain draft until the UI can display indication branches clearly.
- Dialysis-specific records remain draft because hemodialysis status is represented only as variant text inside CrCl-shaped rules.
- `Ropinirole` includes Parkinson disease and RLS hemodialysis variants in a CrCl-shaped rule for draft visibility; severe renal impairment without dialysis remains unstudied per label.
- `Acamprosate` uses first-match row order to make CrCl exactly 30 mL/min select the contraindicated row; the reduced-dose row is retained only for CrCl >30 to 50 mL/min.
