'use client';

import { useState } from 'react';

type QueryResult = { query: string; engine: string; cited: boolean; competitorsCited: string[] };
type EnginePresence = { engine: string; cited: number; total: number };
type Report = {
  score: number;
  shareOfVoice: number;
  perEngine: EnginePresence[];
  results: QueryResult[];
  gaps: QueryResult[];
};

const box = 'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-emerald-500';
const ENGINE_LABEL: Record<string, string> = {
  perplexity: 'Perplexity', chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude',
  ai_mode: 'Google AI Mode', copilot: 'Copilot', grok: 'Grok',
};

// AEO Audit — live-URL AI-readiness score
type AeoCheck = { id: string; label: string; category: 'discovery' | 'structure' | 'content'; pass: boolean; value: string; detail: string };
type AeoReport = { url: string; score: number; checks: AeoCheck[] };
const AEO_CAT_LABEL: Record<AeoCheck['category'], string> = { discovery: 'גילוי', structure: 'מבנה', content: 'תוכן' };

export default function GeoPage() {
  const [domain, setDomain] = useState('');
  const [brand, setBrand] = useState('');
  const [queries, setQueries] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [extEngines, setExtEngines] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  // AI referral traffic (GA4)
  const [propertyId, setPropertyId] = useState('');
  const [tBusy, setTBusy] = useState(false);
  const [tErr, setTErr] = useState<string | null>(null);
  const [traffic, setTraffic] = useState<{ totalSessions: number; pages: { page: string; sessions: number; engaged: number; sources: string[] }[] } | null>(null);

  // AEO Audit
  const [auditUrl, setAuditUrl] = useState('');
  const [aBusy, setABusy] = useState(false);
  const [aErr, setAErr] = useState<string | null>(null);
  const [audit, setAudit] = useState<AeoReport | null>(null);

  async function runAudit() {
    setAErr(null);
    setAudit(null);
    const url = auditUrl.trim();
    if (!/^https?:\/\//i.test(url)) return setAErr('הכניסו כתובת מלאה (https://…).');
    setABusy(true);
    try {
      const res = await fetch('/api/aeo-audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'error');
      setAudit(json.report as AeoReport);
    } catch (e) {
      setAErr('שגיאה: ' + (e as Error).message);
    } finally {
      setABusy(false);
    }
  }

  async function runTraffic() {
    setTErr(null);
    setTraffic(null);
    if (!propertyId.trim()) return setTErr('הכניסו GA4 Property ID.');
    setTBusy(true);
    try {
      const res = await fetch('/api/ai-traffic', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ propertyId: propertyId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'error');
      setTraffic(json);
    } catch (e) {
      setTErr('שגיאה: ' + (e as Error).message);
    } finally {
      setTBusy(false);
    }
  }

  async function run() {
    setErr(null);
    setReport(null);
    if (!domain.trim() || !queries.trim()) return setErr('הכניסו דומיין ולפחות שאילתה אחת.');
    setBusy(true);
    try {
      const res = await fetch('/api/geo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          domain: domain.trim(),
          brand: brand.trim() || undefined,
          queries: queries.split('\n').map((q) => q.trim()).filter(Boolean),
          competitors: competitors.split(/[\n,]/).map((c) => c.trim()).filter(Boolean),
          // Base 4 direct-API engines; extended set adds AI Mode/Copilot/Grok via BrightData.
          engines: extEngines
            ? ['perplexity', 'chatgpt', 'gemini', 'claude', 'ai_mode', 'copilot', 'grok']
            : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'error');
      setReport(json.report as Report);
    } catch (e) {
      setErr('שגיאה: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-[860px] mx-auto px-5 md:px-8 pt-10 pb-16">
      <div className="mb-1 text-[13px] font-bold text-emerald-600">HELIX Rank</div>
      <h1 className="text-[clamp(24px,4.5vw,36px)] font-extrabold tracking-tight mb-1">GEO Monitor</h1>
      <p className="text-[var(--ink-secondary)] text-[15px] mb-6">
        בודק אם מנועי ה-AI (ChatGPT · Gemini · Claude · Perplexity) מצטטים אותך — ואיפה אתה חסר.
      </p>

      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <input className={box} dir="ltr" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
          <input className={box} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="שם המותג (אופציונלי)" />
        </div>
        <textarea className={box + ' min-h-[110px]'} value={queries} onChange={(e) => setQueries(e.target.value)} placeholder="שאילתות — אחת בכל שורה. למשל:&#10;מה הכלי הכי טוב ל-SEO בעברית&#10;איך מקדמים אתר ב-2026" />
        <input className={box} value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder="מתחרים (דומיינים/שמות, מופרד בפסיק)" />
        <label className="flex items-center gap-2 text-[13px] text-[var(--ink-secondary)] cursor-pointer select-none">
          <input type="checkbox" checked={extEngines} onChange={(e) => setExtEngines(e.target.checked)} className="accent-emerald-600 w-4 h-4" />
          מנועים מורחבים (Google AI Mode · Copilot · Grok) — איטי יותר, דורש BrightData
        </label>
        <button onClick={run} disabled={busy} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-[15px] font-bold disabled:opacity-50">
          {busy ? 'בודק מנועי AI…' : 'בדוק נוכחות ב-AI'}
        </button>
        {err && <p className="text-[14px] text-red-600">{err}</p>}
      </div>

      {report && (
        <div className="space-y-5 mt-8">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Citation Score" value={`${report.score}`} suffix="/100" />
            <Stat label="Share of Voice" value={`${Math.round(report.shareOfVoice * 100)}`} suffix="%" />
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5">
            <div className="text-[13px] font-semibold text-[var(--ink-secondary)] mb-2">נוכחות per-מנוע</div>
            <div className="flex flex-wrap gap-2">
              {report.perEngine.map((e) => (
                <span key={e.engine} className="rounded-full bg-black/5 px-3 py-1 text-[13px] font-semibold">
                  {ENGINE_LABEL[e.engine] ?? e.engine}: {e.cited}/{e.total}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5">
            <div className="text-[15px] font-bold mb-3">Gap Board — {report.gaps.length} פערים</div>
            {report.gaps.length === 0 && <p className="text-[14px] text-[var(--ink-secondary)]">אין פערים — אתה מצוטט בכל השאילתות 🎉</p>}
            <div className="space-y-2">
              {report.gaps.map((g, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold">{g.query}</div>
                    <div className="text-[12px] text-[var(--ink-secondary)]">
                      {ENGINE_LABEL[g.engine] ?? g.engine}
                      {g.competitorsCited.length ? ` · מצוטט: ${g.competitorsCited.join(', ')}` : ' · אף אחד לא מצוטט'}
                    </div>
                  </div>
                  <a href={`/write?keyword=${encodeURIComponent(g.query)}`} className="shrink-0 rounded-lg bg-black text-white px-3 py-1.5 text-[13px] font-semibold">
                    כתוב patch
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI referral traffic (GA4) — the ROI half of GEO */}
      <div className="mt-10 rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-[16px] font-bold mb-1">תנועה אמיתית ממנועי AI (GA4)</h2>
        <p className="text-[13px] text-[var(--ink-secondary)] mb-3">
          אילו עמודים מקבלים גולשים <b>מ-ChatGPT/Perplexity/Gemini/Claude</b>. דורש חיבור Google (אותו כפתור למעלה) + GA4 Property ID.
        </p>
        <div className="flex flex-wrap gap-2">
          <input className={box + ' max-w-[240px]'} dir="ltr" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} placeholder="GA4 Property ID (מספר)" />
          <button onClick={runTraffic} disabled={tBusy} className="rounded-lg bg-black text-white px-4 py-2 text-[14px] font-semibold disabled:opacity-50">
            {tBusy ? 'טוען…' : 'הצג תנועת AI'}
          </button>
        </div>
        {tErr && <p className="text-[13px] text-red-600 mt-2">{tErr}</p>}
        {traffic && (
          <div className="mt-4">
            <div className="text-[14px] font-semibold mb-2">{traffic.totalSessions.toLocaleString()} sessions מ-AI · {traffic.pages.length} עמודים</div>
            <div className="space-y-1">
              {traffic.pages.slice(0, 15).map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-b border-black/5 py-1">
                  <span className="text-[13px] truncate" dir="ltr">{p.page}</span>
                  <span className="text-[12px] text-[var(--ink-secondary)] shrink-0">{p.sessions} · {p.sources.join(', ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AEO Audit — is a live page ready to be cited by AI engines? */}
      <div className="mt-10 rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-[16px] font-bold mb-1">AEO Audit — מוכנות לציטוט ב-AI</h2>
        <p className="text-[13px] text-[var(--ink-secondary)] mb-3">
          סורק <b>עמוד חי</b> ומחזיר ציון 0-100 לפי 11 בדיקות (llms.txt · גישת בוטי-AI · sitemap · JSON-LD · FAQ · meta · תשובה-ישירה · כותרות).
        </p>
        <div className="flex flex-wrap gap-2">
          <input className={box + ' max-w-[360px]'} dir="ltr" value={auditUrl} onChange={(e) => setAuditUrl(e.target.value)} placeholder="https://example.com/page" />
          <button onClick={runAudit} disabled={aBusy} className="rounded-lg bg-black text-white px-4 py-2 text-[14px] font-semibold disabled:opacity-50">
            {aBusy ? 'סורק…' : 'בדוק מוכנות'}
          </button>
        </div>
        {aErr && <p className="text-[13px] text-red-600 mt-2">{aErr}</p>}
        {audit && (
          <div className="mt-4">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-[32px] font-extrabold text-emerald-600">{audit.score}</span>
              <span className="text-[14px] text-[var(--ink-secondary)]">/100 מוכנות ל-AEO</span>
            </div>
            {(['discovery', 'structure', 'content'] as const).map((cat) => {
              const items = audit.checks.filter((c) => c.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat} className="mb-3">
                  <div className="text-[12px] font-bold text-[var(--ink-secondary)] mb-1">{AEO_CAT_LABEL[cat]}</div>
                  <div className="space-y-1">
                    {items.map((c) => (
                      <div key={c.id} className="flex items-start justify-between gap-3 border-b border-black/5 pb-1.5">
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold flex items-center gap-1.5">
                            <span className={c.pass ? 'text-emerald-600' : 'text-red-500'}>{c.pass ? '✓' : '✕'}</span>
                            {c.label}
                          </div>
                          <div className="text-[12px] text-[var(--ink-secondary)]">{c.detail}</div>
                        </div>
                        <span className="text-[12px] font-semibold shrink-0 text-[var(--ink-secondary)]">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="text-[13px] font-semibold text-[var(--ink-secondary)] mb-1">{label}</div>
      <div className="text-[32px] font-extrabold text-emerald-600">
        {value}
        {suffix && <span className="text-[16px] text-[var(--ink-secondary)]"> {suffix}</span>}
      </div>
    </div>
  );
}
