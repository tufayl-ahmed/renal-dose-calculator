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

The existing Cloudflare Pages project was originally created with Direct Upload
through Wrangler. Cloudflare's Git integration cannot be added to an existing
Direct Upload Pages app, so the safer auto-deploy path for the current live
project is GitHub Actions running Wrangler deploys.

The intended production workflow is:

1. Commit locally.
2. Push to `main`.
3. GitHub Actions runs tests.
4. If deployment is enabled, GitHub Actions deploys the same repository to the
   existing Cloudflare Pages project with Wrangler.
5. Verify the live Pages URL and bot webhooks.

Required GitHub repository secret:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Required GitHub repository variable:

- `CLOUDFLARE_DEPLOY_ENABLED=true`

Keep `CLOUDFLARE_DEPLOY_ENABLED=false` until the Cloudflare API token has been
created and stored as a GitHub secret.

Recommended Cloudflare API token permission:

- Account: Cloudflare Pages - Edit

Scope it to the Cloudflare account that owns `renal-dose-calculator`.

Wrangler direct deploy can still be used during development:

```bash
npm run deploy
```

Use direct deploy only as a temporary preview path once GitHub auto-deploy is
connected.
