import { NextResponse } from 'next/server';
import { generateArticle } from '@/lib/content-engine';
import { publishTo } from '@/lib/publish';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Citation-Gap → Patch (SPEC §3.5.1). Given a query where AI engines don't cite
// us, generate a GEO-optimised article engineered to become the cited answer,
// and optionally publish it. Closes the agentic loop from the Gap Board.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    query?: string;
    lang?: 'he' | 'en';
    context?: string;
    publish?: { cms: string; config: Record<string, unknown>; status?: 'draft' | 'publish' };
  };
  if (!body.query?.trim()) return NextResponse.json({ error: 'no_query' }, { status: 400 });

  try {
    const article = await generateArticle({
      keyword: body.query.trim(),
      lang: body.lang ?? 'he',
      context: body.context,
      notes:
        'זהו patch לסגירת פער-ציטוט במנועי AI. בנה תשובה עצמאית, עובדתית ומיוחסת שראויה להיות המקור המצוטט: ' +
        'תשובה ישירה ב-40-60 המילים הראשונות, מבנה שאלה-תשובה, מקורות/נתונים, וישות מותג ברורה.',
    });
    if (!article) return NextResponse.json({ error: 'generation_failed' }, { status: 500 });

    let publishedUrl: string | undefined;
    if (body.publish?.cms && body.publish.config) {
      const schemaTag = `\n<script type="application/ld+json">${JSON.stringify(article.schema_json)}</script>`;
      const res = await publishTo(body.publish.cms, body.publish.config, {
        title: article.title,
        content_html: article.body_html + schemaTag,
        excerpt: article.meta,
        status: body.publish.status ?? 'draft',
      });
      if (!res.ok) return NextResponse.json({ article, publish_error: res.error }, { status: 200 });
      publishedUrl = res.url;
    }

    return NextResponse.json({ article, publishedUrl });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
