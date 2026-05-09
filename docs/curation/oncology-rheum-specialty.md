# Oncology, Rheumatology, Urology, Nephrology-Adjacent, and Specialty Renal Rules

Draft curated by Expansion Worker 6 on 2026-05-06. Sources were limited to DailyMed FDA label pages surfaced during this pass. Records in `src/data/renalRules/oncology-rheum-specialty.js` are all marked `confidence: "draft-source-extracted"`; none are verified.

## Completed JS Records

30 records were added:

1. Hydroxyurea - measured CrCl cutoff for 50% initial-dose reduction.
2. Capecitabine - CLcr 30-50 starting-dose reduction and CLcr <30 no established dosage as a manual-review source-summary band.
3. Pemetrexed - Cockcroft-Gault CrCl >=45 required for dosing; no recommended dose below 45.
4. Lenalidomide - Cockcroft-Gault CLcr renal table with indication-specific variants.
5. Fludarabine phosphate injection - IV starting-dose table and CrCl <30 do-not-administer threshold.
6. Fludarabine phosphate tablets - oral renal percentage reductions by CrCl band.
7. Bendamustine - CrCl <30 do-not-use threshold.
8. Oxaliplatin - severe renal impairment reduction to 65 mg/m2.
9. Etoposide - initial percentage dose reduction by measured CrCl.
10. Topotecan injection - single-agent IV CLcr 20-39 dose reduction plus CLcr <20 insufficient-data source-summary band.
11. Topotecan capsules - oral capsule CLcr 30-49 and <30 dose reductions.
12. Imatinib - renal impairment starting-dose reduction and maximum-dose caps.
13. Venetoclax - no renal adjustment for CLcr >=15, with TLS caveat retained in note.
14. Anastrozole - explicit no renal dose adjustment statement.
15. Letrozole - no adjustment when CrCl >=10.
16. Exemestane - no adjustment despite increased exposure in moderate/severe renal impairment.
17. Bicalutamide - explicit no renal dose adjustment statement.
18. Abiraterone acetate - explicit no renal dose adjustment statement.
19. Palbociclib - no adjustment for CrCl >15.
20. Olaparib - moderate renal impairment reduction and no-data threshold at CLcr <=30.
21. Rucaparib - no modification for CLcr 30-89; no study data below 30/dialysis.
22. Talazoparib - moderate/severe renal dose reductions by adult indication/regimen, with hemodialysis/<15 mL/min not-studied source-summary band.
23. Tamsulosin - no adjustment in renal impairment, with ESRD unstudied caveat.
24. Silodosin - moderate impairment dose reduction and severe impairment contraindication.
25. Mirabegron - adult MDRD eGFR table with <15/dialysis not recommended.
26. Solifenacin - severe renal impairment maximum dose.
27. Tolterodine extended-release - severe renal impairment reduction and CCr <10 not recommended.
28. Fesoterodine - adult Cockcroft-Gault CLcr table.
29. Mycophenolate mofetil - oral tablet/capsule severe chronic kidney graft impairment maximum-dose cap.
30. Darolutamide - eGFR-based severe renal impairment dose reduction when not on hemodialysis plus ESRD/hemodialysis source-summary band.

## Source URLs Used

- Hydroxyurea: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6053c775-68de-45e4-9af9-33b18fd0e140
- Capecitabine: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=29885ada-b743-419c-8f15-edd4247c76ca
- Pemetrexed: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=3ae68628-7ab0-4491-b3ae-6a8330b719c8
- Lenalidomide: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=84d9dec7-9250-4dbd-9a0d-23e75f111892
- Fludarabine phosphate injection: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=20e5acf0-90b7-45c8-be78-91eaf77c9ac0
- Fludarabine phosphate tablets: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ac76aca8-e718-4232-92ab-399166ce9e46
- Bendamustine: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=766b73e2-49bb-47f9-bbb1-44cfa1a3197e
- Oxaliplatin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=95b05292-36a1-4946-b8b3-835a3a77f4a7
- Etoposide: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4f850eb2-3542-43a0-90e8-bb37fa05cf15
- Topotecan injection: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b6019088-cd94-43b4-b5ce-ba20b6b8021e
- Topotecan capsules: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=b23b46f5-c276-47f5-8bbd-940680b3f579
- Imatinib: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1debf3a0-7587-47d7-8ea6-e739698d7297
- Venetoclax: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b118a40d-6b56-cee3-10f6-ded821a97018
- Anastrozole: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=7e0bd2cc-d3cc-403f-a6b6-4597ccb2f685
- Letrozole: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=2d1f18f0-2c77-407c-b702-2d1b07f92510&version=3
- Exemestane: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e24b08eb-4693-41c7-81cb-b536947f7070
- Bicalutamide: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=7a08d88b-051a-4c16-9560-12685c500c58&version=3
- Abiraterone acetate: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6f5b628b-69da-4a04-a4d5-623b18d1fd5d
- Palbociclib: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fecbdd7d-b729-41b5-9872-231b8fe104ce
- Olaparib: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=741ff3e3-dc1a-45a6-84e5-2481b27131aa
- Rucaparib: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0295d202-1cfe-7659-e063-6294a90a476e
- Talazoparib: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=13839d4f-6acf-4ffb-a128-79df59319273
- Tamsulosin: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=6771ad8e-ac92-4aec-b484-5d8350a353f8
- Silodosin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ea3bbafb-d32a-d0d3-e053-2a95a90ac387
- Mirabegron: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=e597023d-6dcc-4d9e-8ce0-2d28a5d862f3&version=1
- Solifenacin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=aea71cde-6d62-4f8d-b813-47064cb213d9
- Tolterodine extended-release: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9710ad7b-93c2-4ec1-95ff-597563be4314
- Fesoterodine: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=dc8f6158-3c2b-4ec0-a951-e04468b83bb1
- Mycophenolate mofetil: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8015f042-54fb-4a7a-a10b-6219e1a450c8
- Darolutamide: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=1a7cb212-56e4-4b9d-a73d-bfee7fe4735e

## Needs Manual Review

- Capecitabine: CLcr <30 mL/min remains a manual clinical review band because the FDA label states that dosage has not been established.
- Topotecan injection: CLcr <20 mL/min remains a manual clinical review band because the FDA label states that data are insufficient to provide a dosage recommendation.
- Talazoparib: CLcr <15 mL/min or hemodialysis remains a manual clinical review band because the FDA label does not provide dosing for these patients and states hemodialysis has not been studied.
- Mycophenolate mofetil: only the oral tablet/capsule label is represented; delayed kidney graft function and non-kidney-transplant renal impairment remain manual review rather than generalized numeric renal bands.
- Darolutamide: eGFR <15 mL/min/1.73 m2 or hemodialysis remains a manual clinical review band because the FDA label says the ESRD pharmacokinetic effect is unknown and the severe-renal recommendation excludes hemodialysis.
- Pomalidomide: renal text found is dialysis-specific and tied to treatment timing; hold for a more expressive dialysis model.
- Thalidomide: renal dosing language was not clear enough for a numeric CrCl/eGFR rule in this pass.
- Dasatinib and nilotinib: renal statements are mostly pharmacokinetic/no-clear-adjustment wording; needs a dedicated current-label pass before adding.
- Ruxolitinib: explicit renal dose modifications exist, but they are strongly indication-, platelet-, and dialysis-status-dependent.
- Cyclophosphamide: labels reviewed emphasize monitoring/toxicity risk more than a clean adult CrCl/eGFR adjustment.
- Cladribine: renal guidance is indication/formulation-specific and not clean enough for this draft pass.
- Methotrexate: current tablet label gives monitoring and dose-reduce/discontinue language for CLcr <90, but not a fixed adult renal regimen.
- Leflunomide: no clean renal adjustment threshold was found during this pass.
- Sulfasalazine: renal language is mainly precautions/overdose and crystalluria management, not a fixed renal dose rule.
- Hydroxychloroquine: current label says dose reduction may be necessary in renal disease and lists renal impairment as a retinopathy risk factor, but does not provide a fixed renal regimen.
- Tacrolimus: renal guidance is trough- and nephrotoxicity-driven rather than a fixed CrCl/eGFR dose table.
- Alfuzosin: label advises caution in severe renal impairment without a clear renal dose adjustment.
- Enzalutamide: renal subsection needs direct current-label extraction before any no-adjustment record is added.
- Niraparib: not added because the renal statement needs product- and indication-specific confirmation.

## Caveats

- All records are draft source extractions for review and are not prescribing recommendations.
- Some records use eGFR or GFR because the label uses eGFR/GFR rather than Cockcroft-Gault CrCl; the `condition` text identifies the metric.
- Several oncology records encode "not studied" or "no data" as draft visibility bands. These should remain draft until the UI has clearer display semantics for evidence gaps.
- Dialysis-specific instructions were included only when the source label supplied a clear CrCl band plus dialysis timing; otherwise candidates were kept in manual review.
- The current rule schema has numeric range matching but no first-class renal metric, dialysis status, transplant context, or evidence-gap type. Those limitations are represented in `condition`, `dose`, and `interval` text for the remediated flagged records.
