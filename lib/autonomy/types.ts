// HELIX Autonomy Switch — canonical types. Source: helix/PRODUCTS/autonomy-reference.
// Rank is site-scoped: the "tenant" id passed to resolveMode is a site_id.

export type AutonomyMode = 'advisor' | 'approve' | 'autopilot';
export type RiskClass = 'internal' | 'outbound' | 'money' | 'tos';

export const RISK_BY_FEATURE: Record<string, RiskClass> = {
  'rank.publish': 'outbound',   // publishes a live page to an external CMS
  'rank.patch': 'outbound',
  'rank.edit_page': 'tos',
  'rank.meta_fix': 'tos',
};

export function riskOf(featureKey: string): RiskClass {
  return RISK_BY_FEATURE[featureKey] ?? 'outbound';
}

export function needsRiskAck(featureKey: string): boolean {
  return riskOf(featureKey) !== 'internal';
}
