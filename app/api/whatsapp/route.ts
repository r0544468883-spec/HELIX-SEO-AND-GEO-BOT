import { NextResponse } from 'next/server';
import { handleMessage } from '@/lib/bot/agent';
import { sendWhatsApp } from '@/lib/bot/channels';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// WhatsApp Cloud API webhook — inbound control, mirrors app/api/telegram/route.ts.
// The user WhatsApps the bot; if their number is linked to a site (channel_bindings),
// the agent answers with THAT site's real data. Otherwise it answers generically and
// nudges them to link. Reply credentials come from the site's whatsapp connection
// (or, when unlinked, from the connection matching the receiving phone_number_id).
//
// Set up: in Meta → WhatsApp → Configuration set the callback URL to
// https://<host>/api/whatsapp and the verify token to WHATSAPP_VERIFY_TOKEN.

// GET — Meta webhook verification handshake.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

type WaCreds = { access_token?: string; phone_number_id?: string };

// POST — inbound message. Return 200 fast so Meta doesn't retry.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const value = (body as { entry?: { changes?: { value?: Record<string, unknown> }[] }[] })
    ?.entry?.[0]?.changes?.[0]?.value as
    | { messages?: { from?: string; type?: string; text?: { body?: string } }[]; metadata?: { phone_number_id?: string } }
    | undefined;
  const msg = value?.messages?.[0];
  const from = msg?.from; // bare digits, e.g. 972501234567
  const text = msg?.type === 'text' ? msg.text?.body : undefined;
  if (!from || !text) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: true });

  try {
    // Resolve the linked site from the sender's number.
    const { data: binding } = await admin
      .from('channel_bindings')
      .select('site_id')
      .eq('channel', 'whatsapp')
      .eq('identifier', from)
      .eq('verified', true)
      .maybeSingle();
    const siteId = (binding?.site_id as string | undefined) ?? null;

    // Find WhatsApp reply credentials: prefer the linked site's connection; otherwise
    // fall back to any whatsapp connection matching the receiving phone_number_id.
    let creds: WaCreds | null = null;
    if (siteId) {
      const { data: conn } = await admin
        .from('site_connections')
        .select('credentials')
        .eq('site_id', siteId)
        .eq('provider', 'whatsapp')
        .maybeSingle();
      creds = (conn?.credentials as WaCreds) ?? null;
    }
    if (!creds?.access_token || !creds?.phone_number_id) {
      const recvId = value?.metadata?.phone_number_id;
      const { data: conns } = await admin.from('site_connections').select('credentials').eq('provider', 'whatsapp');
      const match = (conns ?? [])
        .map((c) => c.credentials as WaCreds)
        .find((c) => c?.phone_number_id && (!recvId || c.phone_number_id === recvId));
      if (match?.access_token && match?.phone_number_id) creds = match;
    }
    if (!creds?.access_token || !creds?.phone_number_id) return NextResponse.json({ ok: true });

    const reply = siteId
      ? await handleMessage(text, { siteId, lang: 'he' })
      : (await handleMessage(text, { lang: 'he' })) +
        '\n\nℹ️ כדי לקבל נתונים אמיתיים של האתר שלך, קשרו את המספר הזה בדשבורד (מסך "האתרים שלי").';
    await sendWhatsApp({ access_token: creds.access_token, phone_number_id: creds.phone_number_id }, from, reply);
  } catch {
    // Swallow — always ack so Meta doesn't retry-storm.
  }
  return NextResponse.json({ ok: true });
}
