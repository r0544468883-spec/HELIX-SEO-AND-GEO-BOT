'use client';
// WhatsApp templates manager — pick a site, view the built-in catalog (∪ this site's
// customs), and add/edit/delete/clone custom templates. A custom entry with the same key
// OVERRIDES the built-in. SITE-SCOPED: every fetch carries site_id.
// Talks to /api/templates/list (merged read) and /api/templates/custom (upsert/delete).
import { useCallback, useEffect, useState } from 'react';
import type { Site } from '@/lib/db';

type WaItem = {
  key: string;
  name: string;
  language: string;
  category: string;
  body: string;
  params: string[];
  sampleParams: string[];
  quickReply: string[] | null;
  urlButton: { text: string; baseUrl: string } | null;
  source: string;
  overrides: boolean;
};

type EditorData = {
  key: string;
  name: string;
  language: string;
  category: string;
  body: string;
  params: string;
  sampleParams: string;
  quickReply: string;
  urlText: string;
  urlBase: string;
};

const box = 'w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-[14px] outline-none focus:border-emerald-500';

const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function TemplatesManager({ sites, initialSite }: { sites: Site[]; initialSite: string }) {
  const [site, setSite] = useState(initialSite);
  const [items, setItems] = useState<WaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [editor, setEditor] = useState<null | { data: EditorData }>(null);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const load = useCallback(async () => {
    if (!site) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/templates/list?site=${encodeURIComponent(site)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'load failed');
      setItems(j.whatsapp ?? []);
    } catch {
      flash('err', 'טעינת התבניות נכשלה');
      setItems([]);
    }
    setLoading(false);
  }, [site]);
  useEffect(() => {
    load();
  }, [load]);

  const blank = (): EditorData => ({ key: '', name: '', language: 'he', category: 'UTILITY', body: '', params: '', sampleParams: '', quickReply: '', urlText: '', urlBase: '' });
  const fromItem = (i: WaItem): EditorData => ({
    key: i.key,
    name: i.name,
    language: i.language,
    category: i.category,
    body: i.body,
    params: i.params.join(', '),
    sampleParams: i.sampleParams.join(', '),
    quickReply: (i.quickReply ?? []).join(', '),
    urlText: i.urlButton?.text ?? '',
    urlBase: i.urlButton?.baseUrl ?? '',
  });
  // Editing a built-in "clones as custom": prefill from the built-in, save writes a custom row.
  const openNew = () => setEditor({ data: blank() });
  const openEdit = (i: WaItem) => setEditor({ data: fromItem(i) });

  const patch = (p: Partial<EditorData>) => setEditor((e) => (e ? { data: { ...e.data, ...p } } : e));

  const save = async () => {
    if (!editor) return;
    const d = editor.data;
    if (!site) return flash('err', 'בחרו אתר');
    if (!d.key.trim()) return flash('err', 'חובה מפתח (key)');
    if (!/^[a-z0-9_]+$/.test(d.name)) return flash('err', 'שם התבנית ב-Meta חייב להיות a-z0-9_');
    const definition: Record<string, unknown> = {
      name: d.name.trim(),
      language: d.language.trim() || 'he',
      category: d.category,
      body: d.body,
      params: splitList(d.params),
      sampleParams: splitList(d.sampleParams),
    };
    if (d.quickReply.trim()) definition.quickReply = splitList(d.quickReply);
    if (d.urlText.trim() && d.urlBase.trim()) definition.urlButton = { text: d.urlText.trim(), baseUrl: d.urlBase.trim() };
    try {
      const r = await fetch('/api/templates/custom', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'whatsapp', site_id: site, key: d.key.trim(), definition }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.results?.[0]?.error || j.error || 'שמירה נכשלה');
      flash('ok', 'נשמר ✓');
      setEditor(null);
      load();
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'שמירה נכשלה');
    }
  };

  const remove = async (key: string) => {
    if (!site) return;
    if (!confirm(`למחוק את "${key}"? (חוזר לברירת-המחדל אם קיימת)`)) return;
    try {
      const r = await fetch(`/api/templates/custom?site=${encodeURIComponent(site)}&kind=whatsapp&key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      flash('ok', 'נמחק');
      load();
    } catch {
      flash('err', 'מחיקה נכשלה');
    }
  };

  if (sites.length === 0) {
    return (
      <div className="rounded-xl border border-black/10 p-6 text-[14px] text-[var(--ink-secondary)]">
        אין עדיין אתרים. <a href="/sites" className="text-emerald-600 font-semibold">הוסיפו אתר</a> כדי לנהל תבניות WhatsApp עבורו.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[13px] font-semibold text-[var(--ink-secondary)]">אתר</label>
        <select className={`${box} max-w-[320px]`} value={site} onChange={(e) => setSite(e.target.value)}>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.url}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button onClick={openNew} className="rounded-xl bg-emerald-600 text-white px-5 py-2 text-[14px] font-bold">+ תבנית חדשה</button>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-2 text-[13px] ${msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>
      )}

      {loading ? (
        <div className="text-[14px] text-[var(--ink-secondary)] py-10 text-center">טוען…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-black/10 p-6 text-[14px] text-[var(--ink-secondary)]">אין תבניות להצגה.</div>
      ) : (
        <div className="space-y-2.5">
          {items.map((i) => (
            <div key={i.key} className="rounded-xl border border-black/10 bg-white p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <strong className="text-[14px]" dir="ltr">{i.name}</strong>
                  <Badge tone={i.category === 'MARKETING' ? 'warn' : 'slate'}>{i.category}</Badge>
                  {i.source === 'custom' ? (
                    <Badge tone="ok">{i.overrides ? 'דורס מובנה' : 'מותאם'}</Badge>
                  ) : (
                    <Badge tone="slate">מובנה</Badge>
                  )}
                  {i.quickReply && <Badge tone="cyan">Quick-Reply</Badge>}
                </div>
                <div className="text-[12.5px] text-[var(--ink-secondary)] truncate">{i.body}</div>
              </div>
              <button onClick={() => openEdit(i)} className="rounded-lg bg-black/5 text-[13px] font-semibold px-3 py-1.5 shrink-0">
                {i.source === 'custom' ? 'ערוך' : 'שכפל כמותאם'}
              </button>
              {i.source === 'custom' && (
                <button onClick={() => remove(i.key)} className="rounded-lg border border-black/10 text-red-600 text-[13px] font-semibold px-3 py-1.5 shrink-0">מחק</button>
              )}
            </div>
          ))}
        </div>
      )}

      {editor && (
        <div onClick={() => setEditor(null)} className="fixed inset-0 bg-black/50 flex items-start justify-center overflow-y-auto p-4 md:p-8 z-50">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-[560px] shadow-xl">
            <h2 className="text-[18px] font-bold mb-4">תבנית WhatsApp</h2>
            <div className="space-y-3">
              <Field label="מפתח (key)">
                <input className={box} value={editor.data.key} onChange={(e) => patch({ key: e.target.value })} placeholder="למשל price / my_promo" />
              </Field>
              <Field label="שם התבנית ב-Meta (a-z0-9_)">
                <input className={box} dir="ltr" value={editor.data.name} onChange={(e) => patch({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
              </Field>
              <div className="flex gap-3">
                <Field label="קטגוריה">
                  <select className={box} value={editor.data.category} onChange={(e) => patch({ category: e.target.value })}>
                    <option>UTILITY</option>
                    <option>MARKETING</option>
                  </select>
                </Field>
                <Field label="שפה">
                  <input className={box} value={editor.data.language} onChange={(e) => patch({ language: e.target.value })} />
                </Field>
              </div>
              <Field label="גוף ההודעה ({{1}}, {{2}}…)">
                <textarea className={`${box} min-h-[90px] resize-y`} value={editor.data.body} onChange={(e) => patch({ body: e.target.value })} />
              </Field>
              <Field label="פרמטרים (תיאור, מופרד בפסיקים)">
                <input className={box} value={editor.data.params} onChange={(e) => patch({ params: e.target.value })} placeholder="כתובת האתר, מילת מפתח" />
              </Field>
              <Field label="דוגמאות לפרמטרים (מופרד בפסיקים)">
                <input className={box} value={editor.data.sampleParams} onChange={(e) => patch({ sampleParams: e.target.value })} placeholder="example.co.il, עורך דין" />
              </Field>
              <Field label="כפתורי Quick-Reply (אופציונלי, מופרד בפסיקים)">
                <input className={box} value={editor.data.quickReply} onChange={(e) => patch({ quickReply: e.target.value })} placeholder="אישור, ביטול" />
              </Field>
              <div className="flex gap-3">
                <Field label="טקסט כפתור קישור (אופציונלי)">
                  <input className={box} value={editor.data.urlText} onChange={(e) => patch({ urlText: e.target.value })} placeholder="צפייה בדשבורד" />
                </Field>
                <Field label="בסיס ה-URL (אופציונלי)">
                  <input className={box} dir="ltr" value={editor.data.urlBase} onChange={(e) => patch({ urlBase: e.target.value })} placeholder="{{APP_URL}}/" />
                </Field>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} className="rounded-xl bg-emerald-600 text-white px-5 py-2 text-[14px] font-bold">שמירה</button>
              <button onClick={() => setEditor(null)} className="rounded-xl bg-black/5 text-[var(--ink-secondary)] px-5 py-2 text-[14px] font-semibold">ביטול</button>
            </div>
            <p className="text-[12px] text-[var(--ink-secondary)] mt-3">אחרי שמירה — הריצו סנכרון (/api/templates/sync) ואשרו את התבנית ב-WhatsApp Manager.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'slate' | 'cyan'; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    ok: 'bg-emerald-100 text-emerald-700',
    warn: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-600',
    cyan: 'bg-cyan-100 text-cyan-700',
  };
  return <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block flex-1">
      <span className="block text-[12px] text-[var(--ink-secondary)] mb-1.5">{label}</span>
      {children}
    </label>
  );
}
