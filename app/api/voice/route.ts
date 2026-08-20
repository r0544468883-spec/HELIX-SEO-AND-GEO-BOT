import { NextResponse } from 'next/server';
import { extractVoiceProfile } from '@/lib/voice';
import { getVoiceProfile, saveVoiceProfile, deleteVoiceProfile } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Voice profile API — learn the user's authentic writing voice from samples they paste,
// so articles can be generated in their own voice. If a siteId is supplied (and the user
// owns it via RLS), the profile is persisted per-site and reused on every generation.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { samples?: unknown; siteId?: string };
  const samples = Array.isArray(body.samples) ? (body.samples as string[]) : [];
  if (samples.filter((s) => (s ?? '').trim()).length < 1) {
    return NextResponse.json({ error: 'no_samples' }, { status: 400 });
  }
  try {
    const voice = await extractVoiceProfile(samples);
    if (!voice) return NextResponse.json({ error: 'extraction_failed' }, { status: 422 });
    let saved = false;
    if (body.siteId) {
      const r = await saveVoiceProfile(body.siteId, voice);
      saved = !r.error;
    }
    return NextResponse.json({ voice, saved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });
  const voice = await getVoiceProfile(siteId);
  return NextResponse.json({ voice });
}

export async function DELETE(req: Request) {
  const siteId = new URL(req.url).searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'no_site' }, { status: 400 });
  await deleteVoiceProfile(siteId);
  return NextResponse.json({ ok: true });
}
