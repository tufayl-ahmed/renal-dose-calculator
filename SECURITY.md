# Security Policy

## Secrets

Do not commit real API tokens, webhook secrets, Cloudflare credentials, Meta
tokens, Telegram bot tokens, WhatsApp access tokens, private keys, or `.env`
files.

Use Cloudflare Pages secrets for production values:

```bash
npx wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name renal-dose-calculator
npx wrangler pages secret put TELEGRAM_WEBHOOK_SECRET --project-name renal-dose-calculator
npx wrangler pages secret put WHATSAPP_VERIFY_TOKEN --project-name renal-dose-calculator
npx wrangler pages secret put WHATSAPP_PHONE_NUMBER_ID --project-name renal-dose-calculator
npx wrangler pages secret put WHATSAPP_ACCESS_TOKEN --project-name renal-dose-calculator
npx wrangler pages secret put WHATSAPP_APP_SECRET --project-name renal-dose-calculator
```

## If A Secret Is Exposed

1. Revoke or rotate the exposed token at the provider.
2. Update the Cloudflare Pages secret.
3. Remove the value from Git history before making the repository public.
4. Redeploy and test the affected integration.

## Clinical Safety

This repository contains educational clinical decision-support software. It is
not a prescribing system. Changes that affect renal calculations, dose parsing,
route selection, or drug-label interpretation should include tests and clinical
review before production use.
