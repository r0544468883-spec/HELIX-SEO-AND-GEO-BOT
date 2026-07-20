// BrightData engine adapters for GEO — covers the answer engines that have NO
// usable public API (Google AI Mode, Copilot, Grok) by scraping the live answer
// via BrightData datasets. Complements lib/geo/engines.ts (Perplexity/ChatGPT/
// Gemini/Claude direct-API). Same EngineAnswer shape, so callers stay uniform.
// Harvested & adapted (MIT) from danishashko/geo-aeo-tracker.
import type { EngineAnswer } from './engines';

type PlatformConfig = {
  id: string;
  label: string;
  datasetEnvVar: string;
  targetUrl: string;
  defaultDatasetId: string;
};

// Engines here are the ones WITHOUT a first-party API — that's the whole point
// of routing them through BrightData rather than engines.ts.
export const BRIGHTDATA_PLATFORMS: PlatformConfig[] = [
  { id: 'ai_mode', label: 'Google AI Mode', datasetEnvVar: 'BRIGHT_DATA_DATASET_GOOGLE_AI', targetUrl: 'https://www.google.com/search?udm=50', defaultDatasetId: 'gd_mcswdt6z2elth3zqr2' },
  { id: 'copilot', label: 'Copilot', datasetEnvVar: 'BRIGHT_DATA_DATASET_COPILOT', targetUrl: 'https://copilot.microsoft.com', defaultDatasetId: 'gd_m7di5jy6s9geokz8w' },
  { id: 'grok', label: 'Grok', datasetEnvVar: 'BRIGHT_DATA_DATASET_GROK', targetUrl: 'https://grok.com', defaultDatasetId: 'gd_m8ve0u141icu75ae74' },
];

const TRIGGER_URL = 'https://api.brightdata.com/datasets/v3/trigger';
const SNAPSHOT_URL = 'https://api.brightdata.com/datasets/v3/snapshot';
const POLL_INTERVAL = 6_000;
const MAX_POLLS = 50;

type SnapshotRecord = {
  answer_text?: string;
  answer_text_markdown?: string;
  citations?: { url?: string }[];
  sources?: { url?: string }[];
};

function datasetId(p: PlatformConfig): string {
  return process.env[p.datasetEnvVar] || p.defaultDatasetId;
}

async function triggerSnapshot(p: PlatformConfig, query: string, key: string): Promise<string> {
  const res = await fetch(`${TRIGGER_URL}?dataset_id=${datasetId(p)}&include_errors=true`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify([{ url: p.targetUrl, prompt: query, country: 'US' }]),
  });
  if (!res.ok) throw new Error(`brightdata_trigger_${res.status}`);
  const data = (await res.json()) as { snapshot_id?: string; id?: string };
  const id = data.snapshot_id || data.id;
  if (!id) throw new Error('brightdata_no_snapshot_id');
  return id;
}

// BrightData is async: trigger returns a snapshot id, then we poll until the
// scrape finishes (202 = still running). Bounded by MAX_POLLS so it can't hang.
async function pollSnapshot(id: string, key: string): Promise<SnapshotRecord[]> {
  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const res = await fetch(`${SNAPSHOT_URL}/${id}?format=json`, { headers: { authorization: `Bearer ${key}` } });
    if (res.status === 200) {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) return data;
        if (data?.data && Array.isArray(data.data)) return data.data;
      } catch {
        // NDJSON fallback — one malformed row must not crash the whole poll.
        const rows = text.split('\n').map((l) => l.trim()).filter(Boolean).reduce<SnapshotRecord[]>((acc, l) => {
          try { acc.push(JSON.parse(l)); } catch { /* skip */ }
          return acc;
        }, []);
        if (rows.length) return rows;
      }
    } else if (res.status !== 202 && attempt > 5) {
      throw new Error(`brightdata_poll_${res.status}`);
    }
  }
  throw new Error('brightdata_timeout');
}

// Query one BrightData engine; returns the same EngineAnswer shape as engines.ts.
export async function askBrightData(platformId: string, query: string): Promise<EngineAnswer> {
  const key = process.env.BRIGHT_DATA_KEY;
  if (!key) throw new Error('brightdata_not_configured');
  const p = BRIGHTDATA_PLATFORMS.find((x) => x.id === platformId);
  if (!p) throw new Error(`brightdata_engine_not_supported_${platformId}`);

  const id = await triggerSnapshot(p, query, key);
  const records = await pollSnapshot(id, key);
  const record = records[0] ?? {};
  const answer = record.answer_text_markdown || record.answer_text || '';
  const citations = [...(record.citations ?? []), ...(record.sources ?? [])]
    .map((c) => c.url)
    .filter((u): u is string => !!u);
  return { engine: platformId, answer, citations };
}

export const BRIGHTDATA_ENGINES = BRIGHTDATA_PLATFORMS.map((p) => p.id);
