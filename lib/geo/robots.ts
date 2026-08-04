// GEO-ready robots.txt generator. Encodes the 2026 AI-bot policy: allow the
// search-time crawlers (so you get cited) while letting the site opt out of
// specific training crawlers. Mirrors the hebrew-seo-geo-toolkit Step 9 block.

export type BotPolicy = {
  sitemapUrl?: string;
  blockTraining?: boolean; // block GPTBot/Google-Extended/CCBot (training) — keeps SEARCH bots open
  blockMeta?: boolean; // opt out of Meta AI (Meta-ExternalAgent)
};

// Search-time crawlers — ALWAYS allow these, they decide if AI cites you.
const SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'ClaudeBot', 'anthropic-ai', 'Claude-Web', 'MistralAI-User', 'Googlebot', 'Bingbot'];
// Training crawlers — allowing = broader presence; blocking = opt out of training only.
const TRAINING_BOTS = ['GPTBot', 'Google-Extended', 'CCBot', 'Applebot-Extended'];

export function generateRobotsTxt(policy: BotPolicy = {}): string {
  const blocks: string[] = [];
  for (const bot of SEARCH_BOTS) blocks.push(`User-agent: ${bot}\nAllow: /`);
  for (const bot of TRAINING_BOTS) {
    blocks.push(`User-agent: ${bot}\n${policy.blockTraining ? 'Disallow: /' : 'Allow: /'}`);
  }
  blocks.push(`User-agent: Meta-ExternalAgent\n${policy.blockMeta ? 'Disallow: /' : 'Allow: /'}`);
  let out = blocks.join('\n\n');
  if (policy.sitemapUrl) out += `\n\nSitemap: ${policy.sitemapUrl}`;
  return out + '\n';
}
