# Improvement plan

Written 2026-10-06 after a review of the whole repository and of the live
site. It is meant to be worked through by a coding agent (or a person) one
work package at a time. Each package says what to change, which files are
involved, how to prove it works, and what must not change.

## Where the project stands

- Live at https://renal-dose-calculator-3fl.pages.dev (landing `/`,
  calculator `/app/`, clinician review `/review`). Cloudflare Pages +
  Pages Functions, deployed by hand with `npm run deploy`.
- Dose pipeline (`server/renalDose/pipeline.js`): curated rules → auto-extracted
  candidates → openFDA label (special handlers, then table parser) → Workers AI
  summary (validated) → "Review source".
- Rule database: **530 curated records** (`listCuratedRecords()`), of which
  **2 are clinician-verified and 528 are drafts**; 31 auto-extracted candidates.
  The label-curated file (`src/data/renalRules/label-curated.js`, 2,707 lines,
  ~330 records) was written from FDA label text and cites a DailyMed setId per
  record.
- Coverage of the 300 most-prescribed US drugs (ClinCalc): 174/300 have a
  curated record; most of the rest are topical, inhaled, ophthalmic, vitamins,
  contraceptives or labels with no kidney text.
- Tests: 201 unit (`node --test`), 68 Playwright e2e (desktop + mobile + axe).
  CI runs lint, unit, build, e2e on Node 22. The CI deploy job exists but is
  disabled until Cloudflare secrets are added.
- Bundles: app 53 KB, autocomplete chunk 166 KB (lazy), **review page 414 KB**
  (loads the whole rule database).
- Largest files: `src/drugAutocompleteData.js` (11,943 lines),
  `server/renalDose/specialDrugs.js` (2,547 lines of per-drug handlers),
  `src/curatedDoseRules.js` (1,391), `src/llmDoseAssistCore.js` (622).

## Working conventions (keep these)

- Branch → PR → merge → `git checkout main && git pull` → confirm the merge
  commit is on main → `npm run deploy`. Run `npm run lint && npm test && npm run
  build && npx playwright test` before every PR.
- Any change to what the API returns: bump `ASSIST_CACHE_VERSION` in
  `server/renalDose/cache.js`, otherwise cached answers keep the old shape.
- Any change to results: refresh `test/fixtures/api-smoke.json.gz` with
  `node scripts/record-api-fixtures.mjs --replay` and check that only the
  intended cases changed (diff old vs new `outputs[i].response.result`).
- Any rule change: `npm run coverage:index` and `npm run rules:export`; the
  schema test fails if the coverage index is stale.
- `.env.local` holds `OPENFDA_API_KEY`; never print, log or commit it. Server
  code must read secrets only from `env`.
- Drafts stay drafts. Nothing in code may mark a record verified; only
  `scripts/import-rule-verifications.mjs` from a clinician's CSV does that.
- Keep the educational-use disclaimer on every result and the DailyMed link on
  every card. Adults only; no pediatric dosing, no drug interactions.
- Right after a deploy the live API answers "Selected drug / Review DailyMed
  source" for ~30 s. Wait for a known curated drug to answer before judging a
  deploy (see WP-3).

## Priority order

| # | Package | Value | Size |
|---|---------|-------|------|
| WP-1 | Check every label-curated number against its label | Safety | M |
| WP-2 | Show label sentences instead of an empty "Review source" | Safety, usefulness | M |
| WP-3 | Diagnose the post-deploy failure window | Reliability | S–M |
| WP-4 | "Kidney dosing not applicable" for non-systemic products | Coverage | S |
| WP-5 | Review page that a clinician can finish | Verification | L |
| WP-6 | Retire special-drug handlers shadowed by curated records | Code health, safety | M |
| WP-7 | openFDA key on the server, auto-deploy, smoke test | Ops | S |
| WP-8 | Lookup-gap logging and cookie-free analytics | Curation targeting | S–M |
| WP-9 | Ambiguous names (tenofovir, Adderall) ask instead of guess | Correctness | M |
| WP-10 | Indication and dialysis choices on the card | UX | M |
| WP-11 | Shrink the autocomplete data | Performance | S |
| WP-12 | Type-check core modules with JSDoc + tsc | Code health | M |
| WP-13 | Split `curatedDoseRules.js` and the validator regexes | Code health | M |
| WP-14 | Docs refresh | Accuracy | S |
| WP-15 | Next curation tier (drugs 300–600) | Coverage | L |

S = under half a day, M = a day, L = several days.

---

## WP-1 — Check every label-curated number against its label

**Why.** The ~330 label-curated records were transcribed from label text by an
AI assistant and are unverified. A transcription slip (wrong threshold, wrong
mg) would surface as a confident dose. Numbers can be checked mechanically
before a clinician spends time on wording.

**What to build.** `scripts/verify-rules-against-labels.mjs`:

1. For each record in `labelCuratedRules` (export from
   `src/data/renalRules/label-curated.js`), read its setId from `sourceUrl`.
2. Fetch the label from openFDA: `search=set_id:"<setId>"` (reuse the fetch and
   `.env.local` reading from `scripts/extract-renal-candidates.mjs`; cache
   responses under `.cache/labels-by-setid/<setId>.json`, which is git-ignored).
   Concatenate `dosage_and_administration`, `use_in_specific_populations`,
   `contraindications`, `warnings_and_cautions`, `warnings`, `precautions`,
   `clinical_pharmacology`; normalise whitespace, `≥`/`≤`/`<`/`>` spelled
   forms, `mL/min/1.73 m2` variants, and en/em dashes.
3. For each rule band and each variant, extract the "claims":
   - band bounds (`min`, `max`, type) → the numbers must appear in the label
     near a kidney term (within ~200 characters of `creatinine clearance|CrCl|
     CLcr|eGFR|GFR|renal|kidney|dialysis`);
   - every `\d+(\.\d+)?\s*(mg|g|mcg|units?|mL|%)` token in `dose` and
     `interval` must appear in the label;
   - every `every \d+ hours`, `once|twice|three times (daily|weekly)`,
     `\d+ times/day` phrase in `interval` must appear (allow `q12h`-style
     synonyms).
4. Write `docs/curation/label-text-audit.md`: one line per record with
   OK / MISSING(claim list) / FETCH-FAILED, plus totals.
5. Triage every MISSING line by reading the label passage (the audit can print
   the nearest kidney sentence to speed this up). Fix the record, or add a short
   `note` explaining why the number is right but absent from the text (for
   example a derived maximum). Re-run until every record is OK or documented.

**Also add** a unit test `test/labelTextClaims.test.js` that replays a stored
compact fingerprint (`test/fixtures/label-claims.json`: setId → sorted list of
normalised numeric tokens present in the label), so the check runs in CI
without network. Regenerate the fixture with `--write-fixture`.

**Acceptance.** Audit report committed with zero untriaged MISSING; the replay
test passes in CI; `npm test` still passes; api-smoke fixture unchanged unless a
record was corrected (list the corrections in the PR).

**Files.** New script and test; edits to `label-curated.js` as found;
`package.json` script `rules:verify-text`.

---

## WP-2 — Show label sentences instead of an empty "Review source"

**Why.** When neither a rule nor the parser matches, the card today shows
"Review DailyMed source" with nothing else (levothyroxine, cetirizine,
prednisone). The API already carries the label's renal sentences
(`sourceSections` with `hasRenalKeyword`), and the AI tier (Llama 3.1 8B) adds
risk without adding information for these labels.

**What to change.**

1. In `server/renalDose/pipeline.js`, before calling the AI, classify the label
   text with the existing helpers in `src/doseGuidance.js`:
   - no kidney sentences at all → return a new `status: "no_renal_text"`
     result: dose "Label has no kidney-dosing text", decision "Label silent",
     tier "Label text". No AI call.
   - kidney sentences but no dose table (`hasRenalDoseTableEvidence` false) →
     return `status: "review_source"` with `labelExcerpt: [sentences…]` (max
     5, each ≤ 300 chars, taken from `extractRenalSnippets`). No AI call.
   - dose-table evidence present → keep the AI tier as is.
2. `src/doseView.js`: add `excerpt` to the view; `getDecision` maps
   `no_renal_text` → `{ id: "silent", label: "Label silent", tone: "neutral" }`.
   Add the icon in `DECISION_ICONS` (`src/ui/doseCards.js`).
3. `src/ui/doseCards.js`: when `view.excerpt` exists, render it in the dose
   box as a quoted list headed "From the label", with the DailyMed link under
   it. Share text (`buildShareText`) includes the first two sentences.
4. Keep "AI summary" strictly for the dose-table case, and keep all current
   validator checks (`test/outputQuality.test.js`).

**Acceptance.** For levothyroxine, cetirizine and prednisone the card shows
either "Label silent" or quoted label sentences; the AI is not called for them
(assert via the `modelUsed` field being empty). New unit tests for the
classifier and the view; e2e test for the excerpt card. Cache version bumped.
Expected side effect: fewer Workers AI calls — check `AI_USAGE` after a day.

---

## WP-3 — Diagnose the post-deploy failure window

**Why.** For ~30 s after each deploy, curated drugs answer "Selected drug /
Review DailyMed source". It self-heals, but it means that for that window the
app gives wrong answers, and nobody knows why.

**Steps.**

1. Add diagnostics to the API, returned only when the request body has
   `debug: true`: `{ stage, timings: { curated, candidates, label, ai }, cache:
   { hit, key version }, errors: [messages without stack traces] }`. Implement
   in `server/renalDose/pipeline.js`; strip in `functions/api/renal-dose/
   assist.js` unless `debug` is set. Never include patient identifiers (there
   are none) or secrets.
2. Write `scripts/poll-after-deploy.mjs`: every 2 s for 90 s, POST
   lorlatinib/ORAL/CrCl 22 and simvastatin/ORAL/CrCl 20 with `debug: true`;
   print status, `sourceMode`, stage, errors.
3. Deploy a trivial change and capture the output. Candidate causes, in order
   of likelihood: (a) Pages serves new static assets before the new Function
   is live (or vice versa), and the client's fixture-shaped fallback hides the
   error; (b) the Function throws on first invocation (cold start importing
   530 records) and the client turns any error into "Review source"; (c) an
   openFDA retry loop (4 attempts with back-off) exceeds the client timeout.
4. Fix according to the cause. If (a) or (b): in `src/llmDoseAssist.js`, when
   the response is a network/5xx error, retry once after 2 s and otherwise show
   an explicit "Service temporarily unavailable, retry" card (new decision
   `unavailable`), never a review card. If (c): cap total openFDA retry time at
   8 s.
5. Add the poll script to the deploy routine (`npm run deploy` runs it after
   `wrangler pages deploy`) and make it exit non-zero if the window exceeds 60 s.

**Acceptance.** The cause is written up in `docs/DEPLOYMENT.md`; a deploy
followed by the poll shows correct answers within 10 s, or an explicit
"unavailable" card rather than a wrong "review" card.

---

## WP-4 — "Kidney dosing not applicable" for non-systemic products

**Why.** Inhalers, creams, eye/ear drops, nasal sprays and vaginal products
make up a large share of the remaining top-300 gaps. Today they run through
the AI tier and come back as "Review source", which reads as "we don't know".

**What to build.**

1. `src/data/nonSystemicRoutes.js`: a list of openFDA `route` values that do
   not need kidney dosing: `TOPICAL`, `OPHTHALMIC`, `OTIC`, `NASAL`,
   `RESPIRATORY (INHALATION)`, `INHALATION`, `VAGINAL`, `RECTAL` (topical
   only), `DENTAL`, `TRANSDERMAL` (flag as "usually not", since some patches are
   systemic — fentanyl, clonidine; keep an allow-list of exceptions).
2. In `server/renalDose/openfda.js`, after the label is chosen, if every
   `openfda.route` value is in that list and the requested route is ORAL/ALL
   with no oral evidence (`hasOralRouteEvidence` false), return a new label
   status `non_systemic` with the route names.
3. Pipeline: map it to `status: "not_applicable"`, dose "Topical/inhaled
   product: kidney dosing does not apply", decision `{ id: "na", label: "Not
   applicable", tone: "neutral" }`, no AI call. Keep the DailyMed link.
4. Autocomplete coverage badge: show "n/a" for these names (extend
   `scripts/lib/coverageIndex.mjs` with status `n`).

**Acceptance.** fluticasone (nasal/inhaled), mupirocin, latanoprost,
clobetasol, timolol (ophthalmic) show "Not applicable" and make no AI call;
fentanyl and clonidine patches do not. Unit test with mocked openFDA results;
e2e test for the card. Re-run the top-300 gap script and record the new
count in the PR.

---

## WP-5 — Review page that a clinician can finish

**Why.** 528 drafts, one reviewer, and a page that lists everything in one
414 KB bundle with decisions kept in localStorage. Verification is the single
step that turns this from "educational" into something a department could
trust, so the review path has to be fast.

**Changes (all in `src/review.js`, `review.html`, `src/ruleReview.js`,
`src/styles.css`, plus a small build script).**

1. **Evidence beside the rule.** At build time, generate
   `src/data/reviewEvidence.js` (or a JSON chunk loaded on demand) mapping
   record id → up to 3 label sentences (from WP-1's cached labels) that
   contain the band numbers. The review card shows rule on the left, evidence
   on the right, DailyMed link below. Without evidence the reviewer opens
   DailyMed for every record.
2. **Order by importance.** Embed the ClinCalc top-300 rank (a small
   `src/data/drugRank.js`, generic name → rank) and sort drafts by rank, then
   alphabetically. Show the rank on the card.
3. **Filters and search.** Status (draft/verified/retired/undecided), source
   file (batch), route, decision type (adjust/avoid/caution/not-studied/no
   change — derive from the band texts with `getDecision`), free-text search.
   Filters live in the URL hash so a reviewer can bookmark "drafts, oral,
   avoid".
4. **Keyboard flow.** `j`/`k` next/previous, `v` verify, `x` retire, `e` edit
   note, `u` undo. Focus management and `aria-live` announcements for the
   decision count.
5. **Bulk action.** "Verify all N in view" with a confirm dialog that lists the
   drug names; only enabled when a filter other than "all" is active.
6. **Persistence and export.** Keep localStorage, but add "Download
   decisions.json" / "Load decisions.json" so work can move between devices,
   and keep the CSV export (`rules:import` reads it). Show progress
   (`n verified · m retired · k left`).
7. **Bundle.** Lazy-load the record groups per source file (dynamic import),
   so the initial review page is under 150 KB.
8. **Import path.** Document in `docs/RENAL_DOSE_CURATION.md`: export CSV →
   `npm run rules:import -- file.csv` → PR → merge → deploy. The verified badge
   then appears automatically (`getRecordVerification`).

**Acceptance.** e2e: load review, filter to "oral, avoid", verify two records
by keyboard, export CSV, run `rules:import` on it in a unit test, assert both
ids are in `RULE_VERIFICATIONS` output. Lighthouse performance ≥ 90 on
`/review`. axe passes.

---

## WP-6 — Retire special-drug handlers shadowed by curated records

**Why.** `server/renalDose/specialDrugs.js` has ~60 hand-written `buildXDose
(crcl)` handlers (meropenem, pip/tazo, levofloxacin, lisinopril,
levetiracetam, cefazolin…). The pipeline consults curated rules first, so a
handler for a curated drug never runs — but it is still maintained and may
silently disagree with the record.

**Steps.**

1. `scripts/audit-special-handlers.mjs`: for each handler, derive the drug
   name and route(s) it targets (from the dispatch in
   `buildSpecialDrugResult`), and check whether a curated record exists for the
   same name/route via `findCuratedRenalDoseGuidance`.
2. For shadowed handlers, compare outputs at CrCl 5, 15, 25, 35, 45, 55, 70,
   95 with the curated recommendation text; print disagreements.
3. Put the disagreement list in `docs/curation/special-handler-audit.md` for
   the clinician; where the handler is clearly right (it cites a label table
   the record simplified), fix the record.
4. Delete shadowed handlers, keep the rest, and keep
   `buildMissingLabelSpecialResult` (it covers products with no openFDA label).
5. The remaining handlers are candidates for conversion to records in
   `label-curated.js` so there is one source of truth; do that for any handler
   whose logic is a plain CrCl table.

**Acceptance.** `specialDrugs.js` shrinks substantially; unit tests pass; the
api-smoke fixture is unchanged (those cases are curated) ; the e2e mocked
pipeline is unchanged.

---

## WP-7 — openFDA key on the server, auto-deploy, smoke test

1. **openFDA key.** `server/renalDose/openfda.js`: if `env.OPENFDA_API_KEY`
   is set, append `api_key` to requests (keyed requests get 120,000/day instead
   of 1,000/day per IP). Pass `env` into `lookupDrugLabel`. Never log the URL
   with the key; strip `api_key` from any error message. The user adds the
   secret in the Cloudflare dashboard (Pages → Settings → Environment
   variables → encrypt). Add it to `.env.example` (name only).
2. **Auto-deploy.** The CI deploy job already exists. The user must add
   `CLOUDFLARE_API_TOKEN` (token with Pages: Edit) and `CLOUDFLARE_ACCOUNT_ID`
   as GitHub secrets and set the repository variable
   `CLOUDFLARE_DEPLOY_ENABLED=true`. Document this in `docs/DEPLOYMENT.md`
   with screenshots-free step text.
3. **Post-deploy smoke.** Add a workflow step after deploy that POSTs three
   requests (meropenem IV / CrCl 20 → dose_found; lorlatinib ORAL / CrCl 22 →
   "75 mg"; nitrofurantoin ORAL / CrCl 40 → contains "Contraindicated"), with
   the WP-3 poll so the rollout window does not fail the job.

**Acceptance.** A merge to main deploys without a local `npm run deploy`;
the smoke step is green; keyed openFDA requests are visible in the Cloudflare
logs (as `api_key=REDACTED`).

---

## WP-8 — Lookup-gap logging and cookie-free analytics

**Why.** Curation so far was guided by a prescription-frequency list. Real
usage is a better guide, and failures are the useful signal.

1. **Gap log.** In `functions/api/renal-dose/assist.js`, when the final result
   status is `not_found`, `review_source`, `no_renal_text` or
   `not_applicable`, increment a KV counter `gap:<normalizedDrug>|<route>`
   (binding `LOOKUP_GAPS`, free tier). Store nothing else — no patient values,
   no IPs, no timestamps beyond KV's own metadata. Skip when the binding is
   absent (local dev).
2. `scripts/report-lookup-gaps.mjs`: list the top 100 counters via `wrangler
   kv key list`, join with the coverage index, and print "not curated / label
   silent / not applicable" per drug. Output feeds WP-15.
3. **Analytics.** Add the Cloudflare Web Analytics beacon (no cookies, no
   personal data) to `index.html`, `app/index.html` and `review.html` behind a
   `VITE_CF_BEACON_TOKEN` build variable so local builds have none. Update the
   CSP in `public/_headers` (`script-src` `static.cloudflareinsights.com`,
   `connect-src` `cloudflareinsights.com`).

**Acceptance.** After a day, `report-lookup-gaps` lists real drugs; e2e CSP
test still passes; privacy note added to the landing page footer ("no cookies,
no patient data stored").

---

## WP-9 — Ambiguous names ask instead of guess

**Why.** "tenofovir" matches neither TDF nor TAF (deliberately), "emtricitabine/
tenofovir" could be Truvada or Descovy, "Adderall" could be IR or XR. Today
these fall through to a label lookup that may pick either product.

1. In `src/curatedDoseRules.js`, add `findAmbiguousCuratedRecords(query,
   route)`: records whose `baseDrugKey` matches the query's base key but
   whose own keys differ and whose recommendations differ. Define pairs
   explicitly in `src/data/renalRules/ambiguousNames.js` (tenofovir →
   [TDF, TAF]; emtricitabine and tenofovir → [Truvada, Descovy]; amphetamine
   mixed salts → [IR, XR]; metformin → [IR, ER] if ER is ever added), rather
   than inferring, so there are no surprises.
2. Pipeline returns `status: "ambiguous"` with `options: [{ label, searchTerm
   }]` before any label lookup.
3. UI: card shows "Which product?" with chips; choosing one re-runs the lookup
   with the exact search term and remembers the choice for the session
   (`src/ui/doseCards.js`, `src/app.js`).
4. Quick input: `parseQuickInput` leaves the name as typed; no change.

**Acceptance.** Typing "tenofovir" shows two chips and no dose; picking TAF
gives the TAF record. Unit tests for the matcher; e2e for the chips.

---

## WP-10 — Indication and dialysis choices on the card

**Why.** Many curated records default an indication and bury "Indication not
selected; showing X" in the cautions. Dialysis variants now render as a list,
but a patient marked HD still gets the lowest-band regimen list rather than
the HD row.

1. When `view.options.indications` has more than one entry and none is chosen,
   render the chooser directly above the dose (not in the cautions), with the
   default highlighted and labelled "default". Remove the "Indication not
   selected" sentence from `importantCautions` once the chooser is visible.
   Remember the last choice per drug in localStorage.
2. With dialysis = HD or PD selected and a record whose band has a variant
   whose condition mentions hemodialysis/dialysis/CAPD, pre-select that variant
   and show the others collapsed ("Other situations"). Implement in
   `src/doseView.js` (`variants` → `selectedVariant`) using the patient's
   dialysis from `values`.
3. Move "after dialysis on HD days"-style timing out of `interval` into the
   existing `dialysisNote` field for the records that have it
   (`label-curated.js`: pomalidomide, Biktarvy, Descovy, ranitidine, and any
   others found by grep for "dialysis" in intervals), and render
   `dialysisNote` as its own line.

**Acceptance.** e2e: HD patient + colchicine shows the dialysis regimen
first; famotidine with no indication shows the chooser above the dose and no
"not selected" caution. Share text reflects the chosen variant.

---

## WP-11 — Shrink the autocomplete data

`src/drugAutocompleteData.js` is 11,943 lines (166 KB chunk, loaded on first
keystroke). Options, in order of preference:

1. Build it from the coverage index plus a trimmed openFDA generic-name list
   (names that actually resolve to a label), dropping entries that never
   produced a result in `qa:autocomplete-full`.
2. Store it as one packed string (`name|name|…`) and split at runtime; gzip
   handles repetition well. Target under 60 KB over the wire.
3. Keep brand → generic aliases in `src/drugNormalizer.js` only.

**Acceptance.** Autocomplete e2e tests pass; chunk size reported in the PR;
no name that is curated or in the top-300 list is lost (assert in a unit
test).

---

## WP-12 — Type-check core modules with JSDoc + tsc

1. Add `jsconfig.json` with `checkJs` for `src/renal.js`, `src/doseView.js`,
   `src/doseText.js`, `src/curatedDoseRules.js`, `src/llmDoseAssistCore.js`,
   `src/drugNormalizer.js`, `server/renalDose/*.js`.
2. `src/types.js` with `@typedef`s: `Patient`, `CuratedRecord`, `Rule`,
   `Variant`, `Guidance`, `AssistResult`, `DoseView`, `Decision`.
3. `npm run typecheck` → `tsc --noEmit -p jsconfig.json`; add to CI after
   lint. Fix what it finds (expect null-handling issues in the validator).

**Acceptance.** CI green with the type step; no runtime behaviour change
(api-smoke fixture identical).

---

## WP-13 — Split `curatedDoseRules.js` and the validator regexes

1. `src/curated/match.js` (record matching, keys, route rules),
   `src/curated/format.js` (`formatBand`, `formatRange`, `formatVariants`,
   `formatInterval`, `listVariants`), `src/curated/structured.js`
   (structured overlays and controls), `src/curated/metric.js` (CrCl/eGFR/SCr
   inference). `curatedDoseRules.js` re-exports so imports do not change.
2. `src/llmDoseAssistCore.js`: move the regex constants into
   `src/assistValidation/patterns.js` with a table-driven test that lists
   positive and negative examples for each pattern (`RENAL_BAND_TERM`,
   `RENAL_CAUTION_TERM`, `VAGUE_DOSE`, `RENAL_ACTION_PHRASE`, …).
3. Golden tests: `formatInterval` for every distinct interval string in the
   database (snapshot file), and `buildShareText` for a three-drug check.

**Acceptance.** No behaviour change (fixtures identical); file sizes under
~500 lines each.

---

## WP-14 — Docs refresh

- `README.md` and `docs/PRODUCTION_CHECKLIST.md` say "205 drugs"; it is 530
  records (2 verified, 528 drafts) plus 31 candidates. Add the tier and
  decision vocabulary (Clinician-verified / Curated draft / Auto-extracted /
  Label logic / AI summary / Review source; Adjust / Avoid / Caution / Not
  studied / Depends on situation / Not applicable / Label silent).
- New `docs/ARCHITECTURE.md`: pipeline diagram, where each tier's code lives,
  the cache-version rule, the fixture-replay rule.
- Commit the curation helpers now sitting in the git-ignored `.cache/curation`
  (`dump.mjs`, `view.mjs`, `grep.mjs`, `raw.mjs`) as `scripts/curation/` with
  a README so the process is reproducible; they must read the key from
  `.env.local` as the extractor does.
- `CHANGELOG.md` from the PR titles (#2–#26 so far).

---

## WP-15 — Next curation tier (drugs 300–600)

Use the same process as the first 347-entry queue:

1. Extend `scripts/curation/dump.mjs` to build a queue from (a) the ClinCalc
   list beyond 300, (b) WP-8's gap report, (c) hospital-formulary classes that
   are kidney-sensitive and thin in the database (aminoglycosides,
   antifungals, antivirals, chemotherapy, anticoagulants, antiepileptics).
2. For each entry: fetch the label, read the renal sentences, write a record
   with the `record()`/`band()`/`all()` helpers, cite the setId, keep
   thresholds exactly as the label states them (SCr-based rules use an
   all-band with the condition in the dose text; urine-output or
   Child-Pugh-defined rules stay condition-only).
3. Ship every ~40 records; run WP-1's text check on each batch before the PR.

**Acceptance.** Each PR lists skipped entries and why (duplicate, pediatric,
no kidney text, wrong product), and the WP-1 audit is clean for the batch.

---

## Things that need the user, not code

- Clinician review at `/review` (WP-5 makes it faster; nothing else turns
  drafts into verified records).
- mg amounts for the verified meropenem record.
- Cloudflare: `OPENFDA_API_KEY` secret, API token + account id for
  auto-deploy, `AI_USAGE` and `LOOKUP_GAPS` KV bindings, Telegram bot secrets
  (`docs/telegram-setup.md`), a custom domain.

## Out of scope (do not add without asking)

Pediatric dosing, drug–drug interactions, non-US labels, dose calculators for
specific drugs (vancomycin AUC, aminoglycoside levels), user accounts, and
anything that stores patient data.
