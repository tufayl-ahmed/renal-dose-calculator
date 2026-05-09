# Verification Report - Additional Common Adult Medication Renal Rules

Verification Agent E report for Expansion Worker 7, completed 2026-05-06.

Scope verified:

- `src/data/renalRules/additional-common-meds.js`
- `docs/curation/additional-common-meds.md`

Method: each JS record was checked against the cited DailyMed FDA label when available. I looked for explicit adult renal dose adjustment, renal not-recommended/avoidance thresholds, or explicit no-adjustment statements. No JS data files were edited.

## Summary

| Result | Count | Notes |
| --- | ---: | --- |
| Pass | 23 | Supported by DailyMed label text with acceptable formulation/route traceability. |
| Flag | 7 | Needs curation review before verification because of boundary, dialysis, source URL, renal-warning, or indication/product alias issues. |
| Unable | 0 | All 30 records were independently checked against DailyMed label sources. |

## Findings

| # | Drug | Status | FDA label source checked | Verification finding |
| ---: | --- | --- | --- | --- |
| 1 | Cimetidine | Flag | [DailyMed setid 28fd7158-a617-436a-8f5c-71ffbaafe527](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=28fd7158-a617-436a-8f5c-71ffbaafe527) | The 300 mg every 12 hours severe-renal-impairment regimen is supported, but the label also states that hemodialysis reduces circulating cimetidine and the schedule should coincide with the end of hemodialysis. The JS rule/source note omits this dialysis timing detail while applying broadly to severe renal impairment. |
| 2 | Nizatidine | Flag | [DailyMed setid e9957997-8b85-48a0-9bb3-b878cb223236](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=e9957997-8b85-48a0-9bb3-b878cb223236) | The active-treatment and maintenance renal intervals match the label, but the JS no-adjustment branch is `type: "gte", min: 50` while its condition says CrCl `>50`. This overlaps the adjusted CrCl 20-50 band at exactly 50 mL/min. |
| 3 | Esomeprazole magnesium | Pass | [DailyMed setid 6f650345-0bca-4fe9-96eb-4d7ac80928ec](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6f650345-0bca-4fe9-96eb-4d7ac80928ec) | Label explicitly states no dosage adjustment is necessary in renal insufficiency. Oral delayed-release PPI route/record scope is appropriate. |
| 4 | Lansoprazole | Pass | [DailyMed setid 7d811f01-f0c2-4753-bb36-80b48dabb58c](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=7d811f01-f0c2-4753-bb36-80b48dabb58c) | Label explicitly states patients with renal impairment do not require dosage adjustment. |
| 5 | Pantoprazole sodium | Pass | [DailyMed setid 7c958802-daad-4c7e-88eb-73be7d2261d8](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7c958802-daad-4c7e-88eb-73be7d2261d8) | Label supports no dosage adjustment in renal impairment and hemodialysis; oral route scope is appropriate for this record. |
| 6 | Dexlansoprazole | Pass | [DailyMed setid 3ed69e5a-aa78-4118-aa32-59a10f80c901](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=3ed69e5a-aa78-4118-aa32-59a10f80c901) | Label states renal impairment is not expected to alter pharmacokinetics and no adjustment is needed. |
| 7 | Levocetirizine dihydrochloride | Pass | [DailyMed setid 348eadb6-5be2-f8c7-e063-6394a90a1314](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=348eadb6-5be2-f8c7-e063-6394a90a1314) | Adult/adolescent renal table supports the encoded dose reductions and the ESRD/hemodialysis do-not-use statement. |
| 8 | Fexofenadine hydrochloride | Pass | [DailyMed setid a3d17e8d-a8ce-4e1a-9ec2-13736af1d7b5](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a3d17e8d-a8ce-4e1a-9ec2-13736af1d7b5) | Label supports 60 mg once daily as the adult starting dose for decreased renal function. No numeric cutoff is provided, and the JS condition correctly avoids inventing one. |
| 9 | Desloratadine | Pass | [DailyMed setid 4d094001-b85a-47b3-bc67-a46660384ece](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=4d094001-b85a-47b3-bc67-a46660384ece) | Label supports 5 mg every other day as the adult starting dose in renal impairment. |
| 10 | Montelukast sodium | Pass | [DailyMed setid 488e08d7-59d8-499e-bac6-a0783651d67b](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=488e08d7-59d8-499e-bac6-a0783651d67b) | Label explicitly states no dosage adjustment is recommended in renal insufficiency. |
| 11 | Mirabegron | Pass | [DailyMed setid 2e40eb74-3b2a-47f7-bf31-fe27484f9bd2](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2e40eb74-3b2a-47f7-bf31-fe27484f9bd2) | Adult eGFR bands and not-recommended threshold for eGFR <15 or dialysis match the label. |
| 12 | Solifenacin succinate | Pass | [DailyMed setid 7eb1a5d6-4972-44f4-8ab9-80b932bf81e0](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=7eb1a5d6-4972-44f4-8ab9-80b932bf81e0) | Label supports the severe renal impairment cap of 5 mg once daily. The no-adjustment/may-increase branch for CLcr >=30 is consistent with usual labeled dosing outside the severe band. |
| 13 | Trospium chloride | Flag | [DailyMed setid d5c837a4-d1c6-4615-b7ad-27f3162a03aa](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d5c837a4-d1c6-4615-b7ad-27f3162a03aa) | The CrCl <30 mL/min immediate-release dose of 20 mg at bedtime is supported. The `CrCl >=30` branch presents a clean usual dose, but the label notes PK was not studied in CrCl 30-80 mL/min and systemic exposure is likely increased. That warning is not equivalent to an explicit no-adjustment statement. |
| 14 | Fesoterodine fumarate | Pass | [DailyMed setid 299db62d-9658-4796-b449-657fa859c5cd](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=299db62d-9658-4796-b449-657fa859c5cd) | Adult Cockcroft-Gault renal table supports the encoded CLcr bands for renal impairment alone. Separate CYP3A4 inhibitor limits are outside this renal-only record. |
| 15 | Vibegron | Pass | [DailyMed setid 25f21d25-14f8-4fda-91f6-7aa8b68aa1c8](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=25f21d25-14f8-4fda-91f6-7aa8b68aa1c8) | Label supports no adjustment for eGFR 15 to <90 and not-recommended use for eGFR <15 or dialysis. Usual 75 mg dosing is appropriate for normal renal function. |
| 16 | Ibandronate sodium | Pass | [DailyMed setid a5741ef6-0599-4657-8cda-2902ded4f680](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=a5741ef6-0599-4657-8cda-2902ded4f680&version=12) | Oral osteoporosis label supports no adjustment for mild/moderate renal impairment and not recommended when CrCl is below 30 mL/min. |
| 17 | Cinacalcet | Pass | [DailyMed setid 28262843-b0a8-4ca7-8b92-41b7f0e896b4](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=28262843-b0a8-4ca7-8b92-41b7f0e896b4) | Label explicitly states no dosage adjustment is necessary for renal impairment. CKD-on-dialysis is an indication context, not an adjustment error. |
| 18 | Ondansetron | Pass | [DailyMed setid 69b9a032-f2d1-4c5a-a35e-9cdc3c620716](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=69b9a032-f2d1-4c5a-a35e-9cdc3c620716) | Label states the dosage recommendation for impaired renal function is the same as for the general population, with limited experience beyond first-day administration noted in the record. |
| 19 | Granisetron | Flag | [DailyMed setid f7c7ffdd-8270-4030-bc1e-a1cb28a6de56](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=f7c7ffdd-8270-4030-bc1e-a1cb28a6de56&version=10) | The SUSTOL SC renal dosing content is supported: every 7 days if CrCl >=60, every 14 days if CrCl 30-59, and avoid if CrCl <30. However, the exact JS `sourceUrl` with `version=10` did not resolve during verification; the same setid without the version parameter did resolve. Treat as a source traceability cleanup, not a dose-content failure. |
| 20 | Aprepitant | Pass | [DailyMed setid ec44482e-6194-4829-a3f7-ebe8d48a41a5](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ec44482e-6194-4829-a3f7-ebe8d48a41a5) | Label supports no dosage adjustment for renal impairment, including ESRD on hemodialysis. |
| 21 | Rimegepant | Pass | [DailyMed setid 9ef08e09-1098-35cc-e053-2a95a90a3e1d](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9ef08e09-1098-35cc-e053-2a95a90a3e1d) | Label supports no adjustment in mild, moderate, or severe renal impairment and avoidance in ESRD/CLcr <15. |
| 22 | Ubrogepant | Pass | [DailyMed search/canonical label](https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=human&query=Ubrogepant) | Label supports 50 mg initial/second dose in severe renal impairment and avoidance in ESRD. The source URL is a search URL, but it resolves to DailyMed label content; a canonical setid URL would improve traceability. |
| 23 | Atogepant | Flag | [DailyMed setid 8c8ab8f4-32bd-497a-befa-70c8a51d8d52](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=8c8ab8f4-32bd-497a-befa-70c8a51d8d52&version=18) | Dose content is supported: 10 mg daily for episodic migraine with CLcr <30/ESRD, take after dialysis on dialysis days, and not recommended for chronic migraine in that band. However, the exact JS `sourceUrl` with `version=18` did not resolve during verification; the same setid without the version parameter did resolve. |
| 24 | Ramelteon | Pass | [DailyMed setid 9de82310-70e8-47b9-b1fc-6c6848b99455](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9de82310-70e8-47b9-b1fc-6c6848b99455) | Label explicitly states no adjustment is required in renal impairment. |
| 25 | Eszopiclone | Pass | [DailyMed setid af86b753-d2ee-9b5f-e053-2a95a90ad23d](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=af86b753-d2ee-9b5f-e053-2a95a90ad23d) | Label states no dose adjustment is necessary in renal impairment. |
| 26 | Zaleplon | Pass | [DailyMed setid bc7639e9-c2cb-47bb-a295-efb0f656ccd1](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=bc7639e9-c2cb-47bb-a295-efb0f656ccd1) | Label supports no adjustment in mild to moderate renal impairment and says severe renal impairment was not adequately studied. The JS leaves severe impairment unencoded, which is appropriate. |
| 27 | Tolterodine tartrate | Flag | [DailyMed setid bbbee85a-e5e2-24ec-e053-2995a90acfd8](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=bbbee85a-e5e2-24ec-e053-2995a90acfd8) | The CCr 10-30 dose reduction and CCr <10 not-recommended threshold are supported. The `CCr >=30` branch presents usual dosing as a renal rule, but the label notes Detrol LA was not studied in CCr 30-80 mL/min. This is not an explicit no-adjustment statement. |
| 28 | Tadalafil | Flag | [DailyMed setid f9e9a953-2802-4bb1-91a3-a29be347801e](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=f9e9a953-2802-4bb1-91a3-a29be347801e) | ED/BPH renal dosing branches match the cited label. The unsafe issue is traceability/product scope: aliases include `adcirca`, but the record explicitly does not encode the pulmonary arterial hypertension tadalafil regimen, which has different renal guidance. This could route PAH/Adcirca lookups to ED/BPH dosing. |
| 29 | Darifenacin | Pass | [DailyMed setid 7e9f2cec-8c9f-7668-dfb4-6ab57c9d3e8a](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7e9f2cec-8c9f-7668-dfb4-6ab57c9d3e8a) | Label explicitly states no dose adjustment is recommended for renal impairment. |
| 30 | Apremilast | Pass | [DailyMed setid f6b1f516-4972-4d82-bced-113e47b41cc5](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f6b1f516-4972-4d82-bced-113e47b41cc5) | Immediate-release OTEZLA label supports reducing adult maintenance dosing to 30 mg once daily when CLcr is below 30 mL/min and using AM-only titration. |

## Flag Details for Lead Review

- Cimetidine: add dialysis timing or restrict the rule/note so hemodialysis is not silently lost.
- Nizatidine: change the no-adjustment branch from `>=50` behavior to `>50` behavior to avoid exact-cutoff conflict.
- Trospium chloride: do not represent CrCl 30-80 mL/min as clean no-adjustment unless the UI/rule text preserves the label warning that PK was not studied and exposure is likely increased.
- Granisetron: replace the versioned DailyMed URL if it remains non-resolving in the project environment.
- Atogepant: replace the versioned DailyMed URL if it remains non-resolving in the project environment.
- Tolterodine tartrate: do not represent CCr 30-80 mL/min as clean no-adjustment unless the not-studied warning is preserved.
- Tadalafil: remove `adcirca` from the ED/BPH record or split/encode the PAH-specific tadalafil renal guidance separately.
