# OpenWA experimental bridge

This is an experimental WhatsApp bridge for personal testing only. The production-safe WhatsApp path remains the official Meta WhatsApp Cloud API at `/api/whatsapp/webhook`.

OpenWA runs a WhatsApp Web session and exposes a REST API. It cannot run inside Cloudflare Pages/Workers, so it must be hosted separately on a VPS, Railway, local machine, or another always-on Docker host.

## Architecture

```text
WhatsApp message
  -> OpenWA self-hosted gateway
  -> POST /api/openwa/webhook on this app
  -> existing renal calculator reply builder
  -> OpenWA send-text API
  -> WhatsApp reply
```

The app endpoint is disabled by default and only turns on when `OPENWA_EXPERIMENT_ENABLED=true`.

## Safety rules

- Use a spare WhatsApp number for testing.
- Do not use this as the production public integration.
- Do not use bulk messaging.
- Keep group replies disabled unless deliberately testing in a private group.
- Keep the official Meta Cloud API integration in place for production.

## Cloudflare configuration

Set these variables/secrets for the Cloudflare Pages project:

```bash
npx wrangler pages secret put OPENWA_API_BASE_URL --project-name renal-dose-calculator
npx wrangler pages secret put OPENWA_API_KEY --project-name renal-dose-calculator
npx wrangler pages secret put OPENWA_SESSION_ID --project-name renal-dose-calculator
npx wrangler pages secret put OPENWA_WEBHOOK_SECRET --project-name renal-dose-calculator
```

Set non-secret runtime variables in the Cloudflare dashboard or `wrangler.toml`:

```text
OPENWA_EXPERIMENT_ENABLED=true
OPENWA_ALLOW_GROUPS=false
```

Recommended values:

| Variable | Example | Purpose |
|---|---|---|
| `OPENWA_API_BASE_URL` | `https://openwa.example.com` | Public URL of your OpenWA API. The app appends `/api` if missing. |
| `OPENWA_API_KEY` | secret | API key from OpenWA dashboard/config. |
| `OPENWA_SESSION_ID` | `renal-test` | Default OpenWA session used to send replies. Incoming `sessionId` overrides this. |
| `OPENWA_WEBHOOK_SECRET` | secret | Shared secret for webhook verification. |
| `OPENWA_EXPERIMENT_ENABLED` | `true` | Enables `/api/openwa/webhook`. |
| `OPENWA_ALLOW_GROUPS` | `false` | Keeps replies out of groups by default. |

## OpenWA setup

Use the OpenWA dashboard or API to create a session, scan the QR code, and register a webhook.

Webhook URL:

```text
https://renal-dose-calculator.pages.dev/api/openwa/webhook
```

Events:

```text
message.received
session.status
```

If your OpenWA version supports webhook secrets/HMAC, set its webhook secret to the same value as `OPENWA_WEBHOOK_SECRET`.

For early debugging only, if signature headers differ between OpenWA versions, either:

- add a request header `x-openwa-secret: <OPENWA_WEBHOOK_SECRET>` through OpenWA webhook request config, or
- temporarily use `https://renal-dose-calculator.pages.dev/api/openwa/webhook?secret=<OPENWA_WEBHOOK_SECRET>`.

Do not keep a secret in the URL once testing is complete.

## OpenWA API call used by this app

The bridge sends replies with:

```text
POST {OPENWA_API_BASE_URL}/api/sessions/{sessionId}/messages/send-text
X-API-Key: {OPENWA_API_KEY}
Content-Type: application/json
```

Body:

```json
{
  "chatId": "911234567890@c.us",
  "text": "formatted renal-dose reply"
}
```

## Test messages

```text
hi
form
45 M 2.1 70
45 M 2.1 70 meropenem IV
68 F 1.7 64 cephalexin oral
```

Expected behavior:

- `hi` returns the short bot introduction and format.
- `form` returns the copy-paste form.
- Kidney-only input returns eGFR and CrCl.
- Drug input returns eGFR, CrCl, route-specific dose guidance, DailyMed link when available, and the disclaimer.

## Rollback

Set:

```text
OPENWA_EXPERIMENT_ENABLED=false
```

This disables the experimental endpoint without touching the official WhatsApp Cloud API webhook.
