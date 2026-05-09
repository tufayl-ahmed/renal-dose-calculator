# Deployment

## Current Target

- GitHub repository: `tufayl-ahmed/renal-dose-calculator`
- Production branch: `main`
- Cloudflare Pages project: `renal-dose-calculator`
- Build command: none
- Build output directory: `.`
- Runtime: Cloudflare Pages Functions

## Cloudflare Bindings

Configured in `wrangler.toml`:

- `AI` Workers AI binding
- `WHATSAPP_DEDUPE` KV namespace
- `AI_FREE_MODE=true`
- `FREE_AI_DAILY_REQUEST_LIMIT=200`
- `WHATSAPP_GRAPH_VERSION=v23.0`

Production secrets must be configured in Cloudflare Pages, not Git:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_APP_SECRET`

## GitHub Auto-Deploy

The intended production workflow is:

1. Commit locally.
2. Push to `main`.
3. Cloudflare Pages builds/deploys automatically from GitHub.
4. Verify the live Pages URL and bot webhooks.

Wrangler direct deploy can still be used during development:

```bash
npm run deploy
```

Use direct deploy only as a temporary preview path once GitHub auto-deploy is
connected.
