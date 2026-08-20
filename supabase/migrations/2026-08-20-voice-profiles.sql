-- Voice profiles — the user's OWN authentic writing voice, learned from real samples
-- (posts/articles they paste). Injected into article generation as few-shot style anchors
-- so the output sounds like them, not a generic house voice. One profile per site.
-- Owner-scoped via the shared owns_site() helper. Idempotent.

create table if not exists voice_profiles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  key_tells jsonb not null default '[]'::jsonb,           -- 3-5 enforced fingerprint rules
  signature_passages jsonb not null default '[]'::jsonb,  -- verbatim style-extreme excerpts
  summary text,                                           -- one-line voice description
  words int not null default 0,                           -- sample size analysed
  tier text not null default 'basic' check (tier in ('basic','strong','full')),
  lang text not null default 'he' check (lang in ('he','en')),
  updated_at timestamptz not null default now(),
  unique (site_id)
);

create index if not exists idx_voice_profiles_site on voice_profiles(site_id);

alter table voice_profiles enable row level security;

do $$ begin
  create policy voice_own on voice_profiles for all using (owns_site(site_id)) with check (owns_site(site_id));
exception when duplicate_object then null; end $$;
