# Full Autocomplete Drug QA Report

Date: 2026-05-12

## Scope

Tested all 1,884 searchable autocomplete drug names with four adult renal profiles:

| Profile | Route | Patient | Renal values |
|---|---|---|---|
| normal-adult | ORAL | 42 male, SCr 0.9 mg/dL, weight 78 kg | CrCl 118 mL/min |
| moderate-renal-iv | IV | 68 female, SCr 1.7 mg/dL, weight 64 kg | CrCl 32 mL/min |
| severe-renal-oral | ORAL | 76 male, SCr 2.8 mg/dL, weight 70 kg | CrCl 22.2 mL/min |
| very-severe-renal-iv | IV | 84 female, SCr 3.6 mg/dL, weight 52 kg | CrCl 9.5 mL/min |

Primary sweep target: `https://93fe2460.renal-dose-calculator.pages.dev`

Why this preview was used: the latest production deployment briefly returned Cloudflare `Worker exceeded resource limits` during the initial heavy run. Production later recovered, but the stable preview let the full output-quality sweep complete.

## Results

Total cases: 7,536

| Result bucket | Count | Interpretation |
|---|---:|---|
| Pass | 7,177 | Clean output or safe route-unavailable handling |
| Review | 49 | Expected clinical/source-review state |
| Warning | 192 | Possible label mismatch, AI/parser caution, or source verification caution |
| Raw issues | 118 | Includes transient HTTP 503 cases |
| Persistent content issues after retry | 21 | Non-HTTP output problems requiring fixes |

Important reliability note: 97 raw `HTTP 503` cases were retried slowly afterward, and all 97 recovered on first retry. These are infrastructure/load-pressure findings, not drug-specific output failures.

Safe route-unavailable responses: 4,009. These are expected when the selected IV/Oral route is not found and the app refuses to invent a dose.

## Persistent Issues Found In Original Sweep

| Drug | Cases | Problem |
|---|---:|---|
| Amikacin | 4 | Monitoring-based aminoglycoside guidance shown as `dose_found`; oral route also not reflected correctly |
| Tobramycin | 4 | Monitoring-based aminoglycoside guidance shown as `dose_found`; oral route also not reflected correctly |
| Aztreonam | 2 | Oral-selected cases returned non-oral route guidance |
| Gentamicin | 2 | Monitoring-based aminoglycoside guidance shown as `dose_found` |
| Plazomicin | 2 | Monitoring-based aminoglycoside guidance shown as `dose_found` |
| Sulfamethoxazole and Trimethoprim | 2 | IV-selected cases did not reflect IV route in result |
| Trimethoprim | 2 | IV-selected cases matched TMP-SMX-style guidance and did not reflect IV route |
| Cephalexin | 1 | `No dose adjustment / By indication` is too vague for `dose_found` |
| Pertuzumab | 1 | Parser returned label fragment as dose text |
| Perjeta | 1 | Parser returned label fragment as dose text |

Issue kinds:

- `vague clean dose/action displayed as dose_found`: 15
- `selected oral route not reflected in dose result`: 6
- `selected IV route not reflected in dose result`: 4

## Fix Verification

Implemented and deployed on 2026-05-12.

Production retest target: `https://renal-dose-calculator.pages.dev/api/renal-dose/assist`

Latest deployed preview after fixes: `https://4878782a.renal-dose-calculator.pages.dev`

Targeted live retest covered the 10 persistent issue drugs from the sweep, including oral and IV route variants where relevant:

| Area | Verified behavior after fix |
|---|---|
| Aminoglycosides: gentamicin, amikacin, tobramycin, plazomicin | No longer shown as clean fixed-dose `dose_found`; shown as monitoring-based `review_source` guidance |
| Oral amikacin and oral aztreonam | Return route-unavailable / no oral DailyMed label instead of borrowing IV guidance |
| Oral tobramycin inhalation label | Does not apply IV/IM aminoglycoside renal dosing to an oral/inhaled product |
| TMP-SMX IV | Result route now stays `IV` |
| Trimethoprim IV | Stays `IV` and asks to verify whether TMP-SMX was intended |
| Cephalexin | No longer returns bare `By indication`; returns renal-band-specific wording |
| Pertuzumab / Perjeta | Parser fragment is blocked; oncology label is shown as source-review, not a fake dose |

Targeted live retest result: 13/13 cases passed, 0 targeted issues.

Autocomplete cleanup also removed low-value/non-systemic suggestions that appeared during the sweep. The local autocomplete source still has 2,000 names, but searchable suggestions dropped from 1,884 to 1,808 after filtering diagnostics/tests, typo-like entries, vitamins/minerals, supplements, and homeopathic-style names.

Verification commands run after fixes:

- `npm test`: 136/136 passing
- `npm audit --omit=dev`: 0 vulnerabilities
- `gitleaks detect --source . --redact --no-banner --exit-code 1`: no leaks found

The full 7,536-case production sweep was not rerun after these fixes to avoid repeating the Cloudflare resource-limit pressure seen in the original run. A rerun can be performed with `npm run qa:autocomplete-full -- --base-url=https://renal-dose-calculator.pages.dev` when we are ready to stress production again.

## Review States

49 cases across 26 drugs were correctly pushed into clinical review rather than forced into a clean dose. Notable expected examples:

- Vancomycin
- Morphine
- Digoxin
- Rivaroxaban / Xarelto
- Apixaban / Eliquis
- Dabigatran
- Enoxaparin
- Nitrofurantoin variants
- Valacyclovir
- Levofloxacin at very low CrCl
- Topotecan at very low CrCl

This is acceptable behavior for now because these drugs need indication, monitoring, dialysis, or specialist context.

## Warning Patterns

192 warning cases affected 103 drug names. Most were not immediate dose bugs; they point to data hygiene and source matching:

- Possible label mismatches for minerals/salts/vitamins and odd label names.
- Typo-like autocomplete entries such as `Ciprofolxacin`, `Llevofloxacin`, and `Nalxone`.
- Non-clinical or low-value autocomplete names such as test products, homeopathic-style names, vitamins/minerals, and supplements.
- AI/parser cautions where the app correctly downgraded uncertain output.

## Source Modes

| Source mode | Cases |
|---|---:|
| `route-not-found` | 4,009 |
| `dailymed-table-parser` | 3,124 |
| `dailymed-special-review` | 258 |
| `cloudflare-ai-small-model` | 39 |
| `cache` | 9 |
| transient `unknown`/HTTP 503 | 97, all recovered on slow retry |

## Main Conclusions

1. The app handled most of the 7,536 test cases safely.
2. The biggest clinical output issue is aminoglycosides: monitoring-based recommendations should not appear as clean `dose_found` cards.
3. Some route-specific special handlers need stricter route checks.
4. The parser can still produce bad fragment text for some oncology/biologic labels, e.g. Pertuzumab/Perjeta.
5. Autocomplete needs another cleanup pass; 1,884 searchable names still include items that doctors should not see in a renal-dose typeahead.
6. Heavy live sweeping can trigger Cloudflare resource-limit 503s. The app needs better backend caching/indexing before broad public traffic.

## Remaining Work

1. Add stronger backend request throttling/caching and precomputed label snippets before doing repeated large public sweeps.
2. Continue shrinking the warning bucket by reviewing likely label mismatches and noisy autocomplete candidates.
3. Build drug-specific modules for monitoring-heavy drugs only when enough clinical context is captured, rather than forcing clean one-line dosing.

## Artifacts

- Full JSON: `docs/testing/generated/autocomplete-full-qa-2026-05-12T09-25-05-785Z.json`
- Full Markdown: `docs/testing/generated/autocomplete-full-qa-2026-05-12T09-25-05-785Z.md`
- HTTP 503 retry JSON: `docs/testing/generated/autocomplete-full-qa-http503-retry-2026-05-12T09-30-00-533Z.json`
- Latest aliases: `docs/testing/generated/autocomplete-full-qa-latest.json`, `docs/testing/generated/autocomplete-full-qa-http503-retry-latest.json`
