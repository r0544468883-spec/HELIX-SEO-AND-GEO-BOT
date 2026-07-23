import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HELIX Rank — סוכן SEO + GEO',
  description: 'בוט SEO+GEO דו-לשוני. מתחילים מ-Striking Distance: הרווח המהיר ביותר מ-Search Console.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <nav className="border-b border-black/10 bg-white">
          <div className="max-w-[860px] mx-auto px-5 md:px-8 py-3 flex items-center gap-5 text-[14px]">
            <a href="/" className="font-extrabold text-emerald-600">HELIX Rank</a>
            <a href="/" className="text-[var(--ink-secondary)] hover:text-black">GSC Intelligence</a>
            <a href="/geo" className="text-[var(--ink-secondary)] hover:text-black">GEO Monitor</a>
            <a href="/write" className="text-[var(--ink-secondary)] hover:text-black">כתיבה ופרסום</a>
            <a href="/sites" className="text-[var(--ink-secondary)] hover:text-black">האתרים שלי</a>
            <a href="/templates" className="text-[var(--ink-secondary)] hover:text-black">תבניות</a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
