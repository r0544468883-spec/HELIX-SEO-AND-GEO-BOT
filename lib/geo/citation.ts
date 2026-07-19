// GEO citation analysis — "does the AI cite us, and where are we missing?"
// Runs a prompt panel through answer engines, checks whether our domain/brand
// is cited, computes a Citation Score + Share-of-Voice, and surfaces gaps.
import { askEngine, SUPPORTED_ENGINES } from './engines';

export type QueryResult = {
  query: string;
  engine: string;
  cited: boolean;
  competitorsCited: string[];
  citations: string[];
};

export type EnginePresence = { engine: string; cited: number; total: number };
export type CitationReport = {
  score: number; // 0..100 — % of (query×engine) checks where we're cited
  shareOfVoice: number; // our citations / (our + competitors') across the panel
  perEngine: EnginePresence[]; // presence per AI engine
  results: QueryResult[];
  gaps: QueryResult[]; // not cited (prioritise where a competitor is cited)
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function domainMatch(target: string, urlOrText: string): boolean {
  const t = target.replace(/^www\./, '').toLowerCase();
  return urlOrText.toLowerCase().includes(t);
}

// Run the panel. `engines` defaults to the supported set.
export async function analyzeCitations(input: {
  domain: string;
  brand?: string;
  queries: string[];
  competitors?: string[];
  engines?: string[];
}): Promise<CitationReport> {
  const engines = input.engines?.length ? input.engines : [...SUPPORTED_ENGINES];
  const competitors = (input.competitors ?? []).map((c) => c.trim()).filter(Boolean);
  const results: QueryResult[] = [];

  for (const query of input.queries) {
    for (const engine of engines) {
      let ans;
      try {
        ans = await askEngine(engine, query);
      } catch {
        continue; // engine not configured / failed — skip
      }
      const citedHosts = ans.citations.map(hostOf);
      const cited =
        citedHosts.some((h) => domainMatch(input.domain, h)) ||
        (input.brand ? domainMatch(input.brand, ans.answer) : false);
      const competitorsCited = competitors.filter(
        (c) => citedHosts.some((h) => domainMatch(c, h)) || domainMatch(c, ans.answer)
      );
      results.push({ query, engine, cited, competitorsCited, citations: ans.citations });
    }
  }

  const total = results.length || 1;
  const ourCited = results.filter((r) => r.cited).length;
  const score = Math.round((ourCited / total) * 100);

  const compCitations = results.reduce((s, r) => s + r.competitorsCited.length, 0);
  const shareOfVoice = ourCited + compCitations > 0 ? ourCited / (ourCited + compCitations) : 0;

  const gaps = results
    .filter((r) => !r.cited)
    .sort((a, b) => b.competitorsCited.length - a.competitorsCited.length);

  // Presence per engine.
  const engMap = new Map<string, { cited: number; total: number }>();
  for (const r of results) {
    const e = engMap.get(r.engine) ?? { cited: 0, total: 0 };
    e.total += 1;
    if (r.cited) e.cited += 1;
    engMap.set(r.engine, e);
  }
  const perEngine = Array.from(engMap.entries()).map(([engine, v]) => ({ engine, ...v }));

  return { score, shareOfVoice: Math.round(shareOfVoice * 100) / 100, perEngine, results, gaps };
}
