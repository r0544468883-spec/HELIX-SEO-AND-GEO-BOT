// Department Chief for Rank's content node (charter §4b). Orchestrates the team
// for ONE content-gap article: Researcher → Maker (generateArticle) → Critic.
// Rank's daily loop (lib/act/loop.ts) stays the deterministic System Chief and
// calls this only at the "new page" node — the math/diff never becomes an agent.
import { generateArticle, type Article } from '../../content-engine';
import { research } from './roles/researcher';
import { critique } from './roles/critic';
import { revisionNotes } from './roles/editor';
import type { ExistingPage, ResearchBrief, CriticReview, Lang } from './contract';

// Mechanical floor: even a Critic "pass" won't publish structurally broken
// content (missing schema, far too short, keyword absent). The Critic judges
// substance; this guards the basics. Was the whole gate before — now a floor.
export const MECHANICAL_FLOOR = 60;

export type ContentRun = {
  article: Article | null;
  brief: ResearchBrief | null;
  review: CriticReview | null;
  approved: boolean; // final gate: Critic pass AND mechanical floor
};

// Turn the Researcher's brief into writing instructions for the existing engine.
function briefToNotes(b: ResearchBrief, he: boolean): string {
  const p: string[] = [];
  if (b.angle) p.push(he ? `זווית ייחודית: ${b.angle}.` : `Unique angle: ${b.angle}.`);
  if (b.mustCover?.length) p.push(he ? `חובה לכסות: ${b.mustCover.join('; ')}.` : `Must cover: ${b.mustCover.join('; ')}.`);
  if (b.subQuestions?.length) p.push(he ? `שאלות-משנה (כל אחת = H2): ${b.subQuestions.join('; ')}.` : `Sub-questions (each an H2): ${b.subQuestions.join('; ')}.`);
  if (b.entities?.length) p.push(he ? `ישויות לשלב: ${b.entities.join(', ')}.` : `Entities to weave in: ${b.entities.join(', ')}.`);
  if (b.cannibalizationRisk?.length) {
    const titles = b.cannibalizationRisk.map((c) => c.title).join('; ');
    p.push(he ? `הימנע מחפיפה לדפים הקיימים (${titles}) — כתוב זווית מובחנת.` : `Avoid overlap with existing pages (${titles}) — take a distinct angle.`);
  }
  return p.join(' ');
}

export async function runContentDepartment(input: {
  keyword: string;
  lang: Lang;
  context?: string;
  notes?: string;
  existingPages: ExistingPage[];
}): Promise<ContentRun> {
  const he = input.lang === 'he';

  // 1) Researcher — grounded on the real existing pages.
  const brief = await research({
    keyword: input.keyword,
    lang: input.lang,
    context: input.context,
    existingPages: input.existingPages,
  }).catch(() => null);

  // 2) Maker — the existing content engine, now fed the brief.
  const baseNotes = [input.notes, brief ? briefToNotes(brief, he) : ''].filter(Boolean).join(' ');
  const draftArticle = (extra?: string) =>
    generateArticle({
      keyword: input.keyword,
      lang: input.lang,
      context: input.context,
      notes: [baseNotes, extra].filter(Boolean).join(' ') || undefined,
    }).catch(() => null);

  let article = await draftArticle();
  if (!article) return { article: null, brief, review: null, approved: false };

  const runCritic = (a: Article) =>
    critique({
      article: a,
      keyword: input.keyword,
      lang: input.lang,
      brief,
      mechanicalFailures: a.checks.issues.filter((i) => !i.ok).map((i) => i.label),
    }).catch(() => null);

  // 3) Critic — the adversarial editor that replaces the score-70 gate.
  let review = await runCritic(article);

  // 4) Editor — one revise pass: if the Critic asked to revise (fixable base),
  // regenerate with its findings as instructions, then re-critique and keep the
  // better result. Turns "reject" into "improve".
  if (review && review.verdict === 'revise') {
    const revised = await draftArticle(revisionNotes(review, input.lang));
    if (revised) {
      const revisedReview = await runCritic(revised);
      if (revisedReview && (revisedReview.verdict === 'pass' || review.verdict === 'revise')) {
        article = revised;
        review = revisedReview;
      }
    }
  }

  // Final gate: the Critic must pass AND the mechanical basics must hold. If the
  // Critic call itself failed (API error), do NOT approve — the piece stays a
  // draft rather than auto-publishing un-reviewed (matches Rank's no-surprise
  // go-live rule). A missing critic is "not measured", never an implicit pass.
  const approved = !!review && review.verdict === 'pass' && article.checks.score >= MECHANICAL_FLOOR;

  return { article, brief, review, approved };
}
