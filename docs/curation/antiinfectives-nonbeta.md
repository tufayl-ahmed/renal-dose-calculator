# Anti-infectives Non-Beta-Lactam Renal Rules

Worker: Codex curation draft  
Date: 2026-05-06  
Scope: adult renal dosing rules sourced from DailyMed FDA label text only.

## JS Records Completed

All JS records are marked `confidence: "draft-source-extracted"` and require clinician review before promotion.

| Drug | Route(s) | Source basis |
| --- | --- | --- |
| Ciprofloxacin | ORAL | Adult CrCl renal dose table. |
| Levofloxacin | ORAL | Adult CrCl renal dose table by normal-dose regimen. |
| Moxifloxacin | ORAL | Explicit no renal dose adjustment statement, including HD/CAPD. |
| Azithromycin | ORAL | Explicit no renal dosage adjustment statement with severe-impairment caution. |
| Clarithromycin | ORAL | Adult renal dose-reduction table, including atazanavir/ritonavir variants. |
| Clindamycin | ORAL | Label states dosage schedules do not need renal-disease modification. |
| Linezolid | ORAL, IV | Label states no dose adjustment for renal impairment; metabolite accumulation caveat retained. |
| Daptomycin | IV | Adult CrCl table with q24h vs q48h regimens. |
| Nitrofurantoin | ORAL | Contraindication threshold for CrCl under 60 mL/min. |
| Sulfamethoxazole and trimethoprim | ORAL | Adult CrCl table using usual, half-usual, and not-recommended bands. |
| Fluconazole | ORAL | Multiple-dose renal table after loading dose; single-dose vaginal candidiasis caveat retained. |
| Voriconazole | ORAL | Oral no-adjustment statement; IV vehicle warning kept out of dose rules. |
| Posaconazole | ORAL | Oral delayed-release no-adjustment statement. |
| Isavuconazonium sulfate | ORAL, IV | No renal adjustment statement, including ESRD. |
| Fosfomycin disodium | IV | CONTEPO adult renal dose table for CrCl 50 mL/min or less. |
| Terbinafine | ORAL | Label says use is not recommended at CrCl 50 mL/min or less. |
| Colistimethate sodium | IV, IM | Adult renal impairment table in colistin base activity. |
| Acyclovir | ORAL | Adult oral renal dose table by normal regimen. |
| Valacyclovir | ORAL | Adult renal table by indication. |
| Famciclovir | ORAL | Adult renal table by indication. |
| Oseltamivir | ORAL | Adult treatment/prophylaxis renal table including ESRD dialysis rows. |
| Valganciclovir | ORAL | Adult tablet renal table for induction and maintenance/prevention. |
| Ganciclovir | IV | Adult IV induction and maintenance renal table. |
| Atovaquone and proguanil hydrochloride | ORAL | Adult prophylaxis/treatment renal statement by CrCl; prophylaxis contraindicated under 30 mL/min. |
| Fidaxomicin | ORAL | Explicit no-adjustment statement based on CrCl renal impairment categories. |
| Rifampin | ORAL | Explicit no-adjustment statement in renal failure for doses not exceeding 600 mg daily. |
| Rifabutin | ORAL | Explicit no-adjustment statement for mild/moderate impairment and toxicity-based reduction language for severe impairment. |
| Doxycycline hyclate | ORAL | No numeric renal adjustment table; label pharmacokinetic text supports no specified renal adjustment and unchanged half-life in severe renal impairment/hemodialysis context. |
| Vancomycin hydrochloride | IV | Source-summary/manual-review record because label dosing in renal impairment requires individualized dosing and serum concentration monitoring rather than a clean fixed CrCl-only rule. |
| Tinidazole | ORAL | Explicit no-adjustment statement for severe renal impairment; HD supplemental-dose note retained. |

## Needs Manual Review / Not Added to JS

These labels mention renal impairment but were not added as fixed JS rules because the label text is vague, TDM-driven, formulation-specific without a clear CrCl dose rule, or not easily represented in the current CrCl-only schema.

| Drug | Reason |
| --- | --- |
| Minocycline | Label advises reducing total dosage or extending intervals in renal impairment, but gives no fixed CrCl bands. Capsule label says data are insufficient and caps total daily dose at 200 mg. |
| Gentamicin | Aminoglycoside labels generally require serum concentration monitoring and individualized renal dosing; no clean fixed adult CrCl-band rule curated in this pass. |
| Amikacin | Same aminoglycoside issue: dosing is monitoring/PK driven rather than a simple fixed CrCl-band table. |
| Tobramycin | Same aminoglycoside issue: serum level monitoring and individualized dosing required. |
| Metronidazole | Label discusses HD supplementation and CAPD, and recommends ESRD adverse-event monitoring, but no broad fixed CrCl adjustment table. |
| Fosfomycin tromethamine oral | Oral label describes prolonged half-life and reduced urinary recovery in renal impairment but gives no explicit adult renal dose adjustment. |
| Polymyxin B | Label says to reduce dose in renal impairment but does not give fixed CrCl bands. |
| Itraconazole | Label says limited renal data/caution and possible adjustment; no fixed CrCl dosing rule. |
| Amphotericin B products | Labels emphasize renal monitoring, nephrotoxicity, and non-dialyzability, but do not give fixed CrCl dose adjustments. |
| Flucytosine | Label requires serum concentration and renal monitoring; no fixed CrCl-band dose table in reviewed DailyMed labels. |
| Ethambutol | Label has renal excretion and abnormal renal function language but no fixed CrCl dosing table in the reviewed DailyMed label. |
| Pyrazinamide | Label notes prolonged half-life in renal impairment but does not give a fixed CrCl adjustment. |
| Rifaximin | Label says renal pharmacokinetics have not been studied; no renal dose rule. |

## Source URLs Used

- Ciprofloxacin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=888dc7f9-ad9c-4c00-8d50-8ddfd9bd27c0
- Levofloxacin: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=af4b7333-4f77-4ec9-e053-2a95a90a16d2
- Moxifloxacin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=45ce14e5-98b8-296b-e063-6294a90a769b
- Azithromycin: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=7e7c2f49-449c-4ba2-98ae-0ff0c040614c
- Clarithromycin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1d328f5d-73c1-4df7-a3df-71d0e0221181
- Clindamycin: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=47f76d99-2024-4531-a527-66c80deeeb37
- Doxycycline hyclate: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=cec4368f-2852-443d-9d6f-7ba95807021b
- Minocycline reviewed but not added: https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f33fcfd2-b9ef-8e67-e053-2a95a90a0306
- Linezolid: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=374af2a7-d994-40bd-a86a-cd9038d0b72c&version=15
- Daptomycin: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=d87bd6b5-bf92-49c1-879b-dc2add3deae6
- Vancomycin hydrochloride: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8eccafe8-40c9-495a-872d-7f45a98ee759
- Metronidazole reviewed but not added: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=40509b3c-b725-400c-abe5-d6d5714d405d
- Nitrofurantoin: https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0f4d7699-d5d8-4c36-aaa6-63c3c8c68b4f
- Sulfamethoxazole and trimethoprim: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=0b261114-77e7-ff08-e063-6394a90a4e03
- Fosfomycin tromethamine reviewed but not added: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d101b5d8-bffc-4ee6-b93b-4589fcb8750d
- Fosfomycin disodium / CONTEPO: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?audience=consumer&setid=855574f2-39f8-43bc-a3d2-79dbb578cb94
- Fluconazole: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=4d7cf836-d115-456c-a636-6f05eae043cd
- Voriconazole: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4cbac6ad-0faa-4181-a830-27a9f1536b7a
- Posaconazole: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=548124ce-8050-46a9-967b-ff23dfb18633
- Isavuconazonium sulfate / CRESEMBA: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8f7f73b8-586a-4df0-935f-fecd4696c16c
- Terbinafine: https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?audience=consumer&setid=60452f7e-f971-428b-aa6a-9e2c15480bf3
- Itraconazole reviewed but not added: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e564067e-e469-4c51-9076-75f89f5c5cdf
- Amphotericin B deoxycholate reviewed but not added: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a0a54943-9ce4-4f3e-b681-a1a9144c16ce
- Amphotericin B liposome reviewed but not added: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a96a734f-d1c4-4d42-93c2-7c336da7f7b9
- Flucytosine reviewed but not added: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2aaf23f5-9b8f-4c5a-8c90-5c83765ad889
- Colistimethate sodium: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8ec7dc90-825c-422e-9f4b-c8ace9d93af5
- Polymyxin B reviewed but not added: https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=7dc505aa-64b0-4b7f-8ee3-2945bde40a34&type=display
- Acyclovir: https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=69e5455e-d0be-4c2b-b9ab-458b5480ed57
- Valacyclovir: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=4ab809f3-8898-463c-b55a-f452c87d0779
- Famciclovir: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=2c44b8d2-3b70-4e8b-af03-2e917178f761
- Oseltamivir: https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1b17fffc-5774-4b9b-8440-3a5295a34f89
- Valganciclovir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6a6533fd-0579-4059-ba87-aa399829a8b0
- Ganciclovir: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=26361de8-39b5-4266-90f6-2b307940135d
- Atovaquone and proguanil hydrochloride: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=57d74d71-8cf8-4b10-9420-22954fae623c
- Fidaxomicin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=dd966338-c820-4270-b704-09ef75fa3ceb
- Rifampin: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4905542c-83a5-4507-a7cf-94f827119c60
- Rifabutin: https://www.dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=25a60937-cbbe-4a50-994f-2ce15203f589&type=display
- Tinidazole: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b39bc167-f1c4-4169-8b46-e6c2eafe6bbf
- Ethambutol reviewed but not added: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=d32e9865-8edd-4644-9939-62ed119db3ef
- Pyrazinamide reviewed but not added: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a8b7ba02-8509-475b-8a3b-39d205af3f1e
- Rifaximin reviewed but not added: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7afafa63-3236-4212-9589-045db6b01c0b

## Curation Caveats

- The current JS schema has no dialysis-status input and no route-specific rule selection inside a single record. Dialysis-specific variants are therefore retained as conditions where unavoidable, and manual-review variants are used when the DailyMed row cannot be safely collapsed into a CrCl-only recommendation.
- Some label tables define bands using GFR rather than Cockcroft-Gault CrCl. Those were only used when the label made a direct no-adjustment statement.
- This is source extraction, not prescribing guidance. All records need clinician review before any `verified` status.

## Remediation on 2026-05-06

Updated all non-beta antiinfective records flagged in `verification-antiinfectives.md` without removing any drugs:

- Added or surfaced DailyMed dialysis-specific rows/timing for ciprofloxacin, levofloxacin, fosfomycin disodium, valacyclovir, famciclovir, and oseltamivir.
- Made clarithromycin formulation-specific by changing the record to clarithromycin extended-release and narrowing search/aliases to ER terms from the cited DailyMed label.
- Added CAPD and ESRD-not-on-dialysis oseltamivir variants, and tightened the >30-60 and >10-30 renal boundaries to avoid exact-boundary misclassification.
- Added conservative manual-review variants where DailyMed is dialysis-specific or lacks a clean non-dialysis row: levofloxacin CrCl `<10` not on HD/CAPD and fosfomycin disodium CLcr `<=10`.
- Added doxycycline hyclate after app smoke-review so the common shorthand `doxy` returns a clean curated draft source-summary instead of the raw DailyMed fallback.
- Added IV vancomycin hydrochloride after app smoke-review so `vanco`/`vancomycin` returns a clean TDM-based source-summary instead of an unreliable parsed renal table.
- Remaining schema limitation: dialysis modality, post-HD timing, and formulation selection are encoded as free-text `condition` fields rather than independent matcher fields.
