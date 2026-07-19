import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseGscInput, fetchSearchAnalytics, type GscRow } from '@/lib/gsc';
import { analyze } from '@/lib/striking-distance';
import { analyzeCannibalization, analyzeQuestions, analyzeDecay } from '@/lib/gsc-analyses';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type AnalysisType = 'striking' | 'cannibalization' | 'questions' | 'decay';

// Unified GSC Intelligence endpoint. Data comes from a pasted export, or live
// from a connected GSC account (cookie token).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    type?: AnalysisType;
    input?: string;
    previous?: string;
    lang?: 'he' | 'en';
    context?: string;
    useGsc?: boolean;
    siteUrl?: string;
  };
  const type = body.type ?? 'striking';
  const lang = body.lang ?? 'he';

  // Resolve the primary dataset.
  let rows: GscRow[] = [];
  try {
    if (body.useGsc && body.siteUrl) {
      const token = (await cookies()).get('gsc_token')?.value;
      if (!token) return NextResponse.json({ error: 'gsc_not_connected' }, { status: 401 });
      rows = await fetchSearchAnalytics(token, body.siteUrl);
    } else if (body.input) {
      rows = parseGscInput(body.input);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  if (rows.length === 0) return NextResponse.json({ error: 'no_rows' }, { status: 400 });

  try {
    if (type === 'striking') {
      const opportunities = await analyze(rows, { lang, context: body.context, limit: 5 });
      return NextResponse.json({ analyzed: rows.length, type, opportunities });
    }
    if (type === 'cannibalization') {
      const cases = await analyzeCannibalization(rows, lang);
      return NextResponse.json({ analyzed: rows.length, type, cases });
    }
    if (type === 'questions') {
      const items = await analyzeQuestions(rows, lang);
      return NextResponse.json({ analyzed: rows.length, type, items });
    }
    if (type === 'decay') {
      const previous = body.previous ? parseGscInput(body.previous) : [];
      if (previous.length === 0) return NextResponse.json({ error: 'decay_needs_previous' }, { status: 400 });
      const items = await analyzeDecay(rows, previous, lang);
      return NextResponse.json({ analyzed: rows.length, type, items });
    }
    return NextResponse.json({ error: 'unknown_type' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
