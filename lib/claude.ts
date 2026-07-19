// Claude caller — plain fetch, no SDK. Server-only (reads ANTHROPIC_API_KEY).
const MODEL = process.env.CONTENT_MODEL || 'claude-sonnet-5';

export async function claude(system: string, user: string, maxTokens = 1200): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('missing_api_key');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`claude_${res.status}`);
  const json = (await res.json()) as { content?: { text?: string }[] };
  return (json.content?.[0]?.text ?? '').trim();
}

// Parse the first JSON object/array out of a model response (handles ```json fences).
export function parseJson<T>(text: string): T | null {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) return null;
  try {
    return JSON.parse(cleaned.slice(start)) as T;
  } catch {
    return null;
  }
}
