// HELIX Rank — internal agent department (charter §4b of HELIX-CHIEF-AND-AGENTS-SPEC).
// Shared types for the content department. Rank's orchestration stays deterministic
// (lib/act/loop.ts = System Chief); the agents live ONLY at the two content nodes:
//   Researcher (grounds the brief) → Maker (generateArticle) → Critic (the gate).
// The Critic REPLACES the mechanical "score >= 70" gate with an adversarial editor.

export type Lang = 'he' | 'en';

// A real existing page on the site (from content_pieces) — the only source the
// Researcher/Critic may use for internal-links + cannibalization. Never invented.
export type ExistingPage = { title: string; url?: string; keyword?: string };

// --- Researcher output: a focused brief. Planning, not fabricated facts. --------
export type ResearchBrief = {
  angle: string;                 // the unique angle this article should take
  entities: string[];            // entities/concepts to cover (for topical depth + GEO)
  subQuestions: string[];        // each becomes an answer-first H2
  mustCover: string[];           // non-negotiable points
  internalLinks: ExistingPage[]; // from the provided existing pages ONLY
  cannibalizationRisk: { title: string; reason: string }[]; // overlapping existing pages
  notes: string;
};

// --- Critic output: a blunt editorial verdict. ---------------------------------
export type CriticVerdict = 'pass' | 'revise' | 'reject';
export type CriticReview = {
  verdict: CriticVerdict;
  score: number;             // 0..100 editorial judgement (separate from mechanical checks)
  factualIssues: string[];   // unverifiable / fabricated-sounding claims, each quoted
  eeatIssues: string[];      // trust/expertise/authority gaps
  cannibalization: string[]; // concrete overlaps with a named existing page
  geoGaps: string[];         // why an AI engine would NOT cite this
  mustFix: string[];         // blocking items before publish
  directNote: string;        // one blunt sentence, no sugarcoating
};
