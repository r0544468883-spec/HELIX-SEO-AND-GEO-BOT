// GA4 connector — measures REAL traffic that AI engines send to your pages
// (the ROI half of GEO, complementing citation tracking). Uses the GA4 Data API
// runReport with a session source/medium filter for the AI hosts, dimensioned by
// landing page. Reuses the connected Google OAuth token (same as GSC).

// The hostnames AI engines refer traffic from.
export const AI_SOURCES = ['chatgpt.com', 'perplexity.ai', 'gemini.google.com', 'claude.ai', 'copilot.microsoft.com'];

export type AiTrafficRow = { page: string; source: string; sessions: number; engaged: number };

export async function fetchAiTraffic(
  accessToken: string,
  propertyId: string,
  days = 90
): Promise<AiTrafficRow[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const body = {
    dateRanges: [{ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }],
    dimensions: [{ name: 'landingPagePlusQueryString' }, { name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionSource',
        inListFilter: { values: AI_SOURCES },
      },
    },
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 100,
  };

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`ga4_${res.status}`);
  const json = (await res.json()) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
  };
  return (json.rows ?? []).map((r) => ({
    page: r.dimensionValues[0]?.value ?? '',
    source: r.dimensionValues[1]?.value ?? '',
    sessions: parseInt(r.metricValues[0]?.value ?? '0', 10) || 0,
    engaged: parseInt(r.metricValues[1]?.value ?? '0', 10) || 0,
  }));
}

// Aggregate to a per-page summary across AI sources.
export type AiPageSummary = { page: string; sessions: number; engaged: number; sources: string[] };
export function summarizeByPage(rows: AiTrafficRow[]): AiPageSummary[] {
  const map = new Map<string, AiPageSummary>();
  for (const r of rows) {
    const s = map.get(r.page) ?? { page: r.page, sessions: 0, engaged: 0, sources: [] };
    s.sessions += r.sessions;
    s.engaged += r.engaged;
    if (!s.sources.includes(r.source)) s.sources.push(r.source);
    map.set(r.page, s);
  }
  return Array.from(map.values()).sort((a, b) => b.sessions - a.sessions);
}
