# Additional Common Adult Medication Renal Rules

Draft curated by Worker 7 on 2026-05-06. Sources were limited to DailyMed FDA label pages surfaced during this pass. Records in `src/data/renalRules/additional-common-meds.js` are all marked `draft-source-extracted`; none are marked verified.

## Completed JS Records

30 records were added:

1. Cimetidine - source-summary/manual-review record for nonnumeric severe renal impairment reduced regimen of 300 mg every 12 hours.
2. Nizatidine - CrCl-based active-treatment and maintenance dose intervals; `CrCl >50` is encoded as a strict greater-than branch so exactly 50 mL/min remains in the 20-50 mL/min reduced-dose band.
3. Esomeprazole magnesium - explicit no renal dose adjustment statement.
4. Lansoprazole - explicit no renal dose adjustment statement.
5. Pantoprazole sodium - explicit no renal dose adjustment statement, including hemodialysis.
6. Dexlansoprazole - explicit no renal dose adjustment statement.
7. Levocetirizine dihydrochloride - CrCl-based adult dose reductions and ESRD/hemodialysis avoidance.
8. Fexofenadine hydrochloride - source-summary/manual-review record for nonnumeric decreased renal function adult starting dose.
9. Desloratadine - source-summary/manual-review record for adult renal impairment every-other-day starting dose because the label does not map it to a numeric cutoff.
10. Montelukast sodium - explicit no renal dose adjustment statement.
11. Roflumilast - explicit no renal dose adjustment statement.
12. Tiotropium bromide - explicit no renal dose adjustment statement with monitoring caveat.
13. Trospium chloride - immediate-release CrCl <30 mL/min bedtime dosing.
14. Vibegron - source-summary/manual-review record because the label uses eGFR, not Cockcroft-Gault CrCl.
15. Ibandronate sodium - not recommended below CrCl 30 mL/min.
16. Cinacalcet - explicit no renal dose adjustment statement.
17. Ondansetron - renal impairment dosage same as general population.
18. Granisetron - SUSTOL extended-release injection interval extension and severe renal avoidance.
19. Aprepitant - explicit no renal dose adjustment statement, including ESRD on hemodialysis.
20. Rimegepant - no adjustment through severe renal impairment and ESRD avoidance.
21. Ubrogepant - severe renal impairment dose reduction and ESRD avoidance.
22. Atogepant - renal dosing differs for episodic versus chronic migraine.
23. Ramelteon - explicit no renal dose adjustment statement.
24. Eszopiclone - explicit no renal dose adjustment statement.
25. Zaleplon - source-summary/manual-review record because mild/moderate renal impairment is not numerically mapped and severe renal impairment was not adequately studied.
26. Suvorexant - explicit no renal dose adjustment statement.
27. Lemborexant - explicit no renal dose adjustment statement with somnolence caveat.
28. Tadalafil - ED/BPH product renal dose and not-recommended rules; ADCIRCA/PAH alias removed because PAH renal dosing differs.
29. Darifenacin - explicit no renal dose adjustment statement.
30. Apremilast - severe renal impairment maintenance dose reduction for immediate-release OTEZLA.

## Source URLs Used

- Cimetidine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=28fd7158-a617-436a-8f5c-71ffbaafe527
- Nizatidine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=e9957997-8b85-48a0-9bb3-b878cb223236
- Esomeprazole magnesium: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6f650345-0bca-4fe9-96eb-4d7ac80928ec
- Lansoprazole: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=7d811f01-f0c2-4753-bb36-80b48dabb58c
- Pantoprazole sodium: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7c958802-daad-4c7e-88eb-73be7d2261d8
- Dexlansoprazole: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=3ed69e5a-aa78-4118-aa32-59a10f80c901
- Levocetirizine dihydrochloride: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=348eadb6-5be2-f8c7-e063-6394a90a1314
- Fexofenadine hydrochloride: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a3d17e8d-a8ce-4e1a-9ec2-13736af1d7b5
- Desloratadine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=4d094001-b85a-47b3-bc67-a46660384ece
- Montelukast sodium: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=488e08d7-59d8-499e-bac6-a0783651d67b
- Roflumilast: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4251c764-7224-4f94-9de7-b6c76cb1f5cd
- Tiotropium bromide: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=c6343458-617b-41ed-8e96-763e91dc8e90
- Trospium chloride: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d5c837a4-d1c6-4615-b7ad-27f3162a03aa
- Vibegron: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=25f21d25-14f8-4fda-91f6-7aa8b68aa1c8
- Ibandronate sodium: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=a5741ef6-0599-4657-8cda-2902ded4f680&version=12
- Cinacalcet: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=28262843-b0a8-4ca7-8b92-41b7f0e896b4
- Ondansetron: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=69b9a032-f2d1-4c5a-a35e-9cdc3c620716
- Granisetron: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f7c7ffdd-8270-4030-bc1e-a1cb28a6de56
- Aprepitant: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ec44482e-6194-4829-a3f7-ebe8d48a41a5
- Rimegepant: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9ef08e09-1098-35cc-e053-2a95a90a3e1d
- Ubrogepant: https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=human&query=Ubrogepant
- Atogepant: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8c8ab8f4-32bd-497a-befa-70c8a51d8d52
- Ramelteon: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9de82310-70e8-47b9-b1fc-6c6848b99455
- Eszopiclone: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=af86b753-d2ee-9b5f-e053-2a95a90ad23d
- Zaleplon: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=bc7639e9-c2cb-47bb-a295-efb0f656ccd1
- Suvorexant: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e5b72731-1acb-45b7-9c13-290ad12d3951
- Lemborexant: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7074cb65-77b3-45d2-8e8d-da8dc0f70bfd
- Tadalafil: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=f9e9a953-2802-4bb1-91a3-a29be347801e
- Darifenacin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7e9f2cec-8c9f-7668-dfb4-6ab57c9d3e8a
- Apremilast: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f6b1f516-4972-4d82-bced-113e47b41cc5

## Remediation Notes from R5

Remediated on 2026-05-06 against `docs/curation/verification-additional-common-meds-final.md` using DailyMed FDA label pages only.

- Cimetidine, fexofenadine hydrochloride, desloratadine, vibegron, and zaleplon remain in the JS data but were changed from unsafe CrCl-selectable dosing to source-summary/manual-review wording.
- Nizatidine boundary handling was corrected by changing the no-adjustment branch from `gte 50` to `gt 50`; the DailyMed renal table places 20-50 mL/min in the reduced-dose band.
- Granisetron/SUSTOL and atogepant/QULIPTA source URLs were normalized to resolving DailyMed `drugInfo.cfm` setid URLs without broken `version` parameters.
- Tadalafil remains an ED/BPH record only. The `adcirca` alias was removed because ADCIRCA/PAH tadalafil uses a different renal dosing scheme.
- All affected JS records remain `confidence: "draft-source-extracted"` and require clinical review before promotion.

## Needs Manual Review

- Baclofen: labels reviewed emphasize cautious use in renal impairment and toxicity risk, but the sources surfaced did not provide a clean adult CrCl/eGFR dose adjustment suitable for this JS shape.
- Cetirizine: OTC labels commonly say kidney disease patients should ask a doctor; I did not add a JS record because the official label text surfaced did not provide a precise adult renal regimen.
- Loratadine: OTC labels similarly direct kidney disease patients to ask a doctor for a different dose without specifying a dose.
- Naltrexone and disulfiram: renal language is monitoring/caution-oriented in the labels surfaced, not a fixed adult renal dosing rule.
- Sevelamer and calcitriol: use is tightly tied to CKD/mineral-lab management, but I did not find a clean renal adjustment or no-adjustment statement useful for this database pass.
- Immediate-release granisetron: SUSTOL has explicit renal adjustment, but other granisetron products should be checked separately before generalizing.
- Tadalafil for pulmonary arterial hypertension: a PAH-specific tadalafil label has a different renal dosing scheme; this batch encoded only the ED/BPH product and removed the `adcirca` alias from that record.
- Trospium extended-release capsules: label says not recommended when CrCl <30 mL/min; this batch encoded the immediate-release tablet dose adjustment and noted the ER limitation.
- Mirabegron, solifenacin, tolterodine ER, and fesoterodine: excluded from this file after duplicate scan because Worker 6 already added them in `src/data/renalRules/oncology-rheum-specialty.js`.

## Caveats

- The JS rule schema is CrCl-oriented and only supports numeric rule types plus `all`; it has no explicit metric field for eGFR and no nonnumeric renal-impairment category selector.
- Labels that use nonnumeric categories such as "severe renal impairment," "decreased renal function," or "mild to moderate renal impairment" are now retained as source-summary/manual-review rows rather than reduced doses applied to all CrCl values.
- Indication-specific branches remain draft-only, especially tadalafil ED/BPH, atogepant episodic versus chronic migraine, nizatidine active treatment versus maintenance, and granisetron/SUSTOL.
