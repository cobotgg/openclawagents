/**
 * Cobot AI - Tenant Worker Template
 *
 * Each tenant Worker:
 * 1. Validates Telegram webhook secret
 * 2. Parses Telegram update -> extracts message text
 * 3. Sends to OpenClaw container via Service Binding (/v1/chat/completions)
 * 4. Extracts AI response and replies via Telegram sendMessage API
 *
 * The tenant Worker bridges Telegram <-> OpenClaw's OpenAI-compatible API.
 */

export function generateTenantWorkerCode(): string {
  return `
// Cobot AI Tenant Worker - Telegram <-> OpenClaw Bridge
// Translates Telegram webhooks to OpenClaw chat completions API

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', tenant: env.TENANT_ID });
    }

    // Only accept POST for webhooks
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Validate Telegram webhook secret
    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!secretHeader || secretHeader !== env.WEBHOOK_SECRET) {
      console.error('[AUTH] Webhook secret mismatch');
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse Telegram update
    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const message = update.message;
    if (!message || !message.chat) {
      return new Response('Ok'); // Acknowledge non-message updates
    }

    const chatId = message.chat.id;
    const userText = message.text || '';

    // Handle /start command
    if (userText === '/start') {
      await sendTg(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        text: 'Welcome! I am your AI assistant powered by Cobot AI. Send me any message to get started.',
      });
      return new Response('Ok');
    }

    // Ignore non-text messages
    if (!userText) {
      return new Response('Ok');
    }

    // Send typing indicator (non-blocking)
    ctx.waitUntil(
      sendTg(env.TELEGRAM_BOT_TOKEN, 'sendChatAction', {
        chat_id: chatId,
        action: 'typing',
      }).catch(() => {})
    );

    try {
      // Forward to OpenClaw container's chat completions endpoint
      const chatReq = new Request('https://internal/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': env.TENANT_ID,
          'X-Telegram-User-ID': env.TELEGRAM_USER_ID || '',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: userText }],
          stream: false,
        }),
      });

      const res = await env.SANDBOX.fetch(chatReq);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[CHAT] Container error ' + res.status + ': ' + errText);
        throw new Error('Container returned ' + res.status);
      }

      const completion = await res.json();
      // Support both OpenAI chat completions and responses API formats
      const assistantMsg = completion.choices?.[0]?.message?.content
        || completion.output?.[0]?.content?.[0]?.text
        || 'I could not generate a response.';

      // Reply via Telegram
      await sendTg(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        text: assistantMsg,
      });

      return new Response('Ok');
    } catch (error) {
      console.error('[ERROR]', error.message || error);

      // Notify user of error
      await sendTg(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        text: 'Your AI agent is starting up or encountered an error. Please try again in 30-60 seconds.',
      }).catch(() => {});

      return new Response('Ok');
    }
  }
};

async function sendTg(botToken, method, body) {
  return fetch('https://api.telegram.org/bot' + botToken + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
`
}
