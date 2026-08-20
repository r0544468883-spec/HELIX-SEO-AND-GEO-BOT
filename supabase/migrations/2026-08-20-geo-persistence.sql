-- GEO persistence — make the citation scan write a trend, not just compute-and-forget.
-- The ai_citations / citation_gaps / citation_scores tables already exist (schema.sql)
-- but nothing wrote to them. This turns each GEO scan into a stored daily snapshot so
-- the GEO Monitor can show a Citation Score trend over time (the core of a visibility
-- tracker like Snoika). Idempotent — safe to re-run.

-- One snapshot per site per day: a re-scan the same day updates the day's row.
alter table citation_scores add column if not exists created_at timestamptz not null default now();

do $$ begin
  alter table citation_scores add constraint citation_scores_site_date_uniq unique (site_id, date);
exception when duplicate_object then null; end $$;

-- Helpful read indexes for the trend + gap board.
create index if not exists idx_citation_scores_site_date on citation_scores(site_id, date);
create index if not exists idx_ai_citations_site_time on ai_citations(site_id, checked_at desc);
create index if not exists idx_citation_gaps_site_status on citation_gaps(site_id, status);
