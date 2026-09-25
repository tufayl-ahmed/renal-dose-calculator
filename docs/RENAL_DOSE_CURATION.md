# Renal Dose Database and Clinician Review

The app answers renal dosing questions from a local rule database first and
only falls back to the live DailyMed/openFDA label when a drug (or a renal
range) is not covered.

## Pipeline order

| Step | Source | Badge in the app |
| --- | --- | --- |
| 1 | Hand-curated rules, `src/data/renalRules/*.js` + `src/curatedDoseRules.js` | **Clinician-verified** or **Curated · draft** |
| 2 | Auto-extracted label candidates, `src/data/renalRules/candidates.js` | **Auto-extracted** |
| 3 | Live label: drug-specific handlers, then renal table parser | **Label logic** / **Label table** |
| 4 | Workers AI summary of label text (validated against the text) | **AI summary** |
| 5 | Nothing reliable | **Review source** |

A curated record answers only when it has a band for the patient's CrCl/eGFR.
Where the label is silent for a range (e.g. a record that only covers
CrCl < 30), the request falls through instead of guessing. Whole-number label
bands (40–59, ≥60) match fractional CrCl values by rounding.

When a record's dose depends on indication, product or dialysis and the user
has not chosen one, the first option is shown and the card says so
("Indication not selected; showing …"), with a **choose** marker on the
selector. Apixaban NVAF uses the label's age/weight/creatinine criteria
automatically.

## Review status

Clinician sign-off is stored separately from the extracted data, in
`src/data/renalRules/verifications.js`, keyed by record id
(`<search-term>:<ROUTES>`, e.g. `meropenem:IV`). Extraction tools can never
mark their own output as verified.

| Status | Meaning |
| --- | --- |
| `verified` | Reviewed and approved by a clinician. Shown as **Clinician-verified**. |
| `retired` | Hidden from lookups; kept for audit history. |
| (none) | Draft (hand-curated) or unreviewed (auto-extracted). |

The two starter records reviewed by Dr. Tufayl (piperacillin/tazobactam and
meropenem) count as verified.

## Reviewing records

```bash
npm run rules:export
```

writes `docs/curation/rule-review.csv` with one row per record: its bands,
structured rules, notes and DailyMed link. Open it in Excel, Numbers or Google
Sheets, check each record against the label, and fill in:

- `decision`: `verified` or `retired` (leave blank to skip)
- `reviewer`: name as it should appear in the app
- `review_date`: `YYYY-MM-DD`
- `notes`: optional

Then import:

```bash
npm run rules:import -- docs/curation/rule-review.csv
npm test
```

Rows with missing reviewer/date or unknown ids are reported and skipped.

## Growing the database

```bash
npm run candidates:extract -- --limit=200
```

For every generic drug in the autocomplete list without a curated record, the
script fetches oral and IV labels (add `--routes=ORAL,IV,SC` for subcutaneous), runs the
deterministic label pipeline at 17 CrCl/eGFR values, and keeps the drug only
when every answer is clean and band-consistent. It rejects:

- labels whose name does not match the drug,
- non-specific guidance ("reduce dose or extend interval"),
- "label silent" answers (the label sections read do not mention kidneys),
- answers that differ inside one band or mix CrCl and eGFR.

Everything rejected is listed in
`docs/curation/candidate-extraction-report.md` as the manual curation queue.

openFDA allows about 1,000 requests a day without a key. The script caches
labels in `.cache/labels/`, stops cleanly when rate limited and can be re-run
to continue. With a free key from https://open.fda.gov/apis/authentication/:

```bash
OPENFDA_API_KEY=your-key npm run candidates:extract -- --limit=2000
```

`--offline` rebuilds candidates from cached labels only; `--fresh` discards
existing candidates first.

## Adding a hand-curated record

Add it to the matching file in `src/data/renalRules/` (schema enforced by
`test/renalRulesSchema.test.js`): generic name, aliases, routes, adult-only
flag, CrCl/eGFR bands with dose and interval per variant, indication notes,
DailyMed `setid` URL, `reviewedBy: "Codex curation draft"`, date and
`confidence: "draft-source-extracted"`. For drugs whose dose depends on
indication, product or dialysis, add a structured overlay in
`src/curatedDoseRules.js` so the app can show selectors.
