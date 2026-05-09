# Drug Data Strategy

The doctor-facing app should be fast, so it should not query DailyMed/openFDA for every dose recommendation.

## Runtime Path

At runtime, the app should use a local verified database:

```text
doctor input -> calculator -> verified_rules table -> instant dose result
```

DailyMed/openFDA should be used at runtime only for:

- source links
- label text preview when no verified rule exists
- manual review workflows
- cache misses during early development

## Background Ingestion Path

A scheduled Cloudflare Worker should periodically ingest label data:

```text
DailyMed bulk XML / openFDA JSON
  -> normalize drug identity with RxNorm
  -> filter human prescription drugs
  -> extract renal-relevant label sections
  -> generate candidate renal dosing rules
  -> clinician/pharmacist review
  -> publish verified rules to D1
```

## Database Tables

Suggested production tables:

```text
drugs
- id
- rx_cui
- generic_name
- brand_names
- routes
- product_type
- source
- source_set_id
- updated_at

renal_label_sections
- id
- drug_id
- section_name
- route
- text
- renal_keywords
- source_url
- label_updated_at

renal_dose_rules
- id
- drug_id
- route
- renal_function_type
- min_value
- max_value
- dose_text
- interval_text
- dialysis_text
- caveats
- source_section_id
- verification_status
- verified_by
- verified_at
```

## Verification Status

Only `verified` rules should produce a final dose recommendation.

```text
candidate     extracted but not reviewed
needs_review  extraction looks incomplete or ambiguous
verified      approved for doctor-facing recommendation
retired       old rule preserved for audit history
```

## Why This Design

- Fast: dose lookup is a local database query.
- Safer: labels are not converted into recommendations without review.
- Auditable: every dose points back to source text and DailyMed label.
- Scalable: DailyMed/openFDA changes are handled by a scheduled updater, not by each doctor request.
