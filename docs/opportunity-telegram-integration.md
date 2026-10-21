# Opportunity Tracker Telegram integration

Telegram is a thin, private-chat-only client for the existing Opportunity capture queue. It does not have a separate extractor or opportunity database.

## Data model

- `messaging_connections` holds one Telegram connection per Supabase user. A pending connection row also holds the SHA-256 hash and expiry of the current single-use link token.
- `messaging_events` deduplicates inbound Telegram updates and provides a durable outbox for replies.
- `opportunity_capture_jobs` remains the only background capture queue. Telegram jobs reference their inbound messaging event.
- `saved_opportunities` remains the final opportunity store.

All messaging tables are service-role-only. The browser reaches them through authenticated API endpoints; it cannot select or mutate them directly.

## Capture lifecycle

1. The dashboard creates a 32-byte, base64url account-link token, stores only its SHA-256 hash for ten minutes, and opens `https://t.me/<bot>?start=<token>`.
2. The webhook validates `X-Telegram-Bot-Api-Secret-Token`, inserts the inbound `update_id` under a unique constraint, and accepts private chats only.
3. Text, exact URLs, forwarded text, PDFs, images, and voice notes enqueue through `enqueueOpportunityCaptureJob`.
4. Telegram files are downloaded only while processing and copied to the existing private `opportunity-capture-files` bucket. Voice notes are transcribed through the replaceable `transcribeAudio()` service. It prefers OpenAI when configured and otherwise uses the existing Google AI key; Google-hosted temporary audio is deleted immediately after transcription.
5. Existing success cleanup removes temporary source files immediately. Final failures use the existing 24-hour recovery window.
6. Outbound acknowledgements and final results are durable events; the existing one-minute capture cron retries pending jobs and failed Telegram deliveries.

## Production activation

1. Create the bot through Telegram's official `@BotFather` and retain its token outside the repository.
2. Apply only `supabase/migrations/20261021120000_create_telegram_integration.sql` to the linked project.
3. Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`, and `TELEGRAM_BOT_ENABLED=true` to Vercel Production. Voice transcription also requires either the already configured `GOOGLE_API_KEY`/`GEMINI_API_KEY` or `OPENAI_API_KEY`.
4. Deploy the application.
5. The first authenticated **Connect Telegram** request verifies the bot username, sets commands and descriptions, configures the HTTPS webhook, and verifies it. `scripts/configure-telegram-bot.mjs` remains available as a manual recovery tool from a secure environment containing the production values.
6. In Opportunity Tracker settings, choose **Connect**, press Telegram's **Start** button, and submit one URL and one voice note.

Never commit the bot token, webhook secret, raw account-link token, or AI provider key. A duplicate webhook must receive HTTP 200 after its existing event is found so Telegram does not retry it indefinitely.
