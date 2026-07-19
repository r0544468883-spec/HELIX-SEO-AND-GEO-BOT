'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
      });
      if (error) throw error;
      setSent(true);
    } catch (e) {
      setErr('שגיאה: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-[420px] mx-auto px-5 pt-24">
      <div className="mb-1 text-[13px] font-bold text-emerald-600">HELIX Rank</div>
      <h1 className="text-[28px] font-extrabold mb-2">התחברות</h1>
      <p className="text-[var(--ink-secondary)] text-[15px] mb-6">נשלח לכם קישור כניסה למייל.</p>
      {sent ? (
        <p className="text-[15px] text-emerald-700">נשלח קישור ל-{email}. בדקו את המייל 📩</p>
      ) : (
        <div className="space-y-3">
          <input
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-emerald-500"
            dir="ltr"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-emerald-600 text-white px-6 py-3 font-bold disabled:opacity-50">
            {busy ? 'שולח…' : 'שלח קישור כניסה'}
          </button>
          {err && <p className="text-[14px] text-red-600">{err}</p>}
        </div>
      )}
    </main>
  );
}
