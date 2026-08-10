// HELIX Autonomy Switch — mode resolution. Fail-safe & downgrade-only.

import type { AutonomyMode } from './types';
import { needsRiskAck } from './types';

export interface AutonomyStore {
  getSettings(
    scopeId: string, // Rank: a site_id
    featureKey: string,
  ): Promise<{ mode: AutonomyMode; risk_ack: boolean } | null>;
}

export async function resolveMode(
  store: AutonomyStore,
  scopeId: string,
  featureKey: string,
): Promise<AutonomyMode> {
  let row: { mode: AutonomyMode; risk_ack: boolean } | null = null;
  try {
    row = await store.getSettings(scopeId, featureKey);
  } catch {
    return 'advisor';
  }
  if (!row) return 'advisor';
  if (row.mode === 'autopilot' && needsRiskAck(featureKey) && !row.risk_ack) {
    return 'approve';
  }
  return row.mode;
}
