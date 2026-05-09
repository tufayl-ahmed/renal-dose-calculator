# Telegram Mini App Setup

The Telegram integration is intentionally Mini App only.

The bot does not calculate doses in chat, does not run a guided `/calc` flow,
and does not send copy-paste forms. Any Telegram message simply returns one
button that opens the calculator inside Telegram.

## Mini App URL

```text
https://renal-dose-calculator.pages.dev/?telegram=1
```

## Webhook URL

```text
https://renal-dose-calculator.pages.dev/api/telegram/webhook
```

## Cloudflare Secrets

Store the Telegram bot token:

```bash
npx wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name renal-dose-calculator
```

Store a random webhook secret:

```bash
npx wrangler pages secret put TELEGRAM_WEBHOOK_SECRET --project-name renal-dose-calculator
```

After changing either secret, redeploy Cloudflare Pages so the Function receives
the new values.

## Set The Webhook

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://renal-dose-calculator.pages.dev/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  -d "allowed_updates=[\"message\"]"
```

## Set The Bot Menu Button

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "Open Calculator",
      "web_app": {
        "url": "https://renal-dose-calculator.pages.dev/?telegram=1"
      }
    }
  }'
```

Clear old chat commands:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteMyCommands"
```

## Expected Behavior

Send any message to the bot, including `/start`.

The bot should reply with:

- a short Mini App launcher message
- one `Open Renal Dose Calculator` button

The calculator opens inside Telegram and uses the same Cloudflare Pages frontend
and DailyMed/openFDA backend as the public web app.
