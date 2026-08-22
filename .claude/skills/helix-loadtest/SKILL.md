---
name: helix-loadtest
description: >
  Load-test and stress-test HELIX apps and the shared Supabase backend using
  the clean-room, MPL-2.0 Artillery tool — never k6, whose AGPL-3.0 license is
  risky to embed. Use whenever the user wants to load-test, stress-test, check
  how many concurrent users the app handles, find the scaling ceiling, or verify
  a launch won't fall over — especially before a launch on the shared Supabase
  project that several HELIX products share. Trigger on "load test", "stress
  test", "how many users can it handle", "will it survive launch", "בדיקת
  עומסים", "כמה משתמשים", without naming a tool. Bakes in the test-against-staging
  rule, RLS-authenticated scenarios, and shared-backend blast-radius awareness.
metadata:
  type: reference
license: MIT (this skill) — drives Artillery (MPL-2.0)
---

# HELIX loadtest — capacity testing without the AGPL tool

## Why this skill exists
k6 is **AGPL-3.0**; **Artillery** (MPL-2.0) is a permissive alternative that reads
YAML scenarios and drives HTTP/WebSocket load. Since many HELIX products share
ONE Supabase project, a single unindexed query under load can take several
products down together — capacity testing is not optional before a launch.

## The one rule that matters most: never load-test production
The shared Supabase is live for all products. Hammering prod can exhaust
connections and knock over PLUG, CRM, Rank, etc. at once.
- Test against **staging / a branch DB**, or a clearly-scoped test project.
- If you must touch prod, cap `arrivalRate` low, run off-peak, and watch the
  Supabase dashboard (connections, CPU) with a hand on the kill switch.

## HELIX rules baked in

### Realistic authenticated scenarios (RLS changes the cost)
Anonymous GETs don't exercise the real path — RLS policies and `auth.uid()`
filters are where the DB cost lives. Log in first, carry the JWT, hit the real
endpoints:
```yaml
config:
  target: "https://staging.example.supabase.co"
  phases:
    - { duration: 60, arrivalRate: 5, rampTo: 50, name: "ramp" }
    - { duration: 120, arrivalRate: 50, name: "sustained" }
scenarios:
  - name: "authenticated dashboard load"
    flow:
      - post:
          url: "/auth/v1/token?grant_type=password"
          json: { email: "{{ email }}", password: "{{ password }}" }
          capture: { json: "$.access_token", as: "jwt" }
      - get:
          url: "/rest/v1/applications?select=*"
          headers: { Authorization: "Bearer {{ jwt }}", apikey: "{{ anonKey }}" }
```

### Watch the right signals
Latency percentiles (p95/p99, not mean), error rate, and — critically — Supabase
**connection count** and **CPU**. Connection exhaustion is the usual first wall;
pair with the [[supabase-postgres-best-practices]] connection-pooling guidance.

### Find the ceiling, then leave headroom
Ramp until p95 latency or error rate breaks, note the arrival rate, and plan for
~50% of that as the safe operating point. Record the number so launch decisions
are data-based, not vibes.

## Product mapping
- **Shared Supabase** — the main target; a launch of any one product raises load
  for all. Test the hottest queries per product before its launch.
- **SDR / OPS bots** — burst load when campaigns fire; test the webhook/ingest path.
- **Dashboards** — heavy read/aggregation queries; test with realistic board sizes.

## Guardrails
- Never run sustained load against production Supabase.
- Authenticate — anonymous tests hide the real RLS cost.
- Measure p95/p99 + DB connections/CPU, not just average latency.
- Record the ceiling number; leave 50% headroom for launch.
