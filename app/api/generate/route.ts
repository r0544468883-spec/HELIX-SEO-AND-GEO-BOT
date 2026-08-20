import { NextResponse } from 'next/server';
import { generateArticle } from '@/lib/content-engine';
import { saveContentPiece, getVoiceProfile } from '@/lib/db';
import { extractVoiceProfile, type VoiceProfile } from '@/lib/voice';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Generate a full SEO+GEO article from a keyword (Hebrew via the writing skill).
// If a siteId is supplied (and the user is authed), the draft is persisted.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    keyword?: string;
    lang?: 'he' | 'en';
    context?: string;
    intent?: string;
    notes?: string;
    siteId?: string;
    withImage?: boolean;
    voice?: VoiceProfile | null; // inline voice profile (e.g. from a not-yet-saved sample)
    voiceSamples?: string[]; // OR raw samples to learn a voice from, one-off for this run
    useVoice?: boolean; // load the site's saved voice profile (default true when siteId present)
  };
  if (!body.keyword?.trim()) return NextResponse.json({ error: 'no_keyword' }, { status: 400 });

  try {
    // Resolve the author's voice: explicit inline profile → learn-from-samples → site's saved profile.
    let voice: VoiceProfile | null = body.voice ?? null;
    if (!voice && body.voiceSamples?.length) voice = await extractVoiceProfile(body.voiceSamples);
    if (!voice && body.siteId && body.useVoice !== false) voice = await getVoiceProfile(body.siteId);

    const article = await generateArticle({
      keyword: body.keyword.trim(),
      lang: body.lang ?? 'he',
      context: body.context,
      intent: body.intent,
      notes: body.notes,
      withImage: body.withImage,
      voice,
    });
    if (!article) return NextResponse.json({ error: 'generation_failed' }, { status: 500 });

    let contentId: string | undefined;
    if (body.siteId) {
      const saved = await saveContentPiece(
        body.siteId,
        { title: article.title, body: article.body_html, schema_json: article.schema_json, lang: article.lang },
        'draft'
      );
      contentId = saved.id;
    }
    return NextResponse.json({ article, contentId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
