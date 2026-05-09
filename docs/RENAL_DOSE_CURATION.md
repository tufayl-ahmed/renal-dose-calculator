# Renal Dose Curation Workflow

Goal: curate 200 common adult drugs into a fast local renal-dose table while keeping DailyMed/openFDA label text as the fallback for drugs outside the table.

## Rule Status

- `starter-verified`: entered from a clear renal dosing table already used by the app.
- `draft`: extracted from label text, not ready for clean output.
- `needs-review`: parsed or entered, but missing a source, route, indication, or CrCl band.
- `verified`: reviewed against the source label and ready for the one-line dose card.

Only `starter-verified` and `verified` rules should appear as clean curated dose guidance.

## Required Fields

- Generic drug name
- Aliases and common abbreviations
- Route
- Adult-only scope
- CrCl bands
- Dose
- Interval
- Indication notes when the label has different regimens
- Dialysis note when present
- Source label and URL
- Reviewer and review date

## App Behavior

1. Normalize the entered drug name.
2. Check the curated renal-dose table.
3. If a matching verified rule exists, show the clean dose card immediately.
4. If no curated rule exists, search openFDA/DailyMed and show the current label-text fallback.

## Next Data Work

Build the top-200 list as a curation queue, then add rules in batches. Antibiotics, antivirals, anticoagulants, antiepileptics, diabetic drugs, and cardiovascular drugs should be prioritized because renal dosing changes are common and clinically important.
