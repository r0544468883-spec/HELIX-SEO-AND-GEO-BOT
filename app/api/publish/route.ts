import { NextResponse } from 'next/server';
import { publishToWordPress, type WpConfig } from '@/lib/publish/wordpress';

export const dynamic = 'force-dynamic';

// Publish an article to WordPress. MVP: WP config passed in the request
// (later: read from the site's stored site_connections).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    body_html?: string;
    meta?: string;
    schema_json?: unknown;
    status?: 'draft' | 'publish';
    wp?: WpConfig;
  };
  if (!body.title || !body.body_html) return NextResponse.json({ error: 'no_article' }, { status: 400 });
  if (!body.wp) return NextResponse.json({ error: 'no_wp_config' }, { status: 400 });

  // Inline the JSON-LD schema so GEO structured data ships with the post.
  const schemaTag = body.schema_json
    ? `\n<script type="application/ld+json">${JSON.stringify(body.schema_json)}</script>`
    : '';

  const res = await publishToWordPress(body.wp, {
    title: body.title,
    content_html: body.body_html + schemaTag,
    excerpt: body.meta,
    status: body.status ?? 'draft',
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({ ok: true, url: res.url, id: res.id });
}
