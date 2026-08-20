import { NextResponse } from 'next/server';
import { analyzeBrandProtection } from '@/lib/geo/brand-protection';
import { findSiteByDomain, saveBrandProtectionRun } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // brand prompts × engines × Claude analysis — slow

// Brand Protection — run brand prompts through the AI engines, score how they portray
// the brand, and flag negative framing / wrong facts. Persists alerts if the brand's
// domain maps to one of the caller's sites.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    brand?: string;
    domain?: string;
    truth?: string;
    prompts?: string[];
    engines?: string[];
  };
  const brand = (body.brand ?? '').trim();
  if (!brand) return NextResponse.json({ error: 'brand_required' }, { status: 400 });

  try {
    const report = await analyzeBrandProtection({
      brand,
      truth: body.truth?.trim() || undefined,
      prompts: (body.prompts ?? []).map((p) => p.trim()).filter(Boolean),
      engines: body.engines,
    });
    if (report.checks.length === 0) {
      return NextResponse.json({ error: 'no_engine_configured' }, { status: 400 });
    }

    let persisted = false;
    try {
      if (body.domain) {
        const siteId = await findSiteByDomain(body.domain);
        if (siteId) {
          const { error } = await saveBrandProtectionRun(siteId, report);
          persisted = !error;
        }
      }
    } catch {
      // persistence non-fatal
    }

    return NextResponse.json({ report, persisted });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
