// Hebrew keyword morphology — expand a seed phrase into the prefix/plural/definite
// variants Israelis actually search. Hebrew is root-based: single-letter prefixes
// (ה/ו/ב/ל/מ/ש/כ) attach to words and change the query, so a keyword optimized for
// one form misses the majority of search traffic. Unicode-aware (real Hebrew chars).
// Ported/expanded from the hebrew-seo-geo-toolkit skill (analyze_keywords.py).

// Single-letter inseparable prefixes and their meaning.
const PREFIXES: { p: string; meaning: string }[] = [
  { p: 'ה', meaning: 'הידיעה (the)' },
  { p: 'ו', meaning: 'ו״ו החיבור (and)' },
  { p: 'ב', meaning: 'ב (in/at)' },
  { p: 'ל', meaning: 'ל (to/for)' },
  { p: 'מ', meaning: 'מ (from)' },
  { p: 'ש', meaning: 'ש (that/which)' },
  { p: 'כ', meaning: 'כ (as/like)' },
];

// Common two-letter compound prefixes (preposition + definite article).
const COMPOUND: { p: string; meaning: string }[] = [
  { p: 'וה', meaning: 'and the' },
  { p: 'שה', meaning: 'that the' },
  { p: 'מה', meaning: 'from the' },
  { p: 'כש', meaning: 'when' },
  { p: 'שב', meaning: 'that in' },
];

const HEBREW = /[֐-׿]/;

/** Pluralize a single Hebrew token (heuristic): feminine ה→ות, otherwise +ים. */
function pluralize(word: string): string | null {
  if (!HEBREW.test(word) || word.length < 2) return null;
  if (word.endsWith('ה')) return word.slice(0, -1) + 'ות';
  if (word.endsWith('ת')) return word + 'ים'; // rough; many exceptions
  return word + 'ים';
}

export type KeywordVariant = { variant: string; kind: string; note: string };

/**
 * Expand a Hebrew seed phrase into search-relevant variants.
 * Prefixes attach to the FIRST token (head of the phrase); plural applies to the LAST token.
 * Non-Hebrew phrases return just the base (nothing to expand).
 */
export function expandHebrewKeyword(phrase: string): KeywordVariant[] {
  const clean = phrase.trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  const out: KeywordVariant[] = [{ variant: clean, kind: 'base', note: 'צורת בסיס' }];
  if (!HEBREW.test(clean)) return out; // English/other — no morphology

  const tokens = clean.split(' ');
  const first = tokens[0]; // head noun — in Hebrew phrases it's first (דירה להשכרה)
  const withFirst = (nf: string) => [nf, ...tokens.slice(1)].join(' ');
  const seen = new Set<string>([clean]);
  const push = (variant: string, kind: string, note: string) => {
    if (!seen.has(variant)) {
      seen.add(variant);
      out.push({ variant, kind, note });
    }
  };

  // Prefixes on the head token (skip if it already starts with that prefix letter).
  for (const { p, meaning } of PREFIXES) {
    if (!first.startsWith(p)) push(withFirst(p + first), 'prefix', meaning);
  }
  for (const { p, meaning } of COMPOUND) {
    push(withFirst(p + first), 'compound', meaning);
  }

  // Plural of the HEAD token (+ its definite form) — "דירה להשכרה" → "דירות להשכרה".
  const plural = pluralize(first);
  if (plural && plural !== first) {
    push(withFirst(plural), 'plural', 'צורת רבים');
    push(withFirst('ה' + plural), 'definite-plural', 'רבים מיודע');
  }

  return out;
}

/** Expand many seeds, flatten + dedupe, capped. Handy before a paid keyword-data lookup. */
export function expandMany(phrases: string[], cap = 60): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const phrase of phrases) {
    for (const v of expandHebrewKeyword(phrase)) {
      if (!seen.has(v.variant)) {
        seen.add(v.variant);
        out.push(v.variant);
        if (out.length >= cap) return out;
      }
    }
  }
  return out;
}
