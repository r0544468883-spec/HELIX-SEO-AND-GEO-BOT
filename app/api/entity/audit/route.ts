import { NextResponse } from 'next/server';
import { auditEntity } from '@/lib/entity/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Entity Audit — score how well AI knows a brand/person as an entity
// (Wikidata item + depth, Wikipedia article, schema.org sameAs linking).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; domain?: string };
  const name = (body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }
  try {
    const report = await auditEntity({ name, domain: (body.domain ?? '').trim() || undefined });
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
