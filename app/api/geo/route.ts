import { NextResponse } from 'next/server';
import { analyzeCitations } from '@/lib/geo/citation';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// GEO citation analysis — run a prompt panel across AI engines and report where
// we're cited, per-engine presence, Share-of-Voice, and the gaps to patch.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    brand?: string;
    queries?: string[];
    competitors?: string[];
    engines?: string[];
  };
  const queries = (body.queries ?? []).map((q) => q.trim()).filter(Boolean);
  if (!body.domain || queries.length === 0) {
    return NextResponse.json({ error: 'domain_and_queries_required' }, { status: 400 });
  }

  try {
    const report = await analyzeCitations({
      domain: body.domain,
      brand: body.brand,
      queries,
      competitors: body.competitors,
      engines: body.engines,
    });
    if (report.results.length === 0) {
      return NextResponse.json({ error: 'no_engine_configured' }, { status: 400 });
    }
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
