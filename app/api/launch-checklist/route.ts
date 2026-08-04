import { NextResponse } from 'next/server';
import { runLaunchChecklist } from '@/lib/launch-checklist';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Post-launch checklist — auto-runs the checkable "10 things after launch" items.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const url = (body.url ?? '').trim();
  if (!url) return NextResponse.json({ error: 'url_required' }, { status: 400 });
  try {
    const report = await runLaunchChecklist(url);
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
