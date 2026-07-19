# HELIX Rank — תוכנית בנייה (Build Plan)

## האם אפשר להתחיל לבנות? ✅ כן.
האפיון (`docs/SPEC.md`) מפורט דיו: ארכיטקטורה, מודל נתונים, agent logic, מסכים, roadmap, ולוגיקת GSC (`docs/GSC-PROMPTS.md`). **אין חוסר קריטי.** מה ש"חסר" הן החלטות-הקמה + credentials — שמגיעים בזמן הבנייה, לא חוסמים.

## החלטות פתוחות (לא חוסמות — לסמן ואפשר להתחיל)
| החלטה | ברירת מחדל מומלצת |
|---|---|
| Repo/stack | אפליקציית Next.js 15 עצמאית (כמו helix-ops), reuse דפוסים |
| CMS ראשון | **WordPress** (REST API) → אז Wix/Webflow/headless |
| ספק keyword-data | Semrush (או DataForSEO זול) — client BYO-key או שכבה משותפת (per-plan) |
| LLM | Claude (דפוס `content-agent` מ-helix-ops) + baldiga לעברית |
| Ollama | אופציונלי — למשימות נפח (סיווג/סנטימנט) |

## Credentials שיידרשו (בזמן בנייה)
- פרויקט **Supabase** (URL + anon + service_role).
- **ANTHROPIC_API_KEY**.
- **Google OAuth app** (Search Console API, read-only) — client_id/secret.
- **Semrush API key** (או DataForSEO).
- (בהמשך) Meta/Telegram/WhatsApp tokens לערוצי הבוט.

## MVP (מה בונים ראשון) — 3 שלבים ל-"בוט חי שמוכר"
### שלב 1 — הליבה + ה-wow
- Auth + `sites` (RLS) + חיבור **GSC (OAuth)**.
- **GSC Intelligence — Striking Distance** (`docs/GSC-PROMPTS.md` prompt 1) → מסך "GSC Opportunities" עם action-plan.
- *למה:* זה ה-hook שממיר — רגע שמחברים GSC, הבוט מחזיר מיד "5 מילים במקום 8 שאפשר לקפוץ ל-3".

### שלב 2 — מנוע התוכן
- מחקר (Semrush volume/difficulty) + **מנוע תוכן** (Claude + baldiga לעברית + schema + תמונות).
- **Check Modes** (Rank Math/Yoast/HCU §3.8.11) — ציון עד סף עובר.
- HITL: אישור לפני פרסום.

### שלב 3 — פרסום + מעקב
- **adapter WordPress** (פרסום + meta + schema).
- מעקב דירוגים (GSC) + נרטיב.
- **GEO בסיסי:** `llms.txt` + citation tracking (על geo-scan.ts).

→ אחרי MVP: GEO מלא (Citation-Gap→Patch), any-CMS, בוט רב-ערוצי, §3.8 gap-closers, Experiment Ledger. (roadmap מלא ב-SPEC §11).

## reuse מ-helix-ops / helix (לא לבנות מאפס)
- **content-agent + humanize/baldiga** — דפוס יצירת תוכן + הגהת עברית.
- **distribution adapters** — WordPress/Wix/Webflow וכו' (28 קיימים).
- **geo-scan.ts** (`helix/lib/`) — GEO/citation/crawlability.
- **מנוע בוט/שיח** (`HELIX-BOTS-CONVERSATION-OPS`) — לערוצי טלגרם/וואטסאפ/מייל.
- **Agent OS** (`lib/agentos`) — דייג'סט יומי + scheduler.

## הגדרת "בוט מוכן למכירה"
מחבר GSC → מקבל דוח Striking Distance → מאשר → הבוט כותב (עברית baldiga) → מפרסם ל-WordPress → עוקב אחרי דירוג → שולח דייג'סט יומי. זה ה-MVP המוכר.
