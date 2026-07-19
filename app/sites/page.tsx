import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listSites, listContent } from '@/lib/db';
import SitesManager from '@/components/SitesManager';

export const dynamic = 'force-dynamic';

export default async function SitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const sites = await listSites();
  const content = sites[0] ? await listContent(sites[0].id) : [];

  return (
    <main className="max-w-[820px] mx-auto px-5 md:px-8 pt-10 pb-16">
      <div className="mb-1 text-[13px] font-bold text-emerald-600">HELIX Rank</div>
      <h1 className="text-[clamp(24px,4.5vw,36px)] font-extrabold tracking-tight mb-1">האתרים שלי</h1>
      <p className="text-[var(--ink-secondary)] text-[15px] mb-6">
        הוסיפו אתר, חברו GSC ו-WordPress (נשמר) — וכל התוכן שנכתב יישמר תחת האתר.
      </p>
      <SitesManager sites={sites} content={content} />
    </main>
  );
}
