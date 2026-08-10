// The daily "act" engine — ported from the seo-god Claude Code skill
// (references/act.md), translated from a repo-editing agent into HELIX Rank's
// GSC-driven SaaS model. Three components stolen from the skill:
//   1. the fixed daily order — regressions → quick wins → content gap → readout
//   2. quick-win targeting in positions 4–15 (never a new/duplicate page)
//   3. the honesty model — measured vs. not-measured, never a fabricated number
// Pure logic only, no I/O. lib/act/loop.ts wires it to Supabase + GSC.
import type { GscRow } from '../gsc';

// --- Honesty model: every field is either measured, or explicitly not ---------
export type Measured<T> = { measured: true; value: T };
export type NotMeasured = { measured: false; reason: string };
export type Maybe<T> = Measured<T> | NotMeasured;
export const measured = <T>(value: T): Measured<T> => ({ measured: true, value });
export const notMeasured = (reason: string): NotMeasured => ({ measured: false, reason });

export type TrackerRank = { keyword: string; url: string; position: number | null };

// A day's measurements. Any source can be `available: false` — that is "not
// measured", never zero, never a placeholder (act.md hard law 4).
export type Snapshot = {
  date: string; // local YYYY-MM-DD
  gsc: { available: boolean; rows: GscRow[]; clicks: number | null; impressions: number | null };
  ranks: { available: boolean; items: TrackerRank[] };
  issues: { available: boolean; items: { type: string; url: string; severity: string }[] };
};

export type QuickWin = {
  source: 'gsc' | 'tracker';
  query: string;
  url: string;
  position: number;
  impressions: number | null; // only GSC rows carry impressions; tracker rows stay null (honesty)
};

export type Regression =
  | { kind: 'rank_drop'; keyword: string; url: string; from: number; to: number }
  | { kind: 'clicks_down'; from: number; to: number };

export type NewQuery = { query: string; impressions: number };

export type Diff = {
  prevDate: string | null;
  stale: boolean; // today's snapshot could not be captured — acting on an older one
  technicalMeasured: boolean; // is a crawler/site-audit connected at all
  regressions: Maybe<Regression[]>;
  quickWins: Maybe<QuickWin[]>;
  newPageQuery: Maybe<NewQuery | null>; // at most one candidate, or null when none qualifies
};

// Quick wins: positions 4.0–15.0 with impressions above the noise floor, sorted
// by impressions (act.md §4). Stolen component #2: the existing page already
// ranks — improve it, never split it into a new/duplicate page (hard law 2).
export function quickWinsFromGsc(rows: GscRow[], minImpressions = 30): QuickWin[] {
  return rows
    .filter((r) => r.page && r.position >= 4.0 && r.position <= 15.0 && r.impressions >= minImpressions)
    .sort((a, b) => b.impressions - a.impressions)
    .map((r) => ({ source: 'gsc' as const, query: r.query, url: r.page, position: r.position, impressions: r.impressions }));
}

const clicksTotal = (rows: GscRow[]): number => rows.reduce((s, r) => s + (r.clicks || 0), 0);

// Build the review, in act.md's fixed order. `prev` may be null (first run).
export function buildDiff(today: Snapshot, prev: Snapshot | null): Diff {
  const stale = !today.gsc.available && !today.ranks.available && !today.issues.available;
  const technicalMeasured = today.issues.available;

  // --- Regressions first ---
  let regressions: Maybe<Regression[]>;
  if (!prev) {
    regressions = notMeasured('אין snapshot קודם להשוואה');
  } else {
    const list: Regression[] = [];
    // Rank drops — only where a tracker measured a real position on BOTH days.
    if (today.ranks.available && prev.ranks.available) {
      const before = new Map(
        prev.ranks.items.filter((i) => i.position != null).map((i) => [i.keyword, i.position as number])
      );
      for (const cur of today.ranks.items) {
        const was = before.get(cur.keyword);
        if (was != null && cur.position != null && cur.position > was + 2) {
          list.push({ kind: 'rank_drop', keyword: cur.keyword, url: cur.url, from: was, to: cur.position });
        }
      }
    }
    // Clicks down week-over-week — only when GSC measured on both days.
    if (today.gsc.available && prev.gsc.available) {
      const t = clicksTotal(today.gsc.rows);
      const p = clicksTotal(prev.gsc.rows);
      if (p > 0 && t < p * 0.85) list.push({ kind: 'clicks_down', from: p, to: t });
    }
    regressions = measured(list);
  }

  // --- Quick wins (positions 4–15) ---
  let quickWins: Maybe<QuickWin[]>;
  if (today.gsc.available) {
    quickWins = measured(quickWinsFromGsc(today.gsc.rows));
  } else if (today.ranks.available) {
    const rows = today.ranks.items
      .filter((i) => i.position != null && (i.position as number) >= 4 && (i.position as number) <= 15)
      .sort((a, b) => (a.position as number) - (b.position as number))
      .map((i) => ({ source: 'tracker' as const, query: i.keyword, url: i.url, position: i.position as number, impressions: null }));
    quickWins = measured(rows);
  } else {
    quickWins = notMeasured('GSC לא מחובר ואין tracker — אין נתוני מיקום');
  }

  // --- Content gap (at most one; hard law 3) ---
  let newPageQuery: Maybe<NewQuery | null>;
  if (!today.gsc.available) {
    newPageQuery = notMeasured('אין נתוני ביקוש (GSC לא נמדד, אין tracker)');
  } else {
    const candidate = today.gsc.rows
      .filter((r) => r.impressions >= 100 && (!r.page || r.position > 20)) // demand exists, nothing ranks for it
      .sort((a, b) => b.impressions - a.impressions)[0];
    newPageQuery = measured(candidate ? { query: candidate.query, impressions: candidate.impressions } : null);
  }

  return { prevDate: prev?.date ?? null, stale, technicalMeasured, regressions, quickWins, newPageQuery };
}

// What the loop actually did this run — fed into the readout so a reader sees
// action, not just findings.
export type ActActions = {
  quickWinsQueued: { query: string; url: string; position: number; impressions: number | null }[];
  newPage: { query: string; status: 'approved' | 'draft' | 'skipped' | 'published'; gateScore: number | null; reason?: string } | null;
};

// Compose the ≤15-line Hebrew readout. Honesty rule: never drop a "לא נמדד"
// line to hit the cap (act.md §6) — merge or go over instead.
export function composeReadout(siteUrl: string, today: Snapshot, diff: Diff, actions: ActActions): string {
  const L: string[] = [];
  L.push(`## ${today.date} — לולאה יומית · ${siteUrl}`);

  const src = today.gsc.available ? 'GSC חי' : today.ranks.available ? 'tracker בלבד' : 'ללא מקור נתונים';
  L.push(`snapshot: ${today.date} (${src})${diff.prevDate ? ` · diff מול ${diff.prevDate}${diff.stale ? ' · stale' : ''}` : ' · אין היסטוריה'}`);

  // Regressions
  if (!diff.regressions.measured) {
    L.push(`רגרסיות: לא נמדד — ${diff.regressions.reason}`);
  } else if (diff.regressions.value.length === 0) {
    L.push('רגרסיות: אין');
  } else {
    for (const r of diff.regressions.value.slice(0, 3)) {
      if (r.kind === 'rank_drop') L.push(`רגרסיה: "${r.keyword}" ירד ${r.from.toFixed(1)}→${r.to.toFixed(1)} · ${r.url}`);
      else L.push(`רגרסיה: קליקים ירדו ${r.from}→${r.to} (שבוע מול שבוע)`);
    }
  }
  if (!diff.technicalMeasured) L.push('בעיות טכניות (crawl): לא נמדד — אין סורק אתר מחובר');

  // Quick wins
  if (!diff.quickWins.measured) {
    L.push(`Quick-wins: לא נמדד — ${diff.quickWins.reason}`);
  } else if (actions.quickWinsQueued.length === 0) {
    L.push('Quick-wins: אין עמודים בפוזיציה 4–15');
  } else {
    for (const q of actions.quickWinsQueued) {
      const impr = q.impressions != null ? ` · ${q.impressions} חשיפות` : '';
      L.push(`Quick-win: "${q.query}" מיקום ${q.position.toFixed(1)}${impr} → ${q.url} (title·TL;DR·FAQ·קישורים)`);
    }
  }

  // New page
  if (!diff.newPageQuery.measured) {
    L.push(`דף חדש: ${diff.newPageQuery.reason}`);
  } else if (!actions.newPage || actions.newPage.status === 'skipped') {
    L.push(`דף חדש: אין — ${actions.newPage?.reason ?? 'אין ביקוש שעומד בתנאים'}`);
  } else {
    const g = actions.newPage.gateScore != null ? `, gate ${actions.newPage.gateScore}/100` : '';
    const st = actions.newPage.status === 'approved' ? 'מוכן לפרסום (עבר gate)' : 'טיוטה (לא עבר gate — edited, unverified)';
    L.push(`דף חדש: "${actions.newPage.query}" — ${st}${g}`);
  }

  // GSC totals when measured
  if (today.gsc.available && today.gsc.clicks != null) {
    L.push(`GSC: ${today.gsc.clicks} קליקים / ${today.gsc.impressions ?? 0} חשיפות (90 יום)`);
  }

  L.push('הבא: לחבר GSC ל-diff יומי, או לאשר את ה-quick-wins בתור');
  return L.join('\n');
}
