import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchAiTraffic, summarizeByPage } from '@/lib/ga4';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// AI Traffic — which of your pages actually get visits FROM AI engines
// (ChatGPT/Perplexity/Gemini/Claude/Copilot), per the GA4 method. Uses the
// connected Google token (cookie) + a GA4 property id.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { propertyId?: string; accessToken?: string; days?: number };
  const property = (body.propertyId ?? '').replace(/^properties\//, '');
  if (!property) return NextResponse.json({ error: 'property_id_required' }, { status: 400 });

  const token = body.accessToken ?? (await cookies()).get('gsc_token')?.value;
  if (!token) return NextResponse.json({ error: 'google_not_connected' }, { status: 401 });

  try {
    const rows = await fetchAiTraffic(token, property, body.days ?? 90);
    const pages = summarizeByPage(rows);
    const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
    return NextResponse.json({ totalSessions, pages, rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
