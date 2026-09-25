# Production Checklist

This app is a free-first adult renal calculator. Dose guidance comes from a local curated rule database first, then DailyMed/openFDA label logic, with an AI-assisted summary only as a labelled fallback.

## Current Runtime Shape

- Frontend: HTML/CSS/JavaScript built with Vite into `dist/`.
- Local development: `npm run dev` (Vite, UI only) or `npm run cf:dev` (built app + Functions on `http://localhost:8788`, no Cloudflare login needed).
- Production hosting target: Cloudflare Pages.
- Current Cloudflare Pages URL: `https://renal-dose-calculator.pages.dev`.
- Backend target: Cloudflare Pages Function at `/api/renal-dose/assist`.
- Telegram target: Mini App launcher at `/api/telegram/webhook`.
- Drug source: openFDA label JSON with DailyMed source links.
- Name normalization: local aliases plus RxNorm/RxNav fallback.
- AI path: Cloudflare Workers AI, guarded for free-mode usage.
- Curated renal rules (205 drugs) answer first; auto-extracted label candidates second. See `docs/RENAL_DOSE_CURATION.md`.

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
3. Set build command to `npm run build`.
4. Set build output directory to `dist`.
5. Enable the Workers AI binding named `AI`.
6. Add environment variables:
   - `AI_FREE_MODE=true`
   - `FREE_AI_DAILY_REQUEST_LIMIT=200`
7. Optional: add KV binding `AI_USAGE`.
9. Deploy preview.
10. Test `/api/renal-dose/assist` with real Cloudflare AI.
11. Test the app on desktop and mobile.
12. Test Telegram `/start` and the Mini App launch button.

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

- Curated drugs (piptaz, meropenem, cefepime, apixaban, famotidine) show a **Clinician-verified** or **Curated · draft** badge.
- Other drugs show **Label logic**, **Label table**, **AI summary** or **Review source**.
- Source link always opens DailyMed.
- Educational warning remains visible.
- High-risk or unsupported output falls back to `Review DailyMed source`.

## Bot Smoke Tests

In Telegram send `/start`. Expected: a single button that opens the Mini App.
Telegram chat does not calculate doses.

## Safety Rules

- Do not hide source review.
- Do not show an unsupported AI dose as a clean recommendation.
- Do not show auto-extracted or draft records as clinician-verified.
- Do not remove the educational warning.
- Do not call this prescribing software.
- Keep visible attribution: `Made by Dr. Tufayl (Cortex Labs)`.
