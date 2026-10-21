const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const botToken = required('TELEGRAM_BOT_TOKEN');
const webhookSecret = required('TELEGRAM_WEBHOOK_SECRET');
const siteUrl = (process.env.PUBLIC_SITE_URL?.trim() || 'https://abodid.com').replace(/\/$/, '');
const expectedUsername = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') || '';

const telegram = async (method, body = {}) => {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.description || `${method} failed`);
  return payload.result;
};

const me = await telegram('getMe');
if (expectedUsername && me.username?.toLowerCase() !== expectedUsername.toLowerCase()) {
  throw new Error(`TELEGRAM_BOT_USERNAME does not match @${me.username}`);
}

await telegram('setMyCommands', {
  commands: [
    { command: 'start', description: 'Connect or open Opportunity Tracker' },
    { command: 'help', description: 'See supported captures' },
    { command: 'settings', description: 'View Telegram settings' },
    { command: 'disconnect', description: 'Disconnect this Telegram account' },
  ],
});
await telegram('setMyDescription', {
  description: 'Send opportunity links, notes, forwarded text, PDFs, images, or voice notes. They are processed through your existing Opportunity Tracker.',
});
await telegram('setMyShortDescription', {
  short_description: 'Save opportunities to your personal radar from Telegram.',
});
await telegram('setWebhook', {
  url: `${siteUrl}/api/integrations/telegram/webhook`,
  secret_token: webhookSecret,
  allowed_updates: ['message', 'callback_query'],
  drop_pending_updates: false,
  max_connections: 40,
});

const webhook = await telegram('getWebhookInfo');
console.log(JSON.stringify({
  bot: `@${me.username}`,
  webhook_url: webhook.url,
  pending_update_count: webhook.pending_update_count,
  last_error_message: webhook.last_error_message || null,
}, null, 2));
