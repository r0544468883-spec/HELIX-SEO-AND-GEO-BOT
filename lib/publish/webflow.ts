import type { PublishInput, PublishResult } from './wordpress';

// Webflow CMS API v2 — config: { api_token, collection_id }.
// Creates a collection item (fields depend on the collection schema; we set the
// common name/slug/post-body and leave the rest to defaults).
export type WebflowConfig = { api_token: string; collection_id: string };

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post';
}

export async function publishToWebflow(config: WebflowConfig, input: PublishInput): Promise<PublishResult> {
  if (!config.api_token || !config.collection_id) return { ok: false, error: 'webflow_not_configured' };
  try {
    const res = await fetch(`https://api.webflow.com/v2/collections/${config.collection_id}/items`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.api_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        isArchived: false,
        isDraft: input.status !== 'publish',
        fieldData: { name: input.title, slug: slugify(input.title), 'post-body': input.content_html },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: json.message ?? `webflow_${res.status}` };
    return { ok: true, id: undefined, url: json.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
