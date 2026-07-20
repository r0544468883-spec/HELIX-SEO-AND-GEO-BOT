// AI answer-engine query layer for GEO. Each adapter runs a query through a
// search-capable engine and returns the answer + the URLs it cited — exactly
// what GEO needs. GEO genuinely needs live search, so with no key we don't guess.

export type EngineAnswer = { engine: string; answer: string; citations: string[] };

// --- Perplexity (returns citations natively) ---
export async function askPerplexity(query: string): Promise<EngineAnswer> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error('perplexity_not_configured');
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: query }] }),
  });
  if (!res.ok) throw new Error(`perplexity_${res.status}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; citations?: string[] };
  return { engine: 'perplexity', answer: j.choices?.[0]?.message?.content ?? '', citations: j.citations ?? [] };
}

// --- OpenAI / ChatGPT (web search model → url_citation annotations) ---
export async function askOpenAI(query: string): Promise<EngineAnswer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('openai_not_configured');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-search-preview', messages: [{ role: 'user', content: query }] }),
  });
  if (!res.ok) throw new Error(`openai_${res.status}`);
  const j = (await res.json()) as {
    choices?: { message?: { content?: string; annotations?: { type?: string; url_citation?: { url?: string } }[] } }[];
  };
  const msg = j.choices?.[0]?.message;
  const citations = (msg?.annotations ?? [])
    .filter((a) => a.type === 'url_citation' && a.url_citation?.url)
    .map((a) => a.url_citation!.url!);
  return { engine: 'chatgpt', answer: msg?.content ?? '', citations };
}

// --- Google Gemini (google_search grounding → groundingChunks) ---
export async function askGemini(query: string): Promise<EngineAnswer> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('gemini_not_configured');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: query }] }], tools: [{ google_search: {} }] }),
    }
  );
  if (!res.ok) throw new Error(`gemini_${res.status}`);
  const j = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[] };
    }[];
  };
  const c = j.candidates?.[0];
  const answer = (c?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const citations = (c?.groundingMetadata?.groundingChunks ?? [])
    .map((g) => g.web?.uri)
    .filter((u): u is string => !!u);
  return { engine: 'gemini', answer, citations };
}

// --- Anthropic / Claude (web_search tool → citation URLs in text blocks) ---
type ClaudeBlock = { type?: string; text?: string; citations?: { url?: string }[] };
export async function askClaude(query: string): Promise<EngineAnswer> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('claude_not_configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.CONTENT_MODEL || 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: query }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    }),
  });
  if (!res.ok) throw new Error(`claude_${res.status}`);
  const j = (await res.json()) as { content?: ClaudeBlock[] };
  const blocks = j.content ?? [];
  const answer = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  const citations: string[] = [];
  for (const b of blocks) for (const c of b.citations ?? []) if (c.url) citations.push(c.url);
  return { engine: 'claude', answer, citations };
}

const ADAPTERS: Record<string, (q: string) => Promise<EngineAnswer>> = {
  perplexity: askPerplexity,
  chatgpt: askOpenAI,
  gemini: askGemini,
  claude: askClaude,
};

export async function askEngine(engine: string, query: string): Promise<EngineAnswer> {
  const fn = ADAPTERS[engine];
  if (fn) return fn(query);
  // Engines without a first-party API (Google AI Mode / Copilot / Grok) route
  // through BrightData. Lazy import so the direct-API path stays dependency-free.
  const { BRIGHTDATA_ENGINES, askBrightData } = await import('./brightdata');
  if ((BRIGHTDATA_ENGINES as string[]).includes(engine)) return askBrightData(engine, query);
  throw new Error(`engine_not_supported_${engine}`);
}

// Direct-API engines (always available). BrightData engines are opt-in and only
// active when BRIGHT_DATA_KEY is set — see lib/geo/brightdata.ts.
export const SUPPORTED_ENGINES = ['perplexity', 'chatgpt', 'gemini', 'claude'] as const;
export const EXTENDED_ENGINES = ['ai_mode', 'copilot', 'grok'] as const;
