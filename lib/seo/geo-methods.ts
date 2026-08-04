// Princeton GEO scoring — grades an article by the 9 research-backed methods that
// increase citation by AI answer engines (Aggarwal et al., KDD 2024). Deterministic,
// no LLM. Complements checks.ts (classic SEO); this is the GEO half. Weights mirror
// the paper's measured visibility boosts. Ported from hebrew-seo-geo-toolkit.

export type GeoMethod = { id: string; label: string; ok: boolean; boost: number; detail: string };
export type GeoReport = { score: number; methods: GeoMethod[] };

function stripText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreGeoMethods(html: string, keyword = ''): GeoReport {
  const text = stripText(html);
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length || 1;
  const sentences = text.split(/[.!?׃]|\n/).map((s) => s.trim()).filter((s) => s.length > 0);

  // 1) Cite sources (+40): external links or attribution language.
  const hasExternalLink = /<a\b[^>]*href=["']https?:\/\//i.test(html);
  const attributionWords = (text.match(/\b(לפי|על פי|על-פי|מחקר|מקור|נתוני|כפי ש|לדברי|בהתאם ל)\b/g) || []).length;
  const cite = hasExternalLink || attributionWords >= 2;

  // 2) Statistics (+37): percentages / big numbers / multiple figures.
  const percents = (text.match(/\d+(?:\.\d+)?\s*%|\d+\s*אחוז/g) || []).length;
  const bigNumbers = (text.match(/\d[\d,\.]*\s*(אלף|מיליון|מיליארד|₪|\$)/g) || []).length;
  const figures = (text.match(/\b\d[\d,\.]*\b/g) || []).length;
  const stats = percents + bigNumbers >= 2 || figures >= 5;

  // 3) Quotations (+30): quoted text with attribution.
  const quoteMarks = (text.match(/["“”„«»]/g) || []).length;
  const quoteAttribution = /\b(אמר|אמרה|לדברי|כדברי|ציין|הסביר|לטענת)\b/.test(text);
  const quotes = quoteMarks >= 2 && quoteAttribution;

  // 4) Authoritative tone (+25): low hedging density.
  const hedges = (text.match(/\b(אולי|ייתכן|כנראה|נראה ש|אפשר ש|לא בטוח)\b/g) || []).length;
  const authoritative = hedges / (sentences.length || 1) < 0.15;

  // 5) Easy to understand (+20): short average sentence length.
  const avgSentLen = wc / (sentences.length || 1);
  const easy = avgSentLen <= 22;

  // 6) Technical terms (+18): domain terms present (loanwords/parenthetical English/acronyms).
  const technical = /\([A-Za-z][^)]{1,40}\)|[A-Za-z]{2,}[- ]?[A-Za-z]{2,}|[A-Z]{2,}/.test(text);

  // 7) Unique words (+15): lexical diversity (type-token ratio).
  const uniq = new Set(words.map((w) => w.toLowerCase())).size;
  const diverse = uniq / wc >= 0.4;

  // 8) Fluency (+15..30): reasonable sentence-length variance + not too choppy.
  const fluent = avgSentLen >= 8 && avgSentLen <= 26 && sentences.length >= 4;

  // 9) AVOID keyword stuffing (-10): keyword density must stay under ~3%.
  const kw = keyword.trim().toLowerCase();
  let stuffed = false;
  if (kw) {
    const occ = text.toLowerCase().split(kw).length - 1;
    stuffed = occ / wc > 0.03;
  }

  const methods: GeoMethod[] = [
    { id: 'cite', label: 'ציטוט מקורות', ok: cite, boost: 40, detail: cite ? 'יש מקורות/ייחוס סמכותי.' : 'אין קישורים חיצוניים/ייחוס — הוסף מקורות אמינים (+40% ציטוט AI).' },
    { id: 'stats', label: 'סטטיסטיקות ומספרים', ok: stats, boost: 37, detail: stats ? 'יש נתונים כמותיים.' : 'מעט מדי מספרים/אחוזים — הוסף נתונים ספציפיים (+37%).' },
    { id: 'quotes', label: 'ציטוטי מומחה', ok: quotes, boost: 30, detail: quotes ? 'יש ציטוטים מיוחסים.' : 'אין ציטוטים מיוחסים — הוסף ציטוט מומחה עם שם (+30%).' },
    { id: 'authoritative', label: 'טון סמכותי', ok: authoritative, boost: 25, detail: authoritative ? 'טון בטוח, מעט הסתייגויות.' : 'יותר מדי מילות היסוס (אולי/ייתכן) — כתוב בביטחון (+25%).' },
    { id: 'easy', label: 'קל להבנה', ok: easy, boost: 20, detail: easy ? `אורך משפט ממוצע ${avgSentLen.toFixed(0)} מילים.` : 'משפטים ארוכים מדי — קצר אותם (+20%).' },
    { id: 'technical', label: 'מונחים מקצועיים', ok: technical, boost: 18, detail: technical ? 'יש טרמינולוגיה מקצועית.' : 'הוסף מונחי-תחום מדויקים (+18%).' },
    { id: 'diverse', label: 'עושר לשוני', ok: diverse, boost: 15, detail: diverse ? 'אוצר מילים מגוון.' : 'חזרתיות גבוהה — גוון את השפה (+15%).' },
    { id: 'fluent', label: 'שטף וקריאות', ok: fluent, boost: 20, detail: fluent ? 'זרימה תקינה.' : 'קצב לא אחיד — שפר את הזרימה (+15-30%).' },
    { id: 'no_stuffing', label: 'ללא דחיסת מילות מפתח', ok: !stuffed, boost: 10, detail: stuffed ? 'צפיפות מילת המפתח גבוהה מדי (>3%) — פוגע ב-AI (-10%).' : 'צפיפות מילת מפתח תקינה.' },
  ];

  const gained = methods.filter((m) => m.ok).reduce((a, m) => a + m.boost, 0);
  const total = methods.reduce((a, m) => a + m.boost, 0);
  const score = Math.round((gained / total) * 100);
  return { score, methods };
}
