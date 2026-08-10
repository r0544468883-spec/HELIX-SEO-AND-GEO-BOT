// Rank binding of the autonomy switch. Site-scoped: autonomy_settings.scope_id
// holds a site_id. The act loop runs with the service-role admin client.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AutonomyStore } from './resolve';
import type { AutonomyMode } from './types';

export function adminStore(admin: SupabaseClient): AutonomyStore {
  return {
    async getSettings(scopeId, featureKey) {
      const { data } = await admin
        .from('autonomy_settings')
        .select('mode, risk_ack')
        .eq('scope_id', scopeId)
        .eq('feature_key', featureKey)
        .maybeSingle();
      return (data as { mode: AutonomyMode; risk_ack: boolean } | null) ?? null;
    },
  };
}
