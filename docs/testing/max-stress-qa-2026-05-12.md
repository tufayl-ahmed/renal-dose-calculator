# Max-Stress QA And Fix Report - Renal Dose Calculator

Date: 2026-05-12  
Target app: https://renal-dose-calculator.pages.dev  
Initial commit tested: `50d581aff29baa29ef2852353034503526b992e0` on `main`  
Post-fix verification: 2026-05-12 working tree, deployed to Cloudflare Pages  
Environment: macOS 25.4 arm64, Node `v24.11.1`, npm `11.6.2`  
Repo: https://github.com/tufayl-ahmed/renal-dose-calculator

## Executive Summary

The core renal calculator is solid. Unit tests passed, gitleaks found no secrets, npm audit found no production vulnerabilities, and the CKD-EPI 2021 plus Cockcroft-Gault outputs matched the MDCalc reference set exactly for 100 cases.

The first max-stress run found no renal formula failure and no reproducible wrong-route dosing failure, but it did uncover dose-guidance quality issues for Topotecan, Daptomycin, broad autocomplete candidates, and transient live API 503s. Those concrete issues were fixed and retested.

- No P0 renal calculation or wrong-route dose failures were found.
- Topotecan severe renal impairment now returns `review_source` / renal dosing not established instead of a clean fake dose.
- Daptomycin now shows separate clean cSSSI and S. aureus bloodstream infection rows.
- Autocomplete now filters non-systemic label noise while preserving free-text search.
- Frontend, backend label fetches, and QA scripts now retry transient 408/425/429/5xx responses.

## Post-Fix Verification

| Track | Command / method | Result |
|---|---|---|
| Unit tests | `npm test` | Passed: 135/135 |
| Live common drug QA | `npm run qa:live200` | 180 pass, 13 review, 7 warn, 0 issue |
| Autocomplete stress | `npm run qa:autocomplete200` | 192 pass, 6 review, 2 warn, 0 issue |
| DailyMed route validation | `npm run validation:dailymed:routes` | 71 pass, 29 source review, 0 issue, 0 warning |
| Focused live smoke | Daptomycin, Topotecan, Lorlatinib, Meropenem route-unavailable | All expected source-review or route-safe states |
| Deployment | `npm run deploy` | Deployed to Cloudflare Pages preview and production project |

## Commands And Tracks Run

| Track | Command / method | Result |
|---|---|---|
| Unit tests | `npm test` | Passed: 132/132 initially; 135/135 after fixes |
| Audit | `npm audit --omit=dev` | 0 vulnerabilities |
| Secret scan | `gitleaks detect --source . --redact --no-banner --exit-code 1` | No leaks found |
| Repo metadata | `gh repo view ...` | Public repo, MIT license, homepage set |
| Formula reference | `npm run validation:renal:mdcalc` | 100/100 eGFR and CrCl exact matches |
| Independent formula sweep | Boundary sweep across age, sex, SCr, weight | 1,386/1,386 passed |
| Live common drug QA | `npm run qa:live200` | Initially 181 pass, 11 review, 6 warn, 2 issue; post-fix 0 issue |
| Autocomplete stress | `node scripts/qa-live-200.mjs --source=autocomplete --route-mode=ivoral --limit=1000 --concurrency=2` then `npm run qa:autocomplete200` | Broad raw-list run exposed noise; post-filter 200-case run: 0 issue |
| DailyMed route validation | `npm run validation:dailymed:routes` | Initially 64 pass, 27 source review, 9 transient 503 dose_fail; post-fix 0 issue |
| Renal band boundary live QA | Generated 107 cutoff cases | 90 pass, 13 review/warn, 4 issue |
| Browser UI smoke | Codex in-app Browser on local app | Quick input, autocomplete, route toggle, CKD bar, sticky result bar worked |
| PWA/security headers | live `curl` plus file checks | Manifest, SW, CSP, permissions policy present |
| Telegram/WhatsApp surfaces | unit tests plus live health endpoints | Telegram health 200; WhatsApp verify rejects wrong token with 403 |

Raw generated reports are under `docs/testing/generated/` and are intentionally ignored.

## Initial Severity-Ranked Findings

| Severity | Area | Finding | Evidence | Recommended Fix |
|---|---|---|---|---|
| P0 | Renal formula | No P0 issues found. | MDCalc 100/100 exact, independent 1,386-case sweep passed. | Keep current formula tests in CI. |
| P0 | Route safety | No reproducible wrong-route dose display found. | Route-specific validation selected 50 oral and 50 IV labels; no wrong-route dose surfaced. | Keep route filtering strict. |
| P1 | Dose clarity | Daptomycin IV can merge indication-specific dose options into one line. | Slow retry for Daptomycin IV CrCl 39.8 returned `dose: 4 mg/kg once`, `frequency: every 24 hours 6 mg/kg once every 24 hours`. | Add indication/product split formatting for Daptomycin: show cSSSI and bacteremia/endocarditis rows separately. |
| P1 | Dose action state | Topotecan severe renal impairment is returned as `dose_found` with "No recommended dose." | Live200 cases #155/#156 and boundary cases #73/#74/#82/#83. | Convert "No recommended dose" to an avoid/not-established card, not a dose_found card. |
| P2 | Reliability | Live API returned transient 503 under sustained stress. | 72/1000 autocomplete run and 9/100 route run. Slow retry recovered the route-validation failures. | Add client retry/backoff for 503, server-side cache warming, and clearer "temporary service busy" UI. |
| P2 | Autocomplete quality | Drug list is too broad and contains route-irrelevant or poor renal-dose candidates. | Examples: gases, diagnostics, allergen extracts, topical products, vitamins/minerals, malformed names, brand-only entries. | Filter autocomplete to adult human systemic oral/IV prescription candidates, with brand-to-generic normalization. |
| P2 | Source review burden | Many route-valid cases still need manual source review despite renal text being present. | DailyMed route validation: 27/100 source_review; 20 were "renal source text present but no-adjustment summary needs manual review." | Expand deterministic parser patterns for "no adjustment", restrictions, dialysis, and indication-specific tables. |
| P2 | Test harness | Existing route validation summary records transient 503 as dose_fail. | `docs/clinical-validation/dailymed-route-dose-validation.md` was regenerated during stress. | Add automatic retry and classify recovered 503 separately from app logic failures. |
| P3 | Browser QA limitation | Codex in-app Browser could not open the live external URL, but local browser smoke succeeded and shell live checks succeeded. | Browser showed network failure for live URL; local `127.0.0.1:5173` rendered and tested. | Retest live layout in a normal browser before release. |
| P3 | Mobile verification | Mobile layout was not fully screenshot-tested in this pass. | Responsive CSS media queries exist; no viewport-control capability was available in the in-app Browser session. | Add Playwright/Chromium visual smoke tests for 390px and 430px viewports. |

## Calculation Accuracy

The calculator is behaving correctly for the renal equations.

- MDCalc reference script: `egfrExactMatches: 100`, `crclExactMatches: 100`.
- Display comparison tolerance: maximum display diff was `0.5`, consistent with rounding.
- Independent boundary sweep: `1,386` combinations, `0` failures.
- Boundary coverage included age 18 and 95, male/female, SCr 0.5 to 6 mg/dL, and weight 40 to 160 kg.

## Dose Guidance Results

### Common 200 Live API

- Total: 200
- Pass: 181
- Review: 11
- Warn: 6
- Issue: 2

Issue cases:

- Topotecan injection IV: unresolved recommended-dose phrase exposed.
- Topotecan capsules oral: unresolved recommended-dose phrase exposed.

Notable review cases that are acceptable safety behavior for now:

- Vancomycin IV: review/source based, not fake CrCl dose.
- Apixaban/rivaroxaban/dabigatran/enoxaparin: source review due indication/label complexity.
- Acyclovir/valacyclovir: source review due route/dialysis complexity.

### 1000 Autocomplete Stress

- Total: 1000
- Pass: 479
- Review: 11
- Warn: 14
- Issue-like outcomes: 496
- Route-not-found: 423
- HTTP 503: 72
- True non-route/non-503 not-found example: `Iopidine 1`

Interpretation: this is not 496 clinical app bugs. The run deliberately alternated oral and IV against a broad autocomplete list. It exposed that route-unavailable handling works, but the autocomplete list should be filtered and normalized before production promotion.

### DailyMed Route-Specific Validation

- Total eligible source-matched cases: 100
- Oral: 50
- IV: 50
- Pass: 64
- Source review: 27
- Dose fail during first run: 9, all due HTTP 503

Slow retry recovered the 503 route-validation failures:

- Bumetanide oral: recovered, dose_found
- Canagliflozin oral: recovered, dose_found
- Digoxin oral: recovered, review_source
- Aztreonam IV: recovered, no_renal_adjustment
- Miglustat oral: recovered, dose_found
- Methotrexate oral: recovered, dose_found
- Fosaprepitant IV: recovered, no_renal_adjustment
- Acitretin oral: recovered, dose_found
- Daptomycin IV: recovered, dose_found, but needs cleaner indication split

### Renal Band Boundary QA

- Total: 107
- Pass: 90
- Warn/source review: 13
- Issue: 4

Stable across cutoffs:

- Meropenem IV
- Piperacillin/tazobactam IV
- Cefepime IV
- Metformin oral eGFR bands
- Doxycycline oral

Expected review states:

- Vancomycin IV remained monitoring/source-review based.
- Levofloxacin at CrCl <10 returned source review for dialysis-specific complexity.
- Gabapentin at very low CrCl returned source review instead of unsupported AI output.

Issue states:

- Topotecan IV/oral at CrCl 8 and 10 returned "No recommended dose" as `dose_found`.

## Browser, UI, And PWA Notes

Local in-app Browser smoke passed:

- Quick input parsed `65 female creat 1.8 weight 70 cefixime oral`.
- Fields filled correctly: age, female, SCr, weight, drug, oral route.
- CKD stage visual bar highlighted G3b.
- CrCl note showed weight basis: actual body weight.
- Drug autocomplete opened for `met` and listed suggestions.
- Route segmented control switched from oral to IV.
- Sticky result bar and desktop layout rendered without obvious overlap in the tested viewport.

Live shell checks passed:

- Home page: HTTP 200, `text/html`, 21,162 bytes.
- Manifest: HTTP 200, `application/manifest+json`.
- Service worker: HTTP 200, `application/javascript`.
- PWA icons exist: 192 and 512 PNGs.
- Service worker app shell list has no missing local files.

Security headers observed live:

- `Content-Security-Policy`
- `Permissions-Policy`
- `Referrer-Policy`
- `X-Content-Type-Options: nosniff`

## Integration Notes

Telegram:

- Unit tests passed.
- Live health endpoint returned 200 with Mini App launcher metadata.
- Webhook message logic is covered in tests.

WhatsApp:

- Unit tests passed for verification, parsing, formatting, signature handling, duplicate skipping, and reply send path.
- Live GET with no/wrong verify token returned 403, which is correct.
- Live delivery was not re-tested because Meta account/business restrictions can block production delivery.

## Security And Deployment Hygiene

Public repo check:

- Visibility: public
- License: MIT
- Homepage: `https://renal-dose-calculator.pages.dev`
- Description set

Secret checks:

- Gitleaks found no leaks.
- Text search found only secret variable names in docs, tests, and `.env.example`, not secret values.
- `.env.example` contains blank placeholders only.

Deployment headers and PWA assets are present. No production dependency audit issues were found.

## Priority Fix Status

1. Done: Daptomycin formatting now splits cSSSI and S. aureus bloodstream infection regimens.
2. Done: Topotecan severe renal impairment is now renal dosing not established / source review, not `dose_found`.
3. Done: Retry/backoff added for frontend dose lookup, backend openFDA label fetches, and validation scripts.
4. Done: Autocomplete now filters non-systemic DailyMed/openFDA noise while keeping free-text entry available.
5. Ongoing: Deterministic parsers still need expansion for more "no adjustment", "avoid/restrict", and complex renal table patterns.
6. Done: Route-validation retry layer added, and the regenerated summary no longer records transient 503 failures as dose failures.
7. Remaining: Add Playwright visual tests for desktop, 760px, 430px, and 390px.
8. Remaining: Add a lightweight API health/status card or explicit "service busy, retrying" UI if live 5xxs recur.

## Retest Checklist

- Run `npm test`.
- Run `npm audit --omit=dev`.
- Run `gitleaks detect --source . --redact --no-banner --exit-code 1`.
- Run `npm run validation:renal:mdcalc`.
- Run targeted boundary QA for Meropenem, Piptaz, Cefepime, Levofloxacin, Gabapentin, Vancomycin, Topotecan, Metformin, Doxycycline.
- Run route-specific DailyMed validation with retry enabled.
- Run autocomplete stress after systemic-drug filtering.
- Browser smoke test desktop and mobile.
- Verify live PWA installability and offline shell.
- Verify Telegram health and webhook message test.
- Verify WhatsApp webhook locally; live only after Meta restrictions are settled.
