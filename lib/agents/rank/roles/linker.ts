// Internal-Linker archetype (one of the "6 SEO experts"). The Researcher already
// surfaces which existing pages are topically related (brief.internalLinks); this
// turns them into explicit writing instructions so the Maker WEAVES internal links
// to them naturally — internal linking is a real ranking lever the article was
// otherwise ignoring. Deterministic (uses the brief the Researcher produced).
import type { ResearchBrief, Lang } from '../contract';

export function linkingNotes(brief: ResearchBrief | null, lang: Lang): string {
  const links = brief?.internalLinks ?? [];
  if (!links.length) return '';
  const titles = links.slice(0, 4).map((p) => p.title).join('; ');
  return lang === 'he'
    ? `קשר פנימית (עוגן טבעי בגוף המאמר) לדפים הקיימים הרלוונטיים: ${titles}.`
    : `Add natural internal links (anchor text in the body) to these existing pages: ${titles}.`;
}
