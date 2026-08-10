// POST /api/act/trigger — cross-product hook (Phase 4). Lets the HELIX Dashboards
// hub kick Rank to run its act loop (per site) when SEO/traffic slips. Secret-gated.
// SAFETY: runActLoop applies Rank's OWN switch — it only publishes live when
// rank.publish=autopilot+risk_ack; otherwise it queues quick-wins / drafts.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runActLoop } from '@/lib/act/loop';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = process.env.CROSS_ACT_SECRET;
  if (!secret || req.headers.get('x-cross-act-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 503 });

  const { data: sites } = await admin.from('sites').select('id, url, content_lang, cms_type');
  const results: unknown[] = [];
  for (const s of sites ?? []) {
    try {
      results.push(await runActLoop(admin, s as { id: string; url: string; content_lang?: string; cms_type?: string | null }));
    } catch { /* one failing site must not abort the sweep */ }
  }
  return NextResponse.json({ ok: true, sites: results.length, results });
}
