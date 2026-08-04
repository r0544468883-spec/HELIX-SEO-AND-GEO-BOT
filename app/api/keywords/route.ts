import { NextResponse } from 'next/server';
import { keywordOverview, opportunityScore } from '@/lib/semrush';
import { expandMany, expandHebrewKeyword } from '@/lib/hebrew-morphology';

export const dynamic = 'force-dynamic';

// Keyword research — volume/difficulty/CPC + opportunity score, per phrase.
// `expand: true` first runs Hebrew morphology (prefixes/plural/definite) so we
// research the variants Israelis actually search, not just the base form.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    phrases?: string[];
    database?: string;
    expand?: boolean;
  };
  const seeds = (body.phrases ?? []).map((p) => p.trim()).filter(Boolean);
  if (seeds.length === 0) return NextResponse.json({ error: 'no_phrases' }, { status: 400 });

  // With expand, blow each seed up into morphological variants (capped); else use as-is.
  const phrases = (body.expand ? expandMany(seeds, 60) : seeds).slice(0, 25);

  try {
    const out = [];
    for (const phrase of phrases) {
      const kw = await keywordOverview(phrase, body.database).catch(() => null);
      if (kw) out.push({ ...kw, opportunity: opportunityScore(kw) });
    }
    out.sort((a, b) => b.opportunity - a.opportunity);
    // Always return the morphology map too — useful even with no keyword-data key.
    const variants = seeds.map((seed) => ({ seed, variants: expandHebrewKeyword(seed) }));
    return NextResponse.json({ keywords: out, variants });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
