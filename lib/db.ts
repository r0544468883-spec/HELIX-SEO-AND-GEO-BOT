// Persistence helpers — the data layer over Supabase (RLS: owner-scoped sites).
// All functions use the SSR server client (reads the user session from cookies).
import { createClient } from './supabase/server';

export async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export type Site = { id: string; url: string; cms_type: string | null; content_lang: string };

export async function listSites(): Promise<Site[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('sites').select('id, url, cms_type, content_lang').order('created_at');
  return (data ?? []) as Site[];
}

export async function createSite(url: string, lang: 'he' | 'en' | 'both' = 'he'): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const { data, error } = await supabase
    .from('sites')
    .insert({ owner_id: user.id, url, content_lang: lang })
    .select('id')
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

// Upsert a per-site connection (gsc / wordpress / semrush …).
export async function upsertConnection(
  siteId: string,
  provider: string,
  credentials: Record<string, unknown>
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('site_connections')
    .upsert({ site_id: siteId, provider, credentials, status: 'connected' }, { onConflict: 'site_id,provider' });
  if (error) return { error: error.message };
  return {};
}

export async function getConnection(siteId: string, provider: string): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('site_connections')
    .select('credentials')
    .eq('site_id', siteId)
    .eq('provider', provider)
    .maybeSingle();
  return (data?.credentials as Record<string, unknown>) ?? null;
}

// Save a generated article as a content piece (draft by default).
export async function saveContentPiece(
  siteId: string,
  article: { title: string; body: string; schema_json: unknown; lang: string },
  status: 'draft' | 'approved' | 'published' = 'draft'
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_pieces')
    .insert({ site_id: siteId, title: article.title, body: article.body, schema_json: article.schema_json, lang: article.lang, status })
    .select('id')
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

export async function markPublished(contentId: string, url: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('content_pieces')
    .update({ status: 'published', published_url: url, published_at: new Date().toISOString() })
    .eq('id', contentId);
}

export type ContentRow = { id: string; title: string | null; status: string; published_url: string | null };
export async function listContent(siteId: string): Promise<ContentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('content_pieces')
    .select('id, title, status, published_url')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as ContentRow[];
}
