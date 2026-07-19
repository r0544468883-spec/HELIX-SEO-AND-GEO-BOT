import type { PublishInput, PublishResult } from './wordpress';

// Generic webhook — for headless / custom / open-source sites. POSTs the article
// to a URL the customer controls; their site pulls it. config: { url, secret? }.
export type WebhookConfig = { url: string; secret?: string };

export async function publishToWebhook(config: WebhookConfig, input: PublishInput): Promise<PublishResult> {
  if (!config.url) return { ok: false, error: 'webhook_not_configured' };
  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.secret ? { 'x-helix-secret': config.secret } : {}) },
      body: JSON.stringify({
        title: input.title,
        content_html: input.content_html,
        excerpt: input.excerpt ?? '',
        status: input.status ?? 'draft',
      }),
    });
    if (!res.ok) return { ok: false, error: `webhook_${res.status}` };
    const json = (await res.json().catch(() => ({}))) as { url?: string };
    return { ok: true, url: json.url };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
