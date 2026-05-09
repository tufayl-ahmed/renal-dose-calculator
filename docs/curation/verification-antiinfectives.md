# Verification Report: Antiinfectives Renal Rules

Verification date: 2026-05-06  
Verification agent: Verification Agent A  
Scope:
- Worker 1: `src/data/renalRules/antiinfectives-beta-lactams.js` and `docs/curation/antiinfectives-beta-lactams.md`
- Worker 2: `src/data/renalRules/antiinfectives-nonbeta.js` and `docs/curation/antiinfectives-nonbeta.md`

## Summary Counts

Records reviewed: 52

Pass: 34

Flagged: 18

Unable to verify: 0

Field completeness: PASS. Every JS record reviewed includes drug name, route array, renal-function bands, dose, interval, indication note, source URL, and confidence. All records remain marked `draft-source-extracted`.

## Findings Table

| file | drug | status | issue | recommended action |
| --- | --- | --- | --- | --- |
| `antiinfectives-beta-lactams.js` | Amoxicillin | FLAG | DailyMed renal table is traceable, but hemodialysis supplemental dosing is not modeled in the rule bands. | Add a dialysis-specific condition or exclude hemodialysis from the low-GFR bands until dialysis support exists. |
| `antiinfectives-beta-lactams.js` | Amoxicillin and clavulanate potassium | FLAG | Renal bands are traceable, but hemodialysis supplemental doses are omitted from the active rules. | Add hemodialysis-specific dose timing/supplement language or mark the CrCl `<10` band as non-hemodialysis. |
| `antiinfectives-beta-lactams.js` | Ampicillin and sulbactam | PASS | Adult IV/IM CrCl interval table is traceable to the cited label. | No data-file action beyond clinician review. |
| `antiinfectives-beta-lactams.js` | Cefazolin | PASS | Adult reduced renal-function dose-fraction table is traceable, including loading-dose caveat. | No data-file action beyond clinician review. |
| `antiinfectives-beta-lactams.js` | Cephalexin | PASS | Adult/patient-at-least-15-years renal table is traceable; hemodialysis not established note is retained. | No data-file action beyond clinician review. |
| `antiinfectives-beta-lactams.js` | Cefuroxime axetil | PASS | Oral CrCl table is traceable; low band explicitly says without hemodialysis. | Consider future dialysis status support for post-HD dosing. |
| `antiinfectives-beta-lactams.js` | Cefuroxime | FLAG | Adult parenteral renal table is traceable, but label hemodialysis supplemental dosing is not represented in selectable variants. | Add hemodialysis-specific rule/condition or qualify the `<10` band as non-hemodialysis. |
| `antiinfectives-beta-lactams.js` | Ceftriaxone | PASS | Explicit no-adjustment statement is traceable, with renal-plus-hepatic maximum noted. | No data-file action beyond clinician review. |
| `antiinfectives-beta-lactams.js` | Cefepime | FLAG | CrCl maintenance table is traceable, but CAPD and hemodialysis rows differ and are omitted; cefepime has important renal neurotoxicity risk. | Add CAPD/hemodialysis conditions or prevent low-CrCl rules from applying to dialysis patients. |
| `antiinfectives-beta-lactams.js` | Ceftazidime | FLAG | CrCl maintenance table is traceable, but dialysis handling is not represented. | Add hemodialysis/peritoneal dialysis qualification before promotion. |
| `antiinfectives-beta-lactams.js` | Ceftaroline fosamil | PASS | Adult CrCl table, including ESRD/hemodialysis dose, is traceable. | Keep post-HD administration timing visible in UI/notes. |
| `antiinfectives-beta-lactams.js` | Cefdinir | FLAG | Adult CrCl `<30` dose is traceable, but the label's hemodialysis regimen is not modeled. | Add hemodialysis-specific dosing or exclude HD from the `<30` rule. |
| `antiinfectives-beta-lactams.js` | Cefpodoxime proxetil | FLAG | CrCl `<30` interval extension is traceable, but hemodialysis dosing frequency differs and is only in notes. | Add HD-specific rule/condition. |
| `antiinfectives-beta-lactams.js` | Cefixime | PASS | Adult CrCl reductions and dialysis/CAPD groupings are traceable to label renal table. | No data-file action beyond clinician review. |
| `antiinfectives-beta-lactams.js` | Cefprozil | PASS | Renal table is traceable; hemodialysis timing note is retained. | No data-file action beyond clinician review. |
| `antiinfectives-beta-lactams.js` | Cefotetan | FLAG | Interval-extension/dose-reduction options are traceable, but intermittent hemodialysis recommendation is not modeled. | Add hemodialysis condition before promotion. |
| `antiinfectives-beta-lactams.js` | Ceftolozane and tazobactam | FLAG | Adult renal table values for CrCl `15-50` are traceable, but ESRD-on-hemodialysis loading/maintenance rows are omitted entirely. | Add ESRD/HD variants or block use below CrCl 15 until represented. |
| `antiinfectives-beta-lactams.js` | Ceftazidime and avibactam | FLAG | Adult renal table is traceable, but label says dosing on HD days should occur after hemodialysis; the low band does not carry that qualification. | Add post-HD timing or dialysis-specific condition. |
| `antiinfectives-beta-lactams.js` | Cefiderocol | PASS | Adult CLcr table including augmented renal clearance and CLcr `<15` with/without intermittent HD is traceable. | Keep post-HD timing visible in downstream display. |
| `antiinfectives-beta-lactams.js` | Aztreonam | PASS | Adult renal impairment loading-dose and maintenance reduction language is traceable. | Consider future HD supplement modeling for serious infections. |
| `antiinfectives-beta-lactams.js` | Meropenem | PASS | Adult CrCl dose/interval table is traceable; cited label says HD/PD information is inadequate. | No data-file action beyond clinician review. |
| `antiinfectives-beta-lactams.js` | Imipenem and cilastatin | PASS | Adult renal table is traceable, including the CrCl `<15` hemodialysis warning. | No data-file action beyond clinician review. |
| `antiinfectives-beta-lactams.js` | Ertapenem | PASS | Adult CrCl and ESRD dosing is traceable; post-HD supplement is noted. | Keep dialysis timing visible in downstream display. |
| `antiinfectives-beta-lactams.js` | Piperacillin and tazobactam | FLAG | The label states CrCl rows are for patients not receiving hemodialysis; separate HD/CAPD rows are omitted from rules. | Add HD/CAPD variants or qualify current `<20` and `20-40` bands as non-dialysis. |
| `antiinfectives-nonbeta.js` | Ciprofloxacin | FLAG | Adult oral CrCl rows are traceable, but HD/peritoneal dialysis row is omitted. | Add dialysis row or prevent CrCl `5-29` rule from applying to dialysis patients. |
| `antiinfectives-nonbeta.js` | Levofloxacin | FLAG | Adult table is traceable, but the HD/CAPD column is modeled as a CrCl `<10` band, which can over-apply to non-dialysis patients. | Represent HD/CAPD separately; do not infer all CrCl `<10` patients share dialysis dosing. |
| `antiinfectives-nonbeta.js` | Moxifloxacin | PASS | Explicit oral no-adjustment statement including HD/CAPD is traceable. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Azithromycin | PASS | Explicit no renal dose-adjustment statement with severe-impairment caution is traceable. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Clarithromycin | FLAG | Source is an extended-release tablet label, but the record is generic oral clarithromycin with broad aliases; formulation-specific limitations may be lost. | Split IR vs ER or make the formulation explicit in drug name/search/indication. |
| `antiinfectives-nonbeta.js` | Clindamycin | PASS | Label statement that renal disease does not require schedule modification is traceable. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Linezolid | PASS | No-adjustment parent-drug statement is traceable; metabolite accumulation caveat is retained. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Daptomycin | PASS | Adult cSSSI and S. aureus bloodstream infection CrCl table is traceable. | Keep HD administration timing visible if UI supports it. |
| `antiinfectives-nonbeta.js` | Nitrofurantoin | PASS | FDA label contraindication at CrCl under 60 mL/min is traceable. | Clinician review should decide whether to retain strict FDA-label threshold versus contemporary practice. |
| `antiinfectives-nonbeta.js` | Sulfamethoxazole and trimethoprim | PASS | Adult impaired renal-function table is traceable. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Fluconazole | PASS | Multiple-dose renal table after loading dose and dialysis row are traceable. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Voriconazole | PASS | Oral no-adjustment statement is traceable; IV vehicle issue is correctly kept out of oral rule. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Posaconazole | PASS | Delayed-release tablet no-adjustment statement is traceable, with severe impairment monitoring caveat. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Isavuconazonium sulfate | PASS | No renal adjustment statement including ESRD is traceable. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Fosfomycin disodium | FLAG | CONTEPO renal table is traceable for CLcr `11-50`, but label also says administer after HD on HD days and provides no CrCl `<=10` non-HD row. | Add HD timing and make absence of `<=10` non-HD recommendation explicit. |
| `antiinfectives-nonbeta.js` | Terbinafine | PASS | Not-recommended statement at CrCl `<=50` is traceable. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Colistimethate sodium | PASS | Adult renal table is traceable and correctly stops at CrCl `10-29`. | Consider adding an explicit no-rule/needs-review note for CrCl `<10`. |
| `antiinfectives-nonbeta.js` | Acyclovir | PASS | Adult oral renal table by usual regimen is traceable. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Valacyclovir | FLAG | Adult renal table is traceable, but hemodialysis timing is omitted from variants. | Add "after hemodialysis" qualification for HD patients. |
| `antiinfectives-nonbeta.js` | Famciclovir | FLAG | Adult renal table is traceable, but separate HD rows/timing are omitted. | Add HD-specific variants for single-day and multiple-day indications. |
| `antiinfectives-nonbeta.js` | Oseltamivir | FLAG | Adult renal table is traceable, but CAPD and ESRD-not-on-dialysis recommendations are omitted; `<10` is modeled only as HD. | Add CAPD and ESRD-not-on-dialysis conditions or block non-HD `<10` matching. |
| `antiinfectives-nonbeta.js` | Valganciclovir | PASS | Adult tablet renal table is traceable, including tablets not recommended for hemodialysis CrCl `<10`. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Ganciclovir | PASS | Adult IV induction/maintenance renal table including HD post-dialysis dosing is traceable. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Atovaquone and proguanil hydrochloride | PASS | Label renal section is traceable: no adjustment for mild/moderate renal impairment, prophylaxis contraindicated at CrCl `<30`, treatment only with caution if benefits outweigh risks. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Fidaxomicin | PASS | Label states no renal dose adjustment based on CrCl-defined renal impairment categories. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Rifampin | PASS | Label explicitly says no adjustment is required in renal failure for doses not exceeding 600 mg daily; higher-dose limitation is retained in the condition. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Rifabutin | PASS | Label supports no adjustment in mild/moderate renal impairment and toxicity-triggered 50% dose reduction consideration for CrCl `<30`. | No data-file action beyond clinician review. |
| `antiinfectives-nonbeta.js` | Tinidazole | PASS | Label supports no dose adjustment in severe renal impairment and includes a hemodialysis supplemental-dose instruction, which is represented as a condition. | No data-file action beyond clinician review. |

## Top Critical Blockers

1. Dialysis is the dominant safety blocker. Multiple records use low CrCl bands that can be confused with dialysis dosing even when the FDA label has separate HD/CAPD rows or post-HD supplemental instructions.

2. Highest-priority beta-lactam blockers before promotion: cefepime, piperacillin/tazobactam, ceftolozane/tazobactam, cefpodoxime, ceftazidime, cefotetan, and ceftazidime/avibactam. These have either separate dialysis rows, missing ESRD rows, or clinically important dialysis timing.

3. Highest-priority non-beta blockers before promotion: levofloxacin, oseltamivir, ciprofloxacin, famciclovir, valacyclovir, fosfomycin disodium, and clarithromycin. These involve dialysis mis-modeling/omission or formulation-specific source ambiguity.

4. The current schema needs a dialysis-status dimension. Until then, records with label HD/CAPD rows should either include explicit dialysis variants in `condition` text or qualify low-CrCl bands as "not on dialysis."

## Source Notes

- Worker 1 beta-lactam records use DailyMed URLs and are generally traceable to explicit FDA-label renal impairment tables or no-adjustment statements. Representative checks confirmed cefepime Table 2 includes CrCl rows plus distinct CAPD/hemodialysis rows; piperacillin/tazobactam explicitly separates non-hemodialysis CrCl rows from HD/CAPD rows; ceftolozane/tazobactam includes ESRD-on-HD loading and maintenance regimens.
- Worker 2 non-beta records use DailyMed URLs and are generally traceable. Representative checks confirmed ciprofloxacin oral renal dosing has a separate HD/peritoneal dialysis row; levofloxacin table has distinct CrCl and HD/CAPD columns; oseltamivir has separate HD, CAPD, and ESRD-not-on-dialysis rows; nitrofurantoin's FDA label contraindicates CrCl under 60 mL/min; fluconazole includes a loading-dose table with dialysis dosing.
- The five added Worker 2 records are traceable: atovaquone/proguanil has explicit mild/moderate no-adjustment and severe renal impairment prophylaxis/treatment language; fidaxomicin states no adjustment by CrCl category; rifampin limits no-adjustment language to doses not exceeding 600 mg daily; rifabutin gives mild/moderate no-adjustment and severe impairment toxicity-based reduction; tinidazole includes no-adjustment language plus a hemodialysis supplemental-dose instruction.
- No pediatric-only renal dosing was mistaken for an adult rule in the reviewed JS records. Some labels include pediatric sections nearby, but the curated rows are adult-focused.
- No TDM-only aminoglycoside, vancomycin, or flucytosine fixed-dose renal rules were added by Worker 2; this was appropriate.
- No source URLs were found to be non-FDA-label mirrors. All checked sources were DailyMed label pages.
