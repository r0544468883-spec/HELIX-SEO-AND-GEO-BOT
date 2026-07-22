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

const GRAPH = 'https://graph.facebook.com/v21.0';

// Send an APPROVED WhatsApp template — the compliant way to open a conversation
// proactively (outside the 24h window). `params` fill the body {{1}},{{2}}… in order.
// `urlButtonParam` fills a dynamic URL button suffix (e.g. a dashboard path).
export async function sendWhatsAppTemplate(
  config: { access_token: string; phone_number_id: string },
  to: string,
  templateName: string,
  language: string,
  params: string[],
  urlButtonParam?: string
): Promise<SendResult> {
  if (!config.access_token || !config.phone_number_id) return { ok: false, error: 'whatsapp_not_configured' };
  const components: Record<string, unknown>[] = [];
  if (params.length) {
    components.push({ type: 'body', parameters: params.map((t) => ({ type: 'text', text: t })) });
  }
  if (urlButtonParam !== undefined) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: urlButtonParam }] });
  }
  try {
    const res = await fetch(`${GRAPH}/${config.phone_number_id}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: templateName, language: { code: language }, ...(components.length ? { components } : {}) },
      }),
    });
    if (!res.ok) return { ok: false, error: `whatsapp_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Register (create) a message template on the WABA. Duplicate name → treated as OK.
export async function createWhatsAppTemplate(
  config: { access_token: string },
  wabaId: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; id?: string; error?: string; status?: string }> {
  if (!config.access_token) return { ok: false, error: 'whatsapp_not_configured' };
  try {
    const res = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; error?: { message?: string } };
    if (!res.ok) {
      if (json.error?.message?.toLowerCase().includes('already exists')) return { ok: true, status: 'exists' };
      return { ok: false, error: json.error?.message ?? `waba_${res.status}` };
    }
    return { ok: true, id: json.id, status: json.status };
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
