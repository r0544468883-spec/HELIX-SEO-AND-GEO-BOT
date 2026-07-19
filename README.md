# HELIX Rank — סוכן SEO + GEO 🚀

בוט אוטומטי דו-לשוני (עברית-first + אנגלית): מחקר מילים → כתיבת תוכן → פרסום לכל CMS → מעקב דירוגים בגוגל **ובמנועי AI**. חלק מאקו-סיסטם HELIX.

## סטטוס
🟢 **שלב 1+ נבנה — GSC Intelligence מלא + GSC OAuth + Auth** (build נקי, 0 שגיאות).
- **מסך `/`** — מנתח GSC עם 4 ניתוחים בטאבים: **Striking Distance · קניבליזציה · שאלות→FAQ · תוכן דועך**. הדבק ייצוא GSC (CSV/JSON) או משוך חי → תוכנית פעולה בעברית לכל אחד.
- **GSC OAuth** — `/api/gsc/auth` + `/api/gsc/callback` (חיבור אמיתי, token ב-cookie) + `listSites`.
- **Auth** — Supabase (login במגיק-לינק `/login` + middleware לרענון session).
- **`/api/analyze`** — endpoint מאוחד (4 סוגי ניתוח + משיכה חיה מ-GSC).
- **מנועים:** `lib/striking-distance`, `lib/gsc-analyses` (קניבליזציה/FAQ/דועך), `lib/gsc` (parsing+API), `lib/gsc-oauth`, `lib/supabase/*`.

**להרצה חיה:** `.env.local` (ראה `.env.example`) עם `ANTHROPIC_API_KEY` (+ Google OAuth ל-GSC, + Supabase ל-Auth) → `npm run dev`.

**נבנה גם:** מנוע תוכן (Claude+baldiga+schema) + פרסום WordPress (`/write`) · **מנוע GEO** (`/geo`) — Citation Score + Share-of-Voice + Gap Board מול **4 מנועי AI** (ChatGPT/Gemini/Claude/Perplexity, כולם web-search) · **שכבת Supabase** (`lib/db`, `/sites`) — אתרים, חיבורים (WP/GSC נשמרים), content_pieces.

**routes:** `/` (GSC Intelligence) · `/geo` (GEO Monitor) · `/write` (כתיבה+פרסום) · `/sites` (אתרים+חיבורים) · `/login` · `/api/{analyze,generate,publish,geo,gsc/*}`

**הבא:** בוט טלגרם/וואטסאפ (הבידול) · cron/אוטונומיה (drip/דייג'סט) · העמדה live (מסלול A).

## Stack
- **Next.js 15** (App Router) + React 18 + TypeScript + Tailwind + shadcn/ui (RTL) — כמו helix-ops.
- **Supabase** (Auth, DB, Storage, RLS per-site).
- **Claude** (Anthropic API) לכתיבה/נרטיב; **baldiga** להגהת עברית.
- **Ollama** (אופציונלי) למשימות נפח (סיווג/סנטימנט) — הוזלת עלות.
- **geo-scan.ts** (מ-`helix/lib/`) ל-GEO/citation + crawlability — reuse.

## מקורות דאטה
- **Google Search Console** (OAuth, read-only) — חובה. בסיס ל-GSC Intelligence.
- **Semrush/Ahrefs API** (volume/difficulty/מתחרים) — client BYO-key או שכבה משותפת.
- **DataForSEO/Serpapi** — חלופה זולה.

## הבידול (אחרי סקירת 19 מתחרים — כולל WriterGPT)
1. **בוט רב-ערוצי** (טלגרם/וואטסאפ/מייל) — ה-white-space היחיד ב-0/19.
2. **איכות-עברית baldiga** (לא רק "תמיכה" — WriterGPT כבר תומך עברית+RTL).
3. **אקו-סיסטם HELIX** (engagement/Lead Radar/מוניטין/Agent OS).
4. **שוק ישראלי + מסירה בוואטסאפ** + **Ollama on-prem** לפרטיות.

## מבנה התיקייה
```
helix-rank/
├── README.md            ← את הקובץ הזה
├── BUILD-PLAN.md        ← ה-MVP, שלבים, החלטות פתוחות
├── .env.example         ← משתני סביבה
├── docs/
│   ├── SPEC.md          ← האפיון המלא (מוצר 4)
│   └── GSC-PROMPTS.md   ← 7 הפרומפטים ל-GSC Intelligence
├── supabase/
│   └── schema.sql       ← מודל הנתונים
├── app/                 ← Next.js routes (לבנייה)
├── lib/                 ← מנועים (research/content/publish/geo)
└── components/          ← UI
```

## התחלה מהירה (כשנתחיל לבנות)
1. `npx create-next-app@latest` על התיקייה (או להעתיק מבנה מ-helix-ops).
2. פרויקט Supabase → הרצת `supabase/schema.sql`.
3. `.env.local` מ-`.env.example`.
4. שלב 1 של ה-BUILD-PLAN: Auth + sites + חיבור GSC + Striking Distance (ה-wow).

ראה **BUILD-PLAN.md** לפירוט.
