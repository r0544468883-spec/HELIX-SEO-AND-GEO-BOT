-- HELIX Autonomy Switch — Rank install. See helix/PRODUCTS/AUTONOMY-SWITCH-SPEC.md.
-- Rank is SITE-scoped, so the tenant key is scope_id = a site_id (not workspace_id).
-- Safe default: absent row => advisor. The act loop only PUBLISHES LIVE when
-- rank.publish = autopilot with risk_ack=true; otherwise content stays a draft/approved.

create table if not exists autonomy_settings (
  scope_id      uuid not null,                 -- a site_id
  feature_key   text not null,
  mode          text not null default 'advisor'
                check (mode in ('advisor','approve','autopilot')),
  risk_ack      boolean not null default false,
  daily_cap     int,
  updated_by    uuid,
  updated_at    timestamptz default now(),
  primary key (scope_id, feature_key)
);

alter table autonomy_settings enable row level security;

-- Rank scopes rows by site ownership (owns_site helper, as elsewhere in schema.sql).
do $$ begin
  create policy autonomy_own on autonomy_settings for all
    using (owns_site(scope_id)) with check (owns_site(scope_id));
exception when duplicate_object then null; end $$;
