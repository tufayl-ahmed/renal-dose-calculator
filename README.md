# Renal Dose Calculator

Adult renal-function and renal-dose guidance web app by Dr. Tufayl
(Cortex Labs).

Adult-only web MVP for:

- CKD-EPI 2021 creatinine eGFR in mL/min/1.73 m²
- Cockcroft-Gault creatinine clearance in mL/min
- Human DailyMed drug label lookup through openFDA, with prescription labels preferred and OTC labels used as fallback
- Drug-name normalization with fast local aliases and RxNorm/RxNav fallback
- Label-based renal dose guidance when a CrCl table can be parsed from the label
- WhatsApp Cloud API text webhook for fast one-line doctor input
- Telegram Mini App launcher bot

The current app can parse some DailyMed/openFDA renal dose tables and match the patient's Cockcroft-Gault CrCl band. This is still label-based educational support, not a verified local dosing database. Production dosing recommendations should come from reviewed structured rules.

For the production data plan, see [docs/DATA_STRATEGY.md](./docs/DATA_STRATEGY.md).
For deployment, see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).
For bot setup, see [docs/whatsapp-setup.md](./docs/whatsapp-setup.md) and
[docs/telegram-setup.md](./docs/telegram-setup.md).

## Repository Status

- Source of truth branch: `main`
- Hosting target: Cloudflare Pages
- Runtime functions: Cloudflare Pages Functions under `functions/api`
- Secrets: never committed; configured only in Cloudflare Pages
- Package manager: npm
- Node target: 20+

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Test

```bash
npm test
```

## Cloudflare Local Runtime

Use Wrangler when you need to test Pages Functions locally:

```bash
npm run cf:dev
```

This app can run as static HTML for frontend work, but the drug-dose API,
Telegram webhook, WhatsApp webhook, and Workers AI binding need Cloudflare's
Pages runtime.

## Clinical Scope

- Adults only: age 18 years and older
- Creatinine input: mg/dL
- Weight is required for Cockcroft-Gault
- Height is optional and used only to display BMI, ideal body weight, and adjusted body weight estimates
- Drug data target: human DailyMed labels, with human prescription labels preferred
- Route choices: All routes, IV, or Oral
- Status: beta. Educational purpose only. Results are estimates and are not for prescribing.

This app is educational clinical decision support, not medical advice and not a replacement for clinician judgment, local protocols, pharmacist review, or the official prescribing information.

## Hosting Plan

Recommended first deployment:

- GitHub repository for source control
- Cloudflare Pages for static hosting
- Free `*.pages.dev` subdomain during development
- Custom paid domain later when the product name is final
- WhatsApp text webhook and Telegram Mini App launcher as Cloudflare Pages Functions

Future backend:

- Cloudflare Worker API
- Cloudflare D1 SQLite database for verified renal dose rules
- Scheduled label ingestion from openFDA/DailyMed

## Free-First Constraint

- Use free/open public drug-label sources first: DailyMed, openFDA, and RxNorm/RxNav.
- Keep hosting on Cloudflare Pages free tier during development.
- Use Cloudflare Workers AI only within the free daily allocation while testing the LLM-assisted flow.
- Do not rely on paid Hugging Face inference, paid GPU hosting, or paid database services for the MVP unless explicitly approved later.
- Keep a local/mock fallback so the app can still be tested without paid AI calls.

## AI Free-Mode Guard

The live LLM pathway is designed to stay free-first:

- The Cloudflare Function tries the smaller Workers AI model first: `@cf/meta/llama-3.1-8b-instruct-fast`.
- `@cf/google/gemma-3-12b-it` is only a fallback if the smaller model call fails.
- Only compact renal-relevant label snippets are sent to AI, capped at 9,000 characters.
- openFDA label responses are cached for seven days through the Cloudflare Cache API.
- AI summaries are cached for one day by label, route, CrCl band, dialysis, indication, and formulation.
- `AI_FREE_MODE=true` keeps the backend in free-protection mode.
- `FREE_AI_DAILY_REQUEST_LIMIT=200` is an app-level request guard, not a Cloudflare neuron counter. Tune this after reviewing real Cloudflare usage.
- For a persistent daily guard, add an optional free-tier KV binding named `AI_USAGE`. Without it, the app still uses compact prompts and cache, but cannot count AI calls across edge instances.

If the guard is reached or AI is unavailable, the app returns a source-review card instead of inventing a dose.

## Security

Use `.env.example` only as a template. Do not commit real Telegram, WhatsApp,
Cloudflare, GitHub, or Meta tokens. See [SECURITY.md](./SECURITY.md) for the
repo security policy.

## License

No open-source license has been selected yet. All rights reserved unless a
license is added later.
