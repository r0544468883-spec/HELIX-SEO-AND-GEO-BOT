// Additional GSC Intelligence analyses (SPEC §3.9 / GSC-PROMPTS 3,5,6):
// cannibalization, question-mining → FAQ, and content decay.
import { claude, parseJson } from './claude';
import { HEBREW_STYLE, humanizeHe } from './hebrew';
import type { GscRow } from './gsc';

type Lang = 'he' | 'en';

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

// ---------- Cannibalization: 2+ of our URLs competing for the same query ----------
export type CannibalCase = {
  query: string;
  urls: { page: string; clicks: number; impressions: number; position: number }[];
  recommendation: string;
};

export async function analyzeCannibalization(rows: GscRow[], lang: Lang): Promise<CannibalCase[]> {
  const byQuery = new Map<string, GscRow[]>();
  for (const r of rows) {
    if (!r.page) continue;
    const k = norm(r.query);
    const list = byQuery.get(k) ?? [];
    list.push(r);
    byQuery.set(k, list);
  }
  const cases = Array.from(byQuery.values())
    .map((list) => {
      const pages = new Map<string, GscRow>();
      for (const r of list) {
        const prev = pages.get(r.page);
        if (!prev || r.impressions > prev.impressions) pages.set(r.page, r);
      }
      return Array.from(pages.values());
    })
    .filter((pgs) => pgs.length >= 2 && pgs.some((p) => p.impressions > 0))
    .map((pgs) => ({
      query: pgs[0].query,
      combined: pgs.reduce((s, p) => s + p.impressions, 0),
      noTop3: pgs.every((p) => p.position > 3),
      pgs,
    }))
    .sort((a, b) => Number(b.noTop3) - Number(a.noTop3) || b.combined - a.combined)
    .slice(0, 5);

  const out: CannibalCase[] = [];
  for (const c of cases) {
    const urls = c.pgs.map((p) => ({ page: p.page, clicks: p.clicks, impressions: p.impressions, position: p.position }));
    const sys =
      lang === 'he'
        ? `אתה מומחה SEO טכני. נתונה קניבליזציה — כמה עמודים מתחרים על אותה שאילתה. ${HEBREW_STYLE} החזר JSON בלבד: {"recommendation":"..."} — זהה את העמוד הראשי והמלץ על תיקון (מיזוג/301/דיפרנציאציה/קישור פנימי), בעברית קצרה.`
        : 'You are a technical SEO. Given cannibalization, return ONLY JSON: {"recommendation":"..."} — identify the primary page and recommend a fix (merge/301/differentiate/internal links).';
    const raw = await claude(sys, `Query: "${c.query}"\nURLs:\n${JSON.stringify(urls, null, 0)}`, 400).catch(() => '');
    const parsed = parseJson<{ recommendation: string }>(raw);
    out.push({ query: c.query, urls, recommendation: parsed?.recommendation ?? '' });
  }
  return out;
}

// ---------- Question mining → FAQ ----------
const HE_Q = /^(איך|מה|למה|מתי|איפה|מי|האם|כמה|כדאי)\b/;
const EN_Q = /^(how|what|why|when|where|who|which|is|are|can|do|does|should)\b/i;

export function isQuestion(q: string): boolean {
  const t = q.trim();
  return HE_Q.test(t) || EN_Q.test(t) || / מול | vs\.? | versus /i.test(t) || /(price|מחיר|כמה עולה)/i.test(t);
}

export type FaqItem = {
  question: string;
  impressions: number;
  answer_draft: string;
  where: string;
};

export async function analyzeQuestions(rows: GscRow[], lang: Lang): Promise<FaqItem[]> {
  const byQ = new Map<string, GscRow>();
  for (const r of rows) {
    if (!isQuestion(r.query)) continue;
    const prev = byQ.get(norm(r.query));
    if (!prev || r.impressions > prev.impressions) byQ.set(norm(r.query), r);
  }
  const top = Array.from(byQ.values()).sort((a, b) => b.impressions - a.impressions).slice(0, 6);
  const out: FaqItem[] = [];
  for (const r of top) {
    const sys =
      lang === 'he'
        ? `אתה אסטרטג תוכן SEO. עבור שאלה, החזר JSON בלבד: {"answer_draft":"תשובה של 40-60 מילים, מותאמת ל-Featured Snippet","where":"באיזה עמוד לשכן (URL) או עמוד חדש"}. ${HEBREW_STYLE}`
        : 'You are an SEO content strategist. Return ONLY JSON: {"answer_draft":"40-60 word snippet-ready answer","where":"which page/URL to host it or a new article"}.';
    const raw = await claude(sys, `Question: "${r.query}" (impressions: ${r.impressions}, page: ${r.page || 'none'})`, 400).catch(() => '');
    const p = parseJson<{ answer_draft: string; where: string }>(raw);
    // FAQ answers are user-facing content → run through the dedicated Hebrew skill.
    const answer = lang === 'he' ? await humanizeHe(p?.answer_draft ?? '') : p?.answer_draft ?? '';
    out.push({ question: r.query, impressions: r.impressions, answer_draft: answer, where: p?.where ?? '' });
  }
  return out;
}

// ---------- Content decay: current vs previous period (by page) ----------
export type DecayItem = {
  url: string;
  before_clicks: number;
  after_clicks: number;
  reason: string;
  refresh_plan: string;
};

function clicksByPage(rows: GscRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.page) continue;
    m.set(r.page, (m.get(r.page) ?? 0) + r.clicks);
  }
  return m;
}

export async function analyzeDecay(current: GscRow[], previous: GscRow[], lang: Lang): Promise<DecayItem[]> {
  const cur = clicksByPage(current);
  const prev = clicksByPage(previous);
  const drops = Array.from(prev.entries())
    .map(([page, before]) => ({ page, before, after: cur.get(page) ?? 0 }))
    .filter((d) => d.before >= 10 && d.after < d.before) // ignore tiny; must have dropped
    .sort((a, b) => b.before - b.after - (a.before - a.after))
    .slice(0, 6);

  const out: DecayItem[] = [];
  for (const d of drops) {
    const sys =
      lang === 'he'
        ? `אתה אנליסט תוכן SEO. עמוד איבד תנועה בין שתי תקופות. ${HEBREW_STYLE} החזר JSON בלבד: {"reason":"סיבה סבירה","refresh_plan":"תכנית רענון קונקרטית"}.`
        : 'You are an SEO content analyst. A page lost traffic. Return ONLY JSON: {"reason":"likely cause","refresh_plan":"concrete refresh plan"}.';
    const raw = await claude(sys, `URL: ${d.page}\nClicks: ${d.before} -> ${d.after}`, 400).catch(() => '');
    const p = parseJson<{ reason: string; refresh_plan: string }>(raw);
    out.push({ url: d.page, before_clicks: d.before, after_clicks: d.after, reason: p?.reason ?? '', refresh_plan: p?.refresh_plan ?? '' });
  }
  return out;
}
