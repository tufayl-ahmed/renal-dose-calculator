# Antiinfectives: Beta-Lactams Renal Dose Curation Draft

Reviewed on: 2026-05-06  
Reviewer: Codex curation draft  
Status: draft-source-extracted only; not clinician verified.

## Scope

This batch uses DailyMed FDA label pages where an explicit adult renal dosing table, CrCl/GFR adjustment statement, or no-adjustment statement was found. Entries were added to `src/data/renalRules/antiinfectives-beta-lactams.js` only when the label text gave a direct renal dosing instruction.

Dialysis-only rows were usually kept in notes rather than modeled as CrCl ranges unless the label also tied them to a CrCl band. The current JS structure is CrCl-range based and does not yet model hemodialysis, CAPD, CRRT, loading-dose timing, or post-dialysis supplemental doses as independent conditions.

## Completed JS Records

1. Amoxicillin, oral - DailyMed section 2.5 renal impairment table. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f9062321-ffb3-42e8-8f98-453cd30f5282
2. Amoxicillin and clavulanate potassium, oral - DailyMed section 2.4 renal impairment table. Source: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=d25c8190-3690-4ce6-a525-21850754224d
3. Ampicillin and sulbactam, IV/IM - DailyMed impaired renal function Table 3. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=155c7ec0-5862-404f-b1d0-f278f8a8bbda
4. Cefazolin, IV/IM - DailyMed reduced renal function dosage adjustment. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=db977f52-2296-4003-9162-c155163d714a
5. Cephalexin/cefalexin, oral - DailyMed renal adjustment table for adults and patients at least 15 years old. Source: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=3fed2817-fc0d-43cd-9f02-948fbc76672c
6. Cefuroxime axetil, oral - DailyMed section 2.5 renal impairment table. Source: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=76cec54f-d167-4298-951b-5411a3c47f4a
7. Cefuroxime injection, IV/IM - DailyMed impaired renal function adult table. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=19902965-d2d6-433f-982d-0095014df4e8
8. Ceftriaxone, IV/IM - DailyMed renal/hepatic impairment statement; no renal adjustment normally required. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=7bed9b33-29e3-4f04-9766-43a21c7ad47a
9. Cefepime, IV/IM - DailyMed section 2.3 renal impairment Table 2. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=dd641c7f-b857-48ff-bd9d-747e0c3cc89f
10. Ceftazidime, IV/IM - DailyMed renal insufficiency maintenance dosage table. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8b55504e-38c5-fa0c-7766-ee68d38c041b
11. Ceftaroline fosamil, IV - DailyMed section 2.3 renal impairment table. Source: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=3cee3c08-ed60-06c5-ac49-103b7ad2ef5f
12. Cefdinir, oral - DailyMed adult renal insufficiency statement. Source: https://www.dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=236cea6b-c72e-43fa-bbcb-187a061e3a33
13. Cefpodoxime proxetil, oral - DailyMed renal dysfunction statement. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8519a9d8-7106-4545-bc58-859ee9a6708e
14. Cefixime, oral - DailyMed section 2.3 renal impairment table. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=3194433c-c04e-442b-9668-fbeb0a15bac7
15. Cefprozil, oral - DailyMed renal impairment table. Source: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=6133611e-19c1-4df2-8c23-8573aaf63020
16. Cefotetan, IV/IM - DailyMed impaired renal function dosage guidelines. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=33b13b93-58ce-44c7-b9a2-af3b3a333f80
17. Ceftolozane and tazobactam, IV - DailyMed section 2.3 adult renal impairment table. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=70ac1d90-eff3-4f0b-9f46-5846c571b32f
18. Ceftazidime and avibactam, IV - DailyMed section 2.3 adult renal impairment Table 3. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d9c2803f-dc9c-4b19-b4a3-8303bc8c15fd
19. Cefiderocol, IV - DailyMed sections 2.1 and 2.2 dosage adjustment tables. Source: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=75c0c785-38e0-4049-a6fb-b77581f5b35c
20. Aztreonam, IV/IM - DailyMed adult renal impairment statement. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9a105eaf-ee77-4016-beeb-d425a5565db2
21. Meropenem, IV - DailyMed section 2.2 adult renal impairment table. Source: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=185181e3-c004-4d61-b992-5df94fe57a90
22. Imipenem and cilastatin, IV - DailyMed section 2.3 adult renal impairment table. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f41d8abd-7792-4918-1b93-bd83ea01955e
23. Ertapenem, IV/IM - DailyMed sections 2.4 and 2.5 renal impairment/hemodialysis statements. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a400707f-763f-43f6-989e-0d2569d822d8
24. Piperacillin and tazobactam, IV - DailyMed section 2.3 adult renal impairment table. Source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9b682c66-61c6-4ade-baf4-9d68911a16b8

## Needs Manual Review

- Ampicillin: renal adjustment language was not added because I did not find a current DailyMed adult CrCl-banded table during this pass.
- Doripenem: a renal dosing table was found in non-DailyMed mirrors, but I did not add it because this curation pass is limited to DailyMed FDA label sources and I did not locate a current DailyMed page quickly enough.
- Cefoxitin: DailyMed renal impairment text and a table reference were found, but the exact maintenance table values were not captured cleanly enough from the label page in this pass.
- Nafcillin/oxacillin/dicloxacillin: possible no-adjustment or renal/hepatic statements need direct label confirmation before JS inclusion.
- Penicillin G formulations: likely formulation-specific renal language; needs separate review to avoid mixing potassium/sodium/procaine/benzathine products.
- Ceftibuten, cefaclor, cefadroxil, ceftizoxime, cefoperazone, and related older cephalosporins: not reviewed in this pass.
- Meropenem-vaborbactam, imipenem-cilastatin-relebactam, sulopenem, and other newer beta-lactam combinations: not reviewed in this pass.

## Curation Caveats

- All records are `confidence: "draft-source-extracted"` and must not be treated as verified prescribing recommendations.
- Several labels use GFR, CLcr, or CrCl wording. The JS field names remain generic ranges; a future schema should capture renal function type and body-surface-area normalization.
- Dialysis rows, post-hemodialysis supplemental doses, CRRT tables, and loading-dose instructions are captured in variants where the DailyMed label gives a concrete adult regimen; the current schema still cannot select dialysis status independently from CrCl.
- Some labels provide multiple indication-specific regimens. The JS preserves those as `variants`, but clinical selection by indication is still outside the current rule schema.

## Remediation on 2026-05-06

Updated all beta-lactam records flagged in `verification-antiinfectives.md` without removing any drugs:

- Added or surfaced DailyMed hemodialysis/CAPD/peritoneal dialysis language for amoxicillin, amoxicillin/clavulanate, cefuroxime injection, cefepime, ceftazidime, cefdinir, cefpodoxime, cefotetan, ceftolozane/tazobactam, ceftazidime/avibactam, and piperacillin/tazobactam.
- Qualified non-dialysis CrCl bands where the label separates dialysis rows, especially cefepime, ceftazidime, cefdinir, cefpodoxime, cefotetan, and piperacillin/tazobactam.
- Added conservative manual-review variants where no clean non-dialysis adult DailyMed row exists in the represented band: ceftolozane/tazobactam for CrCl `<15` not on hemodialysis.
- Remaining schema limitation: dialysis modality, post-HD timing, loading-dose state, and indication selection are still free-text `condition` values, not first-class matching inputs.
