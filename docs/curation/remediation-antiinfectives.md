# Antiinfectives Remediation Note

Date: 2026-05-06  
Worker: Remediation Worker R1  
Scope: flagged antiinfective records from `docs/curation/verification-antiinfectives.md`.

## Records Remediated

Beta-lactams: amoxicillin; amoxicillin/clavulanate; cefuroxime injection; cefepime; ceftazidime; cefdinir; cefpodoxime; cefotetan; ceftolozane/tazobactam; ceftazidime/avibactam; piperacillin/tazobactam.

Non-beta antiinfectives: ciprofloxacin; levofloxacin; clarithromycin extended-release; fosfomycin disodium; valacyclovir; famciclovir; oseltamivir.

## Still Requiring Manual Clinical Review

- Ceftolozane/tazobactam: CrCl `<15` not on hemodialysis is retained as a manual-review variant because the represented DailyMed adult row is ESRD on hemodialysis.
- Levofloxacin: CrCl `<10` not on HD/CAPD is retained as a manual-review variant because the cited table gives dialysis-specific dosing at that level.
- Fosfomycin disodium: CLcr `<=10` is retained as a manual-review variant because the CONTEPO label provides rows down to 11-20 mL/min and separate HD timing, but no clean maintenance dose for <=10.

## Schema Limitation

The renal rule schema has only CrCl/GFR numeric bands and text variants. It cannot independently match hemodialysis, CAPD, ESRD-not-on-dialysis, post-HD supplement timing, loading-dose state, or formulation. These were encoded conservatively in `condition`, `dose`, and `interval` text while keeping all records `confidence: "draft-source-extracted"`.
