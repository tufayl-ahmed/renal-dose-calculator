# WhatsApp Cloud API setup

The app now includes a Cloudflare Pages Function at:

```text
https://renal-dose-calculator.pages.dev/api/whatsapp/webhook
```

Use this as the callback URL in the Meta WhatsApp Cloud API webhook settings.

## Cloudflare secrets

Set these in Cloudflare Pages before enabling the webhook:

```bash
npx wrangler pages secret put WHATSAPP_VERIFY_TOKEN --project-name renal-dose-calculator
npx wrangler pages secret put WHATSAPP_ACCESS_TOKEN --project-name renal-dose-calculator
npx wrangler pages secret put WHATSAPP_PHONE_NUMBER_ID --project-name renal-dose-calculator
npx wrangler pages secret put WHATSAPP_APP_SECRET --project-name renal-dose-calculator
```

`WHATSAPP_ACCESS_TOKEN` should be a Meta Business System User token for
production. Use a temporary WhatsApp Cloud API token only for early testing,
because Meta expires temporary tokens.

`WHATSAPP_APP_SECRET` lets the webhook verify Meta's `x-hub-signature-256`
header. Once it is set, unsigned webhook POSTs are rejected.

`WHATSAPP_GRAPH_VERSION` is configured in `wrangler.toml` and can be updated
when Meta changes the recommended Graph API version.

## Duplicate-message protection

The webhook stores inbound WhatsApp message IDs for 24 hours in a Cloudflare KV
namespace. This prevents duplicate replies when Meta retries webhook delivery.

`wrangler.toml` must include this binding:

```toml
[[kv_namespaces]]
binding = "WHATSAPP_DEDUPE"
id = "<cloudflare-kv-namespace-id>"
```

## Meta dashboard

1. Create or open a Meta app with the WhatsApp product enabled.
2. Add a WhatsApp Business Account and sender phone number.
3. In Business Settings, create a System User for the bot.
4. Assign the app to that System User with app management access.
5. Assign the WhatsApp Business Account if Meta requires it.
6. Generate a System User access token for the app.
7. Select the WhatsApp permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
8. Store that token as `WHATSAPP_ACCESS_TOKEN` in Cloudflare.
9. In WhatsApp webhooks, set the callback URL to the endpoint above.
10. Set the verify token to the same value as `WHATSAPP_VERIFY_TOKEN`.
11. Subscribe the webhook to the `messages` field.

If Meta says no permissions are available during token generation, the System
User usually still needs either the app assigned, the WhatsApp account assigned,
or both.

## Doctor message format

Examples the bot understands:

```text
45 M 2.1 70 meropenem IV
wt 70 piptaz IV S. Creatinine 2.1 male age 45
45 M 2.1 70
```

If a drug is included, the reply contains eGFR, CrCl, renal band, dose,
frequency, DailyMed source, and the educational disclaimer. If no drug is
included, it replies with eGFR and CrCl only.
