# Live Browser QA - 20 Drug Renal Dosing Test

Date: 2026-05-08  
Environment: Cloudflare Pages live app  
URL tested: https://renal-dose-calculator.pages.dev/?codex=qa-20  
Tester: Codex Browser Use plugin  
Scope: 20 different drugs with 20 different adult parameter combinations.

## Summary

- Total cases tested: 20
- Clean/usable output: 12
- Warning/review output: 8
- Complete UI/API failures: 0

The app is working better than before because drugs are no longer universally showing "drug label not found". However, the test found important quality issues in renal-band matching, eGFR-vs-CrCl validation, and clean display formatting.

## Test Cases

| # | Drug | Approx CrCl | Dose Guidance Result | Source Mode | QA Status | Notes |
|---|---:|---:|---|---|---|---|
| 1 | piptaz | 44.0 | 3.375 g or 4.5 g every 6 hours | DailyMed table parser | Pass | Clean output. |
| 2 | meropenem | 25.9 | Review DailyMed source | AI assisted | Warn | AI selected 26 to 50 mL/min band, but calculated CrCl was 25.9. Need decide rounding policy or parser improvement. |
| 3 | cefepime | 33.3 | 500 mg every 24 hours | AI assisted | Pass | Clean enough output. |
| 4 | levofloxacin | 23.0 | 750 mg every 48 hours | AI assisted | Pass | Clean enough output. |
| 5 | acyclovir | 27.8 | 800 mg every 4 hours, 5 times daily | AI assisted | Pass | Clean but indication-specific dosing may need selector later. |
| 6 | fluconazole | 31.0 | Review DailyMed source | DailyMed table parser | Warn | Parser found percent-based renal adjustment, but UI did not present it cleanly. |
| 7 | gabapentin | 35.5 | 400 to 1400 mg/day | DailyMed table parser | Pass | Output works but frequency line is long and should be formatted better. |
| 8 | doxycycline | 54.6 | Review DailyMed source | AI assisted | Warn | Should likely show a clean "no renal adjustment found/needed in label" style card instead of generic review. |
| 9 | ciprofloxacin | 32.4 | 250-500 mg every 12 hours | AI assisted | Pass | Output is usable, but source text may include dialysis details in same line. Needs cleaner parsing. |
| 10 | famotidine | 19.7 | 20 mg once daily or 40 mg every other day | AI assisted | Pass | Clean enough output. |
| 11 | oseltamivir | 20.5 | 30 mg once daily for 5 days | AI assisted | Pass | Clean output. Indication/treatment-vs-prophylaxis selector needed later. |
| 12 | valacyclovir | 21.3 | Review DailyMed source | AI assisted | Warn | AI selected 30 to 49 mL/min band, but calculated CrCl was 21.3. Need structured renal table support. |
| 13 | enoxaparin | 32.5 | 30 mg once daily | AI assisted | Issue | Browser harness marked pass, but renal band shown was less than 30 while CrCl was 32.5. Validator needs tightening or metric handling review. |
| 14 | dabigatran | 26.0 | 75 mg twice daily | AI assisted | Pass | Clean output. High-risk drug; indication selector needed. |
| 15 | rivaroxaban | 50.7 | 20 mg once daily | DailyMed table parser | Pass | Dose is clean, but frequency includes awkward extra text: "Take with evening meal CrCl". Needs text cleanup. |
| 16 | apixaban | 21.5 | 2.5 mg twice daily | AI assisted | Issue | Band displayed serum creatinine criterion instead of CrCl/eGFR band. Apixaban needs age/weight/SCr-specific logic. |
| 17 | metformin | 59.0 | Review DailyMed source | AI assisted | Warn | Drug uses eGFR thresholds, but validation appears to compare against CrCl. Need eGFR-aware validation. |
| 18 | sitagliptin | 26.1 | Review DailyMed source | AI assisted | Warn | Drug uses eGFR thresholds, but validation appears to compare against CrCl. Need eGFR-aware validation. |
| 19 | vancomycin | 40.2 | Review DailyMed source | AI assisted | Warn | Acceptable to avoid fake dose, but card should explain monitoring/AUC-based dosing rather than generic failure. |
| 20 | nitrofurantoin | 26.4 | Review DailyMed source | AI assisted | Warn | Should show a clean avoid/contraindication-style result when supported by label text. |

## Main Issues Found

1. Renal band mismatch must be stricter and visible.
   - Enoxaparin showed a less-than-30 band despite CrCl being 32.5.
   - Meropenem and valacyclovir were rejected correctly, but the user experience is poor because the app shows generic review instead of explaining the mismatch.

2. The validator needs renal metric awareness.
   - Metformin and sitagliptin use eGFR-based labeling, but current validation appears centered on CrCl.
   - Fix needed: if model/parser returns `renalMetricUsed: egfr`, validate band against eGFR, not CrCl.

3. Some drugs need structured indication/product selectors.
   - Acyclovir, valacyclovir, oseltamivir, rivaroxaban, dabigatran, apixaban, enoxaparin, and vancomycin have dosing that changes by indication or monitoring strategy.

4. Percent-based renal adjustments need better UI.
   - Fluconazole parser found the right style of adjustment but the UI still showed review instead of a clean "50% usual dose after loading dose" card.

5. "No renal adjustment" needs a clean card.
   - Doxycycline should not look like a failure if the label supports no important renal adjustment.

6. High-risk drugs need special display modes.
   - Vancomycin should show monitoring-based guidance.
   - Apixaban should show criteria-based guidance.
   - Enoxaparin and DOACs should not collapse into one generic renal-dose line.

7. Text cleanup is still needed.
   - Rivaroxaban frequency included extra source-table text.
   - Gabapentin frequency is too long and should be displayed as dose range plus regimen options.

## Priority Fix List

1. Add metric-aware validation: CrCl bands compare with CrCl, eGFR bands compare with eGFR.
2. Tighten mismatch detection and make mismatch warnings user-readable.
3. Improve deterministic parsers for fluconazole, meropenem, valacyclovir, nitrofurantoin, and no-adjustment drugs.
4. Add special clean display templates for vancomycin, apixaban, enoxaparin, and DOACs.
5. Clean long frequency/recommendation wrapping in the dose card.
6. Re-run the same 20-drug browser QA after fixes and compare pass/warn/issue counts.
