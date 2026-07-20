import { NextResponse } from 'next/server';
import { auditAeo } from '@/lib/seo/aeo-audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// AEO Audit — grade a LIVE url for AI answer-engine readiness (llms.txt, robots
// AI-bot access, sitemap, JSON-LD, FAQ schema, meta, BLUF, headings).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const url = (body.url ?? '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'valid_url_required' }, { status: 400 });
  }
  try {
    const report = await auditAeo(url);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
