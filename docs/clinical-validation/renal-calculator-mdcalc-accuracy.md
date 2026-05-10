# Renal Calculator Accuracy Validation Against MDCalc

Generated: 2026-05-10

## Scope

This audit validates only the arithmetic layer of the app:

- CKD-EPI 2021 creatinine eGFR
- Cockcroft-Gault creatinine clearance using actual body weight

It does not validate drug-dose interpretation, DailyMed parsing, dialysis dosing, body-weight selection policy for obesity or low body weight, pediatric use, or prescribing decisions.

## Method

I generated 100 deterministic synthetic adult cases using:

- Age in years
- Sex as male/female
- Serum creatinine in mg/dL
- Weight in kg

Height was intentionally omitted because the requested comparison fields did not include height and the app's current Cockcroft-Gault value uses actual body weight.

Each case was calculated three ways:

1. The app's exported calculation functions in `src/renal.js`
2. Independent local reference equations rounded to one decimal
3. MDCalc's live web calculator endpoint for:
   - CKD-EPI Equations for Glomerular Filtration Rate (GFR), calculator 3939: https://www.mdcalc.com/calc/3939/ckd-epi-equations-glomerular-filtration-rate-gfr
   - Creatinine Clearance (Cockcroft-Gault Equation), calculator 43: https://www.mdcalc.com/calc/43/creatinine-clearance-cockcroft-gault-equation

MDCalc displays whole-number results. The app displays one decimal, so MDCalc comparison used a display-rounding tolerance of +/-0.55.

## Result

| Check | Result |
|---|---:|
| CKD-EPI exact formula matches | 100/100 |
| Cockcroft-Gault exact formula matches | 100/100 |
| CKD-EPI matches MDCalc displayed result | 100/100 |
| Cockcroft-Gault matches MDCalc displayed result | 100/100 |
| Rows needing review | 0 |
| Max CKD-EPI exact-formula difference | 0 |
| Max Cockcroft-Gault exact-formula difference | 0 |
| Max CKD-EPI displayed MDCalc difference | 0.5 |
| Max Cockcroft-Gault displayed MDCalc difference | 0.5 |

## Conclusion

The app's eGFR and CrCl arithmetic matched the independent formula implementation exactly in all 100 generated cases. MDCalc's displayed values also matched in all 100 cases after accounting for whole-number display rounding.

No calculation-code change is needed from this validation pass.

## Reproducibility

Run:

```sh
npm run validation:renal:mdcalc
```

The full case table and JSON output are generated under:

```text
docs/testing/generated/renal-mdcalc-validation-latest.md
docs/testing/generated/renal-mdcalc-validation-latest.json
```

That folder is intentionally git-ignored because the QA artifacts can become large.
