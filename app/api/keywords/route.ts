import { NextResponse } from 'next/server';
import { keywordOverview, opportunityScore } from '@/lib/semrush';

export const dynamic = 'force-dynamic';

// Keyword research — volume/difficulty/CPC + opportunity score, per phrase.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { phrases?: string[]; database?: string };
  const phrases = (body.phrases ?? []).map((p) => p.trim()).filter(Boolean).slice(0, 25);
  if (phrases.length === 0) return NextResponse.json({ error: 'no_phrases' }, { status: 400 });

  try {
    const out = [];
    for (const phrase of phrases) {
      const kw = await keywordOverview(phrase, body.database).catch(() => null);
      if (kw) out.push({ ...kw, opportunity: opportunityScore(kw) });
    }
    out.sort((a, b) => b.opportunity - a.opportunity);
    return NextResponse.json({ keywords: out });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
