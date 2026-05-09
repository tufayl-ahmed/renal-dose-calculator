# Verification Report: Antivirals/Immunology and Cardio/Anticoag Renal Rules

Verification Agent: B  
Date: 2026-05-06  
Scope: Independent verification of `src/data/renalRules/antivirals-immunology.js`, `docs/curation/antivirals-immunology.md`, `src/data/renalRules/cardio-anticoag.js`, and `docs/curation/cardio-anticoag.md`.

## Summary Counts

| Metric | Count |
| --- | ---: |
| JS records reviewed | 60 |
| PASS | 46 |
| FLAG | 14 |
| Unable to verify | 0 |

Structural check: all 60 JS records include drug name, route, indication note, source URL, confidence, rule bands, and populated condition/dose/interval variants. No JS data files were edited.

Documentation check: `docs/curation/cardio-anticoag.md` says 29 completed JS records, but `src/data/renalRules/cardio-anticoag.js` currently exports 36 records.

## Findings

| file | drug | status | issue | recommended action |
| --- | --- | --- | --- | --- |
| `src/data/renalRules/antivirals-immunology.js` | Acyclovir | PASS | Oral renal table is traceable to DailyMed; 200 mg, 400 mg, and 800 mg regimen bands match the label table. | Keep; consider clinical review of inclusive boundary handling. |
| `src/data/renalRules/antivirals-immunology.js` | Acyclovir sodium | PASS | IV renal interval/percent-dose table is traceable to DailyMed, including dialysis supplemental dose language in source. | Keep; UI should preserve dialysis supplemental-dose note if applicable. |
| `src/data/renalRules/antivirals-immunology.js` | Valacyclovir | FLAG | Label table includes genital-herpes suppressive therapy and HIV-1 suppressive rows. JS includes cold sores, initial/recurrent genital herpes, and zoster only, despite source note saying suppressive therapy is included. | Add the missing suppressive/transmission rows or narrow the indication/source note so users do not miss indication-specific renal doses. |
| `src/data/renalRules/antivirals-immunology.js` | Famciclovir | FLAG | Label table includes suppression of recurrent genital herpes and HIV-infected recurrent orolabial/genital herpes rows at CrCl >=40 and HD. JS omits those rows from the higher-function bands and omits HD-specific rows. | Complete all indication rows from the label table, including HD, or split into separate indication records. |
| `src/data/renalRules/antivirals-immunology.js` | Ganciclovir | PASS | Adult induction and maintenance/prevention bands match the DailyMed renal table, including the <10 mL/min hemodialysis schedule. | Keep; make dialysis-only qualification visible for the <10 band. |
| `src/data/renalRules/antivirals-immunology.js` | Valganciclovir | PASS | Adult tablet renal table matches DailyMed, including "not recommended" for CrCl <10 on hemodialysis. | Keep. |
| `src/data/renalRules/antivirals-immunology.js` | Oseltamivir | FLAG | DailyMed table has separate ESRD hemodialysis, CAPD, and not-on-dialysis rows. JS includes hemodialysis but omits CAPD and ESRD not on dialysis. | Add CAPD treatment/prophylaxis and "not recommended" non-dialysis ESRD variants. |
| `src/data/renalRules/antivirals-immunology.js` | Peramivir | FLAG | Adult table covers CrCl >=50, 30-49, and 10-29, and source says chronic hemodialysis patients should receive the adjusted dose after dialysis. JS has no explicit hemodialysis timing/qualification row. | Add dialysis timing note/variant, or otherwise prevent a dialysis patient from receiving an unqualified single-dose recommendation. |
| `src/data/renalRules/antivirals-immunology.js` | Tenofovir disoproxil fumarate | PASS | VIREAD interval table and non-HD CrCl <10 no-recommendation statement are traceable. | Keep. |
| `src/data/renalRules/antivirals-immunology.js` | Tenofovir alafenamide | PASS | VEMLIDY renal statement supports no adjustment at eCrCl >=15 and ESRD on chronic HD, with not-recommended ESRD not on HD. | Keep; preserve that this is VEMLIDY/HBV context. |
| `src/data/renalRules/antivirals-immunology.js` | Emtricitabine | PASS | EMTRIVA capsule and oral solution interval table matches DailyMed, including post-HD timing. | Keep. |
| `src/data/renalRules/antivirals-immunology.js` | Lamivudine | PASS | EPIVIR adult/adolescent >=25 kg renal table matches DailyMed and notes no extra post-dialysis dose. | Keep; do not generalize to EPIVIR-HBV. |
| `src/data/renalRules/antivirals-immunology.js` | Entecavir | PASS | BARACLUDE adult renal table matches DailyMed, including usual and lamivudine-refractory/decompensated columns. | Keep. |
| `src/data/renalRules/antivirals-immunology.js` | Adefovir dipivoxil | PASS | HEPSERA interval table and non-HD CrCl <10 no-recommendation statement are traceable. | Keep. |
| `src/data/renalRules/antivirals-immunology.js` | Nirmatrelvir and ritonavir | PASS | Current PAXLOVID renal table supports moderate and severe renal impairment regimens, including hemodialysis after-dose timing. | Keep; source uses eGFR, not Cockcroft-Gault CrCl. |
| `src/data/renalRules/antivirals-immunology.js` | Remdesivir | PASS | DailyMed explicitly states no adjustment for any renal impairment, including dialysis. | Keep. |
| `src/data/renalRules/antivirals-immunology.js` | Molnupiravir | PASS | DailyMed explicitly states no adjustment for renal impairment. | Keep. |
| `src/data/renalRules/antivirals-immunology.js` | Sofosbuvir and velpatasvir | PASS | DailyMed supports no adjustment for any renal impairment including dialysis, with ribavirin caveat. | Keep; retain ribavirin caveat. |
| `src/data/renalRules/antivirals-immunology.js` | Ledipasvir and sofosbuvir | PASS | DailyMed supports no adjustment for any renal impairment including ESRD on dialysis, with ribavirin caveat. | Keep; retain ribavirin caveat. |
| `src/data/renalRules/antivirals-immunology.js` | Sofosbuvir, velpatasvir, and voxilaprevir | PASS | DailyMed supports no adjustment for mild, moderate, or severe renal impairment including dialysis. | Keep. |
| `src/data/renalRules/antivirals-immunology.js` | Glecaprevir and pibrentasvir | PASS | DailyMed supports no adjustment for mild, moderate, or severe renal impairment including dialysis. | Keep. |
| `src/data/renalRules/antivirals-immunology.js` | Letermovir | PASS | DailyMed supports no renal adjustment for CLcr >10 and no dosing recommendation at CLcr <=10/dialysis; IV vehicle accumulation monitoring is noted in source. | Keep; add UI note for IV hydroxypropyl betadex monitoring when CLcr <50 if feasible. |
| `src/data/renalRules/antivirals-immunology.js` | Sirolimus | PASS | DailyMed explicitly states no dose adjustment needed in impaired renal function. | Keep; TDM caveat is appropriate. |
| `src/data/renalRules/antivirals-immunology.js` | Everolimus | PASS | DailyMed explicitly states no dose adjustment needed in renal impairment. | Keep; TDM caveat is appropriate. |
| `src/data/renalRules/cardio-anticoag.js` | Apixaban | PASS | NVAF dose-reduction criteria are traceable to DailyMed and condition includes age, weight, and serum creatinine factors. | Keep as NVAF-only; do not present as a CrCl-band rule. |
| `src/data/renalRules/cardio-anticoag.js` | Rivaroxaban | FLAG | DailyMed adult table includes NVAF CrCl <15 avoid-use and additional adult indications. JS has DVT/PE <15 avoid-use but no explicit NVAF <15 avoid-use, and omits other adult renal/no-adjustment rows. | Add missing NVAF <15 avoidance and either complete or explicitly exclude omitted indications. |
| `src/data/renalRules/cardio-anticoag.js` | Dabigatran etexilate | FLAG | Source supports the listed NVAF and P-gp adjustments, but overlapping bands plus DVT/PE "cannot be provided" language are not fully represented below CrCl 15 or with P-gp caveats. | Split NVAF, DVT/PE, and interacting-drug rules, and add explicit DVT/PE no-recommendation for CrCl <=30 where applicable. |
| `src/data/renalRules/cardio-anticoag.js` | Edoxaban | FLAG | NVAF high-CrCl limitation and 15-50 dose reduction are traceable, but JS lacks an explicit CrCl <15 not-recommended/avoid row. | Add CrCl <15 guidance from label before use. |
| `src/data/renalRules/cardio-anticoag.js` | Enoxaparin sodium | FLAG | Label severe renal table has more indications than JS encodes, including ACS/STEMI-related regimens. Current record collapses too much of an indication-specific anticoagulant table. | Encode all severe renal table rows or split by indication; avoid a generic "usual schedule" fallback without full indication coverage. |
| `src/data/renalRules/cardio-anticoag.js` | Fondaparinux sodium | PASS | Contraindication at CrCl <30 and caution at CrCl 30-50 are traceable to DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Dofetilide | PASS | Starting-dose CrCl table and <20 contraindication match DailyMed. | Keep; inpatient QT monitoring caveat is appropriate. |
| `src/data/renalRules/cardio-anticoag.js` | Sotalol | FLAG | Ventricular arrhythmia interval table is captured, and AFIB/AFL <40 contraindication is captured, but AFIB/AFL >60 and 40-59 dosing intervals are omitted. | Add AFIB/AFL-specific interval rows or split the record by arrhythmia indication. |
| `src/data/renalRules/cardio-anticoag.js` | Flecainide acetate | PASS | Severe renal impairment initial dose and plasma-level monitoring language match DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Digoxin | PASS | Record points users to the label maintenance table by lean body weight and renal function rather than inventing fixed bands. | Keep as a pointer-only rule until the full table is encoded. |
| `src/data/renalRules/cardio-anticoag.js` | Lisinopril | PASS | CrCl >30, 10-30, and <10/hemodialysis initial dose guidance matches DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Enalapril maleate | PASS | Hypertension renal adjustment and dialysis-day guidance are traceable; heart failure caveat is noted. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Ramipril | FLAG | Dose content matches DailyMed renal impairment language, but the exact JS `sourceUrl` returned a DailyMed internal error during verification; alternate DailyMed ramipril pages verify the same content. | Replace with a resolvable DailyMed label URL. |
| `src/data/renalRules/cardio-anticoag.js` | Benazepril hydrochloride | PASS | GFR <30 initial dose/max guidance matches DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Trandolapril | PASS | CrCl <30 starting dose matches DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Quinapril | PASS | Hypertension renal starting-dose table and heart-failure renal starting doses match DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Perindopril erbumine | PASS | Renal impairment statement and CrCl <30 not-recommended guidance are traceable to DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Losartan potassium | PASS | DailyMed supports no renal dose adjustment unless renal impairment is accompanied by volume depletion. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Valsartan | PASS | DailyMed supports no adjustment in mild/moderate renal impairment and states severe renal safety/effectiveness not established. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Candesartan cilexetil | PASS | DailyMed supports no initial dosage adjustment in renal insufficiency, including severe impairment/hemodialysis PK population. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Sacubitril and valsartan | PASS | Severe renal impairment half-starting-dose rule and no adjustment for mild/moderate impairment match DailyMed. | Keep; source uses eGFR. |
| `src/data/renalRules/cardio-anticoag.js` | Spironolactone | FLAG | DailyMed supports the two HFrEF eGFR bands encoded, but JS has no explicit handling for eGFR <30 and the source URL with `www.dailymed` returned an internal error in verification while the non-www URL worked. | Add a severe renal "no label dosing recommendation/avoid initiation unless specialist review" handling note if the app requires full bands; normalize source URL. |
| `src/data/renalRules/cardio-anticoag.js` | Eplerenone | PASS | Renal contraindications for all patients and stricter hypertension contraindication are traceable to DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Torsemide | FLAG | Source text is an indication dose for edema associated with chronic renal failure, not a CrCl/eGFR dose-adjustment rule or no-adjustment statement. | Move to indication dosing context or remove from renal adjustment rules unless the UI clearly distinguishes renal-disease indication dosing. |
| `src/data/renalRules/cardio-anticoag.js` | Metolazone | FLAG | Source text is usual dosage for edema of renal disease, not renal impairment dose adjustment or explicit no-adjustment guidance. | Move to indication dosing context or remove from renal adjustment rules. |
| `src/data/renalRules/cardio-anticoag.js` | Rosuvastatin calcium | PASS | Severe renal impairment starting/max dose and no adjustment for mild/moderate impairment are traceable. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Fenofibrate | PASS | eGFR 30 to <60 initial dose and eGFR <30/ESRD/dialysis contraindication match DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Fenofibric acid | PASS | eGFR 30 to <60 initial dose and eGFR <30/ESRD/dialysis contraindication match DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Pitavastatin | PASS | eGFR 15-59 and ESRD on HD starting/max dose guidance, plus no mild adjustment, match DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Bivalirudin | PASS | Bolus no-reduction, CrCl <30 infusion reduction, and hemodialysis infusion reduction match DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Eptifibatide | FLAG | Infusion reduction for CrCl <50 is traceable, but DailyMed also lists dependency on renal dialysis as a contraindication. JS lacks a dialysis contraindication. | Add explicit dialysis contraindication before use. |
| `src/data/renalRules/cardio-anticoag.js` | Tirofiban hydrochloride | PASS | CrCl <=60 reduced infusion rule and Cockcroft-Gault actual-body-weight note match DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Argatroban | PASS | DailyMed states no renal dose adjustment is necessary; hepatic impairment caveat is preserved. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Atenolol | PASS | Maximum oral doses for CrCl 15-35, <15, and hemodialysis post-dose match DailyMed. | Keep; note max-dose nature in UI. |
| `src/data/renalRules/cardio-anticoag.js` | Nadolol | PASS | Renal failure interval table matches DailyMed. | Keep. |
| `src/data/renalRules/cardio-anticoag.js` | Ivabradine | PASS | DailyMed supports no adjustment for CrCl 15-60 and no data below CrCl 15. | Keep. |
| `docs/curation/cardio-anticoag.md` | Documentation count/source list | FLAG | Markdown claims 29 JS records and omits the 7 later JS records: bivalirudin, eptifibatide, tirofiban, argatroban, atenolol, nadolol, and ivabradine. | Update markdown after data owner confirms final JS contents. |

## Top Critical Blockers

1. Anticoagulant indication collapse: rivaroxaban, dabigatran, edoxaban, enoxaparin, sotalol, and eptifibatide need correction or splitting before production use.
2. Missing dialysis/non-dialysis branches: oseltamivir, peramivir, famciclovir, and eptifibatide have dialysis-specific source language that is incomplete or absent in JS.
3. Non-adjustment vs indication-dose confusion: torsemide and metolazone are renal-disease indication dosing records, not renal impairment adjustment records.
4. Source URL hygiene: ramipril exact source URL and spironolactone `www.dailymed` URL failed in verifier browsing despite alternate DailyMed pages confirming the dosing language.
5. Cardio markdown is stale relative to JS: 36 exported records versus 29 documented records.

## Source Notes

- Verification used DailyMed FDA label pages only. No non-FDA tertiary dosing references were used.
- DailyMed tables explicitly supported the PASS table-driven antiviral records: oral/IV acyclovir, ganciclovir, valganciclovir, tenofovir DF, emtricitabine, lamivudine, entecavir, adefovir, and PAXLOVID.
- DailyMed explicit no-adjustment statements supported remdesivir, molnupiravir, HCV DAA combinations, letermovir above CLcr 10 mL/min, sirolimus, everolimus, losartan, candesartan, argatroban, and ivabradine within its studied range.
- DailyMed explicit cardio/renal adjustment tables or statements supported dofetilide, flecainide, lisinopril, enalapril, ramipril via alternate DailyMed page, benazepril, trandolapril, quinapril, valsartan, sacubitril/valsartan, eplerenone, rosuvastatin, fenofibrate, fenofibric acid, pitavastatin, bivalirudin, tirofiban, atenolol, and nadolol.
- Short source excerpts were checked for traceability, but direct quotations are intentionally limited here; the record-level source URLs in the JS files identify the label pages used.
