import { NextResponse } from 'next/server';
import { buildWikidataDraft, pushToWikidata } from '@/lib/entity/wikidata-write';

export const dynamic = 'force-dynamic';

// Entity push — build a Wikidata entity draft, and (if WIKIDATA_OAUTH_TOKEN is set)
// push it live via wbeditentity. Without credentials it returns the draft + a
// prefilled manual-submission URL, so the feature is always useful.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    nameEn?: string;
    description?: string;
    descriptionEn?: string;
    officialSite?: string;
    instanceOf?: 'business' | 'organization' | 'person' | 'brand';
    sameAs?: string[];
    qid?: string;
    live?: boolean; // attempt a live write (still requires credentials)
  };
  const name = (body.name ?? '').trim();
  const description = (body.description ?? '').trim();
  if (!name || !description) return NextResponse.json({ error: 'name_and_description_required' }, { status: 400 });

  const input = {
    name,
    nameEn: body.nameEn,
    description,
    descriptionEn: body.descriptionEn,
    officialSite: body.officialSite,
    instanceOf: body.instanceOf,
    sameAs: body.sameAs,
  };

  if (body.live) {
    const result = await pushToWikidata({ ...input, qid: body.qid });
    return NextResponse.json(result);
  }

  return NextResponse.json({ ok: true, draft: buildWikidataDraft(input) });
}
