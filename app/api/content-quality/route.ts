import { NextResponse } from 'next/server';
import { auditContentQuality } from '@/lib/seo/content-quality';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Content-quality audit — grade a LIVE url for orphan words (typographic widows)
// and AI-style emojis in prose. Both make a page read amateur / "AI-written".
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const url = (body.url ?? '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'valid_url_required' }, { status: 400 });
  }
  try {
    const report = await auditContentQuality(url);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
