// Content-quality checks — orphan words (typographic widows) + AI-style emojis.
// Two failure modes that make a page read amateur / "AI-written":
//   1) orphan word — a heading/paragraph whose last line is a single lone word.
//   2) AI emoji    — decorative emojis sprinkled inside prose (a classic LLM tell).
// Pure fetch + regex, no LLM, mirroring lib/seo/aeo-audit.ts. The pure detectors
// (detectOrphanWords / detectAiEmojis) also run pre-publish on generated HTML in
// lib/content-engine.ts; auditContentQuality(url) grades a live page.

import type { AeoCheck } from './aeo-audit';

export type ContentIssueKind = 'orphan_word' | 'ai_emoji';
export type ContentIssue = {
  kind: ContentIssueKind;
  severity: 'high' | 'medium' | 'low';
  /** Human-readable Hebrew label of the problem. */
  label: string;
  /** Explanation + concrete fix. */
  detail: string;
  /** The offending text snippet (heading text, or the emoji-bearing sentence). */
  snippet?: string;
};

export type ContentQualityReport = {
  url?: string;
  score: number;
  checks: AeoCheck[];
  issues: ContentIssue[];
};

// AI-tell emoji set — the decorative emojis LLMs love to inject into prose. Kept
// deliberately broad via Extended_Pictographic, with a small allowlist of marks
// that are legitimately textual (®, ™, ©, ℹ) removed to avoid false positives.
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const EMOJI_ALLOW = new Set(['™', '®', '©', 'ℹ']);

const BLOCK_RE = /<(h[1-4]|p|li|blockquote|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function wordCount(text: string): number {
  const t = text.replace(/ /g, ' ').trim();
  return t ? t.split(/\s+/).length : 0;
}

function countEmojis(text: string): { count: number; unique: string[] } {
  const found = text.match(EMOJI_RE) ?? [];
  const kept = found.filter((e) => !EMOJI_ALLOW.has(e));
  return { count: kept.length, unique: [...new Set(kept)] };
}

// ── Orphan words ──────────────────────────────────────────────────────────
// We can't measure pixel line-wrapping statically, so we flag *risk*: multi-word
// headings/paragraphs that (a) lack a non-breaking space gluing the last two
// words and (b) sit on a page that doesn't declare `text-wrap: balance/pretty`.
// The recommended fix is exactly the global CSS the HELIX site now ships.
export function detectOrphanWords(html: string, opts: { max?: number } = {}): ContentIssue[] {
  const max = opts.max ?? 20;
  const hasBalance = /text-wrap\s*:\s*balance/i.test(html);
  const hasPretty = /text-wrap\s*:\s*pretty/i.test(html);
  const issues: ContentIssue[] = [];

  let m: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(html)) && issues.length < max) {
    const tag = m[1].toLowerCase();
    const isHeading = /^h[1-4]$/.test(tag);
    const innerRaw = m[2];
    const text = stripTags(innerRaw);
    const words = wordCount(text);
    if (!words) continue;

    // Already glued with a non-breaking space near the end → not at risk.
    const glued = / |&nbsp;/i.test(innerRaw);
    if (glued) continue;

    if (isHeading) {
      if (hasBalance) continue; // balance handles heading widows
      if (words < 4) continue; // too short to widow meaningfully
      issues.push({
        kind: 'orphan_word',
        severity: 'medium',
        label: 'כותרת בסיכון למילה יתומה',
        detail:
          'הכותרת עלולה לשבור מילה בודדת לשורה נפרדת. פתרון: הוסף CSS `h1,h2,h3{text-wrap:balance}` או רווח קשיח (&nbsp;) בין שתי המילים האחרונות.',
        snippet: text.slice(0, 120),
      });
    } else {
      if (hasPretty) continue; // pretty handles paragraph widows
      if (words < 14) continue; // short blocks rarely widow
      issues.push({
        kind: 'orphan_word',
        severity: 'low',
        label: 'פסקה בסיכון למילה יתומה',
        detail:
          'פסקה ארוכה ללא הגנת text-wrap עלולה להשאיר מילה בודדת בשורה האחרונה. פתרון: `p{text-wrap:pretty}`.',
        snippet: text.slice(0, 120),
      });
    }
  }
  return issues;
}

// ── AI-style emojis ───────────────────────────────────────────────────────
// Flags emojis inside the page's visible prose. Emojis embedded *mid-sentence*
// (word characters on both sides) are the strongest "AI-written" tell and are
// rated higher severity than a leading/trailing decorative emoji.
export function detectAiEmojis(html: string, opts: { max?: number } = {}): ContentIssue[] {
  const max = opts.max ?? 20;
  const issues: ContentIssue[] = [];

  let m: RegExpExecArray | null;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(html)) && issues.length < max) {
    const text = stripTags(m[2]);
    const { count, unique } = countEmojis(text);
    if (!count) continue;
    // mid-sentence = an emoji with a non-space, non-emoji char on both sides
    const midSentence = /\S\s*\p{Extended_Pictographic}\s*\S/u.test(text);
    issues.push({
      kind: 'ai_emoji',
      severity: midSentence ? 'high' : 'medium',
      label: midSentence ? 'אימוג׳י בתוך משפט (סימן היכר של AI)' : 'אימוג׳י דקורטיבי בטקסט',
      detail: `נמצאו ${count} אימוג׳ים (${unique.join(' ')}) בטקסט. אימוג׳ים בתוך קופי מסגירים תוכן שנכתב ע״י AI ומורידים מהמקצועיות — הסר אותם או המר לאייקון קווי.`,
      snippet: text.slice(0, 140),
    });
  }
  return issues;
}

function scoreFromIssues(issues: ContentIssue[]): number {
  const penalty = issues.reduce((sum, i) => sum + (i.severity === 'high' ? 12 : i.severity === 'medium' ? 6 : 3), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

async function tryFetch(url: string): Promise<{ ok: boolean; text: string; status: number }> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'HELIX-Rank-ContentQuality/1.0' }, cache: 'no-store' });
    const text = res.ok ? await res.text() : '';
    return { ok: res.ok, text, status: res.status };
  } catch {
    return { ok: false, text: '', status: 0 };
  }
}

/** Grade a LIVE url for orphan words + AI-style emojis. */
export async function auditContentQuality(url: string): Promise<ContentQualityReport> {
  const page = await tryFetch(url);
  if (!page.ok) throw new Error(`fetch_failed_${page.status}`);
  const html = page.text;

  const orphans = detectOrphanWords(html);
  const emojis = detectAiEmojis(html);
  const issues = [...emojis, ...orphans];

  const checks: AeoCheck[] = [
    {
      id: 'ai_emoji',
      label: 'אימוג׳ים בתוכן (סימן AI)',
      category: 'content',
      pass: emojis.length === 0,
      value: emojis.length ? `${emojis.length} מקומות` : 'נקי',
      detail: emojis.length
        ? `נמצאו אימוג׳ים בקופי ב-${emojis.length} בלוקים. הסר או המר לאייקון קווי כדי שהעמוד ייראה מקצועי.`
        : 'אין אימוג׳ים בתוך הטקסט — מצוין.',
    },
    {
      id: 'orphan_words',
      label: 'מילים יתומות (טיפוגרפיה)',
      category: 'content',
      pass: orphans.length === 0,
      value: orphans.length ? `${orphans.length} בסיכון` : 'תקין',
      detail: orphans.length
        ? `${orphans.length} כותרות/פסקאות בסיכון למילה יתומה. הוסף text-wrap: balance לכותרות ו-pretty לפסקאות.`
        : 'העמוד מגן מפני מילים יתומות (text-wrap) — תקין.',
    },
  ];

  return { url, score: scoreFromIssues(issues), checks, issues };
}
