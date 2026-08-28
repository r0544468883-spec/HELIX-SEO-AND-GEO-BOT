// Orchestrator (archetype 4, the campaign-altitude node) — methodology §5.
// The department's missing link: today the loop ships ONE isolated article per
// content gap. The Orchestrator turns a single seed keyword into a hub-and-spoke
// PLAN — 1 pillar + 4-8 spokes, a differentiating angle, an optional coined
// category term, and one signature-diagram concept reused across the cluster.
// It does NOT write; it plans. Honesty rule (Rank core): it plans keywords +
// angles, it never invents stats/sources. The proposed coinedTerm is gated later
// by the Critic — a term only survives if it is real and defensible, not spam.
import { claude, parseJson } from '../../../claude';
import { withSkills } from '../../../skills/registry';
import type { Lang, ExistingPage, ClusterPlan } from '../contract';

export async function planCluster(input: {
  seedKeyword: string;
  lang: Lang;
  context?: string;
  existingPages: ExistingPage[];
}): Promise<ClusterPlan | null> {
  const he = input.lang === 'he';
  const pagesList =
    input.existingPages.slice(0, 40).map((p, i) => `${i + 1}. ${p.title}`).join('\n') ||
    (he ? '(אין דפים קיימים)' : '(no existing pages)');

  const system = he
    ? `אתה אסטרטג-תוכן SEO/GEO ברמת-קמפיין. מתוך מילת-מפתח אחת (seed) בנֵה תוכנית hub-and-spoke: עמוד-עוגן (pillar) אחד למונח-על, ו-4-8 עמודי-לוויין (spokes) ל-long-tail ממוקד, שכולם מקשרים חזרה ל-pillar.
כללי-ברזל:
- זו תכנית: מילות-מפתח וזוויות בלבד. אל תמציא סטטיסטיקות, מספרים או מקורות.
- pillarKeyword = מונח-על רחב שה-spokes מתנקזים אליו. אל תשכפל דף קיים מהרשימה — בחר זווית/מונח מובחן.
- coinedTerm = מונח-קטגוריה שאפשר "להחזיק" ולתפוס בלי תחרות (למשל שם למתודה/בעיה). רק אם הוא אמיתי והגיוני — אחרת null. אל תמציא ז'רגון ריק.
- angle = משפט אחד: הזווית המבדלת של כל ה-cluster.
- diagram = משפט אחד שמתאר דיאגרמת-חתימה אחת שתחזור בכל עמודי ה-cluster.
- spokes: 4-8, כל אחד {keyword, angle} עם long-tail מדויק שונה. בלי חפיפה ביניהם.
החזר JSON בלבד: {"pillarKeyword":"","coinedTerm":null,"angle":"","diagram":"","spokes":[{"keyword":"","angle":""}]}`
    : `You are a campaign-level SEO/GEO content strategist. From ONE seed keyword, build a hub-and-spoke plan: one pillar page for a head term, and 4-8 spoke pages for focused long-tail, all linking back to the pillar.
Hard rules:
- This is a plan: keywords and angles only. Do NOT invent statistics, numbers, or sources.
- pillarKeyword = the broad head term the spokes funnel into. Do not duplicate an existing page from the list — pick a distinct angle/term.
- coinedTerm = a category term you can OWN and rank on with no competition (e.g. a name for the method/problem). Only if it is real and sensible — otherwise null. Do not invent empty jargon.
- angle = one sentence: the differentiating angle for the whole cluster.
- diagram = one sentence describing a single signature diagram reused across every page of the cluster.
- spokes: 4-8, each {keyword, angle} with a distinct precise long-tail. No overlap between them.
Return ONLY JSON: {"pillarKeyword":"","coinedTerm":null,"angle":"","diagram":"","spokes":[{"keyword":"","angle":""}]}`;

  const user = he
    ? `seed: "${input.seedKeyword}"${input.context ? `\nהקשר עסקי: ${input.context}` : ''}\n\nדפים קיימים באתר (הימנע מחפיפה):\n${pagesList}`
    : `seed: "${input.seedKeyword}"${input.context ? `\nBusiness context: ${input.context}` : ''}\n\nExisting site pages (avoid overlap):\n${pagesList}`;

  const raw = await claude(withSkills(system, ['seo-geo-pack', 'project-orchestration']), user, 1500);
  const plan = parseJson<ClusterPlan>(raw);
  if (!plan || !plan.pillarKeyword) return null;
  // Clamp to the methodology's 4-8 spokes; coerce a blank coined term to null.
  plan.spokes = (plan.spokes ?? []).filter((s) => s && s.keyword).slice(0, 8);
  plan.coinedTerm = plan.coinedTerm && plan.coinedTerm.trim() ? plan.coinedTerm.trim() : null;
  return plan;
}
