// Custom templates — upload your OWN WhatsApp templates for a site, merged over the
// built-in catalog (a custom key OVERRIDES a built-in one). SITE-SCOPED via ?site=
// (or site_id in the body).
//   GET    ?site=&kind=                              → list custom templates
//   POST   { site_id?, kind, key, definition }       → upsert one
//   POST   { site_id?, templates: [{kind,key,definition}, ...] } → bulk upload
//   DELETE ?site=&kind=&key=                          → remove one
// kind ∈ 'whatsapp'. Custom WhatsApp templates still need /api/templates/sync + Meta
// approval before they can send out-of-window.
import { NextRequest, NextResponse } from 'next/server';
import { listCustom, upsertCustom, deleteCustom, type CustomKind } from '@/lib/templates/custom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function site(request: NextRequest, body?: { site_id?: string }): string | null {
  return body?.site_id || request.nextUrl.searchParams.get('site') || request.nextUrl.searchParams.get('site_id') || null;
}

export async function GET(request: NextRequest) {
  const siteId = site(request);
  if (!siteId) return NextResponse.json({ error: 'site required' }, { status: 400 });
  const kind = (request.nextUrl.searchParams.get('kind') as CustomKind | null) ?? undefined;
  return NextResponse.json({ templates: await listCustom(siteId, kind) });
}

export async function POST(request: NextRequest) {
  const b = await request.json().catch(() => null);
  const siteId = site(request, b);
  if (!siteId) return NextResponse.json({ error: 'site required' }, { status: 400 });

  const batch: { kind: CustomKind; key: string; definition: unknown }[] =
    Array.isArray(b?.templates) ? b.templates : b?.kind ? [{ kind: b.kind, key: b.key, definition: b.definition }] : [];
  if (!batch.length) return NextResponse.json({ error: 'provide {kind,key,definition} or {templates:[...]}' }, { status: 400 });

  const results = [];
  for (const t of batch) {
    if (!t.kind || !t.key || !t.definition) {
      results.push({ key: t.key, ok: false, error: 'kind, key, definition required' });
      continue;
    }
    const r = await upsertCustom(siteId, t.kind, t.key, t.definition);
    results.push({ key: t.key, ...r });
  }
  return NextResponse.json({ ok: results.every((r) => r.ok), saved: results.filter((r) => r.ok).length, results });
}

export async function DELETE(request: NextRequest) {
  const siteId = site(request);
  const kind = request.nextUrl.searchParams.get('kind') as CustomKind | null;
  const key = request.nextUrl.searchParams.get('key');
  if (!siteId || !kind || !key) return NextResponse.json({ error: 'site, kind, key required' }, { status: 400 });
  await deleteCustom(siteId, kind, key);
  return NextResponse.json({ ok: true });
}
