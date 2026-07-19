// Check Modes — deterministic pre-publish quality gate (SPEC §3.8.11), mirroring
// Rank Math / Yoast / HCU style checks. No LLM, no external calls — pure rules.
// Closes the gap vs WriterGPT's "76+ checks". Returns per-mode scores + issues.

export type CheckArticle = {
  title: string;
  meta: string;
  h1: string;
  body_html: string;
  faq?: { q: string; a: string }[];
  schema_json?: unknown;
};

export type CheckIssue = { mode: string; ok: boolean; label: string };
export type CheckReport = {
  score: number; // 0..100 overall
  modes: { rankmath: number; yoast: number; hcu: number };
  issues: CheckIssue[];
};

function text(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}
function includesKw(s: string, kw: string): boolean {
  return s.toLowerCase().includes(kw.toLowerCase());
}

export function runChecks(article: CheckArticle, keyword: string): CheckReport {
  const bodyText = text(article.body_html);
  const firstPara = bodyText.slice(0, 200);
  const h2count = (article.body_html.match(/<h2/gi) || []).length;
  const words = wordCount(bodyText);
  const kw = keyword.trim();

  // Rank Math–style (structure/keyword placement).
  const rank: CheckIssue[] = [
    { mode: 'rankmath', ok: includesKw(article.title, kw), label: 'מילת מפתח בכותרת' },
    { mode: 'rankmath', ok: includesKw(article.h1, kw), label: 'מילת מפתח ב-H1' },
    { mode: 'rankmath', ok: includesKw(firstPara, kw), label: 'מילת מפתח בפסקה הראשונה' },
    { mode: 'rankmath', ok: includesKw(article.meta, kw), label: 'מילת מפתח ב-Meta' },
    { mode: 'rankmath', ok: h2count >= 2, label: 'לפחות 2 כותרות משנה (H2)' },
    { mode: 'rankmath', ok: !!article.schema_json, label: 'Schema מובנה' },
  ];

  // Yoast–style (readability + meta lengths).
  const yoast: CheckIssue[] = [
    { mode: 'yoast', ok: article.title.length >= 30 && article.title.length <= 65, label: 'אורך Title תקין (30-65)' },
    { mode: 'yoast', ok: article.meta.length >= 70 && article.meta.length <= 160, label: 'אורך Meta תקין (70-160)' },
    { mode: 'yoast', ok: words >= 900, label: 'אורך מספק (900+ מילים)' },
    { mode: 'yoast', ok: h2count >= Math.floor(words / 400), label: 'צפיפות כותרות סבירה' },
  ];

  // HCU (Helpful Content)–style heuristics.
  const hcu: CheckIssue[] = [
    { mode: 'hcu', ok: (article.faq?.length ?? 0) >= 2, label: 'מענה לשאלות (FAQ)' },
    { mode: 'hcu', ok: words >= 1200, label: 'עומק (1200+ מילים)' },
    { mode: 'hcu', ok: h2count >= 3, label: 'כיסוי נושאי (3+ סקשנים)' },
  ];

  const pct = (arr: CheckIssue[]) => Math.round((arr.filter((i) => i.ok).length / arr.length) * 100);
  const modes = { rankmath: pct(rank), yoast: pct(yoast), hcu: pct(hcu) };
  const all = [...rank, ...yoast, ...hcu];
  const score = Math.round((all.filter((i) => i.ok).length / all.length) * 100);
  return { score, modes, issues: all };
}
