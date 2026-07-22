// Cross-product export — HELIX DASHBOARDS pulls HELIX Rank SEO + GEO metrics from here
// into its metric_points (connector 'helix_rank'). Secret-protected, standalone-safe.
// GET ?site=<id>&secret=<EXPORT_SECRET>
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function count(db: Admin, table: string, site: string, filters: [string, string][] = []) {
  let q = db.from(table).select('id', { count: 'exact', head: true }).eq('site_id', site);
  for (const [k, v] of filters) q = q.eq(k, v);
  const { count } = await q;
  return count ?? 0;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.EXPORT_SECRET;
  const provided = url.searchParams.get('secret') || req.headers.get('x-export-secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const site = url.searchParams.get('site');
  if (!site) return NextResponse.json({ error: 'site_required' }, { status: 400 });

  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const [
    trackedKeywords,
    openOpportunities,
    strikingDistance,
    contentDrafts,
    contentPublished,
    aiCited,
    gapsOpen,
    rankRows,
    historyRows,
    latestScore,
  ] = await Promise.all([
    count(db, 'keywords', site, [['tracked', 'true']]),
    count(db, 'gsc_opportunities', site, [['status', 'open']]),
    count(db, 'gsc_opportunities', site, [['type', 'striking_distance'], ['status', 'open']]),
    count(db, 'content_pieces', site, [['status', 'draft']]),
    count(db, 'content_pieces', site, [['status', 'published']]),
    count(db, 'ai_citations', site, [['cited', 'true']]),
    count(db, 'citation_gaps', site, [['status', 'open']]),
    db.from('keywords').select('current_rank').eq('site_id', site).eq('tracked', true),
    db.from('rank_history').select('keyword_id, date, rank').eq('site_id', site).order('date', { ascending: false }).limit(1000),
    db.from('citation_scores').select('score').eq('site_id', site).order('date', { ascending: false }).limit(1),
  ]);

  // avg position + top-N buckets from tracked keywords with a known rank.
  const ranks = ((rankRows.data ?? []) as { current_rank: number | null }[])
    .map((r) => r.current_rank)
    .filter((r): r is number => typeof r === 'number');
  const avgPosition = ranks.length ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 : 0;
  const keywordsTop3 = ranks.filter((r) => r <= 3).length;
  const keywordsTop10 = ranks.filter((r) => r <= 10).length;

  // improved / declined — compare the two most recent rank_history rows per keyword.
  const byKeyword = new Map<string, number[]>();
  for (const row of (historyRows.data ?? []) as { keyword_id: string | null; rank: number | null }[]) {
    if (!row.keyword_id || typeof row.rank !== 'number') continue;
    const list = byKeyword.get(row.keyword_id) ?? [];
    if (list.length < 2) {
      list.push(row.rank);
      byKeyword.set(row.keyword_id, list);
    }
  }
  let improved = 0;
  let declined = 0;
  for (const [, list] of byKeyword) {
    if (list.length < 2) continue;
    const [current, previous] = list; // list[0] = newest (lower rank = better).
    if (current < previous) improved++;
    else if (current > previous) declined++;
  }

  const citationScore = ((latestScore.data ?? [])[0] as { score: number | null } | undefined)?.score ?? 0;

  const points = [
    { metric: 'rank_tracked_keywords', dims: {}, value: trackedKeywords },
    { metric: 'rank_avg_position', dims: {}, value: avgPosition },
    { metric: 'rank_keywords_top3', dims: {}, value: keywordsTop3 },
    { metric: 'rank_keywords_top10', dims: {}, value: keywordsTop10 },
    { metric: 'rank_rankings_improved', dims: {}, value: improved },
    { metric: 'rank_rankings_declined', dims: {}, value: declined },
    { metric: 'rank_open_opportunities', dims: {}, value: openOpportunities },
    { metric: 'rank_striking_distance', dims: {}, value: strikingDistance },
    { metric: 'rank_content_drafts', dims: {}, value: contentDrafts },
    { metric: 'rank_content_published', dims: {}, value: contentPublished },
    { metric: 'geo_citation_score', dims: {}, value: citationScore },
    { metric: 'geo_cited', dims: {}, value: aiCited },
    { metric: 'geo_citation_gaps_open', dims: {}, value: gapsOpen },
  ];
  return NextResponse.json({ points });
}
