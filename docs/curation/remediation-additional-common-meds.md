# Additional Common Meds Remediation

Remediation Worker R5, 2026-05-06. Scope: `docs/curation/verification-additional-common-meds-final.md` flagged records only. Sources used were DailyMed FDA label pages only.

## Records Fixed

| Record | Remediation |
|---|---|
| Cimetidine | Replaced unsafe all-CrCl reduced dose with source-summary/manual-review wording because DailyMed gives severe renal impairment dosing without a numeric cutoff. |
| Nizatidine | Corrected boundary handling: `CrCl >50` is now `type: "gt"`, leaving exactly 50 mL/min in the 20-50 mL/min reduced-dose band. |
| Fexofenadine hydrochloride | Replaced unsafe all-CrCl reduced starting dose with source-summary/manual-review wording because DailyMed says decreased renal function without a numeric cutoff. |
| Desloratadine | Replaced unsafe all-CrCl every-other-day dose with source-summary/manual-review wording because the adult renal impairment dose is not tied to a numeric cutoff in the dosage section. |
| Vibegron | Replaced CrCl-modeled eGFR bands with source-summary/manual-review wording because the DailyMed label uses eGFR thresholds. |
| Granisetron | Normalized broken versioned DailyMed URL to resolving SUSTOL `drugInfo.cfm` setid URL. |
| Atogepant | Normalized broken versioned DailyMed URL to resolving QULIPTA `drugInfo.cfm` setid URL. |
| Zaleplon | Replaced invented CrCl >=30 branch with source-summary/manual-review wording because mild/moderate renal impairment is not numerically mapped and severe renal impairment was not adequately studied. |
| Tadalafil | Removed `adcirca` alias from the ED/BPH tadalafil record; PAH tadalafil/ADCIRCA dosing is different and remains unencoded here. |

## DailyMed Sources Checked

- Cimetidine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=28fd7158-a617-436a-8f5c-71ffbaafe527
- Nizatidine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=e9957997-8b85-48a0-9bb3-b878cb223236
- Fexofenadine hydrochloride: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a3d17e8d-a8ce-4e1a-9ec2-13736af1d7b5
- Desloratadine: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=4d094001-b85a-47b3-bc67-a46660384ece
- Vibegron/GEMTESA: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=25f21d25-14f8-4fda-91f6-7aa8b68aa1c8
- Granisetron/SUSTOL: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f7c7ffdd-8270-4030-bc1e-a1cb28a6de56
- Atogepant/QULIPTA: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8c8ab8f4-32bd-497a-befa-70c8a51d8d52
- Zaleplon: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=bc7639e9-c2cb-47bb-a295-efb0f656ccd1
- Tadalafil ED/BPH label: https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=f9e9a953-2802-4bb1-91a3-a29be347801e
- ADCIRCA PAH comparison source: https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ff61b237-be8e-461b-8114-78c52a8ad0ae

## Remaining Manual Clinical Review

- Cimetidine, fexofenadine hydrochloride, desloratadine, vibegron, and zaleplon are intentionally source-summary/manual-review records because the current schema cannot safely encode their label language as CrCl-selectable dosing.
- Tadalafil remains ED/BPH-only; PAH tadalafil/ADCIRCA needs a separate product/indication-specific record if it is added.
- Nizatidine, granisetron/SUSTOL, and atogepant have selectable numeric bands but remain draft-only and indication-specific.

## Schema Limitation

The current renal-rule schema has numeric `CrCl`-style rule matching and a generic `all` fallback, but no field for the renal metric used by the label, no eGFR matcher, no nonnumeric category selector, and no product/indication discriminator beyond free-text notes and aliases. Where that blocked clean output, the record was kept with source-summary/manual-review wording instead of inventing thresholds.
