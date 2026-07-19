// Striking Distance engine — the fastest-win SEO play (SPEC §3.9, prompt 1).
// Finds query×page pairs ranking 7.0–11.9 with real impressions, then builds a
// concrete action plan (exact Title/Meta/H1 + content + internal links) per target.
import { claude, parseJson } from './claude';
import { HEBREW_STYLE } from './hebrew';
import type { GscRow } from './gsc';

export type ActionPlan = {
  intent: string;
  title: string;
  meta: string;
  h1: string;
  content_upgrades: string[];
  internal_links: string[];
};

export type Opportunity = GscRow & { plan: ActionPlan };

// Positions 7.0–11.9 (bottom of page 1 / top of page 2), min impressions = noise floor.
export function filterStriking(rows: GscRow[], minImpressions = 50): GscRow[] {
  return rows
    .filter((r) => r.position >= 7.0 && r.position <= 11.9 && r.impressions >= minImpressions)
    .sort((a, b) => b.impressions - a.impressions);
}

async function buildPlan(row: GscRow, lang: 'he' | 'en', context: string): Promise<ActionPlan> {
  const sys =
    lang === 'he'
      ? `אתה אסטרטג SEO מומחה. עבור מילת מפתח שמדורגת בתחתית עמוד 1, החזר תוכנית פעולה קונקרטית. ${context} ${HEBREW_STYLE} החזר JSON בלבד בפורמט: {"intent":"","title":"","meta":"","h1":"","content_upgrades":["",""],"internal_links":["",""]}. הכותרות בעברית, מדויקות ומוכנות להדבקה.`
      : `You are an expert SEO strategist. For a keyword ranking at the bottom of page 1, return a concrete action plan. ${context} Return ONLY JSON: {"intent":"","title":"","meta":"","h1":"","content_upgrades":["",""],"internal_links":["",""]}. Exact, paste-ready text.`;
  const user = `Query: "${row.query}"\nPage: ${row.page}\nPosition: ${row.position.toFixed(1)} · Impressions: ${row.impressions} · CTR: ${(row.ctr * 100).toFixed(1)}%`;
  const raw = await claude(sys, user, 700);
  const parsed = parseJson<ActionPlan>(raw);
  return (
    parsed ?? {
      intent: '',
      title: '',
      meta: '',
      h1: '',
      content_upgrades: [],
      internal_links: [],
    }
  );
}

// Analyze rows → top opportunities with action plans. `context` = business context
// (e.g. "חנות תכשיטים שמוכרת בישראל בלבד") to sharpen intent/prioritization.
export async function analyze(
  rows: GscRow[],
  opts: { lang?: 'he' | 'en'; limit?: number; context?: string } = {}
): Promise<Opportunity[]> {
  const lang = opts.lang ?? 'he';
  const limit = opts.limit ?? 5;
  const context = opts.context ? `הקשר עסקי: ${opts.context}.` : '';
  const targets = filterStriking(rows).slice(0, limit);
  const out: Opportunity[] = [];
  for (const row of targets) {
    const plan = await buildPlan(row, lang, context).catch(() => null);
    if (plan) out.push({ ...row, plan });
  }
  return out;
}
