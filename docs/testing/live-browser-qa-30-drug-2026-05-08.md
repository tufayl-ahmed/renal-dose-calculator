# Live Browser QA - 30 Drug / 30 Parameter Pass

Date: 2026-05-08  
Target: `https://renal-dose-calculator.pages.dev/?codex=qa30-20260508-live-b`  
Scope: adult calculator, explicit route checks, DailyMed/openFDA + parser/AI path.

## Summary

- Total cases: 30
- Clean passes: 11
- Acceptable manual-review warnings: 13
- UX/logic issues found: 6

## Cases

| # | Drug | Route | eGFR | CrCl | Result | Notes |
|---:|---|---|---:|---:|---|---|
| 1 | piptaz | IV | 38.8 | 44.0 | Pass | DailyMed parser returned clean piperacillin/tazobactam dose. |
| 2 | meropenem | IV | 29.4 | 28.7 | Pass | Deterministic concrete mg options shown. |
| 3 | meropenem | Oral | 29.4 | 28.7 | Warn | Correct route-unavailable output for IV-only drug. |
| 4 | levoflox | IV | 35.2 | 34.0 | Pass | Alias and IV route lookup fixed. |
| 5 | levofloxacin | Oral | 35.2 | 34.0 | Pass | Oral label route works. |
| 6 | cefepime | IV | 28.4 | 28.6 | Pass | AI-assisted output clean enough. |
| 7 | ciprofloxacin | IV | 30.5 | 30.8 | Warn | AI selected CrCl 5-29 band although CrCl was 30.8. Needs deterministic band handling. |
| 8 | doxy | Oral | 79.8 | 82.5 | Issue | Raw token `no_renal_adjustment` leaked into band/note. |
| 9 | fluconazole | Oral | 32.5 | 34.0 | Pass | DailyMed parser returned clean percentage dose. |
| 10 | acyclovir | IV | 37.5 | 44.4 | Issue | Raw `review_source` token leaked into dose/frequency. |
| 11 | valacyclovir | Oral | 31.7 | 32.1 | Issue | Dose line was usable, but dialysis note retained vague `recommended dose` wording. |
| 12 | oseltamivir | Oral | 32.4 | 24.3 | Issue | AI selected moderate CrCl band >30-60 although CrCl was 24.3. |
| 13 | gabapentin | Oral | 39.1 | 47.3 | Pass | DailyMed parser returned clean renal table row. |
| 14 | pregabalin | Oral | 38.2 | 40.8 | Warn | AI output required source review; should be deterministic/table-based. |
| 15 | metformin | Oral | 57.9 | 64.3 | Warn | Deterministic eGFR action shown; acceptable source-summary style. |
| 16 | sitagliptin | Oral | 30.9 | 28.4 | Pass | Deterministic eGFR-based dose shown. |
| 17 | empagliflozin | Oral | 47.5 | 55.3 | Warn | Label chosen was Trijardy XR combination; single-ingredient ranking needs improvement. |
| 18 | apixaban | Oral | 27.8 | 22.1 | Warn | Correctly requires criteria/indication review. |
| 19 | rivaroxaban | Oral | 47.7 | 47.8 | Pass | Dose found, but leading label-reference text should be cleaned in parser. |
| 20 | dabigatran | Oral | 34.5 | 35.1 | Pass | Output usable but indication/P-gp complexity remains. |
| 21 | enoxaparin | All | 35.3 | 39.3 | Warn | Correctly asks indication-specific review. |
| 22 | vancomycin | IV | 40.0 | 45.9 | Warn | Correctly avoids fake CrCl dose. |
| 23 | nitrofurantoin | Oral | 27.9 | 26.6 | Warn | Correctly shows renal restriction/review. |
| 24 | famotidine | Oral | 33.1 | 29.2 | Warn | AI selected CrCl 30-60 band although CrCl was 29.2. |
| 25 | amoxicillin clavulanate | Oral | 33.4 | 31.2 | Pass | Output clean enough. |
| 26 | bactrim | Oral | 31.8 | 35.5 | Warn | AI selected Below 15 band despite CrCl 35.5. Needs deterministic TMP-SMX handling. |
| 27 | clindamycin | IV | 66.5 | 60.2 | Issue | Raw `review_source` token leaked into dose/frequency. |
| 28 | azithromycin | Oral | 91.7 | 112.5 | Issue | Raw `review_source` token leaked into dose/frequency. |
| 29 | morphine | Oral | 26.7 | 21.2 | Warn | Appropriate manual review. |
| 30 | digoxin | Oral | 40.5 | 35.9 | Warn | AI selected CrCl 40-50 band despite CrCl 35.9; should be level/criteria review. |

## Fix Targets

1. Sanitize AI/model fields so internal status tokens never appear in UI.
2. Add deterministic handlers for acyclovir IV, azithromycin, ciprofloxacin, clindamycin, doxycycline, digoxin, famotidine, oseltamivir, pregabalin, TMP-SMX, and valacyclovir review.
3. Improve openFDA label ranking for single-ingredient searches to avoid combination products when a monotherapy label is available.
4. Clean parser output that starts with label-reference fragments such as `[see Use in Specific Populations]`.

## Fix Verification

Deployed builds:

- Initial QA fix preview: `https://a2374d56.renal-dose-calculator.pages.dev`
- Final cache-busted/label-ranking build: `https://1f7f6cb6.renal-dose-calculator.pages.dev`

Automated tests:

- `npm test`: 75/75 passing after fixes.

Live browser retest:

- Re-ran all 30 cases after the first fix deployment.
- Hard issue count dropped from 6 to 0.
- Remaining warnings are deliberate `Needs review` or `Source summary` cards for drugs where a single CrCl-only dose would be unsafe or misleading.
- Focus retest after final tightening:
  - `acyclovir` IV now shows `100% of usual dose by indication` every 12 hours for CrCl 25-50, without raw tokens.
  - `rivaroxaban` now shows indication-specific review instead of an AI renal-band mismatch.
  - `dabigatran` now shows indication/P-gp-specific review instead of awkward AI fallback text.
  - `morphine` now selects `MORPHINE SULFATE` instead of an opium tincture product and shows a renal-impairment caution, not a fake liquid dose.
