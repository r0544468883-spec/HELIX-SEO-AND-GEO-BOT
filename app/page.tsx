'use client';

import { useState } from 'react';

type Tab = 'striking' | 'cannibalization' | 'questions' | 'decay';
const TABS: { id: Tab; label: string }[] = [
  { id: 'striking', label: 'Striking Distance' },
  { id: 'cannibalization', label: 'קניבליזציה' },
  { id: 'questions', label: 'שאלות → FAQ' },
  { id: 'decay', label: 'תוכן דועך' },
];

const SAMPLE = `query,page,clicks,impressions,ctr,position
טבעות אירוסין,/rings,40,1200,3.3,8.2
טבעות אירוסין,/engagement,8,400,2.0,14.1
שרשרת זהב לאישה,/gold-necklace,12,800,1.5,10.5
איך לבחור טבעת אירוסין,/guide,3,600,0.5,9.0
כמה עולה טבעת יהלום,/diamond-price,2,500,0.4,11.2`;

const box = 'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-emerald-500';

export default function Home() {
  const [tab, setTab] = useState<Tab>('striking');
  const [input, setInput] = useState('');
  const [previous, setPrevious] = useState('');
  const [context, setContext] = useState('');
  const [lang, setLang] = useState<'he' | 'en'>('he');
  const [siteUrl, setSiteUrl] = useState('');
  const [useGsc, setUseGsc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function run() {
    setErr(null);
    setResult(null);
    if (!useGsc && !input.trim()) {
      setErr('הדביקו ייצוא Search Console (CSV/JSON), או חברו GSC, או "טען דוגמה".');
      return;
    }
    if (tab === 'decay' && !previous.trim()) {
      setErr('ניתוח דעיכה דורש גם נתוני תקופה קודמת (התיבה השנייה).');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: tab, input, previous, lang, context, useGsc, siteUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'error');
      setResult(json);
    } catch (e) {
      setErr('שגיאה: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-[860px] mx-auto px-5 md:px-8 pt-10 pb-16">
      <div className="mb-1 text-[13px] font-bold text-emerald-600">HELIX Rank</div>
      <h1 className="text-[clamp(24px,4.5vw,36px)] font-extrabold tracking-tight mb-1">GSC Intelligence</h1>
      <p className="text-[var(--ink-secondary)] text-[15px] mb-6 leading-relaxed">
        מחברים את Search Console (או מדביקים ייצוא) ו-HELIX מוצא את ההזדמנויות ובונה תוכנית פעולה — בעברית.
      </p>

      {/* Connect GSC */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <a href="/api/gsc/auth" className="rounded-lg bg-black text-white px-4 py-2 text-[14px] font-semibold">
          חבר Google Search Console
        </a>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={useGsc} onChange={(e) => setUseGsc(e.target.checked)} />
          משוך חי מ-GSC
        </label>
        {useGsc && (
          <input className={box + ' max-w-[280px]'} dir="ltr" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="sc-domain:example.com" />
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={'rounded-full px-4 py-1.5 text-[14px] font-semibold ' + (tab === t.id ? 'bg-emerald-600 text-white' : 'bg-black/5 text-[var(--ink-secondary)]')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Input */}
      {!useGsc && (
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold">נתוני Search Console (CSV / JSON)</label>
            <button onClick={() => setInput(SAMPLE)} className="text-[13px] text-emerald-600 font-semibold">טען דוגמה</button>
          </div>
          <textarea className={box + ' min-h-[130px] font-mono text-[12px]'} dir="ltr" value={input} onChange={(e) => setInput(e.target.value)} placeholder="query,page,clicks,impressions,ctr,position&#10;..." />
          {tab === 'decay' && (
            <textarea className={box + ' min-h-[110px] font-mono text-[12px]'} dir="ltr" value={previous} onChange={(e) => setPrevious(e.target.value)} placeholder="תקופה קודמת (90 יום שלפני) — אותו פורמט" />
          )}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-3 mb-4">
        <input className={box} value={context} onChange={(e) => setContext(e.target.value)} placeholder="הקשר עסקי (משפר תעדוף) — למשל: חנות תכשיטים, ישראל בלבד" />
        <select className={box} value={lang} onChange={(e) => setLang(e.target.value as 'he' | 'en')}>
          <option value="he">עברית</option>
          <option value="en">English</option>
        </select>
      </div>

      <button onClick={run} disabled={busy} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-[15px] font-bold disabled:opacity-50">
        {busy ? 'מנתח…' : 'מצא הזדמנויות'}
      </button>
      {err && <p className="text-[14px] text-red-600 mt-3">{err}</p>}

      {result && <Results tab={tab} data={result} />}
    </main>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function Results({ tab, data }: { tab: Tab; data: any }) {
  if (tab === 'striking') {
    const ops = (data.opportunities ?? []) as any[];
    if (!ops.length) return <Empty />;
    return (
      <Section title={`${ops.length} הזדמנויות — ממוינות לפי קלות ביצוע`}>
        {ops.map((o, i) => (
          <Card key={i} head={o.query} sub={`מקום ${o.position?.toFixed?.(1)} · ${o.impressions?.toLocaleString?.()} חשיפות${o.plan?.intent ? ' · ' + o.plan.intent : ''}`}>
            <F l="Title" v={o.plan?.title} />
            <F l="Meta" v={o.plan?.meta} />
            <F l="H1" v={o.plan?.h1} />
            <L l="שדרוגי תוכן" items={o.plan?.content_upgrades} />
            <L l="קישורים פנימיים" items={o.plan?.internal_links} />
          </Card>
        ))}
      </Section>
    );
  }
  if (tab === 'cannibalization') {
    const cases = (data.cases ?? []) as any[];
    if (!cases.length) return <Empty />;
    return (
      <Section title={`${cases.length} מקרי קניבליזציה`}>
        {cases.map((c, i) => (
          <Card key={i} head={c.query} sub={`${c.urls?.length} עמודים מתחרים`}>
            {(c.urls ?? []).map((u: any, j: number) => (
              <div key={j} className="text-[12px] text-[var(--ink-secondary)]" dir="ltr">{u.page} · pos {u.position?.toFixed?.(1)} · {u.impressions} imp</div>
            ))}
            <F l="המלצה" v={c.recommendation} />
          </Card>
        ))}
      </Section>
    );
  }
  if (tab === 'questions') {
    const items = (data.items ?? []) as any[];
    if (!items.length) return <Empty />;
    return (
      <Section title={`${items.length} שאלות ל-FAQ`}>
        {items.map((it, i) => (
          <Card key={i} head={it.question} sub={`${it.impressions?.toLocaleString?.()} חשיפות`}>
            <F l="טיוטת תשובה (40-60 מילים)" v={it.answer_draft} />
            <F l="היכן לשכן" v={it.where} />
          </Card>
        ))}
      </Section>
    );
  }
  // decay
  const items = (data.items ?? []) as any[];
  if (!items.length) return <Empty />;
  return (
    <Section title={`${items.length} עמודים דועכים`}>
      {items.map((it, i) => (
        <Card key={i} head={it.url} sub={`${it.before_clicks} → ${it.after_clicks} קליקים`}>
          <F l="סיבה משוערת" v={it.reason} />
          <F l="תכנית רענון" v={it.refresh_plan} />
        </Card>
      ))}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-[18px] font-bold">{title}</h2>
      {children}
    </div>
  );
}
function Card({ head, sub, children }: { head: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div className="text-[16px] font-bold break-all">{head}</div>
        {sub && <div className="text-[13px] text-[var(--ink-secondary)]">{sub}</div>}
      </div>
      {children}
    </div>
  );
}
function F({ l, v }: { l: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="mb-2">
      <div className="text-[12px] font-semibold text-[var(--ink-secondary)]">{l}</div>
      <div className="text-[14px]">{v}</div>
    </div>
  );
}
function L({ l, items }: { l: string; items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <div className="mb-2">
      <div className="text-[12px] font-semibold text-[var(--ink-secondary)]">{l}</div>
      <ul className="list-disc pr-5 text-[14px] space-y-0.5">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>
  );
}
function Empty() {
  return <p className="mt-6 text-[14px] text-[var(--ink-secondary)]">לא נמצאו תוצאות לניתוח הזה בדאטה שסופק. נסו דאטה עם יותר שורות.</p>;
}
