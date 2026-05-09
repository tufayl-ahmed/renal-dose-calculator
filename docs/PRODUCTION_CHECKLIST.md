# Production Checklist

This app is a free-first adult renal calculator with DailyMed/openFDA source review and an experimental AI-assisted summary path.

## Current Runtime Shape

- Frontend: static HTML/CSS/JavaScript.
- Local development: `npm run dev` serves the static app on `http://localhost:5173`.
- Production hosting target: Cloudflare Pages.
- Current Cloudflare Pages URL: `https://renal-dose-calculator.pages.dev`.
- Backend target: Cloudflare Pages Function at `/api/renal-dose/assist`.
- WhatsApp text bot target: Cloudflare Pages Function at `/api/whatsapp/webhook`.
- Telegram target: Mini App launcher at `/api/telegram/webhook`.
- Drug source: openFDA label JSON with DailyMed source links.
- Name normalization: local aliases plus RxNorm/RxNav fallback.
- AI path: Cloudflare Workers AI, guarded for free-mode usage.
- Curated 209-drug rules: preserved in the repo, currently bypassed in the live app flow.

## Free-First Production Settings

- Keep `AI_FREE_MODE=true`.
- Start with `FREE_AI_DAILY_REQUEST_LIMIT=200`.
- Use Cloudflare Workers AI free allocation only.
- Use the smaller model first: `@cf/meta/llama-3.1-8b-instruct-fast`.
- Keep `@cf/google/gemma-3-12b-it` only as fallback.
- Keep prompt source text compact and renal-relevant.
- Keep DailyMed/openFDA links visible for every drug answer.

## Optional Free KV Guard

For persistent app-level AI request counting, create a free-tier Cloudflare KV namespace and bind it to the Pages project as:

```text
AI_USAGE
```

Without this binding, the app still uses compact prompts and cache protection, but it cannot count AI calls across Cloudflare edge instances.

## Deployment Steps

1. Push the repo to GitHub.
2. Create a Cloudflare Pages project from the GitHub repo.
3. Set build command to empty or no-op because this is a static app.
4. Set build output directory to `/`.
5. Enable the Workers AI binding named `AI`.
6. Add environment variables:
   - `AI_FREE_MODE=true`
   - `FREE_AI_DAILY_REQUEST_LIMIT=200`
7. Optional: add KV binding `AI_USAGE`.
8. Add KV binding `WHATSAPP_DEDUPE` for duplicate WhatsApp webhook retry protection.
9. Deploy preview.
10. Test `/api/renal-dose/assist` with real Cloudflare AI.
11. Test the app on desktop and mobile.
12. Test WhatsApp text input if Meta sender is available.
13. Test Telegram `/start` and the Mini App launch button.

## Pre-Launch Smoke Drugs

Use adult inputs such as age 45, male, SCr 2.1 mg/dL, weight 70 kg, height 170 cm.

- `piptaz`
- `meropenem`
- `cefepime`
- `vancomycin`
- `doxy`
- `apixaban`
- `famotidine`
- one random non-curated human prescription drug

Expected behavior:

- Dose guidance says `AI-assisted DailyMed summary` or `Needs review`.
- It never says `Curated rule` during this experiment.
- Source link always opens DailyMed.
- Educational warning remains visible.
- High-risk or unsupported output falls back to `Review DailyMed source`.

## Bot Smoke Tests

Use these messages in WhatsApp where available:

```text
hi
form
45 M 2.1 70
45 M 2.1 70 meropenem IV
60 F 1.4 55 metformin oral
```

Use this in Telegram:

```text
/start
```

Expected behavior:

- WhatsApp help and form replies include `Made by Dr. Tufayl (Cortex Labs)`.
- WhatsApp result replies omit the brand line to stay clinically compact.
- WhatsApp result replies include eGFR, CrCl, drug/route when supplied,
  DailyMed source when available, and the educational warning.
- Telegram replies only launch the Mini App; Telegram chat does not calculate
  doses or run a guided form.

## Safety Rules

- Do not hide source review.
- Do not show an unsupported AI dose as a clean recommendation.
- Do not remove the educational warning.
- Do not call this prescribing software.
- Keep visible attribution: `Made by Dr. Tufayl (Cortex Labs)`.
