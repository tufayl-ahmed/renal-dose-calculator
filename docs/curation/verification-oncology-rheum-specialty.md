# Verification Agent D Report: Oncology/Rheum/Specialty

Date: 2026-05-06

Scope:
- `src/data/renalRules/oncology-rheum-specialty.js`
- `docs/curation/oncology-rheum-specialty.md`

Constraint followed: no JS data files edited.

## Summary

Verification source standard: DailyMed FDA label pages only. I checked each JS record for whether the renal rule text traces to an explicit adult renal dose adjustment, renal contraindication/not-recommended threshold, no-adjustment statement, or clearly labeled evidence gap in the FDA label.

Counts:
- Total records reviewed: 30
- Pass: 25
- Flag: 5
- Unable to verify: 0

High-risk themes found:
- One severe renal impairment band is missing from the JS record.
- One dialysis/not-studied gap is omitted from a record with severe renal dosing.
- One record uses the wrong renal metric in condition text.
- One record adds unsupported practical wording to a label evidence gap.
- One record includes an unsupported route and overgeneralizes a transplant-specific renal cap.

## Findings

| # | Drug | Status | DailyMed FDA label support | Verification finding |
|---:|---|---|---|---|
| 1 | Hydroxyurea | PASS | [HYDREA DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6053c775-68de-45e4-9af9-33b18fd0e140) | Label section 2.3 supports 15 mg/kg daily at measured CrCl >=60 and 7.5 mg/kg daily when CrCl <60 or ESRD, with post-hemodialysis administration. |
| 2 | Capecitabine | FLAG | [Capecitabine DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=29885ada-b743-419c-8f15-edd4247c76ca) | The 25% reduction for CLcr 30-50 is supported. For CLcr <30, the label says dosage has not been established; the JS interval adds "do not use without specialist review," which is not FDA label wording and should not be represented as a label instruction. |
| 3 | Pemetrexed | PASS | [Pemetrexed DailyMed](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=3ae68628-7ab0-4491-b3ae-6a8330b719c8) | Label section 2.3 supports dosing only when Cockcroft-Gault CrCl is >=45 mL/min and no recommended dose below 45. |
| 4 | Lenalidomide | PASS | [Lenalidomide DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=84d9dec7-9250-4dbd-9a0d-23e75f111892) | Label section 2.6 supports the CLcr 30-60, CLcr <30 non-dialysis, and CLcr <30 dialysis indication-specific variants. Dialysis timing is included in the source. |
| 5 | Fludarabine phosphate injection | PASS | [Fludarabine injection DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=20e5acf0-90b7-45c8-be78-91eaf77c9ac0) | Label section 2.2 supports 25, 20, and 15 mg/m2 IV starting doses for the listed CrCl bands and "do not administer" below 30. |
| 6 | Fludarabine phosphate tablets | PASS | [Fludarabine tablets DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ac76aca8-e718-4232-92ab-399166ce9e46) | Label supports oral 40 mg/m2 daily x5 baseline, 20% reduction for CrCl 30-70, and 50% reduction for CrCl <30. Route separation from IV is appropriate. |
| 7 | Bendamustine | PASS | [Bendamustine DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=766b73e2-49bb-47f9-bbb1-44cfa1a3197e) | Label section 8.6 supports "do not use" when CLcr <30. The >=30 row is phrased as no renal dose adjustment specified, which is acceptable as a visibility band rather than an explicit no-adjustment claim. |
| 8 | Oxaliplatin | PASS | [Oxaliplatin DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=95b05292-36a1-4946-b8b3-835a3a77f4a7) | Label section 2.3 supports 65 mg/m2 when Cockcroft-Gault CLcr <30. No renal reduction for mild/moderate impairment is consistent with label PK/dosing context. |
| 9 | Etoposide | PASS | [Etoposide DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4f850eb2-3542-43a0-90e8-bb37fa05cf15) | Label renal impairment section supports 100% dose when measured CrCl >50, 75% when 15-50, and states data are unavailable below 15 with further reduction to consider. |
| 10 | Topotecan injection | FLAG | [Topotecan injection DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b6019088-cd94-43b4-b5ce-ba20b6b8021e) | The CLcr 20-39 single-agent reduction to 0.75 mg/m2/day and no adjustment >=40 are supported. The label also states insufficient data for CLcr <20; the JS record has no <20 band, leaving a severe renal gap. |
| 11 | Topotecan capsules | PASS | [HYCAMTIN capsules DailyMed](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=b23b46f5-c276-47f5-8bbd-940680b3f579) | Label section 2.3 supports 2.3, 1.5, and 0.6 mg/m2/day oral dosing by CLcr band. |
| 12 | Imatinib | PASS | [Imatinib DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1debf3a0-7587-47d7-8ea6-e739698d7297) | Label section 2.12 and renal classification table support the mild/moderate caps and severe renal caution with limited 100 mg/day tolerance. |
| 13 | Venetoclax | PASS | [VENCLEXTA DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b118a40d-6b56-cee3-10f6-ded821a97018) | Label section 8.6 supports no dose adjustment for CLcr >=15 and separately warns reduced renal function increases TLS monitoring needs; JS note retains the TLS caveat. |
| 14 | Anastrozole | PASS | [Anastrozole DailyMed](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=7e0bd2cc-d3cc-403f-a6b6-4597ccb2f685) | Label sections 2.1 and 8.6 support no dosage adjustment for renal impairment and 1 mg once daily. |
| 15 | Letrozole | PASS | [Letrozole DailyMed](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=2d1f18f0-2c77-407c-b702-2d1b07f92510&version=3) | Label section 2.6 supports no dosage adjustment when creatinine clearance is >=10 mL/min. |
| 16 | Exemestane | PASS | [Exemestane DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=e24b08eb-4693-41c7-81cb-b536947f7070) | Label section 8.7 supports increased AUC with CrCl <35 but states dosage adjustment does not appear necessary. |
| 17 | Bicalutamide | PASS | [Bicalutamide DailyMed](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=7a08d88b-051a-4c16-9560-12685c500c58&version=3) | Label section 2.2 supports no dosage adjustment for renal impairment; the 50 mg daily regimen and LHRH caveat are retained. |
| 18 | Abiraterone acetate | PASS | [Abiraterone DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=6f5b628b-69da-4a04-a4d5-623b18d1fd5d) | Label section 8.7 supports no dosage adjustment for renal impairment. |
| 19 | Palbociclib | PASS | [IBRANCE DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=fecbdd7d-b729-41b5-9872-231b8fe104ce) | Label section 8.7 supports no dose adjustment for mild, moderate, or severe renal impairment with CrCl >15; it also states hemodialysis has not been studied. |
| 20 | Olaparib | PASS | [LYNPARZA DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=741ff3e3-dc1a-45a6-84e5-2481b27131aa) | Label sections 2.5 and 8.6 support 200 mg twice daily for CLcr 31-50, no modification in mild impairment, and no data for CLcr <=30/ESRD. |
| 21 | Rucaparib | PASS | [RUBRACA DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=0295d202-1cfe-7659-e063-6294a90a476e) | Label section 8.6 supports no dosage modification for CLcr 30-89 and not-studied status for CLcr <30 or dialysis. |
| 22 | Talazoparib | FLAG | [TALZENNA DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=13839d4f-6acf-4ffb-a128-79df59319273) | The moderate and severe renal dose reductions by breast cancer versus mCRPC regimen are supported. The label also says hemodialysis has not been studied; the JS record omits that dialysis gap and has no <15 mL/min band. |
| 23 | Tamsulosin | PASS | [FLOMAX DailyMed](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=6771ad8e-ac92-4aec-b484-5d8350a353f8) | Label section 8.6 supports no adjustment in renal impairment and states ESRD with CLcr <10 has not been studied. |
| 24 | Silodosin | PASS | [Silodosin DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ea3bbafb-d32a-d0d3-e053-2a95a90ac387) | Label section 2.2 supports 4 mg once daily for CCr 30-50, no adjustment for mild impairment, and contraindication when CCr <30. |
| 25 | Mirabegron | PASS | [Mirabegron DailyMed](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=e597023d-6dcc-4d9e-8ce0-2d28a5d862f3&version=1) | Current DailyMed label section 2.4 supports the adult MDRD eGFR table: 25 mg start/max 50 for eGFR 30-89, max 25 for eGFR 15-29, and not recommended below 15 or dialysis. |
| 26 | Solifenacin | PASS | [Solifenacin DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=aea71cde-6d62-4f8d-b813-47064cb213d9) | Label section 2.2 supports not exceeding 5 mg daily when CLcr <30; standard 5 mg with possible increase to 10 mg is supported above that threshold. |
| 27 | Tolterodine extended-release | PASS | [Tolterodine ER DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9710ad7b-93c2-4ec1-95ff-597563be4314) | Label section 2.2 supports 2 mg once daily for CCr 10-30 and not recommended below 10. It notes mild/moderate renal impairment has not been studied, but the standard 4 mg row is the labeled adult dose outside severe impairment. |
| 28 | Fesoterodine | PASS | [Fesoterodine DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=dc8f6158-3c2b-4ec0-a951-e04468b83bb1) | Label section 2.3 supports the adult Cockcroft-Gault CLcr table: 8 mg for 30-89 and 4 mg for 15-29 and <15. Pediatric renal tables are appropriately excluded. |
| 29 | Mycophenolate mofetil | FLAG | [Mycophenolate mofetil DailyMed](https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8015f042-54fb-4a7a-a10b-6219e1a450c8) | The severe chronic kidney-graft impairment cap is supported for kidney transplant patients with GFR <25. The JS record lists both ORAL and IV, but the cited label is the oral capsule/tablet label, not an IV product label. The >=25 "no renal dose modification specified" band also overgeneralizes from a transplant-specific cap/no-delayed-graft-modification statement. |
| 30 | Darolutamide | FLAG | [NUBEQA DailyMed](https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=1a7cb212-56e4-4b9d-a73d-bfee7fe4735e) | Label section 2.3 supports 300 mg twice daily for severe renal impairment defined by eGFR 15-29 mL/min/1.73 m2 and not receiving hemodialysis. The JS uses "CrCl >=30" and a numeric 15-29 range without naming eGFR; this is a renal metric mismatch. The label also leaves hemodialysis outside the recommendation. |

## Recommended Follow-Up

Do not promote this worker file to verified without correcting or deliberately accepting the flagged records above. The highest priority fixes are:
- Add an explicit CLcr <20 evidence-gap row for topotecan injection.
- Change darolutamide condition text from CrCl to eGFR and preserve the not-on-hemodialysis limitation.
- Remove unsupported IV route from the mycophenolate mofetil record unless an FDA IV product label is separately cited.
- Keep "dosage not established" wording for capecitabine CLcr <30 without converting it to a do-not-use instruction.
- Add the talazoparib dialysis/not-studied gap or otherwise avoid displaying severe renal dosing as covering dialysis.
