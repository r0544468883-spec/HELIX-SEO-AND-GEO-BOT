// Hub-and-spoke cluster lifecycle for the act loop (methodology §2, §5).
// The Orchestrator plans a cluster once (1 pillar + N spokes); the daily loop
// consumes it ONE item per run — pillar first, then spokes — so act.md hard-law 3
// ("at most one new page per run") stays intact while content stops being a bag
// of isolated articles. Falls back to a standalone spoke if planning fails, so a
// down Orchestrator never blocks the loop.
import type { SupabaseClient } from '@supabase/supabase-js';
import { planCluster } from '../agents/rank/roles/orchestrator';
import type { Lang, ExistingPage, ArticleTemplate } from '../agents/rank/contract';

type SpokeRow = { keyword: string; angle?: string; status: 'planned' | 'produced'; piece_id?: string | null };
type ClusterRow = {
  id: string;
  pillar_keyword: string;
  coined_term: string | null;
  diagram: string | null;
  spokes: SpokeRow[];
  pillar_status: 'planned' | 'produced';
  pillar_piece_id: string | null;
};

// What the loop should produce this run, resolved from the cluster plan.
export type ClusterTarget = {
  clusterId: string;
  keyword: string;
  template: ArticleTemplate;
  role: 'pillar' | 'spoke';
  coinedTerm?: string;
  diagram?: string;
  pillarTitle?: string; // spoke → link back to the pillar (hub-and-spoke)
};

async function loadActive(admin: SupabaseClient, siteId: string): Promise<ClusterRow | null> {
  const { data } = await admin
    .from('content_clusters')
    .select('id, pillar_keyword, coined_term, diagram, spokes, pillar_status, pillar_piece_id')
    .eq('site_id', siteId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as ClusterRow | null) ?? null;
}

async function pillarTitleOf(admin: SupabaseClient, row: ClusterRow): Promise<string> {
  if (row.pillar_piece_id) {
    const { data } = await admin.from('content_pieces').select('title').eq('id', row.pillar_piece_id).maybeSingle();
    if (data?.title) return data.title as string;
  }
  return row.pillar_keyword;
}

// Resolve the next item to produce. Creates a cluster from `seedKeyword` when none
// is active. Returns null ONLY when planning fails — the caller then falls back to
// a plain standalone article (old behavior), never blocking the run.
export async function resolveClusterTarget(
  admin: SupabaseClient,
  input: { siteId: string; seedKeyword: string; lang: Lang; context?: string; existingPages: ExistingPage[] }
): Promise<ClusterTarget | null> {
  let active = await loadActive(admin, input.siteId);

  if (!active) {
    const plan = await planCluster({
      seedKeyword: input.seedKeyword,
      lang: input.lang,
      context: input.context,
      existingPages: input.existingPages,
    }).catch(() => null);
    if (!plan) return null; // Orchestrator down → caller does a standalone article.

    const spokes: SpokeRow[] = plan.spokes.map((s) => ({ keyword: s.keyword, angle: s.angle, status: 'planned', piece_id: null }));
    const { data } = await admin
      .from('content_clusters')
      .insert({
        site_id: input.siteId,
        seed_keyword: input.seedKeyword,
        pillar_keyword: plan.pillarKeyword,
        coined_term: plan.coinedTerm,
        angle: plan.angle,
        diagram: plan.diagram,
        spokes,
        pillar_status: 'planned',
        status: 'active',
      })
      .select('id, pillar_keyword, coined_term, diagram, spokes, pillar_status, pillar_piece_id')
      .single();
    active = (data as ClusterRow | null) ?? null;
    if (!active) return null;
  }

  // Pillar first.
  if (active.pillar_status === 'planned') {
    return {
      clusterId: active.id,
      keyword: active.pillar_keyword,
      template: 'pillar',
      role: 'pillar',
      coinedTerm: active.coined_term ?? undefined,
      diagram: active.diagram ?? undefined,
    };
  }

  // Then the next planned spoke.
  const next = (active.spokes ?? []).find((s) => s.status === 'planned');
  if (next) {
    return {
      clusterId: active.id,
      keyword: next.keyword,
      template: 'spoke',
      role: 'spoke',
      diagram: active.diagram ?? undefined,
      pillarTitle: await pillarTitleOf(admin, active),
    };
  }

  // Cluster exhausted → complete it and start a fresh one from the same seed.
  await admin.from('content_clusters').update({ status: 'complete', updated_at: new Date().toISOString() }).eq('id', active.id);
  return resolveClusterTarget(admin, input);
}

// Record that a produced piece filled its slot; complete the cluster when the
// pillar and every spoke exist.
export async function recordClusterProduction(
  admin: SupabaseClient,
  target: ClusterTarget,
  pieceId: string
): Promise<void> {
  if (target.role === 'pillar') {
    await admin
      .from('content_clusters')
      .update({ pillar_status: 'produced', pillar_piece_id: pieceId, updated_at: new Date().toISOString() })
      .eq('id', target.clusterId);
    return;
  }
  const { data } = await admin
    .from('content_clusters')
    .select('spokes, pillar_status')
    .eq('id', target.clusterId)
    .maybeSingle();
  const row = data as { spokes: SpokeRow[]; pillar_status: string } | null;
  if (!row) return;
  const spokes = (row.spokes ?? []).map((s) =>
    s.keyword === target.keyword && s.status === 'planned' ? { ...s, status: 'produced' as const, piece_id: pieceId } : s
  );
  const allDone = row.pillar_status === 'produced' && spokes.every((s) => s.status === 'produced');
  await admin
    .from('content_clusters')
    .update({ spokes, status: allDone ? 'complete' : 'active', updated_at: new Date().toISOString() })
    .eq('id', target.clusterId);
}
