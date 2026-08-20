-- ============================================================
-- HELIX Rank — hub-and-spoke content clusters (methodology §2)
-- Adds the Orchestrator layer: instead of one isolated article per
-- content-gap, the daily loop plans a CLUSTER (1 pillar + N spokes)
-- and produces ONE item per run from that plan (act.md hard-law 3 intact).
-- Idempotent. Run in Supabase SQL Editor after 2026-08-07-act-loop.sql.
-- Ref: PRODUCTS/HELIX-SEO-AEO-GEO-METHODOLOGY.md §2, §5.
-- ============================================================

-- One active hub-and-spoke plan per seed gap. The Orchestrator writes the plan;
-- the loop consumes it one item per run. Honesty rule: the plan holds keywords +
-- angles (planning), never fabricated facts — same contract as the Researcher.
create table if not exists content_clusters (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  seed_keyword  text not null,                 -- the GSC gap that seeded the cluster
  pillar_keyword text not null,                -- the head term the pillar targets
  coined_term   text,                          -- invented category term (methodology §3.2), nullable
  angle         text,                          -- the cluster's differentiating angle
  diagram       text,                          -- one-line signature-diagram concept, reused across the cluster
  spokes        jsonb not null default '[]'::jsonb, -- [{keyword, angle, status:'planned'|'produced', piece_id}]
  pillar_status text not null default 'planned' check (pillar_status in ('planned','produced')),
  pillar_piece_id uuid references content_pieces(id) on delete set null,
  status        text not null default 'active' check (status in ('active','complete')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists content_clusters_site_status on content_clusters (site_id, status);

-- Produced pieces know which cluster + role they belong to (for interlinking + reporting).
alter table content_pieces add column if not exists cluster_id uuid references content_clusters(id) on delete set null;
alter table content_pieces add column if not exists cluster_role text; -- 'pillar' | 'spoke' | null (standalone)

alter table content_clusters enable row level security;

do $$ begin
  create policy cluster_own on content_clusters for all using (owns_site(site_id)) with check (owns_site(site_id));
exception when duplicate_object then null; end $$;
