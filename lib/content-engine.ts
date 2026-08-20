// Content engine — writes a full SEO+GEO article from a keyword/brief.
// Hebrew routes through the shared writing skill (HEBREW_STYLE + humanizeHe).
// GEO-aware: answer-first structure, FAQ, schema. Returns a publish-ready piece.
import { claude, parseJson } from './claude';
import { HEBREW_STYLE, humanizeHe } from './hebrew';
import { runChecks, type CheckReport } from './seo/checks';
import { scoreGeoMethods, type GeoReport } from './seo/geo-methods';
import { detectOrphanWords, detectAiEmojis, type ContentIssue } from './seo/content-quality';
import { generateImage } from './images';

// The methodology template a piece follows (§4). 'spoke' is the default and keeps
// the historical article shape; the others add the fixed skeleton + tactics.
export type Template = 'spoke' | 'pillar' | 'compare' | 'stats';

export type ArticleInput = {
  keyword: string;
  lang?: 'he' | 'en';
  context?: string; // business context
  intent?: string;
  notes?: string; // e.g. striking-distance action plan / FAQ to cover
  withImage?: boolean; // generate a hero image (needs OPENAI_API_KEY)
  template?: Template; // methodology §4 skeleton; default 'spoke'
  coinedTerm?: string; // invented category term to define + own (methodology §3.2)
  diagram?: string; // signature-diagram concept, rendered as a consistent figure (methodology §3.4)
  cta?: string; // problem-restatement CTA line (methodology §3.7); if absent the model writes one
  pillarTitle?: string; // for a spoke: the pillar page to link back to (hub-and-spoke)
};

export type Article = {
  title: string;
  meta: string;
  h1: string;
  body_html: string;
  faq: { q: string; a: string }[];
  schema_json: unknown;
  lang: 'he' | 'en';
  checks: CheckReport; // pre-publish quality gate (§3.8.11)
  geo: GeoReport; // Princeton 9-method GEO score (AI-citation readiness)
  contentQuality: ContentIssue[]; // AI-emoji / orphan-word content checks
};

type Draft = {
  title: string;
  meta: string;
  h1: string;
  tldr?: string; // "בקצרה" — 2-3 line answer-first TL;DR (methodology §4)
  sections: { h2: string; body: string }[];
  faq: { q: string; a: string }[];
  limits?: string; // honest "what we don't solve / when this isn't the fit" (methodology §3.5)
  cta?: string; // problem-restatement CTA (methodology §3.7)
};

// Methodology §4 skeleton instructions, layered on top of the base GEO rules.
// Keeps the historical shape for 'spoke' but always adds the fixed slots (TL;DR,
// pain → old way → solution → how-it-works via sections, honest limits, CTA).
function templateNotes(template: Template, coinedTerm: string | undefined, he: boolean): string {
  const p: string[] = [];
  if (he) {
    p.push('שלד קבוע (מתודיקה §4): פתח ב-tldr של 2-3 שורות ("בקצרה"). ה-sections חייבים לכסות, בסדר: הבעיה/הכאב → למה הדרך הרגילה נכשלת → הגישה/הפתרון → איך זה עובד (שלבים).');
    p.push('limits = פסקה כנה: מה זה *לא* פותר / מתי זה לא מתאים. אל תמציא — כנות בונה אמון (§3.5).');
    p.push('cta = שורת סיום שמנסחת מחדש את הכאב כשאלה ("מוכן ל___?"), לא "הירשם" גנרי (§3.7).');
    if (coinedTerm) p.push(`הגדר וטבע את המונח "${coinedTerm}" כקטגוריה — הסבר מה הוא ולמה הוא נחוץ (§3.2).`);
    if (template === 'pillar') p.push('זה עמוד-עוגן (pillar): 2800+ מילים, הגדרה מלאה, וסקשן אחד עם טבלת-השוואה מול הגישות הסמוכות (בטקסט: שורה לכל גישה, מה כן/לא).');
    if (template === 'compare') p.push('זה עמוד-השוואה: "המוצר הוא לא ___" → הבחנה מול החלופה, כולל trade-off כן (מתי החלופה עדיפה).');
    if (template === 'stats') p.push('זה עמוד-סטטיסטיקות: כל נתון עם מקור+תאריך. אם אין לך מקור אמיתי — כתוב "[מקור]" ו-"[תאריך]" כ-placeholder ואל תמציא מספר.');
  } else {
    p.push('Fixed skeleton (methodology §4): open with a 2-3 line tldr ("in short"). sections must cover, in order: the problem/pain → why the usual way fails → the approach/solution → how it works (steps).');
    p.push('limits = an honest paragraph: what this does NOT solve / when it is not the fit. Do not invent — candor builds trust (§3.5).');
    p.push('cta = a closing line that restates the pain as a question ("Ready to ___?"), not a generic "sign up" (§3.7).');
    if (coinedTerm) p.push(`Define and own the term "${coinedTerm}" as a category — explain what it is and why it is needed (§3.2).`);
    if (template === 'pillar') p.push('This is a pillar page: 2800+ words, a full definition, and one section with a comparison table vs adjacent approaches (in text: a row per approach, what it does/does not do).');
    if (template === 'compare') p.push('This is a compare page: "the product is NOT ___" → differentiate vs the alternative, including an honest trade-off (when the alternative is better).');
    if (template === 'stats') p.push('This is a statistics page: every stat with source + date. If you lack a real source, write "[source]" and "[date]" as a placeholder and do NOT invent a number.');
  }
  return p.join(' ');
}

// 1) Plan + draft the article as structured JSON (answer-first, GEO-ready).
async function draftArticle(input: ArticleInput): Promise<Draft | null> {
  const he = (input.lang ?? 'he') === 'he';
  const template: Template = input.template ?? 'spoke';
  const ctx = input.context ? `הקשר עסקי: ${input.context}. ` : '';
  const notes = input.notes ? `הנחיות/תוכן לכסות: ${input.notes}. ` : '';
  const tpl = templateNotes(template, input.coinedTerm, he);
  const minWords = template === 'pillar' ? '2800+' : '1500+';
  const system = he
    ? `אתה כותב תוכן SEO+GEO מומחה. כתוב מאמר מקיף (${minWords} מילים) על מילת המפתח. ${ctx}${notes}
${tpl}
מבנה answer-first: כל כותרת H2 = שאלה אמיתית, ו-40-60 המילים הראשונות עונות עליה תשובה מלאה ועצמאית (מנצח featured snippet וגם ציטוט AI). טענה אחת למשפט, עובדתי.
שיטות GEO (פרינסטון) — חובה כדי שמנועי AI יצטטו אותך: שלב סטטיסטיקות ומספרים ספציפיים; ייחס טענות למקורות ("לפי...", "מחקר של..."); הוסף לפחות ציטוט מומחה אחד מיוחס בשם; טון סמכותי בלי מילות היסוס; משפטים קצרים; אל תדחוס את מילת המפתח (מתחת ל-3%). ${HEBREW_STYLE}
החזר JSON בלבד: {"title":"","meta":"תיאור מטא עד 155 תווים","h1":"","tldr":"2-3 שורות","sections":[{"h2":"","body":"פסקאות טקסט (לא HTML)"}],"faq":[{"q":"","a":"תשובה 40-60 מילים"}],"limits":"פסקה כנה","cta":"שורת CTA כהצהרת-בעיה"}`
    : `You are an expert SEO+GEO content writer. Write a comprehensive ${minWords} word article on the keyword. ${input.context ? 'Business context: ' + input.context + '. ' : ''}${input.notes ? 'Cover: ' + input.notes + '. ' : ''}
${tpl}
Answer-first: each H2 is a real question, answered fully in the first 40-60 words. One claim per sentence.
GEO methods (Princeton) — required for AI citation: include specific statistics/numbers; attribute claims to sources ("according to..."); add at least one attributed expert quote; authoritative tone, no hedging; short sentences; do NOT stuff the keyword (under 3%).
Return ONLY JSON: {"title":"","meta":"under 155 chars","h1":"","tldr":"2-3 lines","sections":[{"h2":"","body":"paragraphs, not HTML"}],"faq":[{"q":"","a":"40-60 word answer"}],"limits":"honest paragraph","cta":"problem-restatement CTA line"}`;
  const raw = await claude(system, `Keyword: "${input.keyword}"${input.intent ? ' (intent: ' + input.intent + ')' : ''}`, template === 'pillar' ? 6000 : 4000);
  return parseJson<Draft>(raw);
}

// The signature diagram (methodology §3.4) — a consistent, image-free figure block
// reused across every page of a cluster. Renders the concept as a labeled figure so
// the same visual signature appears without needing an image API.
function renderDiagram(concept: string, he: boolean): string {
  const label = he ? 'איך זה עובד' : 'How it works';
  return `<figure class="signature-diagram" data-role="signature-diagram">\n<figcaption>${esc(label)}</figcaption>\n<p>${esc(concept)}</p>\n</figure>`;
}

// 2) Render structured draft → HTML.
function renderHtml(draft: Draft, opts: { he: boolean; diagram?: string; cta?: string }): string {
  const parts: string[] = [`<h1>${esc(draft.h1 || draft.title)}</h1>`];
  // TL;DR callout up top (answer-first + AI-citation bait).
  if (draft.tldr) parts.push(`<p class="tldr" data-role="tldr"><strong>${opts.he ? 'בקצרה' : 'In short'}:</strong> ${esc(draft.tldr)}</p>`);
  // Signature diagram directly under the intro, before the body.
  if (opts.diagram) parts.push(renderDiagram(opts.diagram, opts.he));
  for (const s of draft.sections ?? []) {
    parts.push(`<h2>${esc(s.h2)}</h2>`);
    for (const para of (s.body ?? '').split(/\n{2,}/).filter(Boolean)) {
      parts.push(`<p>${esc(para.trim())}</p>`);
    }
  }
  // Honest "what we don't solve" section (methodology §3.5).
  if (draft.limits) parts.push(`<h2>${opts.he ? 'מה זה לא פותר' : "What this doesn't solve"}</h2>\n<p>${esc(draft.limits)}</p>`);
  if (draft.faq?.length) {
    parts.push(`<h2>${opts.he ? 'שאלות ותשובות' : 'FAQ'}</h2>`);
    for (const f of draft.faq) parts.push(`<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`);
  }
  // CTA as problem-restatement (methodology §3.7). Prefer the caller's line.
  const cta = opts.cta || draft.cta;
  if (cta) parts.push(`<p class="cta" data-role="cta">${esc(cta)}</p>`);
  return parts.join('\n');
}

// 3) Build Article + FAQ schema (JSON-LD) for GEO.
function buildSchema(draft: Draft): unknown {
  const nodes: unknown[] = [
    { '@type': 'Article', headline: draft.title, description: draft.meta },
  ];
  if (draft.faq?.length) {
    nodes.push({
      '@type': 'FAQPage',
      mainEntity: draft.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': nodes };
}

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Full pipeline: draft → Hebrew humanize pass → HTML + schema.
export async function generateArticle(input: ArticleInput): Promise<Article | null> {
  const lang = input.lang ?? 'he';
  const draft = await draftArticle(input);
  if (!draft) return null;

  // Hebrew content routes through the dedicated writing skill (per section body).
  if (lang === 'he') {
    draft.title = await humanizeHe(draft.title);
    for (const s of draft.sections ?? []) s.body = await humanizeHe(s.body);
    for (const f of draft.faq ?? []) f.a = await humanizeHe(f.a);
    if (draft.tldr) draft.tldr = await humanizeHe(draft.tldr);
    if (draft.limits) draft.limits = await humanizeHe(draft.limits);
    if (draft.cta) draft.cta = await humanizeHe(draft.cta);
  }

  let body_html = renderHtml(draft, { he: lang === 'he', diagram: input.diagram, cta: input.cta });
  // Optional hero image (opt-in; no-op without an image key).
  if (input.withImage) {
    const img = await generateImage(`Editorial hero image for an article titled "${draft.title}". Clean, modern, no text.`);
    if (img) body_html = `<img src="${img}" alt="${draft.h1 || draft.title}" />\n${body_html}`;
  }

  const article = {
    title: draft.title,
    meta: draft.meta,
    h1: draft.h1 || draft.title,
    body_html,
    faq: draft.faq ?? [],
    schema_json: buildSchema(draft),
    lang,
  };
  const contentQuality: ContentIssue[] = [
    ...detectAiEmojis(article.body_html),
    ...detectOrphanWords(article.body_html),
  ];
  return {
    ...article,
    checks: runChecks(article, input.keyword),
    geo: scoreGeoMethods(article.body_html, input.keyword),
    contentQuality,
  };
}

// Compare page (methodology §3.9 / template D): "we are NOT X" + honest trade-off.
// Captures high-intent "X vs Y" / "vs doing it yourself" search traffic.
export function generateCompare(input: {
  keyword: string;
  against: string; // the competitor / alternative / "doing it yourself"
  lang?: 'he' | 'en';
  context?: string;
  diagram?: string;
}): Promise<Article | null> {
  const he = (input.lang ?? 'he') === 'he';
  const notes = he
    ? `השווה מול: "${input.against}". הגדר במה אנחנו שונים, כולל trade-off כן (מתי "${input.against}" עדיף).`
    : `Compare against: "${input.against}". Define how we differ, including an honest trade-off (when "${input.against}" is the better fit).`;
  return generateArticle({ ...input, template: 'compare', notes });
}

// Statistics roundup (methodology §3.6 / template): a dated, sourced, link-worthy
// GEO/AI-citation magnet. Honesty (Rank core): it NEVER invents a number — it
// formats provided stats, or emits explicit [source]/[date] placeholders to fill.
export function generateStatsPage(input: {
  keyword: string;
  stats?: { claim: string; source?: string; date?: string; url?: string }[];
  lang?: 'he' | 'en';
  context?: string;
}): Promise<Article | null> {
  const he = (input.lang ?? 'he') === 'he';
  const lines = (input.stats ?? [])
    .map((s) => `- ${s.claim} (${s.source ?? '[מקור]'}, ${s.date ?? '[תאריך]'}${s.url ? `, ${s.url}` : ''})`)
    .join('\n');
  const notes = lines
    ? (he ? `נתונים לעצב (אל תמציא נוספים, אל תשנה מספרים):\n${lines}` : `Stats to format (do not invent more, do not alter numbers):\n${lines}`)
    : (he ? 'אין נתונים מסופקים — הפק שלד עם placeholders [מקור]/[תאריך] בלבד, בלי להמציא מספרים.' : 'No stats provided — emit a skeleton with [source]/[date] placeholders only, invent no numbers.');
  return generateArticle({ keyword: input.keyword, lang: input.lang, context: input.context, template: 'stats', notes });
}
