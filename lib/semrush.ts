// Semrush connector — keyword volume / difficulty / CPC, and an opportunity
// score to prioritise the content queue (SPEC §12.1). CSV API; no SDK.
export type KeywordData = { phrase: string; volume: number; difficulty: number; cpc: number };

const INTENT_SCORE: Record<string, number> = { informational: 1, commercial: 3, transactional: 5, navigational: 2 };

export async function keywordOverview(phrase: string, database = 'us'): Promise<KeywordData | null> {
  const key = process.env.SEMRUSH_API_KEY;
  if (!key) throw new Error('semrush_not_configured');
  const url =
    `https://api.semrush.com/?type=phrase_this&key=${key}` +
    `&phrase=${encodeURIComponent(phrase)}&database=${database}&export_columns=Ph,Nq,Kd,Cp`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`semrush_${res.status}`);
  const csv = await res.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const cols = lines[1].split(';');
  return {
    phrase: cols[0] ?? phrase,
    volume: parseInt(cols[1] ?? '0', 10) || 0,
    difficulty: parseFloat(cols[2] ?? '0') || 0,
    cpc: parseFloat(cols[3] ?? '0') || 0,
  };
}

// (Volume × Intent × ClickRate) / Difficulty — higher = better opportunity.
export function opportunityScore(kw: KeywordData, intent = 'informational', clickRate = 0.3): number {
  const intentScore = INTENT_SCORE[intent] ?? 1;
  const diff = Math.max(kw.difficulty, 1);
  return Math.round((kw.volume * intentScore * clickRate) / diff);
}
