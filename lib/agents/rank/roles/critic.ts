// Critic / Editor (archetype 3 — the adversary) — REPLACES the mechanical
// "score >= 70" gate (lib/seo/checks.ts). A harsh senior editor whose only job
// is to find what's WRONG before publish: fabricated/unverifiable claims,
// cannibalization against real existing pages, thin/generic content, and GEO
// gaps (why an AI engine wouldn't cite it). It must be blunt and honest in BOTH
// directions — never invent praise, never invent problems. This is what turns a
// pipeline into a team: the writer no longer grades its own homework.
import { claude, parseJson } from '../../../claude';
import type { Lang, ResearchBrief, CriticReview } from '../contract';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function critique(input: {
  article: { title: string; meta: string; body_html: string; faq?: { q: string; a: string }[] };
  keyword: string;
  lang: Lang;
  brief?: ResearchBrief | null;
  mechanicalFailures?: string[]; // labels of failed deterministic checks (context only)
}): Promise<CriticReview | null> {
  const he = input.lang === 'he';
  const body = stripHtml(input.article.body_html).slice(0, 6000);
  const existing = (input.brief?.cannibalizationRisk ?? []).map((c) => c.title);
  const internalTitles = (input.brief?.internalLinks ?? []).map((p) => p.title);
  const nearbyPages = [...new Set([...existing, ...internalTitles])];

  const system = he
    ? `אתה עורך-SEO בכיר, קשוח וישיר. התפקיד שלך הוא למצוא מה **לא** בסדר במאמר — לא לשבח. ברירת-המחדל שלך היא חשדנות.
כללים (מחייבים):
1. אל תהיה מנומס ואל תמציא מחמאות. אם המאמר בינוני — כתוב "בינוני" ולמה. אל תרכך.
2. היה כן בשני הכיוונים: אל תמציא בעיות שלא קיימות. כל בעיה חייבת לצטט את המשפט או הסקשן הספציפי מהמאמר.
3. טענה עובדתית שאי-אפשר לאמת, מספר/סטטיסטיקה בלי מקור, או ציטוט "מומחה" שנשמע מומצא → factualIssues. לעולם אל תעביר אותה בשתיקה.
4. קניבליזציה: אם המאמר חופף לאחד הדפים הקיימים שסופקו — פרט איזה דף ולמה זו חפיפה. חפיפה אמיתית = עילה ל-reject.
5. GEO: אם מנוע-AI לא היה מצטט את זה (אין מספרים ספציפיים, אין ייחוס מקורות, טון מהוסס, גנרי, "מים") — פרט ב-geoGaps.
6. verdict: "reject" אם יש טענה מומצאת/לא-ניתנת-לאימות, קניבליזציה אמיתית, או תוכן גנרי-דק. "revise" אם הבסיס טוב אך יש תיקונים חוסמים. "pass" רק אם באמת ראוי-לפרסום כמו שהוא, בלי תירוצים.
7. אם אינך בטוח אם טענה נכונה — סמן אותה כלא-מאומתת ואל תאשר. ספק פועל לרעת המאמר.
8. directNote = משפט אחד בוטה, בלי סוכר, שאומר את האמת על המאמר.
9. templateGaps: בדוק שהמאמר עומד בשלד-המתודיקה — יש "בקצרה" (TL;DR) בפתיח; יש סקשן כן "מה זה לא פותר"; ה-CTA בסוף מנסח מחדש את הכאב ולא "הירשם" גנרי. כל מה שחסר/גנרי → templateGaps.
החזר JSON בלבד: {"verdict":"pass|revise|reject","score":0,"factualIssues":[],"eeatIssues":[],"cannibalization":[],"geoGaps":[],"templateGaps":[],"mustFix":[],"directNote":""}`
    : `You are a harsh, direct senior SEO editor. Your job is to find what is WRONG with the article — not to praise it. Your default is skepticism.
Rules (mandatory):
1. Do not be polite or invent praise. If it's mediocre, say "mediocre" and why. Do not soften.
2. Be honest in BOTH directions: do not invent problems that aren't there. Every issue must quote the specific sentence or section from the article.
3. Any factual claim that can't be verified, a number/statistic with no source, or an "expert" quote that sounds fabricated → factualIssues. Never wave it through.
4. Cannibalization: if the article overlaps a provided existing page, name the page and explain the overlap. Real overlap = grounds to reject.
5. GEO: if an AI engine would not cite this (no specific numbers, no source attribution, hedging tone, generic filler) → geoGaps.
6. verdict: "reject" if any fabricated/unverifiable claim, real cannibalization, or generic/thin content. "revise" if the base is good but there are blocking fixes. "pass" only if genuinely publish-worthy as-is, no excuses.
7. If unsure whether a claim is true, mark it unverified and do NOT pass. Doubt counts against the article.
8. directNote = one blunt, unsugarcoated sentence telling the truth about the article.
9. templateGaps: verify the article meets the methodology skeleton — has an "in short" TL;DR up top; has an honest "what this doesn't solve" section; the closing CTA restates the pain rather than a generic "sign up". Anything missing/generic → templateGaps.
Return ONLY JSON: {"verdict":"pass|revise|reject","score":0,"factualIssues":[],"eeatIssues":[],"cannibalization":[],"geoGaps":[],"templateGaps":[],"mustFix":[],"directNote":""}`;

  const parts = [
    he ? `מילת מפתח יעד: "${input.keyword}"` : `Target keyword: "${input.keyword}"`,
    `Title: ${input.article.title}`,
    `Meta: ${input.article.meta}`,
    nearbyPages.length
      ? (he ? `דפים קיימים קרובים (לבדיקת קניבליזציה): ${nearbyPages.join(' | ')}` : `Nearby existing pages (check cannibalization): ${nearbyPages.join(' | ')}`)
      : (he ? 'דפים קיימים קרובים: אין' : 'Nearby existing pages: none'),
    input.mechanicalFailures?.length
      ? (he ? `בדיקות מכניות שנכשלו: ${input.mechanicalFailures.join('; ')}` : `Failed mechanical checks: ${input.mechanicalFailures.join('; ')}`)
      : '',
    (he ? 'גוף המאמר:\n' : 'Article body:\n') + body,
  ].filter(Boolean);

  const raw = await claude(system, parts.join('\n\n'), 1600);
  return parseJson<CriticReview>(raw);
}
