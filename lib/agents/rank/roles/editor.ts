// Editor archetype (§4b) — turns the Critic's findings into concrete rewrite
// instructions so the Maker (content-engine) can fix the article in one pass,
// instead of the Critic only rejecting it. This is the draft → critique → revise
// loop that makes the department a team, not a gate.
import type { CriticReview, Lang } from '../contract';

/** Compose writing instructions from the Critic's blocking findings. */
export function revisionNotes(review: CriticReview, lang: Lang): string {
  const he = lang === 'he';
  const parts: string[] = [];
  if (review.mustFix?.length) parts.push(he ? `תקן לפני הכל: ${review.mustFix.join('; ')}.` : `Fix first: ${review.mustFix.join('; ')}.`);
  if (review.factualIssues?.length) parts.push(he ? `הסר/תקן טענות לא-מאומתות: ${review.factualIssues.join('; ')}.` : `Remove/fix unverifiable claims: ${review.factualIssues.join('; ')}.`);
  if (review.cannibalization?.length) parts.push(he ? `הימנע מחפיפה: ${review.cannibalization.join('; ')}.` : `Avoid overlap: ${review.cannibalization.join('; ')}.`);
  if (review.geoGaps?.length) parts.push(he ? `שפר ציטוט-AI: ${review.geoGaps.join('; ')}.` : `Improve AI-citability: ${review.geoGaps.join('; ')}.`);
  if (review.templateGaps?.length) parts.push(he ? `השלם שלד-מתודיקה: ${review.templateGaps.join('; ')}.` : `Complete the methodology skeleton: ${review.templateGaps.join('; ')}.`);
  if (review.eeatIssues?.length) parts.push(he ? `חזק E-E-A-T: ${review.eeatIssues.join('; ')}.` : `Strengthen E-E-A-T: ${review.eeatIssues.join('; ')}.`);
  return parts.join(' ');
}
