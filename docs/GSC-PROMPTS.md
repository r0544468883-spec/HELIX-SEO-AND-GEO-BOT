# HELIX Rank — GSC Intelligence Prompt Reference

מקור: [nisai.dev/guides/gsc-ai-seo-prompts](https://nisai.dev/guides/gsc-ai-seo-prompts/). 7 הפרומפטים המוכחים שמנוע ה-GSC Intelligence (§3.9 במוצר 4) הופך למודולים אוטומטיים. לשימוש כבסיס ל-system prompt / tool-calls של הסוכן בפרודקשן. **הבוט מריץ אותם אוטומטית ומבצע את הפלט** — לא מחזיר טקסט למשתמש.

---

## Prompt 0 — Connection verification (run once)
```
You are connected to my Google Search Console. Before we start any analysis,
confirm the connection is working by fetching and showing me:
1. The exact property/domain name you are connected to.
2. The total number of clicks and impressions for the last 28 days.
3. The single top query and the single top page by clicks for that period.
Show me these raw numbers first. If you cannot retrieve real data, tell me
explicitly that you are NOT connected - do not estimate or invent numbers.
```

## Prompt 1 — Striking Distance (fastest win) 🆕 gap-closer
```
Act as an Expert SEO Strategist connected to my Google Search Console.
1. DATA RETRIEVAL: last 90 days, metrics cross-referenced by BOTH Queries and
   Pages (Clicks, Impressions, CTR, Position per URL-Query pair).
2. FILTER "STRIKING DISTANCE": avg position 7.0-11.9 AND >=50 impressions.
3. SELECT 3-5 queries with highest realistic traffic upside (high impressions +
   commercial/high intent).
4. ACTION PLAN per query: Target Page (exact URL) · Search Intent · On-Page Tweaks
   (exact new Title/Meta/H1-H2 text) · Content Upgrades (vs top 3) · Internal
   Linking (which pages + exact anchor text).
Present as a prioritized table, easiest-win-first.
```

## Prompt 2 — Executive snapshot (monthly)
```
Act as an Expert SEO Analyst connected to GSC. Fetch last 28 days AND previous
28 days (show direction). Executive summary:
1. HEALTH METRICS: Clicks, Impressions, CTR, Position + % change vs prev period.
2. WHAT'S WORKING: top 3 pages + top 3 queries by clicks, and what they share.
3. WHAT NEEDS ATTENTION: high impressions but CTR well below site average.
4. ONE HEADLINE: is SEO trending up/flat/down + the #1 focus. Jargon-free, 60s read.
```

## Prompt 3 — Question mining → FAQ (+ content gaps)
```
Act as an Expert SEO Content Strategist connected to GSC. Last 90 days.
1. FILTER question queries: how/what/why/when/where/who/which/is/can/do +
   Hebrew: איך/מה/למה/מתי/איפה/מי/האם/כמה/כדאי. Include implicit ("price of X",
   "X vs Y", "best X for Y").
2. GROUP into topics.
3. Top 5-7 questions: exact question as heading · 40-60 word answer draft
   (Featured-Snippet/PAA optimized) · WHERE it lives (exact URL or new article).
4. FLAG questions with impressions but NO relevant page = pure content gaps.
Prioritize real impression volume + clear intent.
```

## Prompt 4 — Weekly monitor (every Monday)
```
Act as my ongoing SEO Monitor connected to GSC. Last 7 days vs previous 7 (WoW).
- WINS: biggest gains (before -> after numbers).
- LOSSES: biggest drops (note seasonality / Google update / page issue).
- NEW OPPORTUNITIES: brand-new queries with impressions this week.
- QUICK ACTIONS: exactly 2 concrete tasks for TODAY, by impact (specific).
Under 200 words. Flag urgent with ⚠️.
```

## Prompt 5 — Cannibalization 🆕 gap-closer
```
Act as a Technical SEO Specialist connected to GSC. Last 90 days query-page data.
Find KEYWORD CANNIBALIZATION: queries where 2+ of my URLs get impressions/clicks
for the same term. Per case:
1. Query + all competing URLs (clicks/impressions/position each).
2. Identify the "primary" page (best intent + performance).
3. Fix: consolidate/merge · differentiate secondary · 301 · internal links to
   primary with target anchor.
List top 5 by wasted potential (highest combined impressions, no page in top 3).
```

## Prompt 6 — Content decay (Content Watchdog)
```
Act as an SEO Content Analyst connected to GSC. Last 90 days vs previous 90.
Find CONTENT DECAY: pages that lost the most clicks and/or dropped in position.
Ignore tiny traffic. Top 5-7 decaying pages: URL + clicks/position both periods
(before -> after) · likely reason · concrete REFRESH plan · priority (H/M/L).
Order by biggest lost opportunity first.
```

## Prompt 7 — 90-day content roadmap (quarterly)
```
Act as my SEO Content Director connected to GSC. Analyze last 90 days across:
striking-distance, high-impression/low-CTR, question queries with no page, and
partial topic clusters. Build a prioritized 90-DAY ROADMAP table:
Action · Target query/topic · Target URL (existing or NEW) · Why now (data signal)
· Effort (S/M/L) · Expected impact (Low/Med/High).
10-15 rows, highest impact-to-effort at top. End with 3 items to start THIS WEEK.
```

---
**עקרונות ליישום:** (א) לאמת מספרים גולמיים מול GSC לפני פעולה (anti-hallucination). (ב) לתת קונטקסט עסקי לפני כל ניתוח. (ג) עברית → הפלט עובר baldiga. (ד) הבוט **מבצע** את הפלט (משכתב/כותב/מפרסם), לא רק מציג.
