// Entity Audit — "how well does the AI know you as an entity?"
// Assembles a 0-100 Entity Score from structured-knowledge sources (Wikidata,
// Wikipedia) + the site's own entity linking (schema.org sameAs). Pure fetch,
// no LLM/keys — mirrors lib/seo/aeo-audit.ts. Knowledge-panel + LLM-recognition
// checks are a later stage (need SERP scrape / engine keys).
import { findEntity } from './wikidata';
import { findArticle } from './wikipedia';

export type EntityCheck = {
  id: string;
  label: string;
  category: 'identity' | 'sources' | 'linking';
  pass: boolean;
  value: string;
  detail: string;
};

export type EntityReport = {
  name: string;
  score: number; // 0..100
  qid?: string;
  wikipediaUrl?: string;
  notabilityReady: boolean; // enough structured presence to justify a Wikipedia entry
  checks: EntityCheck[];
};

const CAT_LABEL: Record<EntityCheck['category'], string> = {
  identity: 'זהות',
  sources: 'מקורות סמכות',
  linking: 'קישור ישות',
};
export { CAT_LABEL };

// Pull sameAs URLs from a site's JSON-LD (Organization/Person). Best-effort.
async function sameAsLinks(domain: string): Promise<string[]> {
  const url = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'HELIX-Rank-Entity/1.0' }, cache: 'no-store' });
    if (!res.ok) return [];
    const html = await res.text();
    const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
    const found = new Set<string>();
    for (const block of blocks) {
      const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
      try {
        const data = JSON.parse(json);
        for (const node of Array.isArray(data) ? data : data['@graph'] ?? [data]) {
          const sa = node?.sameAs;
          if (typeof sa === 'string') found.add(sa);
          else if (Array.isArray(sa)) sa.forEach((u) => typeof u === 'string' && found.add(u));
        }
      } catch {
        /* skip invalid JSON-LD */
      }
    }
    return [...found];
  } catch {
    return [];
  }
}

export async function auditEntity(input: { name: string; domain?: string }): Promise<EntityReport> {
  const name = input.name.trim();
  if (!name) throw new Error('name_required');

  const [entity, article, sameAs] = await Promise.all([
    findEntity(name),
    findArticle(name),
    input.domain ? sameAsLinks(input.domain) : Promise.resolve([]),
  ]);

  const checks: EntityCheck[] = [];

  // ── Identity (Wikidata) ─────────────────────────────────
  checks.push({
    id: 'wikidata_item',
    label: 'פריט Wikidata',
    category: 'identity',
    pass: !!entity,
    value: entity ? entity.qid : 'חסר',
    detail: entity
      ? `נמצא פריט מזוהה (${entity.qid})${entity.description ? ` — "${entity.description}"` : ''}.`
      : 'אין פריט Wikidata — מנועי AI מתקשים לזהות אותך כישות מובחנת. ניתן ליצור פריט (בטוח, דרך ה-API הרשמי).',
  });
  checks.push({
    id: 'wikidata_richness',
    label: 'עומק הפריט (תכונות + קישורים)',
    category: 'identity',
    pass: !!entity && entity.claims >= 5,
    value: entity ? `${entity.claims} תכונות · ${entity.sitelinks} קישורים` : '—',
    detail: entity
      ? entity.claims >= 5
        ? 'הפריט מלא מספיק כדי לזהות את הישות.'
        : 'הפריט דליל — הוסף תכונות (סוג, אתר רשמי, תעשייה, מייסד) כדי לחזק את הזיהוי.'
      : 'אין פריט לבדוק את עומקו.',
  });

  // ── Sources (Wikipedia) ─────────────────────────────────
  checks.push({
    id: 'wikipedia',
    label: 'ערך ויקיפדיה',
    category: 'sources',
    pass: !!article,
    value: article ? `${article.lang} · ${article.extractLen} תווים` : 'חסר',
    detail: article
      ? `נמצא ערך ויקיפדיה (${article.url}) — מקור סמכות שמודלים לומדים ומצטטים.`
      : 'אין ערך ויקיפדיה — אחד המקורות החזקים ביותר שמנועי AI מצטטים. דורש בולטות (סיקור עצמאי) והגשה דרך AfC עם גילוי ניגוד-עניינים.',
  });

  // ── Linking (schema.org sameAs) ─────────────────────────
  if (input.domain) {
    const linksToWikidata = sameAs.some((u) => /wikidata\.org|wikipedia\.org/i.test(u));
    checks.push({
      id: 'same_as',
      label: 'קישור ישות באתר (schema sameAs)',
      category: 'linking',
      pass: sameAs.length > 0,
      value: sameAs.length ? `${sameAs.length} קישורים` : 'חסר',
      detail: sameAs.length
        ? linksToWikidata
          ? 'האתר מקשר את עצמו לפרופילים רשמיים כולל Wikidata/Wikipedia — חיזוק ישות מצוין.'
          : 'האתר מקשר לפרופילים רשמיים; הוסף גם קישור ל-Wikidata/Wikipedia לחיזוק הזיהוי.'
        : 'אין sameAs ב-JSON-LD — הוסף Organization.sameAs שמקשר ללינקדאין/רשתות/Wikidata כדי לאחד את זהותך למנועי AI.',
    });
  }

  const passed = checks.filter((c) => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);

  // Notability-ready = both a Wikidata item AND a rich-enough presence, but NO
  // Wikipedia article yet → this is the case worth pushing toward AfC.
  const notabilityReady = !!entity && entity.claims >= 5 && !article;

  return {
    name,
    score,
    qid: entity?.qid,
    wikipediaUrl: article?.url,
    notabilityReady,
    checks,
  };
}
