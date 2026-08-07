import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runActLoop, type ActSummary } from '@/lib/act/loop';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // agentic loop can run long on a large site

// The daily "act" loop endpoint — the autonomy the SPEC (§3.99) left open.
// Wire to a Vercel Cron (e.g. daily 05:00) and protect with ?secret=ACT_SECRET.
// ?site=<id> runs a single site (attended test); no param runs every site.
// It queues quick wins + (autopilot) drafts one gated page, and NEVER publishes
// live — approval/publish stays a separate, human-owned step.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.ACT_SECRET;
  if (secret && url.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const only = url.searchParams.get('site');
  let q = admin.from('sites').select('id, url, content_lang');
  if (only) q = q.eq('id', only);
  const { data: sites, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: ActSummary[] = [];
  for (const s of sites ?? []) {
    try {
      results.push(await runActLoop(admin, s as { id: string; url: string; content_lang?: string }));
    } catch (e) {
      results.push({
        site: (s as { url: string }).url,
        date: new Date().toISOString().slice(0, 10),
        quickWins: 0,
        newPage: 'none',
        degraded: [`ריצה נכשלה: ${(e as Error).message}`],
        readout: '',
      });
    }
  }

  return NextResponse.json({ sites: results.length, results });
}
