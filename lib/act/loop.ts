// The act loop orchestrator — the I/O half. Runs unattended per site:
// capture today's snapshot → diff vs the newest earlier snapshot → queue quick
// wins → (autopilot only) draft at most one page behind the quality gate →
// write a dated readout. Never publishes live and never fabricates a number;
// every missing input degrades to an honest "לא נמדד" line (act.md degrade table).
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchSearchAnalytics, type GscRow } from '../gsc';
import { analyze as buildQuickWinPlans } from '../striking-distance';
import { generateArticle } from '../content-engine';
import {
  buildDiff,
  composeReadout,
  type Snapshot,
  type ActActions,
} from './engine';

// The content quality gate (lib/seo/checks.ts, embedded in generateArticle):
// an article scoring below this stays a draft — the SaaS analog of seo-god's
// "restore the batch, mark edited-unverified" when the build gate is red.
const GATE_THRESHOLD = 70;

function localDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Build today's snapshot from whatever is actually connected. Each source fails
// closed to `available: false` with a reason — never to a fake zero.
async function captureSnapshot(admin: SupabaseClient, siteId: string, siteUrl: string): Promise<Snapshot> {
  const snap: Snapshot = {
    date: localDate(),
    gsc: { available: false, rows: [], clicks: null, impressions: null },
    ranks: { available: false, items: [] },
    issues: { available: false, items: [] }, // no crawler wired in Rank yet — honestly not measured
  };

  // GSC — needs a stored OAuth access token per site.
  const { data: conn } = await admin
    .from('site_connections')
    .select('credentials')
    .eq('site_id', siteId)
    .eq('provider', 'gsc')
    .maybeSingle();
  const token = (conn?.credentials as { access_token?: string } | undefined)?.access_token;
  if (token) {
    try {
      const rows: GscRow[] = await fetchSearchAnalytics(token, siteUrl, 90);
      snap.gsc = {
        available: true,
        rows,
        clicks: rows.reduce((s, r) => s + (r.clicks || 0), 0),
        impressions: rows.reduce((s, r) => s + (r.impressions || 0), 0),
      };
    } catch {
      snap.gsc.available = false; // token expired / API error → not measured this run
    }
  }

  // Tracker ranks — from tracked keywords (free path: current_rank is usually null).
  const { data: kws } = await admin
    .from('keywords')
    .select('phrase, current_rank')
    .eq('site_id', siteId)
    .eq('tracked', true);
  if (kws && kws.length) {
    snap.ranks = {
      available: kws.some((k) => k.current_rank != null),
      items: kws.map((k) => ({ keyword: k.phrase as string, url: '', position: (k.current_rank as number | null) ?? null })),
    };
  }

  return snap;
}

async function loadPrevSnapshot(admin: SupabaseClient, siteId: string, today: string): Promise<Snapshot | null> {
  const { data } = await admin
    .from('seo_snapshots')
    .select('data')
    .eq('site_id', siteId)
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.data as Snapshot) ?? null;
}

async function saveSnapshot(admin: SupabaseClient, siteId: string, snap: Snapshot): Promise<void> {
  await admin.from('seo_snapshots').upsert({ site_id: siteId, date: snap.date, data: snap }, { onConflict: 'site_id,date' });
}

export type ActSummary = {
  site: string;
  date: string;
  quickWins: number;
  newPage: 'approved' | 'draft' | 'skipped' | 'none';
  degraded: string[];
  readout: string;
};

// Run one site's daily loop. `admin` is the service-role client (cron has no session).
export async function runActLoop(
  admin: SupabaseClient,
  site: { id: string; url: string; content_lang?: string }
): Promise<ActSummary> {
  const lang: 'he' | 'en' = site.content_lang === 'en' ? 'en' : 'he';
  const today = await captureSnapshot(admin, site.id, site.url);
  const prev = await loadPrevSnapshot(admin, site.id, today.date);
  await saveSnapshot(admin, site.id, today);

  const diff = buildDiff(today, prev);
  const degraded: string[] = [];
  if (!today.gsc.available) degraded.push('GSC לא נמדד');
  if (!today.issues.available) degraded.push('crawl לא נמדד');
  if (diff.stale) degraded.push('snapshot stale');

  const actions: ActActions = { quickWinsQueued: [], newPage: null };

  // --- Quick wins: take the top 2–3 and queue an action plan each (act.md §4).
  if (diff.quickWins.measured && diff.quickWins.value.length) {
    const top = diff.quickWins.value.slice(0, 3);
    // Reuse the Striking-Distance planner to build the paste-ready Title/TL;DR/FAQ/links.
    const gscTop = top.map((q) => ({ query: q.query, page: q.url, clicks: 0, impressions: q.impressions ?? 0, ctr: 0, position: q.position }));
    let plans: Awaited<ReturnType<typeof buildQuickWinPlans>> = [];
    try {
      plans = await buildQuickWinPlans(gscTop, { lang, limit: top.length, context: site.url });
    } catch {
      plans = [];
    }
    for (const q of top) {
      const plan = plans.find((p) => p.query === q.query)?.plan ?? null;
      await admin.from('gsc_opportunities').insert({
        site_id: site.id,
        type: 'striking_distance',
        query: q.query,
        urls: q.url ? [q.url] : [],
        impressions: q.impressions,
        position: q.position,
        action_plan: plan,
        priority: 1,
        status: 'open',
      });
      actions.quickWinsQueued.push({ query: q.query, url: q.url, position: q.position, impressions: q.impressions });
    }
  }

  // --- Content gap: at most ONE page, and only on autopilot (hard law 3).
  if (diff.newPageQuery.measured && diff.newPageQuery.value) {
    const cand = diff.newPageQuery.value;
    const { data: sched } = await admin
      .from('content_schedule')
      .select('autopilot')
      .eq('site_id', site.id)
      .maybeSingle();
    const autopilot = !!sched?.autopilot;
    if (!autopilot) {
      actions.newPage = { query: cand.query, status: 'skipped', gateScore: null, reason: 'autopilot כבוי — נשמר כהזדמנות בלבד' };
      await admin.from('gsc_opportunities').insert({
        site_id: site.id, type: 'question_gap', query: cand.query, urls: [], impressions: cand.impressions, priority: 2, status: 'open',
      });
    } else {
      const article = await generateArticle({ keyword: cand.query, lang, context: site.url, notes: `ביקוש: ${cand.impressions} חשיפות ב-GSC ללא עמוד ייעודי` }).catch(() => null);
      if (!article) {
        actions.newPage = { query: cand.query, status: 'skipped', gateScore: null, reason: 'יצירת התוכן נכשלה' };
      } else {
        // The gate: passing content is queued approved (ready to publish); failing
        // content stays a draft — edited, unverified — never auto-published.
        const passed = article.checks.score >= GATE_THRESHOLD;
        const status: 'approved' | 'draft' = passed ? 'approved' : 'draft';
        await admin.from('content_pieces').insert({
          site_id: site.id,
          title: article.title,
          body: article.body_html,
          schema_json: article.schema_json,
          lang: article.lang,
          status,
        });
        actions.newPage = { query: cand.query, status, gateScore: article.checks.score };
      }
    }
  } else if (diff.newPageQuery.measured) {
    actions.newPage = { query: '', status: 'skipped', gateScore: null, reason: 'אין ביקוש שעומד בתנאים' };
  }

  // --- The readout: dated, honesty-preserving, persisted.
  const readout = composeReadout(site.url, today, diff, actions);
  await admin.from('daily_readouts').upsert(
    { site_id: site.id, date: today.date, body: readout, degraded, gate_status: actions.newPage?.status ?? 'none' },
    { onConflict: 'site_id,date' }
  );
  // Also feed the monthly narrative surface (reports) so the dashboard sees it.
  await admin.from('reports').insert({ site_id: site.id, period: today.date, narrative: readout });

  return {
    site: site.url,
    date: today.date,
    quickWins: actions.quickWinsQueued.length,
    newPage: actions.newPage?.status ?? 'none',
    degraded,
    readout,
  };
}
