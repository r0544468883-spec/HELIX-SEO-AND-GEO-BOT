// Wikidata read layer for the Entity Audit. Pure public API, no key.
// Answers: does a structured entity exist for this name, and how complete is it?
// Write (wbeditentity) lives in a later stage — this module is read-only.

export type WikidataEntity = {
  qid: string;
  label: string;
  description: string;
  sitelinks: number; // # of Wikipedia/other-project links → maturity signal
  claims: number; // # of statements (P-props) → how filled-in the item is
  hasOfficialSite: boolean; // P856 official website present?
};

const API = 'https://www.wikidata.org/w/api.php';

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Top entity match for a name (he first, en fallback). Returns null if none.
export async function findEntity(name: string): Promise<WikidataEntity | null> {
  const clean = name.trim();
  if (!clean) return null;

  let qid = '';
  for (const lang of ['he', 'en']) {
    const search = await getJson(
      `${API}?action=wbsearchentities&format=json&language=${lang}&uselang=${lang}&limit=1&origin=*&search=${encodeURIComponent(clean)}`
    );
    const hit = search?.search?.[0]?.id as string | undefined;
    if (hit) {
      qid = hit;
      break;
    }
  }
  if (!qid) return null;

  const detail = await getJson(
    `${API}?action=wbgetentities&format=json&ids=${qid}&props=labels|descriptions|sitelinks|claims&languages=he|en&origin=*`
  );
  const ent = detail?.entities?.[qid];
  if (!ent) return { qid, label: clean, description: '', sitelinks: 0, claims: 0, hasOfficialSite: false };

  const label = ent.labels?.he?.value || ent.labels?.en?.value || clean;
  const description = ent.descriptions?.he?.value || ent.descriptions?.en?.value || '';
  const sitelinks = ent.sitelinks ? Object.keys(ent.sitelinks).length : 0;
  const claimKeys = ent.claims ? Object.keys(ent.claims) : [];
  const claims = claimKeys.length;
  const hasOfficialSite = claimKeys.includes('P856'); // official website

  return { qid, label, description, sitelinks, claims, hasOfficialSite };
}
