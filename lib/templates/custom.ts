// Custom (user-uploaded) templates — a SITE defines its OWN WhatsApp templates,
// merged over the built-in catalog (a custom key OVERRIDES a built-in one).
// Backed by the custom_templates table (scoped by site_id). SITE-SCOPED, not
// workspace_id — HELIX Rank's tenant unit is the site.
import { createAdminClient } from '@/lib/supabase/admin';
import { TEMPLATES, type TemplateDef } from './whatsapp-catalog';

export type CustomKind = 'whatsapp';

async function rows(siteId: string, kind: CustomKind): Promise<{ key: string; definition: unknown }[]> {
  const db = createAdminClient();
  if (!db) return [];
  const { data } = await db
    .from('custom_templates')
    .select('key, definition')
    .eq('site_id', siteId)
    .eq('kind', kind)
    .eq('active', true);
  return (data ?? []) as { key: string; definition: unknown }[];
}

/** Built-in WhatsApp templates ∪ the site's customs (customs override by key). */
export async function mergedWhatsAppTemplates(siteId: string): Promise<Record<string, TemplateDef>> {
  const merged: Record<string, TemplateDef> = { ...TEMPLATES };
  for (const r of await rows(siteId, 'whatsapp')) merged[r.key] = r.definition as TemplateDef;
  return merged;
}

export async function listCustom(siteId: string, kind?: CustomKind) {
  const db = createAdminClient();
  if (!db) return [];
  let q = db.from('custom_templates').select('kind, key, definition, active').eq('site_id', siteId);
  if (kind) q = q.eq('kind', kind);
  const { data } = await q;
  return data ?? [];
}

export async function upsertCustom(
  siteId: string,
  kind: CustomKind,
  key: string,
  definition: unknown
): Promise<{ ok: boolean; error?: string }> {
  const err = validate(kind, definition);
  if (err) return { ok: false, error: err };
  const db = createAdminClient();
  if (!db) return { ok: false, error: 'no_admin_client' };
  const { error } = await db.from('custom_templates').upsert(
    { site_id: siteId, kind, key, definition, active: true, updated_at: new Date().toISOString() },
    { onConflict: 'site_id,kind,key' }
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteCustom(siteId: string, kind: CustomKind, key: string): Promise<void> {
  const db = createAdminClient();
  if (!db) return;
  await db.from('custom_templates').delete().eq('site_id', siteId).eq('kind', kind).eq('key', key);
}

/** Minimal shape validation so a bad upload can't break the runner/senders. */
function validate(kind: CustomKind, def: unknown): string | null {
  if (!def || typeof def !== 'object') return 'definition must be an object';
  const d = def as Record<string, unknown>;
  if (kind === 'whatsapp') {
    if (typeof d.name !== 'string' || !/^[a-z0-9_]+$/.test(d.name)) return 'whatsapp: name required (a-z0-9_)';
    if (typeof d.language !== 'string') return 'whatsapp: language required';
    if (!['UTILITY', 'MARKETING'].includes(d.category as string)) return 'whatsapp: category must be UTILITY|MARKETING';
    if (typeof d.body !== 'string') return 'whatsapp: body required';
    if (!Array.isArray(d.params)) return 'whatsapp: params must be an array';
    if (!Array.isArray(d.sampleParams)) return 'whatsapp: sampleParams must be an array';
  }
  return null;
}
