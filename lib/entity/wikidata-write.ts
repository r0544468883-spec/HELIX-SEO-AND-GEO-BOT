// Wikidata WRITE layer — the push half the read module (wikidata.ts) deliberately left out.
// Two levels, matching Wikidata's own norms:
//   1. buildWikidataDraft() — always works, no credentials. Produces the structured
//      entity payload (labels he/en, description, statements, official site) + a
//      prefilled "new item" URL for human submission. This is the safe default.
//   2. pushToWikidata() — credential-gated live write (wbeditentity). Requires a
//      Wikimedia OAuth 2.0 token in WIKIDATA_OAUTH_TOKEN. Creates the item (or adds
//      the official-site claim to an existing QID). Kept conservative on purpose:
//      auto-mass-creating items violates Wikidata policy and gets blocked.

const API = 'https://www.wikidata.org/w/api.php';

export type EntityDraftInput = {
  name: string;
  nameEn?: string;
  description: string; // short he description (<250 chars)
  descriptionEn?: string;
  officialSite?: string; // P856
  instanceOf?: 'business' | 'organization' | 'person' | 'brand'; // → P31 QID
  sameAs?: string[]; // LinkedIn/Crunchbase/etc — as described-at-URL P973 refs
};

// P31 (instance of) target QIDs.
const P31_MAP: Record<NonNullable<EntityDraftInput['instanceOf']>, string> = {
  business: 'Q4830453', // business
  organization: 'Q43229', // organization
  person: 'Q5', // human
  brand: 'Q431289', // brand
};

export type WikidataDraft = {
  labels: Record<string, { language: string; value: string }>;
  descriptions: Record<string, { language: string; value: string }>;
  claims: Record<string, unknown[]>;
  prefillUrl: string; // opens Wikidata's new-item form pre-populated (manual submit)
};

function urlClaim(prop: string, url: string) {
  return [{ mainsnak: { snaktype: 'value', property: prop, datavalue: { type: 'string', value: url } }, type: 'statement', rank: 'normal' }];
}
function itemClaim(prop: string, qid: string) {
  return [{ mainsnak: { snaktype: 'value', property: prop, datavalue: { type: 'wikibase-entityid', value: { 'entity-type': 'item', id: qid } } }, type: 'statement', rank: 'normal' }];
}

// Build the structured entity payload (no credentials needed).
export function buildWikidataDraft(input: EntityDraftInput): WikidataDraft {
  const labels: WikidataDraft['labels'] = { he: { language: 'he', value: input.name.trim() } };
  if (input.nameEn?.trim()) labels.en = { language: 'en', value: input.nameEn.trim() };

  const descriptions: WikidataDraft['descriptions'] = { he: { language: 'he', value: input.description.trim().slice(0, 250) } };
  if (input.descriptionEn?.trim()) descriptions.en = { language: 'en', value: input.descriptionEn.trim().slice(0, 250) };

  const claims: WikidataDraft['claims'] = {};
  if (input.instanceOf) claims.P31 = itemClaim('P31', P31_MAP[input.instanceOf]);
  if (input.officialSite) claims.P856 = urlClaim('P856', input.officialSite);
  for (const s of input.sameAs ?? []) {
    if (!s.trim()) continue;
    claims.P973 = [...(claims.P973 ?? []), ...urlClaim('P973', s.trim())]; // described at URL
  }

  const prefillUrl =
    'https://www.wikidata.org/wiki/Special:NewItem?' +
    new URLSearchParams({ label: input.name.trim(), description: input.description.trim().slice(0, 250), lang: 'he' }).toString();

  return { labels, descriptions, claims, prefillUrl };
}

async function getJson(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Fetch a CSRF edit token using the OAuth bearer token.
async function getCsrfToken(token: string): Promise<string | null> {
  const j = await getJson(`${API}?action=query&meta=tokens&type=csrf&format=json`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return j?.query?.tokens?.csrftoken ?? null;
}

export type PushResult = { ok: boolean; qid?: string; error?: string; draft?: WikidataDraft };

// Live write. Creates a new item from the draft, or, if `qid` is given, merges the
// draft's claims into that existing item. Credential-gated + conservative.
export async function pushToWikidata(input: EntityDraftInput & { qid?: string }): Promise<PushResult> {
  const draft = buildWikidataDraft(input);
  const token = process.env.WIKIDATA_OAUTH_TOKEN;
  if (!token) return { ok: false, error: 'wikidata_write_not_configured', draft };

  const csrf = await getCsrfToken(token);
  if (!csrf) return { ok: false, error: 'wikidata_auth_failed', draft };

  const dataJson = JSON.stringify({ labels: draft.labels, descriptions: draft.descriptions, claims: draft.claims });
  const params = new URLSearchParams({
    action: 'wbeditentity',
    format: 'json',
    token: csrf,
    data: dataJson,
    summary: 'HELIX Rank — entity signals (official site, description, sameAs)',
  });
  if (input.qid) params.set('id', input.qid);
  else params.set('new', 'item');

  const res = await getJson(API, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });
  if (res?.success && res?.entity?.id) return { ok: true, qid: res.entity.id, draft };
  return { ok: false, error: res?.error?.info || 'wikidata_write_failed', draft };
}
