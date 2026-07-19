import { NextResponse } from 'next/server';
import { generateLlmsTxt, type LlmsPage } from '@/lib/geo/llms-txt';

export const dynamic = 'force-dynamic';

// Generate an llms.txt manifest (GEO — helps AI engines find key pages).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    summary?: string;
    pages?: LlmsPage[];
  };
  if (!body.name) return NextResponse.json({ error: 'no_name' }, { status: 400 });
  const txt = generateLlmsTxt({ name: body.name, summary: body.summary }, body.pages ?? []);
  return new NextResponse(txt, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
