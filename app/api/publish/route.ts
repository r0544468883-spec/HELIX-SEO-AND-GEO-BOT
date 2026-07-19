import { NextResponse } from 'next/server';
import { publishTo } from '@/lib/publish';

export const dynamic = 'force-dynamic';

// Publish an article to any supported CMS (WordPress / Webflow / Wix / webhook).
// MVP: cms type + config passed in the request.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    body_html?: string;
    meta?: string;
    schema_json?: unknown;
    status?: 'draft' | 'publish';
    cms?: string;
    config?: Record<string, unknown>;
    wp?: Record<string, unknown>; // backwards-compat
  };
  if (!body.title || !body.body_html) return NextResponse.json({ error: 'no_article' }, { status: 400 });

  const cms = body.cms ?? 'wordpress';
  const config = body.config ?? body.wp;
  if (!config) return NextResponse.json({ error: 'no_cms_config' }, { status: 400 });

  // Inline the JSON-LD schema so GEO structured data ships with the post.
  const schemaTag = body.schema_json
    ? `\n<script type="application/ld+json">${JSON.stringify(body.schema_json)}</script>`
    : '';

  const res = await publishTo(cms, config, {
    title: body.title,
    content_html: body.body_html + schemaTag,
    excerpt: body.meta,
    status: body.status ?? 'draft',
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({ ok: true, url: res.url, id: res.id });
}
