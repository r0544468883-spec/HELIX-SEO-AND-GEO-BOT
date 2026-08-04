# HELIX Rank — מודול Entity / Knowledge-Graph 🧬

> **השכבה החסרה:** לגרום ל-AI לדעת *מי אתה כישות* — לא רק אם עמוד מסוים מוכן לציטוט.
> נשען על התשתית הקיימת (engines, citation, aeo-audit) — שכבה אחת חדשה, לא מוצר חדש.
> תאריך: 2026-08-04 · סטטוס: אפיון לבנייה · ממשיך את [SPEC.md](SPEC.md) §3.5.

---

## 0. למה זה, ולמה עכשיו

הרעיון הגיע מהצעת שירות ב-LinkedIn: *"אנחנו כותבים לך דף ויקיפדיה שגוגל מאנדקס ו-ChatGPT/Claude/Gemini מצטטים."* השירות הידני הזה בעייתי (עריכה-בתשלום אסורה, מחיקות, תלוי-אדם), אבל **השכבה שמתחתיו — בניית וחיזוק ישות שה-AI מזהה — היא GEO אמיתי וניתן לאוטומציה.**

**מה HELIX Rank כבר עושה (ולא נבנה מחדש):** Citation Score + Share-of-Voice ([citation.ts](../lib/geo/citation.ts)), 7 מנועי תשובה ([engines.ts](../lib/geo/engines.ts) + [brightdata.ts](../lib/geo/brightdata.ts)), AEO audit של עמוד חי ([aeo-audit.ts](../lib/seo/aeo-audit.ts)), llms.txt, JSON-LD אוטומטי, תנועת-AI מ-GA4.

**החור:** אין שום דבר בשכבת ה**ישות**. חיפוש `wikidata / wikipedia / knowledge-panel / knowledge-graph / entity` בכל הריפו = 0 תוצאות. המוצר מודד "האם מצטטים עמוד" — לא "האם ה-AI יודע מי אתה כ**גורם**".

**הבידול:** enso/seo-agent מודדים ציטוטים. אף אחד לא מטפל ב-**entity presence** אוטומטית. זה gap ריאלי.

---

## 1. מה המודול עושה — שלוש יכולות

### 1.1 Entity Audit — "כמה AI מכיר אותך כישות?" (נקודת הכניסה + לימגנט לידים)
סורק ישות (מותג/חברה/אדם) ומחזיר **Entity Score 0-100** + פערים ניתנים-לפעולה. אפס עלות-כתיבה, מהיר, ומצוין כ-lead magnet (score-as-lead-magnet, בהשראת [BarBot]):

| בדיקה | מקור | מה נבדק |
|---|---|---|
| **פריט Wikidata** | Wikidata API (`wbsearchentities`) | האם קיים פריט? מקושר? כמה תכונות מלאות? |
| **ערך ויקיפדיה** | Wikipedia REST (`/page/summary`) | קיים ערך? באיזו שפה? אורך/בשלות |
| **Knowledge Panel** | סריקת SERP (BrightData, תשתית קיימת) | האם גוגל מציג panel לשם הישות? |
| **זיהוי ע"י LLM** | `askEngine` הקיים | "מה זה X?" → האם התשובה נכונה, שגויה, או "לא יודע"? |
| **עקביות ישות** | fetch + regex | שם/תיאור/לוגו עקביים באתר, סושיאל, סכמה? |
| **sameAs graph** | JSON-LD של האתר | האם יש `Organization.sameAs` שמקשר לפרופילים הרשמיים? |

הפלט: ציון, פירוט per-בדיקה בעברית (כמו `AeoReport`), ורשימת פערים ממוינת לפי impact.

### 1.2 Wikidata Automation — הזווית שאף אחד לא עושה 🎯
בניגוד לוויקיפדיה, **Wikidata סובלני:** מסד-נתונים מובנה, בלי מבחן-בולטות מחמיר, **API רשמי לכתיבה** (`wbeditentity`) — ניתן לאוטומציה מלאה ובטוחה. וזה מקור שגוגל (knowledge graph) וה-LLM-ים מושכים ממנו.

- **צור/עדכן פריט** — שם, תיאור, aliases, תכונות (P31 instance-of, official website, industry, founder, logo…).
- **קישור sameAs** — מחבר את הפריט לפרופילים הרשמיים (אתר, LinkedIn, GitHub), מה שמחזק זיהוי-ישות.
- **גילוי בטוח (mandatory):** כל עריכה חתומה בחשבון bot מוצהר עם summary-edit שקוף. אנחנו **לא** נוגעים בוויקיפדיה עצמה אוטומטית — Wikidata בלבד.

### 1.3 Notability Readiness — במקום לדחוף ערך שיימחק
ויקיפדיה דורשת *"significant coverage in reliable, independent sources"*. המודול **לא** כותב ערך — הוא מודד מוכנות ומזין את מנוע-התוכן הקיים:

- סורק מקורות צד-ג' קיימים (חיפוש חדשותי/רשת) על הישות; מסווג אמין/בלתי-תלוי מול עצמי/ממומן.
- מחזיר **Readiness verdict**: "עדיין לא — חסרים N מקורות בלתי-תלויים משמעותיים; הנה הפערים."
- הפערים נכתבים כ-`gsc_opportunities` מסוג חדש `entity_source_gap` → נכנסים ללולאת התוכן שכבר קיימת (§3.5.1 ב-SPEC).
- **מעבר סף** → המלצה: הגש דרך **AfC (Articles for Creation)** עם גילוי COI — ידני, מודרך, לא אוטומטי.

---

## 2. ארכיטקטורה — איפה זה יושב

מבנה תואם ל-`lib/geo/*` הקיים. שכבה דקה, שימוש-חוזר במנועים:

```
lib/entity/
  wikidata.ts     — search / read / write (wbsearchentities, wbgetentities, wbeditentity)
  wikipedia.ts    — page summary + notability sources scan
  knowledge.ts    — knowledge-panel detection (דרך brightdata.ts הקיים)
  audit.ts        — מרכיב Entity Score מכל הבדיקות (מקביל ל-seo/aeo-audit.ts)
app/api/entity/
  audit/route.ts  — POST { name, domain } → EntityReport
  wikidata/route.ts — POST { action:'upsert', item } → מזהה פריט (מאחורי אישור-אדם)
app/entity/page.tsx — טאב חדש (או סקשן בדף /geo הקיים)
```

**שימוש-חוזר:** `knowledge.ts` קורא ל-BrightData דרך [brightdata.ts](../lib/geo/brightdata.ts); זיהוי-LLM דרך `askEngine` מ-[engines.ts](../lib/geo/engines.ts); הפערים זורמים ל-`content-engine.ts` הקיים. אין כפילות.

---

## 3. סכמת DB — טבלאות חדשות (תואם [schema.sql](../supabase/schema.sql))

```sql
-- --- Entity / Knowledge-Graph ---
create table if not exists entity_profiles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  entity_name text not null,
  entity_type text not null default 'organization',   -- organization/person/product
  wikidata_qid text,                                   -- Q-number אם קיים/נוצר
  wikipedia_url text,
  same_as text[] not null default '{}',                -- פרופילים רשמיים מקושרים
  created_at timestamptz not null default now(),
  unique (site_id, entity_name)
);

create table if not exists entity_audits (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  score int,                                           -- Entity Score 0-100
  checks_json jsonb,                                   -- פירוט per-בדיקה (כמו AeoReport)
  notability_ready boolean not null default false,
  checked_at timestamptz not null default now()
);
```

- `entity_source_gap` נוסף כ-`type` חוקי ב-`gsc_opportunities` הקיים (אין טבלה חדשה — reuse).
- RLS: אותה תבנית `owns_site(site_id)` כמו כל טבלת-בת.

---

## 4. UX — נקודות מגע

- **Entity Score card** ב-[/geo](../app/geo/page.tsx) לצד Citation Score — מבט-על מאוחד של "נוכחות-AI".
- **Audit חינמי (gated)** בעמוד נחיתה ציבורי: הזן שם מותג → קבל Entity Score → email-gate לפירוט המלא. הזרם → CRM.
- **Wikidata upsert** תמיד מאחורי **אישור-אדם** (diff לפני שליחה) — לא autopilot. גילוי-בוט מוצג למשתמש.
- **Notability board** — פערי-מקורות פתוחים + סטטוס ה-patch שכל אחד קיבל (מקביל ל-Gap Board הקיים).

---

## 5. גבולות ואתיקה (חובה, לא אופציונלי)

1. **ויקיפדיה — לעולם לא אוטומטי.** קריאה בלבד (מדידה). כתיבה = הכוונה ידנית דרך AfC + גילוי COI.
2. **Wikidata — אוטומטי מותר, אך עם גילוי-בוט מוצהר** וטון עובדתי בלבד.
3. **אין הזרקת מקורות מזויפים/ממומנים** כ"בלתי-תלויים" — הסיווג חייב להיות כן, אחרת המוצר מסכן את הלקוח.
4. **המודול מודד ומכין; הוא לא "פורץ".** כל ערך המנוף שלו נובע מלהפוך ישות ל*ראויה-לציון באמת*, לא מלרמות מנוע.

---

## 6. תוכנית בנייה (מדורגת)

| שלב | תוצר | מאמץ |
|---|---|---|
| **A — Audit (MVP)** | `lib/entity/{wikidata,wikipedia}.ts` + `audit.ts` + `/api/entity/audit` + כרטיס ב-/geo | קטן — reuse מלא |
| **B — Lead magnet** | עמוד audit ציבורי + email-gate + הזרמה ל-CRM | קטן |
| **C — Wikidata write** | `wikidata.ts` write + UI diff + אישור-אדם | בינוני (חשבון-בוט + auth) |
| **D — Notability loop** | סריקת מקורות → `entity_source_gap` → מנוע תוכן | בינוני — נשען על content-engine |

**המלצה:** שלב A+B נותנים 80% מהערך (audit + lead magnet) בעלות נמוכה. C+D בהמשך.
