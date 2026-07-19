// WordPress publishing adapter — WordPress REST API + Application Password.
// config: { base_url, username, app_password }. Creates a post; returns its URL.
export type WpConfig = { base_url: string; username: string; app_password: string };
export type PublishResult = { ok: boolean; url?: string; id?: number; error?: string };

export type PublishInput = {
  title: string;
  content_html: string;
  status?: 'draft' | 'publish';
  excerpt?: string;
};

export async function publishToWordPress(config: WpConfig, input: PublishInput): Promise<PublishResult> {
  const base = config.base_url?.replace(/\/+$/, '');
  if (!base || !config.username || !config.app_password) {
    return { ok: false, error: 'wordpress_not_configured' };
  }
  const auth = Buffer.from(`${config.username}:${config.app_password}`).toString('base64');
  try {
    const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        content: input.content_html,
        excerpt: input.excerpt ?? '',
        status: input.status ?? 'draft',
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: number; link?: string; message?: string };
    if (!res.ok) return { ok: false, error: json.message ?? `wordpress_${res.status}` };
    return { ok: true, id: json.id, url: json.link };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
