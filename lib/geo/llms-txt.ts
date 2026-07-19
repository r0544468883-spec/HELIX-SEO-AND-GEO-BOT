// Generate an llms.txt — the manifest that helps AI engines find key pages.
export type LlmsPage = { path: string; description: string };

export function generateLlmsTxt(site: { name: string; summary?: string }, pages: LlmsPage[]): string {
  const lines: string[] = [`# ${site.name}`];
  if (site.summary) lines.push(`> ${site.summary}`, '');
  if (pages.length) {
    lines.push('## Pages');
    for (const p of pages) lines.push(`- ${p.path}: ${p.description}`);
  }
  return lines.join('\n') + '\n';
}
