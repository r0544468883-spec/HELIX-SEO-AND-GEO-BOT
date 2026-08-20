-- Brand Protection — store how AI engines portray the brand (sentiment) and the
-- alerts raised (negative framing, wrong/outdated facts, absence). Closes the gap
-- vs a dedicated brand-protection module. Idempotent.

create table if not exists ai_sentiment (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  engine text not null,                                 -- chatgpt/gemini/perplexity/claude
  query text,
  sentiment text,                                       -- positive/neutral/negative
  sentiment_score numeric,                              -- -1..1
  wrong_facts int not null default 0,
  checked_at timestamptz not null default now()
);

create table if not exists brand_alerts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  severity text not null,                               -- high/medium/low
  alert_type text not null,                             -- negative_sentiment/wrong_fact/not_mentioned
  engine text,
  query text,
  detail text,
  correction text,
  status text not null default 'open' check (status in ('open','ack','resolved')),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_sentiment_site_time on ai_sentiment(site_id, checked_at desc);
create index if not exists idx_brand_alerts_site_status on brand_alerts(site_id, status, severity);

alter table ai_sentiment enable row level security;
alter table brand_alerts enable row level security;

do $$ begin
  create policy sent_own  on ai_sentiment for all using (owns_site(site_id)) with check (owns_site(site_id));
  create policy alert_own on brand_alerts for all using (owns_site(site_id)) with check (owns_site(site_id));
exception when duplicate_object then null; end $$;
