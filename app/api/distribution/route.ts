import { NextResponse } from 'next/server';
import { generateDistribution, type DistroChannel } from '@/lib/geo/distribution';
import { findSiteByDomain, saveDistribution } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Multi-channel distribution — generate platform-tailored drafts for a topic and
// persist them if the domain maps to one of the caller's sites.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    topic?: string;
    brand?: string;
    url?: string;
    domain?: string;
    lang?: 'he' | 'en';
    channels?: DistroChannel[];
  };
  const topic = (body.topic ?? '').trim();
  if (!topic) return NextResponse.json({ error: 'topic_required' }, { status: 400 });

  try {
    const drafts = await generateDistribution({ topic, brand: body.brand, url: body.url, lang: body.lang, channels: body.channels });
    if (drafts.length === 0) return NextResponse.json({ error: 'generation_failed' }, { status: 500 });

    let persisted = false;
    try {
      if (body.domain) {
        const siteId = await findSiteByDomain(body.domain);
        if (siteId) {
          const { error } = await saveDistribution(siteId, topic, drafts);
          persisted = !error;
        }
      }
    } catch {
      // non-fatal
    }

    return NextResponse.json({ drafts, persisted });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
