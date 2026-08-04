import { NextResponse } from 'next/server';
import { buildLocalBusinessSchema, buildHreflangTags, type IsraeliBusiness } from '@/lib/seo/israeli-schema';

export const dynamic = 'force-dynamic';

// Generate Israeli LocalBusiness JSON-LD (+ optional hreflang tags) for a site.
// Consumed by the publishing adapters / dashboard "structured data" panel.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as IsraeliBusiness & {
    hreflang?: { he: string; en?: string };
  };
  if (!body?.name || !body?.url) {
    return NextResponse.json({ error: 'name_and_url_required' }, { status: 400 });
  }
  const schema = buildLocalBusinessSchema(body);
  const hreflang = body.hreflang ? buildHreflangTags(body.hreflang) : null;
  return NextResponse.json({ schema, hreflang });
}
