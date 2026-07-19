-- ============================================================
-- HELIX Rank — database schema (Supabase)
-- Per-site ownership + RLS. Run in Supabase SQL Editor.
-- Mirrors SPEC §5. Idempotent (create if not exists).
-- ============================================================

create extension if not exists "pgcrypto";

-- Sites (a site = a tenant unit, owned by a user).
create table if not exists sites (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  url           text not null,
  cms_type      text,                                   -- wordpress/wix/webflow/headless…
  gsc_connected boolean not null default false,
  plan          text not null default 'starter',
  content_lang  text not null default 'he' check (content_lang in ('he','en','both')),
  branding_json jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- Ownership helper for child-table RLS.
create or replace function owns_site(s uuid) returns boolean language sql stable as $$
  select exists (select 1 from sites where id = s and owner_id = auth.uid());
$$;

-- --- Core (MVP) ---
create table if not exists site_connections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  provider text not null,                               -- gsc/semrush/ahrefs/ga4/wp/wix/webflow…
  credentials jsonb not null default '{}'::jsonb,
  adapter_config jsonb not null default '{}'::jsonb,
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  unique (site_id, provider)
);

create table if not exists keywords (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  phrase text not null,
  intent text,                                          -- informational/commercial/transactional
  volume int,
  difficulty int,
  current_rank numeric,
  tracked boolean not null default true
);

create table if not exists content_pieces (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  title text,
  body text,
  images text[] not null default '{}',
  schema_json jsonb,
  lang text,
  status text not null default 'draft' check (status in ('draft','approved','published')),
  published_url text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists content_schedule (
  site_id uuid primary key references sites(id) on delete cascade,
  cadence text not null default 'weekly',
  articles_per_month int not null default 4,
  autopilot boolean not null default false
);

create table if not exists rank_history (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  keyword_id uuid references keywords(id) on delete cascade,
  date date not null default current_date,
  rank numeric,
  impressions int,
  clicks int
);

-- GSC Intelligence opportunities (Striking Distance, cannibalization, gaps, decay).
create table if not exists gsc_opportunities (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  type text not null,                                   -- striking_distance/cannibalization/question_gap/decay
  query text,
  urls text[] not null default '{}',
  impressions int,
  position numeric,
  action_plan jsonb,
  priority int not null default 3,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- --- GEO ---
create table if not exists ai_citations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  engine text not null,                                 -- chatgpt/gemini/perplexity/claude
  query text,
  cited boolean,
  position int,
  checked_at timestamptz not null default now()
);

create table if not exists citation_gaps (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  query text,
  engine text,
  competitor_cited text,
  status text not null default 'open' check (status in ('open','patching','published','won')),
  patch_content_id uuid references content_pieces(id) on delete set null
);

create table if not exists citation_scores (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  date date not null default current_date,
  score int,
  share_of_voice_json jsonb
);

-- --- Reports + bot channels ---
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  period text,
  narrative text,
  channels text[] not null default '{}',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists channel_bindings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  channel text not null,                                -- telegram/email/whatsapp
  identifier text,
  verified boolean not null default false,
  inbound_enabled boolean not null default false
);

-- --- Advanced (later phases: §3.8 gap-closers, experiments) — add as needed ---
-- experiments, site_issues, internal_links, backlinks, crawler_hits,
-- prompt_volumes, ai_sentiment, content_decay, syndication_targets, channel_optin
-- (see SPEC §5). Kept out of the MVP schema; add per roadmap phase.

-- ============================================================
-- RLS — owner-scoped.
-- ============================================================
alter table sites             enable row level security;
alter table site_connections  enable row level security;
alter table keywords          enable row level security;
alter table content_pieces    enable row level security;
alter table content_schedule  enable row level security;
alter table rank_history      enable row level security;
alter table gsc_opportunities enable row level security;
alter table ai_citations      enable row level security;
alter table citation_gaps     enable row level security;
alter table citation_scores   enable row level security;
alter table reports           enable row level security;
alter table channel_bindings  enable row level security;

do $$ begin
  create policy sites_own on sites for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  create policy conn_own  on site_connections  for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy kw_own    on keywords          for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy cp_own    on content_pieces    for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy sch_own   on content_schedule  for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy rank_own  on rank_history      for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy opp_own   on gsc_opportunities for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy cit_own   on ai_citations      for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy gap_own   on citation_gaps     for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy cs_own    on citation_scores   for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy rep_own   on reports           for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy chan_own  on channel_bindings  for all using (owns_site(site_id)) with check (owns_site(site_id));
exception when duplicate_object then null; end $$;
