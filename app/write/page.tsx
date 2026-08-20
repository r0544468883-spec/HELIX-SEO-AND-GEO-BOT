'use client';

import { useState, useEffect } from 'react';

type CheckReport = { score: number; modes: { rankmath: number; yoast: number; hcu: number }; issues: { label: string; ok: boolean }[] };
type GeoMethod = { id: string; label: string; ok: boolean; boost: number; detail: string };
type GeoReport = { score: number; methods: GeoMethod[] };
type Article = {
  title: string;
  meta: string;
  h1: string;
  body_html: string;
  faq: { q: string; a: string }[];
  schema_json: unknown;
  lang: 'he' | 'en';
  checks: CheckReport;
  geo: GeoReport;
};

const scoreColor = (n: number) =>
  n >= 80 ? 'bg-emerald-100 text-emerald-800' : n >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';

const box = 'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-emerald-500';
const label = 'block text-[13px] font-semibold mb-1';

export default function WritePage() {
  const [keyword, setKeyword] = useState('');
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get('keyword');
    if (k) setKeyword(k);
  }, []);
  const [context, setContext] = useState('');
  const [notes, setNotes] = useState('');
  const [lang, setLang] = useState<'he' | 'en'>('he');
  const [withImage, setWithImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [article, setArticle] = useState<Article | null>(null);

  // Voice — paste your own writing so the article comes out in YOUR authentic voice.
  type Voice = { keyTells: string[]; signaturePassages: string[]; summary: string; tier: string; words: number; lang: 'he' | 'en' };
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [samples, setSamples] = useState<string[]>(['', '']);
  const [voice, setVoice] = useState<Voice | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const setSample = (i: number, v: string) => setSamples((s) => s.map((x, j) => (j === i ? v : x)));

  async function learnVoice() {
    setVoiceMsg(null);
    const filled = samples.map((s) => s.trim()).filter(Boolean);
    if (filled.length < 1) return setVoiceMsg('הדביקו לפחות דוגמה אחת שכתבתם.');
    setVoiceBusy(true);
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ samples: filled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'error');
      setVoice(json.voice as Voice);
      setVoiceMsg('הקול נלמד ✅ המאמר הבא ייכתב בסגנון שלכם.');
    } catch (e) {
      setVoiceMsg('שגיאה: ' + (e as Error).message);
    } finally {
      setVoiceBusy(false);
    }
  }

  // WordPress
  const [wpUrl, setWpUrl] = useState('');
  const [wpUser, setWpUser] = useState('');
  const [wpPass, setWpPass] = useState('');
  const [status, setStatus] = useState<'draft' | 'publish'>('draft');
  const [pubMsg, setPubMsg] = useState<string | null>(null);
  const [pubBusy, setPubBusy] = useState(false);

  async function generate() {
    setErr(null);
    setArticle(null);
    setPubMsg(null);
    if (!keyword.trim()) return setErr('הכניסו מילת מפתח.');
    setBusy(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keyword, context, notes, lang, withImage, voice }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'error');
      setArticle(json.article as Article);
    } catch (e) {
      setErr('שגיאה: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!article) return;
    if (!wpUrl || !wpUser || !wpPass) return setPubMsg('מלאו את פרטי WordPress.');
    setPubBusy(true);
    setPubMsg(null);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          body_html: article.body_html,
          meta: article.meta,
          schema_json: article.schema_json,
          status,
          wp: { base_url: wpUrl, username: wpUser, app_password: wpPass },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'error');
      setPubMsg(status === 'publish' ? `פורסם ✅ ${json.url}` : `נשמר כטיוטה ✅ ${json.url}`);
    } catch (e) {
      setPubMsg('שגיאה: ' + (e as Error).message);
    } finally {
      setPubBusy(false);
    }
  }

  return (
    <main className="max-w-[860px] mx-auto px-5 md:px-8 pt-10 pb-16">
      <div className="mb-1 text-[13px] font-bold text-emerald-600">HELIX Rank</div>
      <h1 className="text-[clamp(24px,4.5vw,36px)] font-extrabold tracking-tight mb-1">כתיבה ופרסום</h1>
      <p className="text-[var(--ink-secondary)] text-[15px] mb-6">
        מילת מפתח → מאמר SEO+GEO מלא בעברית אנושית (עם schema) → פרסום ל-WordPress.
      </p>

      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <input className={box} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="מילת מפתח — למשל: איך לבחור טבעת אירוסין" />
          <select className={box} value={lang} onChange={(e) => setLang(e.target.value as 'he' | 'en')}>
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </div>
        <input className={box} value={context} onChange={(e) => setContext(e.target.value)} placeholder="הקשר עסקי (אופציונלי) — חנות תכשיטים, ישראל בלבד" />
        <input className={box} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הנחיות/תוכן לכסות (אופציונלי) — למשל תוכנית פעולה מ-Striking Distance" />
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={withImage} onChange={(e) => setWithImage(e.target.checked)} />
          צור תמונת AI למאמר
        </label>

        {/* Voice — write the article in the user's own authentic voice */}
        <div className="rounded-xl border border-black/10 bg-white">
          <button
            type="button"
            onClick={() => setVoiceOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-right"
          >
            <span className="text-[14px] font-semibold">
              ✍️ כתוב בקול שלי
              {voice && <span className="mr-2 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[12px] font-bold">פעיל</span>}
            </span>
            <span className="text-[var(--ink-secondary)] text-[13px]">{voiceOpen ? '▲' : '▼'}</span>
          </button>
          {voiceOpen && (
            <div className="px-4 pb-4 space-y-2 border-t border-black/5 pt-3">
              <p className="text-[13px] text-[var(--ink-secondary)]">
                הדביקו 1–3 טקסטים שכתבתם (פוסט, מאמר, מייל). נלמד את הקול האותנטי שלכם, והמאמר ייכתב בסגנון שלכם — לא בקול גנרי.
              </p>
              {samples.map((s, i) => (
                <textarea
                  key={i}
                  className={box + ' resize-y'}
                  rows={3}
                  value={s}
                  onChange={(e) => setSample(i, e.target.value)}
                  placeholder={`דוגמה ${i + 1} — טקסט שכתבתם בעצמכם…`}
                />
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={learnVoice} disabled={voiceBusy} className="rounded-xl bg-black text-white px-5 py-2.5 text-[14px] font-bold disabled:opacity-50">
                  {voiceBusy ? 'לומד…' : voice ? 'עדכן את הקול' : 'למד את הקול שלי'}
                </button>
                {voice && (
                  <button onClick={() => { setVoice(null); setVoiceMsg('הקול הוסר — נחזור לסגנון הבית.'); }} className="text-[13px] text-[var(--ink-secondary)] underline">
                    הסר
                  </button>
                )}
                {voiceMsg && <span className="text-[13px]">{voiceMsg}</span>}
              </div>
              {voice && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-1.5">
                  {voice.summary && <div className="text-[13px] font-semibold">הקול שלכם: {voice.summary}</div>}
                  {voice.keyTells.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {voice.keyTells.map((t, k) => (
                        <span key={k} className="rounded-full bg-white border border-emerald-200 px-2.5 py-0.5 text-[12px]">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={generate} disabled={busy} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-[15px] font-bold disabled:opacity-50">
          {busy ? 'כותב…' : 'כתוב מאמר'}
        </button>
        {err && <p className="text-[14px] text-red-600">{err}</p>}
      </div>

      {article && (
        <>
          <div className="rounded-2xl border border-black/10 bg-white p-5 mt-6 space-y-3">
            <div>
              <div className="text-[12px] font-semibold text-[var(--ink-secondary)]">Title</div>
              <div className="text-[18px] font-bold">{article.title}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-[var(--ink-secondary)]">Meta</div>
              <div className="text-[14px]">{article.meta}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
              <span className={'rounded-full px-3 py-1 text-[13px] font-bold ' + scoreColor(article.checks.score)}>
                ציון SEO {article.checks.score}/100
              </span>
              <span className={'rounded-full px-3 py-1 text-[13px] font-bold ' + scoreColor(article.geo.score)}>
                ציון GEO {article.geo.score}/100
              </span>
              <span className="text-[12px] text-[var(--ink-secondary)]">Rank Math {article.checks.modes.rankmath}% · Yoast {article.checks.modes.yoast}% · HCU {article.checks.modes.hcu}%</span>
              {article.checks.issues.filter((i) => !i.ok).slice(0, 4).map((i, k) => (
                <span key={k} className="rounded-full bg-black/5 px-2.5 py-0.5 text-[12px] text-[var(--ink-secondary)]">⚠ {i.label}</span>
              ))}
            </div>

            {/* Princeton GEO methods — what makes AI engines cite this article */}
            <div className="border-t border-black/5 pt-3">
              <div className="text-[12px] font-semibold text-[var(--ink-secondary)] mb-2">שיטות GEO (ציטוט ב-AI)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {article.geo.methods.map((m) => (
                  <div key={m.id} className="flex items-start gap-1.5 text-[13px]" title={m.detail}>
                    <span className={m.ok ? 'text-emerald-600' : 'text-red-500'}>{m.ok ? '✓' : '✕'}</span>
                    <span className="font-semibold">{m.label}</span>
                    {!m.ok && <span className="text-[11px] text-[var(--ink-secondary)] truncate">— {m.detail}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-[var(--ink-secondary)] mb-1">תצוגה מקדימה</div>
              <div className="prose-preview text-[15px] leading-relaxed [&_h1]:text-[22px] [&_h1]:font-bold [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:mt-4 [&_h3]:font-semibold [&_h3]:mt-3 [&_p]:my-2" dangerouslySetInnerHTML={{ __html: article.body_html }} />
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-5 mt-4 space-y-3">
            <h2 className="text-[16px] font-bold">פרסום ל-WordPress</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>כתובת האתר</label>
                <input className={box} dir="ltr" value={wpUrl} onChange={(e) => setWpUrl(e.target.value)} placeholder="https://example.com" />
              </div>
              <div>
                <label className={label}>שם משתמש</label>
                <input className={box} dir="ltr" value={wpUser} onChange={(e) => setWpUser(e.target.value)} />
              </div>
              <div>
                <label className={label}>Application Password</label>
                <input className={box} dir="ltr" type="password" value={wpPass} onChange={(e) => setWpPass(e.target.value)} />
              </div>
              <div>
                <label className={label}>סטטוס</label>
                <select className={box} value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'publish')}>
                  <option value="draft">טיוטה</option>
                  <option value="publish">פרסום מיידי</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={publish} disabled={pubBusy} className="rounded-xl bg-black text-white px-6 py-3 text-[15px] font-bold disabled:opacity-50">
                {pubBusy ? 'מפרסם…' : status === 'publish' ? 'פרסם עכשיו' : 'שמור טיוטה'}
              </button>
              {pubMsg && <span className="text-[13px] break-all">{pubMsg}</span>}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
