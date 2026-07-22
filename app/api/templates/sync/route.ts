// POST /api/templates/sync?secret=... — registers every HELIX Rank WhatsApp template
// in the catalog on the site's WABA (Meta message_templates). Idempotent: templates
// that already exist are treated as OK. Run once after wiring the WABA, and again
// whenever the catalog changes. Templates then need Meta APPROVAL (async).
// Body (optional): { site_id } — otherwise pass ?site_id=. The site's WhatsApp
// credentials (access_token, waba_id) live in site_connections (provider='whatsapp').
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createWhatsAppTemplate } from '@/lib/bot/channels';
import { allRegistrationPayloads } from '@/lib/templates/whatsapp-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.TEMPLATES_SYNC_SECRET || process.env.DIGEST_SECRET;
  const provided = request.nextUrl.searchParams.get('secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { site_id?: string };
  const siteId = body?.site_id || request.nextUrl.searchParams.get('site_id') || undefined;
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || '';
  if (!siteId) return NextResponse.json({ error: 'site_id required' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const { data: conn } = await admin
    .from('site_connections')
    .select('credentials')
    .eq('site_id', siteId)
    .eq('provider', 'whatsapp')
    .maybeSingle();
  const cfg = (conn?.credentials ?? {}) as { access_token?: string; waba_id?: string };
  if (!cfg.access_token) return NextResponse.json({ error: 'whatsapp access_token missing in site_connections' }, { status: 400 });
  if (!cfg.waba_id) return NextResponse.json({ error: 'waba_id missing in site_connections credentials (add it to register templates)' }, { status: 400 });

  const results: { name: unknown; ok: boolean; status?: string; error?: string }[] = [];
  for (const payload of allRegistrationPayloads(appUrl)) {
    const r = await createWhatsAppTemplate({ access_token: cfg.access_token }, cfg.waba_id, payload);
    results.push({ name: payload.name, ok: r.ok, status: r.status, error: r.error });
  }
  return NextResponse.json({ ok: true, registered: results.filter((r) => r.ok).length, total: results.length, results });
}
