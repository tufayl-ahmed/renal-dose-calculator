# Contributing

Keep changes small, tested, and clinically reviewable.

## Setup

```bash
npm install
npx playwright install chromium   # once, for end-to-end tests
```

## Everyday commands

```bash
npm run dev        # UI only (Vite, http://localhost:5173)
npm run cf:dev     # built app + Pages Functions (http://localhost:8788)
npm run check      # lint + unit tests + build
npm run test:e2e   # Playwright, desktop and mobile
```

`npm run cf:dev` runs without a Cloudflare login and without Workers AI; set
`CF_REMOTE_AI=1` after `wrangler login` to use the real AI binding.

## Tests

- `test/` — Node test runner. `test/apiSmoke.test.js` replays recorded openFDA
  responses through the whole dose API; re-record with
  `npm run fixtures:record` after intentional pipeline changes and review the
  differences.
- `e2e/` — Playwright. The dose API is served from the real curated pipeline in
  Node, so no network is needed.

## Clinical rules

- Adults only unless the clinical scope is intentionally changed.
- Do not invent dose guidance when source labels are unclear; prefer
  "Review source".
- "The label does not mention the kidney" is not the same as "no adjustment".
- Keep the educational/non-prescribing warning in the UI.
- Only a clinician may add entries to `src/data/renalRules/verifications.js`
  (see `docs/RENAL_DOSE_CURATION.md`).
- Do not commit API tokens, `.env` files or `.cache/`.
