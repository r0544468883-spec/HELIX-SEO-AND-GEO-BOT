-- Multi-channel distribution — store off-site content drafts (Reddit / YouTube /
-- LinkedIn / Trustpilot / backlink outreach) generated per topic. Closes the
-- off-site content gap (on-site articles were the only content model). Idempotent.

create table if not exists syndication_targets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  channel text not null,                                 -- reddit/youtube/linkedin/trustpilot/backlinks
  topic text,
  title text,
  body text,
  notes text,
  status text not null default 'draft' check (status in ('draft','scheduled','published')),
  created_at timestamptz not null default now()
);

create index if not exists idx_syndication_site_status on syndication_targets(site_id, status, channel);

alter table syndication_targets enable row level security;

do $$ begin
  create policy synd_own on syndication_targets for all using (owns_site(site_id)) with check (owns_site(site_id));
exception when duplicate_object then null; end $$;
