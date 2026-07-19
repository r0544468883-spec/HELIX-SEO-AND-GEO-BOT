import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegram, sendEmail, sendWhatsApp } from '@/lib/bot/channels';

export const dynamic = 'force-dynamic';

// Daily digest — the outbound half of multi-channel. For each site, compose a
// morning brief (open opportunities, pending drafts) and send it to the site's
// bound channels. Wire to a Vercel Cron; protect with ?secret=DIGEST_SECRET.
export async function GET(req: Request) {
  const secret = process.env.DIGEST_SECRET;
  const provided = new URL(req.url).searchParams.get('secret');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const { data: bindings } = await admin
    .from('channel_bindings')
    .select('site_id, channel, identifier')
    .eq('verified', true);

  // Group bindings by site.
  const bySite = new Map<string, { channel: string; identifier: string }[]>();
  for (const b of bindings ?? []) {
    const list = bySite.get(b.site_id as string) ?? [];
    list.push({ channel: b.channel as string, identifier: b.identifier as string });
    bySite.set(b.site_id as string, list);
  }

  let sent = 0;
  for (const [siteId, channels] of bySite) {
    const { data: site } = await admin.from('sites').select('url').eq('id', siteId).maybeSingle();
    const [{ count: opps }, { count: drafts }] = await Promise.all([
      admin.from('gsc_opportunities').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'open'),
      admin.from('content_pieces').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'draft'),
    ]);
    const body =
      `🌅 בוקר טוב — ${site?.url ?? ''}\n` +
      `📊 ${opps ?? 0} הזדמנויות פתוחות (Striking Distance / פערים)\n` +
      `✍️ ${drafts ?? 0} מאמרים ממתינים לאישור\n` +
      `השב "מה המצב" לפרטים, או "כתוב מאמר על …".`;

    for (const c of channels) {
      let res = { ok: false };
      if (c.channel === 'telegram' && process.env.TELEGRAM_BOT_TOKEN) {
        res = await sendTelegram(process.env.TELEGRAM_BOT_TOKEN, c.identifier, body);
      } else if (c.channel === 'email') {
        res = await sendEmail(c.identifier, 'הדייג׳סט היומי — HELIX Rank', body);
      } else if (c.channel === 'whatsapp') {
        const { data: conn } = await admin
          .from('site_connections')
          .select('credentials')
          .eq('site_id', siteId)
          .eq('provider', 'whatsapp')
          .maybeSingle();
        const cfg = conn?.credentials as { access_token?: string; phone_number_id?: string } | undefined;
        if (cfg?.access_token && cfg?.phone_number_id) {
          res = await sendWhatsApp({ access_token: cfg.access_token, phone_number_id: cfg.phone_number_id }, c.identifier, body);
        }
      }
      if (res.ok) sent++;
    }
  }

  return NextResponse.json({ sites: bySite.size, messages_sent: sent });
}
