import type { PublishInput, PublishResult } from './wordpress';

// Wix — via the Data Collections API. config: { api_token, site_id, collection_id }.
// Inserts an item into a content collection (title + content fields).
export type WixConfig = { api_token: string; site_id: string; collection_id: string };

export async function publishToWix(config: WixConfig, input: PublishInput): Promise<PublishResult> {
  if (!config.api_token || !config.site_id || !config.collection_id) {
    return { ok: false, error: 'wix_not_configured' };
  }
  try {
    const res = await fetch('https://www.wixapis.com/wix-data/v2/items', {
      method: 'POST',
      headers: {
        authorization: config.api_token,
        'wix-site-id': config.site_id,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        dataCollectionId: config.collection_id,
        dataItem: { data: { title: input.title, content: input.content_html, excerpt: input.excerpt ?? '' } },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { dataItem?: { id?: string }; message?: string };
    if (!res.ok) return { ok: false, error: json.message ?? `wix_${res.status}` };
    return { ok: true, url: json.dataItem?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
