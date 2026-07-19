'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createSite, upsertConnection } from '@/lib/db';

export async function createSiteAction(url: string, lang: 'he' | 'en' | 'both') {
  if (!url.trim()) return { error: 'no_url' };
  const res = await createSite(url.trim(), lang);
  if (res.error) return { error: res.error };
  revalidatePath('/sites');
  return { ok: true, id: res.id };
}

// Persist WordPress credentials for a site.
export async function saveWpConnectionAction(siteId: string, wp: { base_url: string; username: string; app_password: string }) {
  if (!wp.base_url || !wp.username || !wp.app_password) return { error: 'incomplete' };
  const res = await upsertConnection(siteId, 'wordpress', wp);
  if (res.error) return { error: res.error };
  revalidatePath('/sites');
  return { ok: true };
}

// Persist the connected GSC token (from the OAuth cookie) to the site.
export async function saveGscConnectionAction(siteId: string) {
  const jar = await cookies();
  const access = jar.get('gsc_token')?.value;
  const refresh = jar.get('gsc_refresh')?.value;
  if (!access) return { error: 'gsc_not_connected' };
  const res = await upsertConnection(siteId, 'gsc', { access_token: access, refresh_token: refresh ?? null });
  if (res.error) return { error: res.error };
  revalidatePath('/sites');
  return { ok: true };
}
