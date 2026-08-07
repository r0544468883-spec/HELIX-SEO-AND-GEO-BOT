-- ============================================================
-- HELIX Rank — act-loop tables (daily autonomy engine)
-- Adds the two tables lib/act/loop.ts reads/writes: the measurement
-- history it diffs against, and the dated readouts it leaves behind.
-- Idempotent. Run in Supabase SQL Editor after schema.sql.
-- Ported from the seo-god skill (references/act.md, measure.md).
-- ============================================================

-- One measurement snapshot per site per day (measure.md's contract, as JSONB).
-- The loop diffs today's row against the newest earlier row.
create table if not exists seo_snapshots (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites(id) on delete cascade,
  date       date not null default current_date,
  data       jsonb not null,                    -- the Snapshot object (gsc/ranks/issues + honesty flags)
  created_at timestamptz not null default now(),
  unique (site_id, date)
);
create index if not exists seo_snapshots_site_date on seo_snapshots (site_id, date desc);

-- The dated readout each daily run leaves behind (act.md §6). `degraded` names
-- exactly what was not measured; `gate_status` records the content gate outcome.
create table if not exists daily_readouts (
  site_id     uuid not null references sites(id) on delete cascade,
  date        date not null default current_date,
  body        text not null,
  degraded    jsonb not null default '[]'::jsonb,
  gate_status text not null default 'none',       -- approved/draft/skipped/none
  created_at  timestamptz not null default now(),
  primary key (site_id, date)
);

alter table seo_snapshots  enable row level security;
alter table daily_readouts enable row level security;

do $$ begin
  create policy snap_own    on seo_snapshots  for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy readout_own on daily_readouts for all using (owns_site(site_id)) with check (owns_site(site_id));
exception when duplicate_object then null; end $$;
