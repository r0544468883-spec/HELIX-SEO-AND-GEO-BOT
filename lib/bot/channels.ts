// Channel send adapters — deliver bot messages / digests over Telegram,
// WhatsApp, and email. Mirrors the helix-ops distribution pattern.
export type SendResult = { ok: boolean; error?: string };

// Telegram — reply/send to a chat.
export async function sendTelegram(botToken: string, chatId: string | number, text: string): Promise<SendResult> {
  if (!botToken) return { ok: false, error: 'telegram_not_configured' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) return { ok: false, error: `telegram_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// WhatsApp Cloud API — text inside an open 24h window (proactive → template).
export async function sendWhatsApp(config: { access_token: string; phone_number_id: string }, to: string, text: string): Promise<SendResult> {
  if (!config.access_token || !config.phone_number_id) return { ok: false, error: 'whatsapp_not_configured' };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    });
    if (!res.ok) return { ok: false, error: `whatsapp_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Email — via Resend.
export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return { ok: false, error: 'email_not_configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || 'HELIX Rank <onboarding@resend.dev>', to, subject, text }),
    });
    if (!res.ok) return { ok: false, error: `email_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
