// Persistence helpers — the data layer over Supabase (RLS: owner-scoped sites).
// All functions use the SSR server client (reads the user session from cookies).
import { createClient } from './supabase/server';
import type { CitationReport } from './geo/citation';
import type { BrandProtectionReport } from './geo/brand-protection';
import type { ChannelDraft } from './geo/distribution';

function bareDomain(input: string): string {
  return (input || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();
}

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

// --- GEO citation persistence ---

// Resolve the owner's site whose URL matches a scanned domain (best-effort).
export async function findSiteByDomain(domain: string): Promise<string | null> {
  const supabase = await createClient();
  const clean = bareDomain(domain);
  if (!clean) return null;
  const { data } = await supabase.from('sites').select('id, url');
  for (const s of (data ?? []) as { id: string; url: string }[]) {
    const u = bareDomain(s.url);
    if (u && (u === clean || u.includes(clean) || clean.includes(u))) return s.id;
  }
  return null;
}

// Persist one GEO scan: a daily score snapshot (trend), the per-query×engine rows,
// and any open competitor-cited gaps. Upserts the day's snapshot so re-scans update
// rather than duplicate. Best-effort — RLS blocks if the caller doesn't own the site.
export async function saveCitationRun(siteId: string, report: CitationReport): Promise<{ error?: string }> {
  const supabase = await createClient();
  const perEngine: Record<string, number> = {};
  for (const e of report.perEngine) perEngine[e.engine] = e.total ? Math.round((e.cited / e.total) * 100) : 0;

  const { error: sErr } = await supabase
    .from('citation_scores')
    .upsert(
      { site_id: siteId, date: new Date().toISOString().slice(0, 10), score: report.score, share_of_voice_json: { shareOfVoice: report.shareOfVoice, perEngine } },
      { onConflict: 'site_id,date' }
    );
  if (sErr) return { error: sErr.message };

  if (report.results.length) {
    await supabase
      .from('ai_citations')
      .insert(report.results.map((r) => ({ site_id: siteId, engine: r.engine, query: r.query, cited: r.cited })));
  }

  const gapRows = report.gaps
    .filter((g) => g.competitorsCited.length)
    .map((g) => ({ site_id: siteId, query: g.query, engine: g.engine, competitor_cited: g.competitorsCited.join(', ') }));
  if (gapRows.length) await supabase.from('citation_gaps').insert(gapRows);

  return {};
}

export type CitationTrendPoint = { date: string; score: number; shareOfVoice: number };
export async function getCitationHistory(siteId: string, limit = 30): Promise<CitationTrendPoint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('citation_scores')
    .select('date, score, share_of_voice_json')
    .eq('site_id', siteId)
    .order('date', { ascending: true })
    .limit(limit);
  return ((data ?? []) as { date: string; score: number | null; share_of_voice_json: { shareOfVoice?: number } | null }[]).map((r) => ({
    date: r.date,
    score: r.score ?? 0,
    shareOfVoice: r.share_of_voice_json?.shareOfVoice ?? 0,
  }));
}

// --- Brand Protection persistence ---
export async function saveBrandProtectionRun(siteId: string, report: BrandProtectionReport): Promise<{ error?: string }> {
  const supabase = await createClient();
  // Per-engine sentiment snapshot.
  if (report.perEngine.length) {
    await supabase.from('ai_sentiment').insert(
      report.perEngine.map((e) => ({ site_id: siteId, engine: e.engine, sentiment: e.sentiment, sentiment_score: e.sentimentScore, wrong_facts: e.wrongFacts }))
    );
  }
  // Open alerts (negative framing / wrong facts / absence).
  if (report.alerts.length) {
    const { error } = await supabase.from('brand_alerts').insert(
      report.alerts.map((a) => ({ site_id: siteId, severity: a.severity, alert_type: a.type, engine: a.engine, query: a.query, detail: a.detail, correction: a.correction ?? null }))
    );
    if (error) return { error: error.message };
  }
  return {};
}

// --- Multi-channel distribution persistence ---
export async function saveDistribution(siteId: string, topic: string, drafts: ChannelDraft[]): Promise<{ error?: string }> {
  if (!drafts.length) return {};
  const supabase = await createClient();
  const { error } = await supabase.from('syndication_targets').insert(
    drafts.map((d) => ({ site_id: siteId, channel: d.channel, topic, title: d.title, body: d.body, notes: d.notes }))
  );
  return error ? { error: error.message } : {};
}

// --- Voice profile persistence (per site) ---
// The user's own writing voice, learned from samples they paste. Owner-scoped via RLS.
import type { VoiceProfile } from './voice';

export async function getVoiceProfile(siteId: string): Promise<VoiceProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('voice_profiles')
    .select('key_tells, signature_passages, summary, words, tier, lang')
    .eq('site_id', siteId)
    .maybeSingle();
  if (!data) return null;
  return {
    keyTells: (data.key_tells as string[]) ?? [],
    signaturePassages: (data.signature_passages as string[]) ?? [],
    summary: (data.summary as string) ?? '',
    words: Number(data.words) || 0,
    tier: (data.tier as VoiceProfile['tier']) ?? 'basic',
    lang: (data.lang as 'he' | 'en') ?? 'he',
  };
}

export async function saveVoiceProfile(siteId: string, voice: VoiceProfile): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('voice_profiles').upsert(
    {
      site_id: siteId,
      key_tells: voice.keyTells,
      signature_passages: voice.signaturePassages,
      summary: voice.summary,
      words: voice.words,
      tier: voice.tier,
      lang: voice.lang,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'site_id' }
  );
  if (error) return { error: error.message };
  return {};
}

export async function deleteVoiceProfile(siteId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('voice_profiles').delete().eq('site_id', siteId);
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
