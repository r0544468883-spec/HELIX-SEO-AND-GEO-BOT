// Researcher (archetype 1) — grounds the article before it's written.
// Today generateArticle() gets keyword + site url and almost no research; this
// fills that gap. Two jobs: (1) plan what a strong article must cover, (2) from
// the REAL list of existing pages, pick internal links and flag cannibalization.
// Honesty rule (Rank's core): it plans, it does NOT invent stats or sources.
import { claude, parseJson } from '../../../claude';
import { withSkills } from '../../../skills/registry';
import type { Lang, ExistingPage, ResearchBrief } from '../contract';

export async function research(input: {
  keyword: string;
  lang: Lang;
  context?: string;
  existingPages: ExistingPage[];
}): Promise<ResearchBrief | null> {
  const he = input.lang === 'he';
  const pagesList =
    input.existingPages.slice(0, 40).map((p, i) => `${i + 1}. ${p.title}`).join('\n') ||
    (he ? '(אין דפים קיימים)' : '(no existing pages)');

  const system = he
    ? `אתה חוקר-תוכן SEO/GEO. המשימה: לבנות בריף מחקרי קצר וממוקד לקראת כתיבת מאמר על מילת-המפתח, ולסמן חפיפה לדפים קיימים.
כללי-ברזל:
- internalLinks ו-cannibalizationRisk — אך ורק מתוך רשימת הדפים הקיימים שסופקה. אל תמציא דפים שלא ברשימה.
- אל תמציא סטטיסטיקות, מספרים או מקורות. entities ו-subQuestions הם תכנון של מה שכדאי לכסות — לא עובדות מאומתות.
- היה ממוקד: 5-8 subQuestions, 6-10 entities, 4-6 mustCover.
- angle = הזווית הייחודית שתבדל את המאמר מהדפים הקיימים.
החזר JSON בלבד: {"angle":"","entities":[],"subQuestions":[],"mustCover":[],"internalLinks":[{"title":""}],"cannibalizationRisk":[{"title":"","reason":""}],"notes":""}`
    : `You are an SEO/GEO content researcher. Build a short, focused research brief for an article on the keyword, and flag overlap with existing pages.
Hard rules:
- internalLinks and cannibalizationRisk must come ONLY from the provided existing-pages list. Do not invent pages.
- Do NOT invent statistics, numbers, or sources. entities and subQuestions are a plan of what to cover — not verified facts.
- Stay focused: 5-8 subQuestions, 6-10 entities, 4-6 mustCover.
- angle = the unique angle that differentiates this from the existing pages.
Return ONLY JSON: {"angle":"","entities":[],"subQuestions":[],"mustCover":[],"internalLinks":[{"title":""}],"cannibalizationRisk":[{"title":"","reason":""}],"notes":""}`;

  const user = he
    ? `מילת מפתח: "${input.keyword}"${input.context ? `\nהקשר עסקי: ${input.context}` : ''}\n\nדפים קיימים באתר:\n${pagesList}`
    : `Keyword: "${input.keyword}"${input.context ? `\nBusiness context: ${input.context}` : ''}\n\nExisting site pages:\n${pagesList}`;

  const raw = await claude(withSkills(system, ['seo-geo-pack', 'helix-brand-voice']), user, 1500);
  return parseJson<ResearchBrief>(raw);
}
