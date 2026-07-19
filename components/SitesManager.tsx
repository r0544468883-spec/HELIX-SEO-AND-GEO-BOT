'use client';

import { useState } from 'react';
import { createSiteAction, saveWpConnectionAction, saveGscConnectionAction } from '@/app/actions-site';

type Site = { id: string; url: string; cms_type: string | null; content_lang: string };
type ContentRow = { id: string; title: string | null; status: string; published_url: string | null };

const box = 'w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-emerald-500';

export default function SitesManager({ sites, content }: { sites: Site[]; content: ContentRow[] }) {
  const [rows, setRows] = useState<Site[]>(sites);
  const [url, setUrl] = useState('');
  const [lang, setLang] = useState<'he' | 'en' | 'both'>('he');
  const [msg, setMsg] = useState<string | null>(null);

  // WP form (for the selected site)
  const [selected, setSelected] = useState(sites[0]?.id ?? '');
  const [wpUrl, setWpUrl] = useState('');
  const [wpUser, setWpUser] = useState('');
  const [wpPass, setWpPass] = useState('');

  async function addSite() {
    if (!url.trim()) return setMsg('הכניסו כתובת אתר.');
    const res = await createSiteAction(url.trim(), lang);
    if ('error' in res && res.error) return setMsg('שגיאה: ' + res.error);
    setRows((r) => [...r, { id: res.id as string, url: url.trim(), cms_type: null, content_lang: lang }]);
    if (!selected) setSelected(res.id as string);
    setUrl('');
    setMsg('אתר נוסף ✓');
  }

  async function saveWp() {
    if (!selected) return setMsg('בחרו אתר.');
    const res = await saveWpConnectionAction(selected, { base_url: wpUrl, username: wpUser, app_password: wpPass });
    setMsg('error' in res && res.error ? 'שגיאה: ' + res.error : 'WordPress נשמר ✓');
  }

  async function saveGsc() {
    if (!selected) return setMsg('בחרו אתר.');
    const res = await saveGscConnectionAction(selected);
    setMsg('error' in res && res.error ? 'שגיאה: ' + res.error + ' (חברו GSC קודם במסך הראשי)' : 'GSC נשמר לאתר ✓');
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-black/10 p-5 space-y-3">
        <h2 className="text-[16px] font-bold">הוסף אתר</h2>
        <div className="grid grid-cols-[1fr_auto_auto] gap-3">
          <input className={box} dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          <select className={box} value={lang} onChange={(e) => setLang(e.target.value as 'he' | 'en' | 'both')}>
            <option value="he">עברית</option>
            <option value="en">English</option>
            <option value="both">דו-לשוני</option>
          </select>
          <button onClick={addSite} className="rounded-xl bg-emerald-600 text-white px-5 py-2 text-[14px] font-bold">הוסף</button>
        </div>
        {msg && <p className="text-[13px] text-[var(--ink-secondary)]">{msg}</p>}
      </section>

      {rows.length > 0 && (
        <section className="rounded-xl border border-black/10 p-5 space-y-4">
          <h2 className="text-[16px] font-bold">חיבורים</h2>
          <select className={box} value={selected} onChange={(e) => setSelected(e.target.value)}>
            {rows.map((s) => (
              <option key={s.id} value={s.id}>{s.url}</option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-3">
            <input className={box} dir="ltr" value={wpUrl} onChange={(e) => setWpUrl(e.target.value)} placeholder="WP URL" />
            <input className={box} dir="ltr" value={wpUser} onChange={(e) => setWpUser(e.target.value)} placeholder="WP user" />
            <input className={box} dir="ltr" type="password" value={wpPass} onChange={(e) => setWpPass(e.target.value)} placeholder="App password" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveWp} className="rounded-lg bg-black text-white px-4 py-2 text-[14px] font-semibold">שמור WordPress</button>
            <button onClick={saveGsc} className="rounded-lg bg-black/5 text-[var(--ink-secondary)] px-4 py-2 text-[14px] font-semibold">שמור GSC לאתר</button>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-[16px] font-bold mb-3">תוכן שנשמר</h2>
        {content.length === 0 ? (
          <p className="text-[14px] text-[var(--ink-secondary)]">עוד אין תוכן שמור.</p>
        ) : (
          <div className="space-y-2">
            {content.map((c) => (
              <div key={c.id} className="rounded-lg border border-black/10 p-3 flex items-center justify-between">
                <span className="text-[14px] font-semibold truncate">{c.title ?? 'ללא כותרת'}</span>
                <span className="text-[12px] text-[var(--ink-secondary)]">{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
