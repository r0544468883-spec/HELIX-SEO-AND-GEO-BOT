// Conversational agent — the brain behind multi-channel control. Classifies an
// inbound message into an intent, runs the matching HELIX Rank tool, and replies
// in Hebrew. This is what lets users operate the bot from Telegram/WhatsApp/email.
import { claude, parseJson } from '../claude';
import { humanizeHe } from '../hebrew';
import { generateArticle } from '../content-engine';
import { createAdminClient } from '../supabase/admin';

export type BotContext = { siteUrl?: string | null; siteId?: string | null; lang?: 'he' | 'en' };

type IntentName = 'write' | 'rankings' | 'opportunities' | 'scan' | 'geo' | 'report' | 'help' | 'other';
type Intent = { intent: IntentName; topic?: string };

async function classify(message: string): Promise<Intent> {
  const raw = await claude(
    'סווג את הודעת המשתמש לסוכן SEO/GEO. החזר JSON בלבד: ' +
      '{"intent":"write|rankings|opportunities|scan|geo|report|help|other","topic":"הנושא אם רלוונטי"}. ' +
      'write = בקשה לכתוב מאמר/תוכן; ' +
      'rankings = דירוגים / מיקומים / "מה המצב" / מילים בטופ 10; ' +
      'opportunities = הזדמנויות / Striking Distance / מילות מפתח לשיפור; ' +
      'scan = בקשה להריץ סריקה / לבדוק דירוג עכשיו / רענון נתונים; ' +
      'geo = נוכחות ב-AI / ציטוטים / נראות במנועי תשובות; ' +
      'report = דוח שבועי / סיכום תקופה; ' +
      'help = עזרה / פקודות.',
    message,
    120
  ).catch(() => '');
  return parseJson<Intent>(raw) ?? { intent: 'other' };
}

const HELP =
  'אני HELIX Rank 🤖 מה אפשר לעשות:\n' +
  '• "כתוב מאמר על …" — כותב מאמר SEO+GEO בעברית\n' +
  '• "דירוגים" / "מה המצב" — מיקומים, דירוג ממוצע ומילים בטופ 10\n' +
  '• "הזדמנויות" / "מילות מפתח" — Striking Distance ופערים לשיפור\n' +
  '• "סריקה" / "בדוק דירוג" — מריץ בדיקת דירוג/רענון עכשיו\n' +
  '• "נוכחות ב-AI" / "GEO" — Citation Score וציטוטים במנועי תשובות\n' +
  '• "דוח" — הדוח השבועי המסכם\n' +
  '• "עזרה" — התפריט הזה';

// Real numbers when we know which site the chat is bound to; otherwise guidance.
async function rankingsSummary(siteId?: string | null): Promise<string | null> {
  const admin = siteId ? createAdminClient() : null;
  if (!admin || !siteId) return null;
  const { data } = await admin.from('keywords').select('current_rank').eq('site_id', siteId).eq('tracked', true);
  const ranks = (data ?? []).map((r) => r.current_rank as number | null).filter((r): r is number => typeof r === 'number');
  if (ranks.length === 0) return null;
  const avg = Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10;
  const top10 = ranks.filter((r) => r <= 10).length;
  const top3 = ranks.filter((r) => r <= 3).length;
  return `📊 דירוגים:\n• ${ranks.length} מילים במעקב\n• דירוג ממוצע: ${avg}\n• בטופ 10: ${top10} | בטופ 3: ${top3}`;
}

async function opportunitiesSummary(siteId?: string | null): Promise<string | null> {
  const admin = siteId ? createAdminClient() : null;
  if (!admin || !siteId) return null;
  const { data } = await admin
    .from('gsc_opportunities')
    .select('type, query, position, impressions')
    .eq('site_id', siteId)
    .eq('status', 'open')
    .order('priority', { ascending: true })
    .limit(5);
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const lines = rows.map(
    (o) => `• "${o.query ?? ''}" — מקום ${o.position ?? '?'} (${o.impressions ?? 0} חשיפות)`
  );
  return `🎯 הזדמנויות פתוחות:\n${lines.join('\n')}\n\nרוצה שאכתוב מאמר על אחת מהן? כתוב "כתוב מאמר על …".`;
}

async function geoSummary(siteId?: string | null): Promise<string | null> {
  const admin = siteId ? createAdminClient() : null;
  if (!admin || !siteId) return null;
  const [{ data: score }, { count: cited }, { count: gaps }] = await Promise.all([
    admin.from('citation_scores').select('score').eq('site_id', siteId).order('date', { ascending: false }).limit(1),
    admin.from('ai_citations').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('cited', true),
    admin.from('citation_gaps').select('id', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'open'),
  ]);
  const s = (score ?? [])[0]?.score as number | null | undefined;
  if (s == null && !cited && !gaps) return null;
  return `🤖 נוכחות ב-AI:\n• Citation Score: ${s ?? 0}\n• ציטוטים פעילים: ${cited ?? 0}\n• פערים לסגירה: ${gaps ?? 0}`;
}

export async function handleMessage(message: string, ctx: BotContext = {}): Promise<string> {
  const text = message.trim();
  if (!text) return HELP;

  const { intent, topic } = await classify(text);

  if (intent === 'help') return HELP;

  if (intent === 'write') {
    const keyword = topic || text.replace(/^.*?(כתוב|תכתוב|write)\s*(מאמר|על)?\s*/i, '').trim() || text;
    const article = await generateArticle({ keyword, lang: ctx.lang ?? 'he' }).catch(() => null);
    if (!article) return 'לא הצלחתי לכתוב כרגע, נסה שוב.';
    const preview = article.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 220);
    return (
      `✅ כתבתי מאמר: <b>${article.title}</b>\n\n` +
      `${article.meta}\n\n${preview}…\n\n` +
      `רוצה שאפרסם? חבר אתר ב-/sites והשב "אשר".`
    );
  }

  if (intent === 'rankings') {
    const real = await rankingsSummary(ctx.siteId).catch(() => null);
    if (real) return real;
    return await humanizeHe(
      'סיכום דירוגים: חבר Google Search Console (בדשבורד) ואשלח לך כל בוקר את הדירוג הממוצע, ' +
        'המילים בטופ 10, שינויי הדירוג והמילים ב-Striking Distance. בינתיים אפשר "כתוב מאמר על …".'
    );
  }

  if (intent === 'opportunities') {
    const real = await opportunitiesSummary(ctx.siteId).catch(() => null);
    if (real) return real;
    return await humanizeHe(
      'הזדמנויות: אני מאתר מילים ב-Striking Distance (מקומות 11–20), פערי תוכן וקניבליזציה. ' +
        'חבר Google Search Console בדשבורד ואשלח את הרשימה לפי סדר עדיפויות.'
    );
  }

  if (intent === 'scan') {
    return await humanizeHe(
      'הרצת סריקה: אני מרענן את נתוני הדירוג מ-Google Search Console ובודק ציטוטים ב-AI. ' +
        'הפעל את הסריקה מהדשבורד (GSC Intelligence / GEO Monitor) ואשלח לך התראה כשיש שינוי דירוג משמעותי.'
    );
  }

  if (intent === 'geo') {
    const real = await geoSummary(ctx.siteId).catch(() => null);
    if (real) return real;
    return await humanizeHe(
      'נוכחות ב-AI: אני בודק ב-ChatGPT, Gemini, Claude ו-Perplexity אם מצטטים אותך, מחשב Citation Score, ' +
        'ומאתר פערים. הפעל את הבדיקה ב-GEO Monitor או בקש "כתוב patch על …".'
    );
  }

  if (intent === 'report') {
    const [rank, geo] = await Promise.all([
      rankingsSummary(ctx.siteId).catch(() => null),
      geoSummary(ctx.siteId).catch(() => null),
    ]);
    if (rank || geo) return ['📈 הדוח שלך:', rank, geo].filter(Boolean).join('\n\n');
    return await humanizeHe(
      'הדוח השבועי מסכם דירוגים, הזדמנויות ונראות ב-AI. חבר אתר ו-Google Search Console בדשבורד ' +
        'ואשלח לך אותו אוטומטית כל שבוע לערוץ שתבחר (Telegram / WhatsApp / אימייל).'
    );
  }

  return HELP;
}
