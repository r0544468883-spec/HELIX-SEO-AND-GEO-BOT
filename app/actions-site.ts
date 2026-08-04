'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createSite, upsertConnection } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

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

// Link a WhatsApp number to a site so the bot answers with THAT site's real data.
// Normalizes the number to bare digits (matching the inbound webhook's `from`) and
// stores it in channel_bindings — the same table the digest uses to send outbound.
// No unique (site_id, channel) constraint exists, so we replace the site's row.
export async function linkWhatsAppAction(siteId: string, phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^00/, '');
  if (!siteId) return { error: 'no_site' };
  if (digits.length < 8) return { error: 'bad_phone' };
  const supabase = await createClient();
  await supabase.from('channel_bindings').delete().eq('site_id', siteId).eq('channel', 'whatsapp');
  const { error } = await supabase
    .from('channel_bindings')
    .insert({ site_id: siteId, channel: 'whatsapp', identifier: digits, verified: true, inbound_enabled: true });
  if (error) return { error: error.message };
  revalidatePath('/sites');
  return { ok: true, identifier: digits };
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
