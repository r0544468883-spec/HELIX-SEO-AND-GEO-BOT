// AEO Audit — fetches a LIVE url and grades how ready it is to be cited by AI
// answer engines. Distinct from checks.ts (which gates content pre-publish);
// this inspects a page already on the web. Pure fetch + regex, no LLM.
// Harvested & adapted (MIT) from danishashko/geo-aeo-tracker, Hebrew labels.

export type AeoCheck = {
  id: string;
  label: string;
  category: 'discovery' | 'structure' | 'content';
  pass: boolean;
  value: string;
  detail: string;
};
export type AeoReport = { url: string; score: number; checks: AeoCheck[] };

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function tryFetch(url: string): Promise<{ ok: boolean; text: string; status: number }> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'HELIX-Rank-AEO/1.0' }, cache: 'no-store' });
    const text = res.ok ? await res.text() : '';
    return { ok: res.ok, text, status: res.status };
  } catch {
    return { ok: false, text: '', status: 0 };
  }
}

// The AI crawlers that matter for answer-engine visibility.
const AI_BOTS = ['gptbot', 'chatgpt-user', 'claudebot', 'anthropic-ai', 'google-extended', 'googleother', 'perplexitybot', 'ccbot', 'cohere-ai', 'bytespider'];

export async function auditAeo(url: string): Promise<AeoReport> {
  const origin = new URL(url).origin;
  const page = await tryFetch(url);
  if (!page.ok) throw new Error(`fetch_failed_${page.status}`);
  const html = page.text;
  const plain = stripHtml(html);

  const [llms, llmsFull, robots, sitemap] = await Promise.all([
    tryFetch(`${origin}/llms.txt`),
    tryFetch(`${origin}/llms-full.txt`),
    tryFetch(`${origin}/robots.txt`),
    tryFetch(`${origin}/sitemap.xml`),
  ]);

  const checks: AeoCheck[] = [];

  // ── Discovery ──────────────────────────────────────────
  checks.push({ id: 'llms_txt', label: 'קובץ llms.txt', category: 'discovery', pass: llms.ok, value: llms.ok ? 'קיים' : 'חסר', detail: llms.ok ? `נמצא (${llms.text.length} bytes)` : 'אין llms.txt — הקובץ מסביר למנועי AI על מטרת האתר.' });
  checks.push({ id: 'llms_full', label: 'קובץ llms-full.txt', category: 'discovery', pass: llmsFull.ok, value: llmsFull.ok ? 'קיים' : 'חסר', detail: llmsFull.ok ? `נמצא (${llmsFull.text.length} bytes)` : 'אין llms-full.txt — קובץ מורחב עם הקשר מלא ל-AI.' });

  const blocked: string[] = [];
  if (robots.ok) for (const bot of AI_BOTS) {
    if (new RegExp(`user-agent:\\s*${bot}[\\s\\S]*?disallow:\\s*/`, 'i').test(robots.text)) blocked.push(bot);
  }
  const botOk = robots.ok && blocked.length <= 2;
  checks.push({ id: 'robots_ai', label: 'גישת בוטים של AI (robots.txt)', category: 'discovery', pass: botOk, value: robots.ok ? `${blocked.length}/${AI_BOTS.length} חסומים` : 'אין robots.txt', detail: blocked.length ? `חסומים: ${blocked.join(', ')}` : 'כל בוטי ה-AI מורשים לסרוק.' });

  const hasSitemap = sitemap.ok && sitemap.text.includes('<url');
  const sitemapCount = (sitemap.text.match(/<url>/gi) ?? []).length;
  checks.push({ id: 'sitemap', label: 'מפת אתר (sitemap.xml)', category: 'discovery', pass: hasSitemap, value: hasSitemap ? `${sitemapCount} כתובות` : 'חסר', detail: hasSitemap ? `נמצאה עם ${sitemapCount} עמודים.` : 'אין sitemap.xml — עוזר ל-AI לגלות עמודים.' });

  // ── Structure ──────────────────────────────────────────
  const jsonLd = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const schemaTypes: string[] = [];
  for (const block of jsonLd) {
    try {
      const parsed = JSON.parse(block.replace(/<script[^>]*>|<\/script>/gi, ''));
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        const t = item?.['@type'];
        if (t) schemaTypes.push(...(Array.isArray(t) ? t : [t]));
      }
    } catch { /* skip invalid JSON-LD */ }
  }
  checks.push({ id: 'json_ld', label: 'נתונים מובנים (JSON-LD)', category: 'structure', pass: jsonLd.length > 0, value: jsonLd.length ? `${jsonLd.length} בלוקים` : 'חסר', detail: schemaTypes.length ? `סוגי Schema: ${[...new Set(schemaTypes)].join(', ')}` : 'אין JSON-LD — הוסף Organization/Product/FAQPage/Article.' });

  const hasFaqSchema = schemaTypes.some((t) => /faq/i.test(t));
  const hasFaqHtml = /<details|<summary|class="faq"|id="faq"|class="accordion"/i.test(html);
  checks.push({ id: 'faq', label: 'Schema של שאלות ותשובות', category: 'structure', pass: hasFaqSchema || hasFaqHtml, value: hasFaqSchema ? 'עם Schema' : hasFaqHtml ? 'HTML בלבד' : 'חסר', detail: hasFaqSchema ? 'FAQPage schema קיים — AI יכול לחלץ שאלות/תשובות.' : hasFaqHtml ? 'יש HTML של FAQ אך ללא schema — הוסף FAQPage.' : 'אין FAQ — schema של FAQ משפר ציטוט משמעותית.' });

  const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? '';
  const metaOk = metaDesc.length >= 50 && metaDesc.length <= 300;
  checks.push({ id: 'meta', label: 'תיאור Meta', category: 'structure', pass: metaOk, value: metaDesc ? `${metaDesc.length} תווים` : 'חסר', detail: metaDesc ? (metaOk ? 'אורך תקין.' : 'אורך לא אופטימלי — כוון ל-50-160 תווים.') : 'אין meta description — AI משתמש בו כתקציר.' });

  const hasCanonical = /<link[^>]*rel=["']canonical["']/i.test(html);
  checks.push({ id: 'canonical', label: 'תגית Canonical', category: 'structure', pass: hasCanonical, value: hasCanonical ? 'קיים' : 'חסר', detail: hasCanonical ? 'קיים — מפנה ל-URL הנכון.' : 'אין canonical — הוסף כדי ש-AI יצטט את ה-URL הנכון.' });

  // ── Content ────────────────────────────────────────────
  const firstChunk = plain.slice(0, Math.floor(Math.max(plain.length * 0.2, 400)));
  const hasDirectAnswer = /\b(in short|tl;dr|summary|key takeaways|bottom line|the answer is)\b|לסיכום|בקצרה|התשובה היא|שורה תחתונה/i.test(firstChunk);
  const bulletCount = (html.match(/<li\b/gi) ?? []).length;
  checks.push({ id: 'bluf', label: 'תשובה ישירה בפתיחה (BLUF)', category: 'content', pass: hasDirectAnswer || bulletCount > 3, value: hasDirectAnswer ? 'כן' : 'חלקי', detail: hasDirectAnswer ? 'התוכן פותח בתשובה ישירה — מצוין לציטוט AI.' : 'התוכן לא פותח בתשובה ברורה — התחל במשפט "שורה תחתונה".' });

  const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
  const h2 = (html.match(/<h2[\s>]/gi) ?? []).length;
  const headingOk = h1 === 1 && h2 >= 2;
  checks.push({ id: 'headings', label: 'היררכיית כותרות', category: 'content', pass: headingOk, value: `H1:${h1} H2:${h2}`, detail: headingOk ? 'היררכיה תקינה (H1 יחיד + H2 מרובים).' : 'היררכיה בעייתית — צריך H1 יחיד ולפחות 2 כותרות H2.' });

  const passed = checks.filter((c) => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);
  return { url, score, checks };
}
