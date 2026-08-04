'use client';

import { useState } from 'react';

type Item = {
  id: string;
  label: string;
  mode: 'auto' | 'manual';
  status: 'pass' | 'partial' | 'fail' | 'manual';
  detail: string;
};
type Report = { url: string; score: number; items: Item[] };

const box = 'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-emerald-500';

const STATUS_ICON: Record<Item['status'], string> = { pass: '✓', partial: '◑', fail: '✕', manual: '☐' };
const STATUS_COLOR: Record<Item['status'], string> = {
  pass: 'text-emerald-600',
  partial: 'text-amber-600',
  fail: 'text-red-500',
  manual: 'text-[var(--ink-secondary)]',
};

export default function LaunchPage() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function run() {
    setErr(null);
    setReport(null);
    if (!url.trim()) return setErr('הכניסו כתובת אתר.');
    setBusy(true);
    try {
      const res = await fetch('/api/launch-checklist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
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
      <h1 className="text-[clamp(24px,4.5vw,36px)] font-extrabold tracking-tight mb-1">בדיקת תקינות אתר</h1>
      <p className="text-[var(--ink-secondary)] text-[15px] mb-6">
        10 בדיקות תקינות SEO טכניות — אפשר להריץ בכל שלב, לא רק בהשקה. בודקים אוטומטית מה שאפשר (sitemap · Analytics · noindex · robots · NAP · קישורים שבורים · מהירות · טפסים), ומסמנים מה דורש חיבור ידני.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input className={box + ' max-w-[360px]'} dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.co.il" />
        <button onClick={run} disabled={busy} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-[15px] font-bold disabled:opacity-50">
          {busy ? 'בודק…' : 'הרץ צ׳קליסט'}
        </button>
      </div>
      {err && <p className="text-[14px] text-red-600 mb-3">{err}</p>}

      {report && (
        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <div className="flex items-baseline gap-2 mb-4">
            <span className={'text-[32px] font-extrabold ' + (report.score >= 80 ? 'text-emerald-600' : report.score >= 50 ? 'text-amber-600' : 'text-red-500')}>{report.score}</span>
            <span className="text-[14px] text-[var(--ink-secondary)]">/100 (בדיקות אוטומטיות)</span>
          </div>
          <div className="space-y-2">
            {report.items.map((it) => (
              <div key={it.id} className="flex items-start justify-between gap-3 border-b border-black/5 pb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className={'text-[16px] leading-5 ' + STATUS_COLOR[it.status]}>{STATUS_ICON[it.status]}</span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold">{it.label}</div>
                    <div className="text-[12px] text-[var(--ink-secondary)]">{it.detail}</div>
                  </div>
                </div>
                <span className="text-[11px] font-semibold shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[var(--ink-secondary)]">
                  {it.mode === 'auto' ? 'אוטומטי' : 'ידני'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
