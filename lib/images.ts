// AI hero image for articles — OpenAI Images API. Returns a URL, or null if the
// key isn't set. Never throws — image generation must not block content.
export async function generateImage(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024', response_format: 'url' }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { url?: string }[] };
    return json.data?.[0]?.url ?? null;
  } catch {
    return null;
  }
}
