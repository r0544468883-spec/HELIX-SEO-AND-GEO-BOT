// Brand Protection — how AI engines *portray* your brand, not just whether they cite it.
// Runs brand-specific prompts through the answer engines, then uses Claude to score
// sentiment and check factual claims against a supplied source-of-truth. Surfaces
// alerts for negative framing, wrong/outdated facts, and total absence — the layer a
// pure citation tracker misses (mirrors Snoika's "Brand Protection" module).
import { askEngine, SUPPORTED_ENGINES } from './engines';
import { claude, parseJson } from '../claude';

export type BrandClaim = { claim: string; status: 'correct' | 'wrong' | 'unverifiable'; correction?: string };
export type BrandCheck = {
  engine: string;
  query: string;
  answer: string;
  mentioned: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -1..1
  claims: BrandClaim[];
};
export type BrandAlert = {
  severity: 'high' | 'medium' | 'low';
  type: 'negative_sentiment' | 'wrong_fact' | 'not_mentioned';
  engine: string;
  query: string;
  detail: string;
  correction?: string;
};
export type BrandEnginePresence = { engine: string; sentiment: string; sentimentScore: number; wrongFacts: number };
export type BrandProtectionReport = {
  brand: string;
  sentimentScore: number; // avg across all checks, -1..1
  wrongFactCount: number;
  perEngine: BrandEnginePresence[];
  checks: BrandCheck[];
  alerts: BrandAlert[];
};

// Default Hebrew brand prompts — "what buyers ask AI about you".
export function defaultBrandPrompts(brand: string): string[] {
  return [
    `מה זה ${brand}?`,
    `האם ${brand} מומלץ? מה היתרונות והחסרונות?`,
    `כמה עולה ${brand} ומה כולל השירות?`,
    `מהן החלופות ל-${brand}?`,
  ];
}

type AnswerAnalysis = {
  mentioned: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  claims: BrandClaim[];
};

async function analyzeAnswer(brand: string, query: string, answer: string, truth?: string): Promise<AnswerAnalysis> {
  const system = 'אתה מנתח מוניטין מותג בתשובות של מנועי AI. אתה מקפיד, זהיר ומחזיר JSON תקין בלבד, בלי טקסט נוסף.';
  const user = `מותג: "${brand}"
שאלה שנשאלה מנוע AI: "${query}"
תשובת המנוע:
"""${answer.slice(0, 4000)}"""
${truth ? `עובדות-אמת רשמיות על המותג (source of truth) — ההשוואה מולן:\n"""${truth.slice(0, 2000)}"""\n` : ''}
החזר JSON בלבד במבנה:
{
  "mentioned": true/false,
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": מספר בין -1 ל-1,
  "claims": [ { "claim": "טענה עובדתית קונקרטית על המותג שהופיעה בתשובה", "status": "correct" | "wrong" | "unverifiable", "correction": "התיקון הנכון — רק אם status=wrong" } ]
}
כללים: אם קיים source of truth, השווה כל טענה מולו; טענה שסותרת אותו = "wrong" עם correction. אם אין source of truth, סמן "wrong" רק אם הטענה סותרת ידע כללי מובהק, אחרת "unverifiable". החזר לכל היותר 5 claims.`;
  const raw = await claude(system, user, 900);
  const parsed = parseJson<AnswerAnalysis>(raw);
  if (!parsed) return { mentioned: /./.test(answer) && answer.toLowerCase().includes(brand.toLowerCase()), sentiment: 'neutral', sentimentScore: 0, claims: [] };
  return {
    mentioned: !!parsed.mentioned,
    sentiment: parsed.sentiment === 'positive' || parsed.sentiment === 'negative' ? parsed.sentiment : 'neutral',
    sentimentScore: typeof parsed.sentimentScore === 'number' ? Math.max(-1, Math.min(1, parsed.sentimentScore)) : 0,
    claims: Array.isArray(parsed.claims) ? parsed.claims.slice(0, 5) : [],
  };
}

export async function analyzeBrandProtection(input: {
  brand: string;
  truth?: string;
  prompts?: string[];
  engines?: string[];
}): Promise<BrandProtectionReport> {
  const engines = input.engines?.length ? input.engines : [...SUPPORTED_ENGINES];
  const prompts = input.prompts?.length ? input.prompts : defaultBrandPrompts(input.brand);
  const checks: BrandCheck[] = [];
  const alerts: BrandAlert[] = [];

  for (const query of prompts) {
    for (const engine of engines) {
      let ans;
      try {
        ans = await askEngine(engine, query);
      } catch {
        continue; // engine not configured — skip
      }
      const a = await analyzeAnswer(input.brand, query, ans.answer, input.truth);
      checks.push({ engine, query, answer: ans.answer, ...a });

      if (!a.mentioned) {
        alerts.push({ severity: 'low', type: 'not_mentioned', engine, query, detail: `${input.brand} לא מוזכר בתשובה של ${engine} על "${query}".` });
      } else if (a.sentiment === 'negative') {
        alerts.push({ severity: a.sentimentScore <= -0.4 ? 'high' : 'medium', type: 'negative_sentiment', engine, query, detail: `${engine} מציג את ${input.brand} בטון שלילי (${a.sentimentScore.toFixed(2)}) על "${query}".` });
      }
      for (const c of a.claims) {
        if (c.status === 'wrong') {
          alerts.push({ severity: 'high', type: 'wrong_fact', engine, query, detail: `מידע שגוי ב-${engine}: "${c.claim}"`, correction: c.correction });
        }
      }
    }
  }

  // Aggregate.
  const scored = checks.filter((c) => c.mentioned);
  const sentimentScore = scored.length ? Math.round((scored.reduce((s, c) => s + c.sentimentScore, 0) / scored.length) * 100) / 100 : 0;
  const wrongFactCount = checks.reduce((s, c) => s + c.claims.filter((x) => x.status === 'wrong').length, 0);

  const engMap = new Map<string, { sum: number; n: number; wrong: number }>();
  for (const c of checks) {
    const e = engMap.get(c.engine) ?? { sum: 0, n: 0, wrong: 0 };
    if (c.mentioned) { e.sum += c.sentimentScore; e.n += 1; }
    e.wrong += c.claims.filter((x) => x.status === 'wrong').length;
    engMap.set(c.engine, e);
  }
  const perEngine: BrandEnginePresence[] = Array.from(engMap.entries()).map(([engine, v]) => {
    const avg = v.n ? v.sum / v.n : 0;
    return { engine, sentiment: avg > 0.2 ? 'positive' : avg < -0.2 ? 'negative' : 'neutral', sentimentScore: Math.round(avg * 100) / 100, wrongFacts: v.wrong };
  });

  // High-severity first.
  const rank = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return { brand: input.brand, sentimentScore, wrongFactCount, perEngine, checks, alerts };
}
