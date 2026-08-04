// Post-launch checklist — the "10 things after every website launch" flow.
// Auto-runs the checkable items against a live URL; flags the rest as manual
// (need Google/tool auth). Pure fetch, no keys (PageSpeed optional via env).

export type LaunchItem = {
  id: string;
  label: string;
  mode: 'auto' | 'manual';
  status: 'pass' | 'partial' | 'fail' | 'manual';
  detail: string;
};

const UA = 'HELIX-Rank-Launch/1.0';

async function get(url: string, method: 'GET' | 'HEAD' = 'GET'): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(url, { method, headers: { 'user-agent': UA }, signal: ctl.signal, redirect: 'follow' });
    } finally {
      clearTimeout(t);
    }
    const body = method === 'GET' && res.ok ? await res.text() : '';
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: '' };
  }
}

export async function runLaunchChecklist(rawUrl: string): Promise<{ url: string; score: number; items: LaunchItem[] }> {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const origin = new URL(url).origin;

  const [page, robots, sitemap] = await Promise.all([
    get(url),
    get(`${origin}/robots.txt`),
    get(`${origin}/sitemap.xml`, 'HEAD'),
  ]);
  const html = page.body;

  // Broken internal links (sample up to 12).
  const hrefs = [...html.matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["']/gi)].map((m) => m[1]);
  const internal: string[] = [];
  const seen = new Set<string>();
  for (const h of hrefs) {
    if (/^(mailto:|tel:|javascript:|data:)/i.test(h)) continue;
    let abs: string;
    try { abs = new URL(h, url).toString(); } catch { continue; }
    if (!abs.startsWith(origin) || seen.has(abs)) continue;
    seen.add(abs); internal.push(abs);
    if (internal.length >= 12) break;
  }
  let broken = 0;
  await Promise.all(internal.map(async (u) => {
    const r = await get(u, 'HEAD');
    if (!r.ok && r.status >= 400 && r.status !== 405) broken++;
  }));

  // PageSpeed (optional; slow).
  let psi: number | null = null;
  try {
    const key = process.env.PAGESPEED_API_KEY;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    let r: Response;
    try {
      r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?strategy=mobile&category=performance&url=${encodeURIComponent(url)}${key ? `&key=${key}` : ''}`, { signal: ctl.signal });
    } finally { clearTimeout(t); }
    if (r.ok) {
      const j = (await r.json()) as { lighthouseResult?: { categories?: { performance?: { score?: number } } } };
      const sc = j.lighthouseResult?.categories?.performance?.score;
      if (typeof sc === 'number') psi = Math.round(sc * 100);
    }
  } catch { /* leave null */ }

  const noindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const hasGA = /googletagmanager\.com\/gtag\/js|www\.google-analytics\.com|gtag\s*\(|\bG-[A-Z0-9]{6,}\b|\bUA-\d{4,}-\d\b/i.test(html);
  const hasPhone = /(?:0(?:5\d|[2-4,8-9])[-\s]?\d{3}[-\s]?\d{4})|\+972/.test(html);
  const hasAddress = /(?:רחוב|רח['׳]|שדרות|כתובת|address|street)/i.test(html);
  const hasForm = /<form\b/i.test(html);
  const hasSitemap = sitemap.ok || /sitemap\s*:/i.test(robots.body);

  const items: LaunchItem[] = [
    { id: 'search_console', label: 'הגשה ל-Google Search Console', mode: 'manual', status: 'manual', detail: 'דורש חיבור Google — לאמת נכס ולהגיש.' },
    { id: 'sitemap', label: 'הגשת sitemap.xml', mode: 'auto', status: hasSitemap ? 'pass' : 'fail', detail: hasSitemap ? 'נמצאה מפת אתר.' : 'לא נמצאה sitemap.xml — ליצור ולהגיש ל-GSC.' },
    { id: 'analytics', label: 'התקנת Analytics', mode: 'auto', status: hasGA ? 'pass' : 'fail', detail: hasGA ? 'מותקן GA4/GTM.' : 'לא זוהה קוד מדידה.' },
    { id: 'noindex', label: 'הסרת תגיות noindex', mode: 'auto', status: noindex ? 'fail' : 'pass', detail: noindex ? 'העמוד מסומן noindex — לא ייכלל בחיפוש/AI!' : 'העמוד פתוח לאינדוקס.' },
    { id: 'robots', label: 'בדיקת robots.txt', mode: 'auto', status: robots.ok ? 'pass' : 'partial', detail: robots.ok ? 'קיים robots.txt.' : 'לא נמצא robots.txt.' },
    { id: 'nap', label: 'אימות NAP (שם/כתובת/טלפון)', mode: 'auto', status: hasPhone && hasAddress ? 'pass' : hasPhone || hasAddress ? 'partial' : 'fail', detail: hasPhone || hasAddress ? 'נמצאו חלק מפרטי הקשר.' : 'לא נמצאו טלפון/כתובת כטקסט.' },
    { id: 'broken_links', label: 'תיקון קישורים שבורים', mode: 'auto', status: internal.length === 0 ? 'partial' : broken === 0 ? 'pass' : broken <= 2 ? 'partial' : 'fail', detail: internal.length === 0 ? 'לא נמצאו קישורים פנימיים.' : broken === 0 ? `נבדקו ${internal.length} — תקינים.` : `${broken} שבורים מתוך ${internal.length}.` },
    { id: 'pagespeed', label: 'בדיקת מהירות (PageSpeed)', mode: 'auto', status: psi === null ? 'partial' : psi >= 90 ? 'pass' : psi >= 50 ? 'partial' : 'fail', detail: psi === null ? 'לא נמדד.' : `ציון מובייל ${psi}/100.` },
    { id: 'ai_visibility', label: 'מעקב נראות AI + מפות', mode: 'manual', status: 'manual', detail: 'להפעיל מעקב ציטוטים ב-AI (GEO Monitor) ו-Google Business Profile למפות.' },
    { id: 'forms', label: 'בדיקת טפסים/CTA שקולטים לידים', mode: 'auto', status: hasForm ? 'partial' : 'fail', detail: hasForm ? 'נמצא טופס — לוודא ידנית שהליד באמת נשמר.' : 'לא נמצא טופס — איך נקלטים לידים?' },
  ];

  const scored = items.filter((i) => i.mode === 'auto');
  const val = (s: LaunchItem['status']) => (s === 'pass' ? 1 : s === 'partial' ? 0.5 : 0);
  const score = scored.length ? Math.round((scored.reduce((a, i) => a + val(i.status), 0) / scored.length) * 100) : 0;
  return { url, score, items };
}
