# Antivirals and Immunology Renal-Dose Curation

Worker: Codex curation draft  
Date: 2026-05-06  
Scope: Adult renal-dose draft records for common antivirals and transplant/immunology-adjacent drugs, using DailyMed FDA label text where explicit renal dosing tables or explicit no-adjustment statements were found.

## JS Records Completed

All records are marked `confidence: "draft-source-extracted"` and require clinical review before promotion to production-grade status.

| Drug | Route | Source basis |
| --- | --- | --- |
| Acyclovir oral | ORAL | DailyMed table for oral capsule/tablet renal modification by usual regimen. |
| Acyclovir sodium | IV | DailyMed table adjusting IV percent dose and interval by CrCl. |
| Valacyclovir | ORAL | DailyMed adult renal table with indication-specific rows, including genital-herpes suppressive therapy and reduction-of-transmission rows. |
| Famciclovir | ORAL | DailyMed adult renal table with indication-specific rows, including suppression, HIV-associated recurrent herpes, and hemodialysis rows. |
| Ganciclovir | IV | DailyMed adult renal table for CMV induction and maintenance/prevention. |
| Valganciclovir | ORAL | DailyMed adult tablet renal table for induction and maintenance/prevention. |
| Oseltamivir | ORAL | DailyMed adult renal table for influenza treatment and prophylaxis, including hemodialysis, CAPD, and ESRD not-on-dialysis branches. |
| Peramivir | IV | DailyMed adult single-dose renal adjustment table, with chronic hemodialysis after-dialysis timing captured as a conditioned manual branch. |
| Tenofovir disoproxil fumarate | ORAL | DailyMed VIREAD dosing interval table by CrCl and hemodialysis. |
| Tenofovir alafenamide | ORAL | DailyMed VEMLIDY renal statement for eCrCl at least 15 mL/min and chronic hemodialysis. |
| Emtricitabine | ORAL | DailyMed EMTRIVA adult capsule and oral-solution interval table by CrCl. |
| Lamivudine | ORAL | DailyMed EPIVIR adult/adolescent renal adjustment table. |
| Entecavir | ORAL | DailyMed BARACLUDE adult renal table for usual and 1 mg indication groups. |
| Adefovir dipivoxil | ORAL | DailyMed HEPSERA adult dosing interval table by CrCl and hemodialysis. |
| Nirmatrelvir and ritonavir | ORAL | DailyMed PAXLOVID renal table by eGFR. |
| Remdesivir | IV | DailyMed VEKLURY statement that no adjustment is recommended for any renal impairment, including dialysis. |
| Molnupiravir | ORAL | DailyMed LAGEVRIO statement that no adjustment is recommended for renal impairment. |
| Sofosbuvir and velpatasvir | ORAL | DailyMed EPCLUSA renal statement for any degree of renal impairment, including dialysis. |
| Ledipasvir and sofosbuvir | ORAL | DailyMed HARVONI renal statement for any degree of renal impairment, including ESRD on dialysis. |
| Sofosbuvir, velpatasvir, and voxilaprevir | ORAL | DailyMed VOSEVI renal statement for any degree of renal impairment, including dialysis. |
| Glecaprevir and pibrentasvir | ORAL | DailyMed MAVYRET renal statement for mild, moderate, or severe impairment, including dialysis. |
| Letermovir | ORAL/IV | DailyMed PREVYMIS statement for CLcr greater than 10 mL/min, with insufficient data at CLcr 10 or below/dialysis. |
| Sirolimus | ORAL | DailyMed statement that renal impairment does not require dosage adjustment. |
| Everolimus | ORAL | DailyMed ZORTRESS statement that renal impairment does not require dosage adjustment. |

## Needs Manual Review

These were intentionally not added to JS because the label guidance is protocol-dependent, toxicity-monitoring dependent, uses nonstandard renal metrics, or lacks a clear fixed adult CrCl/eGFR band suitable for the app.

| Drug | Reason |
| --- | --- |
| Baloxavir marboxil | DailyMed pharmacokinetics mention no clinically significant difference for CrCl 50 mL/min and above, but severe renal impairment has not been evaluated; no explicit renal dose adjustment statement was found. |
| Mycophenolate mofetil | DailyMed gives a kidney-transplant cap for severe chronic graft impairment but heart/liver data are limited and dosing is transplant-protocol dependent. |
| Tacrolimus | DailyMed advises lower-end dosing and further reductions for some transplant patients with renal impairment because of nephrotoxicity, but does not provide fixed CrCl bands. |
| Cyclosporine | Labeling is dominated by therapeutic monitoring, nephrotoxicity warnings, and indication-specific contraindications rather than fixed CrCl bands. |
| Methotrexate | Renal guidance is high-risk and indication/regimen specific; no single adult fixed renal band table was curated in this pass. |
| Cidofovir | DailyMed has renal contraindications and on-therapy dose changes based on serum creatinine/proteinuria changes, not stable CrCl dose bands for app display. |
| Foscarnet | DailyMed provides detailed nomograms in mL/min/kg and by CMV/HSV induction and maintenance; this needs a dedicated parser/review rather than simple CrCl bands. |
| Zanamivir | DailyMed states no renal dose adjustment is necessary for oral inhalation, but the current draft JS schema only allows `ORAL` and `IV` route values; not added to avoid misclassifying inhaled therapy. |
| Letermovir at CLcr 10 mL/min or below/dialysis | Added as "no dosing recommendation" in JS because the same label has a clear no-adjustment statement above 10 mL/min; needs clinical handling in UI. |
| Lamivudine HBV products | EPIVIR HIV dosing was added; EPIVIR-HBV has different tablet strength/dose context and should be curated separately if needed. |
| Ribavirin-containing HCV regimens | HCV combination records note that ribavirin renal dose modification must be reviewed separately. |
| Famciclovir and peramivir dialysis branches | Dialysis status is represented only in `condition` text because the current rule schema does not have a dialysis/CAPD modality field. |

## Source URLs Used

- Acyclovir oral: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=8d9fea43-6c04-40d7-8aac-398c2de2a558&version=5
- Acyclovir IV: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=23a7cf9e-f21b-06c2-e063-6394a90aa623
- Valacyclovir: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=df34e11d-5f2c-4755-b84b-b95d1d7b73f0
- Famciclovir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b046ff0c-4762-479f-9b8e-44714e4174ec
- Ganciclovir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=69017374-ac20-4b8c-86c7-d35907046dce
- Valganciclovir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6a6533fd-0579-4059-ba87-aa399829a8b0
- Oseltamivir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ee3c9555-60f2-4f82-a760-11983c86e97b
- Peramivir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fe04f6cd-e71c-4bd4-abac-97720bba2a0d
- Zanamivir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=12ff22f6-20b5-4fa8-9028-58f87e169ff5
- Tenofovir disoproxil fumarate: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e122435e-cd0b-4c90-940a-b7a0d090d866
- Tenofovir alafenamide: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=72e6b33c-0351-4070-9172-eeaa186c01d2
- Emtricitabine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=d6599395-3944-44f9-97f2-e0424c6b6a1f
- Lamivudine: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=89226149-47fa-4f7d-bb1f-1aa7034486b8
- Entecavir: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=046e61c9-9298-4b2e-b76e-b26b81fecd20&version=42
- Adefovir dipivoxil: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=80595d45-2224-47d1-bd5c-4b11a824e5bd
- Nirmatrelvir and ritonavir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8a99d6d6-fd9e-45bb-b1bf-48c7f761232a
- Remdesivir: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=c0978fa8-53ff-4ca2-82a7-567fd3e958ca&version=23
- Molnupiravir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1b0da643-ab23-4a0b-a9ec-a434522446d0
- Sofosbuvir and velpatasvir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?audience=consumer&setid=7f30631a-ee3b-4cfe-866b-964df3f0a44f
- Ledipasvir and sofosbuvir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f4ec77e4-bae8-4db0-b3d5-bde09c5fa075
- Sofosbuvir, velpatasvir, and voxilaprevir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=17ffc094-8ca7-45d2-80d8-fd043bc9a221
- Glecaprevir and pibrentasvir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7bf99777-0401-9095-8645-16c6e907fcc0
- Letermovir: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=1b49df80-be4f-47e0-a0b7-123f3e69395b&version=28
- Sirolimus: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=5908cd1a-fc5a-462f-99ed-1d8983e253c9
- Everolimus: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=e082a024-7850-400b-a5c2-2a140612562a&version=29
- Baloxavir manual-review source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=325b077a-8fe2-435c-be70-df9579862e13
- Mycophenolate manual-review source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=741e079a-646b-47ec-84ac-8e12574c2aaf
- Tacrolimus manual-review source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4caa20af-45a8-4365-9f06-1568afae61b1
- Cidofovir manual-review source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=56541229-8c1a-4550-8951-2415ed08e7e9
- Foscarnet manual-review source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a09299d5-9c55-4cef-aed0-3a6a45532289
