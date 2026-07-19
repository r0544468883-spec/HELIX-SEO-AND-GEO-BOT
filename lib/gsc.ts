// Google Search Console client — pulls query×page performance rows.
// Ready to wire once GSC OAuth is connected (access token per site).
export type GscRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

// Query the Search Analytics API for the last `days` days, by query + page.
export async function fetchSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  days = 90
): Promise<GscRow[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const body = {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    dimensions: ['query', 'page'],
    rowLimit: 5000,
  };
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`gsc_${res.status}`);
  const json = (await res.json()) as {
    rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
  };
  return (json.rows ?? []).map((r) => ({
    query: r.keys[0] ?? '',
    page: r.keys[1] ?? '',
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

// Parse a pasted GSC export — either JSON array of rows, or CSV with a header.
export function parseGscInput(input: string): GscRow[] {
  const text = input.trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      return (JSON.parse(text) as GscRow[]).filter((r) => r && r.query);
    } catch {
      return [];
    }
  }
  // CSV: expect a header row containing query/page/clicks/impressions/ctr/position (any order).
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(/[,\t]/).map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const qi = idx(['query', 'שאיל', 'מילת']);
  const pi = idx(['page', 'url', 'עמוד', 'דף']);
  const ci = idx(['click', 'קליק']);
  const ii = idx(['impress', 'חשיפ']);
  const ti = idx(['ctr']);
  const posi = idx(['position', 'מיקום']);
  const num = (v: string) => parseFloat((v || '').replace('%', '').replace(',', '.')) || 0;
  const rows: GscRow[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split(/[,\t]/);
    if (qi < 0 || !c[qi]) continue;
    rows.push({
      query: c[qi].trim(),
      page: pi >= 0 ? (c[pi] ?? '').trim() : '',
      clicks: ci >= 0 ? num(c[ci]) : 0,
      impressions: ii >= 0 ? num(c[ii]) : 0,
      ctr: ti >= 0 ? num(c[ti]) : 0,
      position: posi >= 0 ? num(c[posi]) : 0,
    });
  }
  return rows;
}
