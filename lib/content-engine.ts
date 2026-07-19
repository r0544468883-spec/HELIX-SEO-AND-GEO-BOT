// Content engine — writes a full SEO+GEO article from a keyword/brief.
// Hebrew routes through the shared writing skill (HEBREW_STYLE + humanizeHe).
// GEO-aware: answer-first structure, FAQ, schema. Returns a publish-ready piece.
import { claude, parseJson } from './claude';
import { HEBREW_STYLE, humanizeHe } from './hebrew';
import { runChecks, type CheckReport } from './seo/checks';
import { generateImage } from './images';

export type ArticleInput = {
  keyword: string;
  lang?: 'he' | 'en';
  context?: string; // business context
  intent?: string;
  notes?: string; // e.g. striking-distance action plan / FAQ to cover
  withImage?: boolean; // generate a hero image (needs OPENAI_API_KEY)
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
};

type Draft = {
  title: string;
  meta: string;
  h1: string;
  sections: { h2: string; body: string }[];
  faq: { q: string; a: string }[];
};

// 1) Plan + draft the article as structured JSON (answer-first, GEO-ready).
async function draftArticle(input: ArticleInput): Promise<Draft | null> {
  const he = (input.lang ?? 'he') === 'he';
  const ctx = input.context ? `הקשר עסקי: ${input.context}. ` : '';
  const notes = input.notes ? `הנחיות/תוכן לכסות: ${input.notes}. ` : '';
  const system = he
    ? `אתה כותב תוכן SEO+GEO מומחה. כתוב מאמר מקיף (1500+ מילים) על מילת המפתח. ${ctx}${notes}
מבנה answer-first: כל כותרת H2 = שאלה אמיתית, ו-40-60 המילים הראשונות עונות עליה תשובה מלאה ועצמאית (מנצח featured snippet וגם ציטוט AI). טענה אחת למשפט, עובדתי. ${HEBREW_STYLE}
החזר JSON בלבד: {"title":"","meta":"תיאור מטא עד 155 תווים","h1":"","sections":[{"h2":"","body":"פסקאות טקסט (לא HTML)"}],"faq":[{"q":"","a":"תשובה 40-60 מילים"}]}`
    : `You are an expert SEO+GEO content writer. Write a comprehensive 1500+ word article on the keyword. ${input.context ? 'Business context: ' + input.context + '. ' : ''}${input.notes ? 'Cover: ' + input.notes + '. ' : ''}
Answer-first: each H2 is a real question, answered fully in the first 40-60 words. One claim per sentence.
Return ONLY JSON: {"title":"","meta":"under 155 chars","h1":"","sections":[{"h2":"","body":"paragraphs, not HTML"}],"faq":[{"q":"","a":"40-60 word answer"}]}`;
  const raw = await claude(system, `Keyword: "${input.keyword}"${input.intent ? ' (intent: ' + input.intent + ')' : ''}`, 4000);
  return parseJson<Draft>(raw);
}

// 2) Render structured draft → HTML.
function renderHtml(draft: Draft): string {
  const parts: string[] = [`<h1>${esc(draft.h1 || draft.title)}</h1>`];
  for (const s of draft.sections ?? []) {
    parts.push(`<h2>${esc(s.h2)}</h2>`);
    for (const para of (s.body ?? '').split(/\n{2,}/).filter(Boolean)) {
      parts.push(`<p>${esc(para.trim())}</p>`);
    }
  }
  if (draft.faq?.length) {
    parts.push('<h2>שאלות ותשובות</h2>');
    for (const f of draft.faq) parts.push(`<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`);
  }
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
  }

  let body_html = renderHtml(draft);
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
  return { ...article, checks: runChecks(article, input.keyword) };
}
