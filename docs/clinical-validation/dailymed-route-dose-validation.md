# DailyMed Route-Specific Dose Guidance Validation

Generated: 2026-05-12

Target web app: https://renal-dose-calculator.pages.dev

Cases: 100 synthetic adult drug-route-patient sets.

Units: age in years, sex male/female, serum creatinine mg/dL, weight kg. Routes were restricted to IV or Oral only; no `All routes` cases were used.

## Source Basis

- App output came from the web app backend: `POST /api/renal-dose/assist`.
- Route/form and label evidence came from openFDA label data and DailyMed label links.
- Each case required route-specific DailyMed/openFDA evidence for the requested route before it entered the 100-case sample.

## Summary

### Verdicts

- pass: 71
- source_review: 29

### Routes

- ORAL: 50
- IV: 50

### Source modes

- dailymed-table-parser: 79
- dailymed-special-review: 17
- cloudflare-ai-small-model: 4

### Source support

- renal-action-supported-by-renal-source-text: 26
- no-renal-text-in-label-sections: 25
- renal-text-no-adjustment-review: 21
- dose-frequency-tokens-found-in-source: 7
- source-no-adjustment-text: 7
- deterministic-table-supported: 6
- source-review-returned: 4
- needs-source-review: 3
- renal-table-no-adjustment-review: 1

## Interpretation

- `pass`: drug and IV/Oral route were found in DailyMed/openFDA evidence, and the app result was supported by source text or deterministic table parsing.
- `source_review`: drug and route matched, but the label text or app output needs manual clinical review before calling it source-verified.
- `route_fail`: the matched source did not confirm the requested IV/Oral route/form.
- `label_fail`: no reliable matching DailyMed/openFDA label was found.
- `dose_fail`: a route-matched source was found, but the app dose/action conflicted with or was not supported by the source.

## Non-Pass Cases

- #3 Choline IV, CrCl 10.6: source_review - renal source text present but no-adjustment summary needs manual review
- #12 Piperacillin IV, CrCl 13.7: source_review - app asked user to review DailyMed source
- #14 Pancrelipase Amylase ORAL, CrCl 45.8: source_review - renal source text present but no-adjustment summary needs manual review
- #15 Methimazole ORAL, CrCl 9.8: source_review - renal source text present but no-adjustment summary needs manual review
- #20 Levocarnitine ORAL, CrCl 6.4: source_review - renal source text present but no-adjustment summary needs manual review
- #26 Dextrose IV, CrCl 50.5: source_review - renal source text present but no-adjustment summary needs manual review
- #29 Rifadin IV, CrCl 132.5: source_review - renal source text present but no-adjustment summary needs manual review
- #32 Anastrozole ORAL, CrCl 15.8: source_review - renal source text present but no-adjustment summary needs manual review
- #33 Penicillin IV, CrCl 113.4: source_review - app asked user to review DailyMed source
- #37 Clotrimazole ORAL, CrCl 82: source_review - renal source text present but no-adjustment summary needs manual review
- #42 Pantoprazole Sodium I IV, CrCl 69.5: source_review - renal source text present but no-adjustment summary needs manual review
- #44 Trazodone ORAL, CrCl 33.8: source_review - renal source text present but no-adjustment summary needs manual review
- #47 Alunbrig ORAL, CrCl 16.8: source_review - renal action returned but source text lacks renal wording
- #49 Hydralazine IV, CrCl 162.5: source_review - renal source text present but no-adjustment summary needs manual review
- #53 Lidocaine and Dextrose IV, CrCl 99.4: source_review - renal source text present but no-adjustment summary needs manual review
- #55 Digoxin ORAL, CrCl 45.2: source_review - app asked user to review DailyMed source
- #63 Roctavian IV, CrCl 14.9: source_review - renal source text present but no-adjustment summary needs manual review
- #64 Albumin Human IV, CrCl 12.8: source_review - renal source text present but no-adjustment summary needs manual review
- #65 Carbamazepine ORAL, CrCl 153: source_review - renal source text present but no-adjustment summary needs manual review
- #66 Aztreonam IV, CrCl 93.8: source_review - renal source text present but no-adjustment summary needs manual review
- #73 Saxagliptin ORAL, CrCl 124.5: source_review - renal source text present but no-adjustment summary needs manual review
- #76 Pertuzumab IV, CrCl 11.3: source_review - app asked user to review DailyMed source; app caution says the summary could not be fully verified against source text
- #77 Ciprofloxacin ORAL, CrCl 75.7: source_review - renal table-like source text present; no-adjustment summary needs manual review
- #79 Coreg ORAL, CrCl 11: source_review - renal source text present but no-adjustment summary needs manual review
- #81 Leucovorin IV, CrCl 176: source_review - renal source text present but no-adjustment summary needs manual review
- #87 Emtricitabine and Tenofovir Disoproxil ORAL, CrCl 19.6: source_review - dose/frequency tokens not sufficiently found in source (0/4)
- #88 Retifanlimab Dlwr IV, CrCl 20.1: source_review - renal source text present but no-adjustment summary needs manual review
- #92 Brigatinib ORAL, CrCl 19.9: source_review - renal action returned but source text lacks renal wording
- #98 Levocarnitine IV, CrCl 82.3: source_review - renal source text present but no-adjustment summary needs manual review

## Issue Kinds

### Issues

- None

## Review Kinds

### Reviews

- renal source text present but no-adjustment summary needs manual review: 21
- app asked user to review DailyMed source: 4
- renal action returned but source text lacks renal wording: 2
- app caution says the summary could not be fully verified against source text: 1
- renal table-like source text present; no-adjustment summary needs manual review: 1
- dose/frequency tokens not sufficiently found in source (0/4): 1

## Reproduce

```sh
npm run validation:dailymed:routes
```

Detailed generated artifacts are written under `docs/testing/generated/`.


