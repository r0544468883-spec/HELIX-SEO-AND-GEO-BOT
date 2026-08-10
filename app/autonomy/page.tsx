import { createClient } from '@/lib/supabase/server';
import SiteAutonomySwitch from '@/components/SiteAutonomySwitch';
import type { AutonomyMode } from '@/lib/autonomy/types';

export const dynamic = 'force-dynamic';

const FEATURES: { key: string; label: string; risky: boolean }[] = [
  { key: 'rank.publish', label: '🚀 פרסום חי ל-CMS', risky: true },
  { key: 'rank.patch', label: '🩹 פרסום patch לציטוטי AI', risky: true },
];

export default async function AutonomyPage() {
  const supabase = await createClient();
  const { data: sites } = await supabase.from('sites').select('id, url').order('created_at');
  const list = (sites ?? []) as { id: string; url: string }[];

  // Load stored settings for all sites at once.
  const settings: Record<string, Record<string, { mode: AutonomyMode; risk_ack: boolean }>> = {};
  if (list.length) {
    const { data: rows } = await supabase.from('autonomy_settings').select('scope_id, feature_key, mode, risk_ack').in('scope_id', list.map((s) => s.id));
    for (const r of (rows ?? []) as { scope_id: string; feature_key: string; mode: AutonomyMode; risk_ack: boolean }[]) {
      (settings[r.scope_id] ??= {})[r.feature_key] = { mode: r.mode, risk_ack: r.risk_ack };
    }
  }

  return (
    <main dir="rtl" style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(20px,4vw,48px)' }}>
      <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, margin: '0 0 6px' }}>⚙️ מתג אוטונומיה — לכל אתר</h1>
      <p style={{ color: 'var(--ink-2, #6b7280)', fontSize: 14, margin: '0 0 22px' }}>כמה חופש לתת ל-Rank לפרסם לבד. ברירת מחדל בטוחה: תוכן נשאר מוכן-לפרסום עד שתדליקו אוטופיילוט לאתר.</p>
      {list.length === 0 && <p style={{ color: 'var(--ink-2, #6b7280)' }}>אין אתרים עדיין — הוסיפו אתר כדי להגדיר מתג.</p>}
      {list.map((site) => (
        <section key={site.id} style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px', direction: 'ltr', textAlign: 'start' }}>{site.url}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            {FEATURES.map((f) => (
              <SiteAutonomySwitch key={f.key} scopeId={site.id} featureKey={f.key} label={f.label} risky={f.risky}
                initialMode={settings[site.id]?.[f.key]?.mode ?? 'advisor'} initialRiskAck={settings[site.id]?.[f.key]?.risk_ack ?? false} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
