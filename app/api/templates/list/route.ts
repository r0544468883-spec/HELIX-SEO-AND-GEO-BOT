// GET /api/templates/list?site=<id> — merged WhatsApp catalog for the management UI:
// built-in ∪ the site's custom templates. Each item is tagged source: 'builtin' | 'custom'
// (and overrides: true when a custom key shadows a built-in one) so the UI can mark it.
// SITE-SCOPED — HELIX Rank's tenant unit is the site, not a workspace.
import { NextRequest, NextResponse } from 'next/server';
import { TEMPLATES } from '@/lib/templates/whatsapp-catalog';
import { mergedWhatsAppTemplates, listCustom } from '@/lib/templates/custom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const siteId =
    request.nextUrl.searchParams.get('site') ||
    request.nextUrl.searchParams.get('site_id') ||
    process.env.DEFAULT_SITE_ID;
  if (!siteId) return NextResponse.json({ error: 'site required' }, { status: 400 });

  const builtinWa = new Set(Object.keys(TEMPLATES));
  const [waMerged, waCustomRows] = await Promise.all([
    mergedWhatsAppTemplates(siteId),
    listCustom(siteId, 'whatsapp'),
  ]);
  const waCustomKeys = new Set(waCustomRows.map((r) => (r as { key: string }).key));

  const whatsapp = Object.entries(waMerged).map(([key, d]) => ({
    key,
    name: d.name,
    language: d.language,
    category: d.category,
    body: d.body,
    params: d.params,
    sampleParams: d.sampleParams,
    quickReply: (d as { quickReply?: string[] }).quickReply ?? null,
    urlButton: d.urlButton ?? null,
    source: waCustomKeys.has(key) ? 'custom' : 'builtin',
    overrides: waCustomKeys.has(key) && builtinWa.has(key),
  }));

  return NextResponse.json({ whatsapp });
}
