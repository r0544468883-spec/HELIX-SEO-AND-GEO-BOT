// Unified publish dispatch — one interface over all CMS adapters (any-CMS).
import { publishToWordPress, type PublishInput, type PublishResult } from './wordpress';
import { publishToWebflow } from './webflow';
import { publishToWix } from './wix';
import { publishToWebhook } from './webhook';

export type { PublishInput, PublishResult } from './wordpress';
export const SUPPORTED_CMS = ['wordpress', 'webflow', 'wix', 'webhook'] as const;

// Dispatch by CMS type. `config` is the adapter-specific credentials object.
export async function publishTo(
  cms: string,
  config: Record<string, unknown>,
  input: PublishInput
): Promise<PublishResult> {
  switch (cms) {
    case 'wordpress':
      return publishToWordPress(config as never, input);
    case 'webflow':
      return publishToWebflow(config as never, input);
    case 'wix':
      return publishToWix(config as never, input);
    case 'webhook':
      return publishToWebhook(config as never, input);
    default:
      return { ok: false, error: `cms_not_supported_${cms}` };
  }
}
