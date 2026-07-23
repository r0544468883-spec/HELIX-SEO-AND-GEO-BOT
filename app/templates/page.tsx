import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listSites } from '@/lib/db';
import TemplatesManager from '@/components/TemplatesManager';

export const dynamic = 'force-dynamic';

// Templates manager — view the built-in WhatsApp catalog and upload/edit/delete your
// OWN templates per site. A custom entry with the same key OVERRIDES the built-in.
// SITE-SCOPED: the manager resolves a site from ?site= (or the first site) and every
// call to /api/templates/{list,custom} carries that site_id.
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const sites = await listSites();
  const { site } = await searchParams;
  const initialSite = (site && sites.some((s) => s.id === site) ? site : sites[0]?.id) ?? '';

  return (
    <main className="max-w-[820px] mx-auto px-5 md:px-8 pt-10 pb-16">
      <div className="mb-1 text-[13px] font-bold text-emerald-600">HELIX Rank</div>
      <h1 className="text-[clamp(24px,4.5vw,36px)] font-extrabold tracking-tight mb-1">תבניות WhatsApp</h1>
      <p className="text-[var(--ink-secondary)] text-[15px] mb-6">
        צפייה בתבניות המובנות (התראות ודוחות) והעלאת תבניות משלכם לכל אתר. תבנית מותאמת עם אותו מפתח דורסת את המובנית.
      </p>
      <TemplatesManager sites={sites} initialSite={initialSite} />
    </main>
  );
}
