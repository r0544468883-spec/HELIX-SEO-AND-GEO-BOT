// Wikipedia read layer for the Entity Audit. A Wikipedia article is one of the
// strongest entity sources LLMs are trained on and cite. Pure public API, no key.

export type WikipediaArticle = { lang: string; title: string; url: string; extractLen: number };

// Search he first, then en. Returns the first article found, or null.
export async function findArticle(name: string): Promise<WikipediaArticle | null> {
  const clean = name.trim();
  if (!clean) return null;

  for (const lang of ['he', 'en']) {
    try {
      const searchUrl =
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json` +
        `&srlimit=1&srprop=&origin=*&srsearch=${encodeURIComponent(clean)}`;
      const sRes = await fetch(searchUrl, { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!sRes.ok) continue;
      const sJson = (await sRes.json()) as { query?: { search?: { title?: string }[] } };
      const title = sJson.query?.search?.[0]?.title;
      if (!title) continue;

      // Confirm + measure via the page summary endpoint.
      const sumUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const pRes = await fetch(sumUrl, { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!pRes.ok) continue;
      const pJson = (await pRes.json()) as {
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
      };
      const url =
        pJson.content_urls?.desktop?.page ||
        `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
      return { lang, title: pJson.title || title, url, extractLen: (pJson.extract || '').length };
    } catch {
      /* try next language */
    }
  }
  return null;
}
