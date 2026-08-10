'use server';

import { createClient } from '@/lib/supabase/server';
import type { AutonomyMode } from '@/lib/autonomy/types';

// Rank autonomy is SITE-scoped: autonomy_settings.scope_id holds a site_id.
export async function setSiteAutonomy(scopeId: string, featureKey: string, mode: AutonomyMode, riskAck: boolean): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('autonomy_settings').upsert(
    { scope_id: scopeId, feature_key: featureKey, mode, risk_ack: riskAck, updated_at: new Date().toISOString() },
    { onConflict: 'scope_id,feature_key' },
  );
  return error ? { error: error.message } : { ok: true };
}
