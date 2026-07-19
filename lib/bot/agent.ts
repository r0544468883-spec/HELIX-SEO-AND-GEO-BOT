// Conversational agent — the brain behind multi-channel control. Classifies an
// inbound message into an intent, runs the matching HELIX Rank tool, and replies
// in Hebrew. This is what lets users operate the bot from Telegram/WhatsApp/email.
import { claude, parseJson } from '../claude';
import { humanizeHe } from '../hebrew';
import { generateArticle } from '../content-engine';

export type BotContext = { siteUrl?: string | null; lang?: 'he' | 'en' };

type Intent = { intent: 'write' | 'status' | 'geo' | 'help' | 'other'; topic?: string };

async function classify(message: string): Promise<Intent> {
  const raw = await claude(
    'סווג את הודעת המשתמש לסוכן SEO. החזר JSON בלבד: {"intent":"write|status|geo|help|other","topic":"הנושא אם רלוונטי"}. ' +
      'write = בקשה לכתוב מאמר/תוכן; status = דירוגים/מצב/הזדמנויות; geo = נוכחות ב-AI/ציטוטים; help = עזרה/פקודות.',
    message,
    120
  ).catch(() => '');
  return parseJson<Intent>(raw) ?? { intent: 'other' };
}

const HELP =
  'אני HELIX Rank 🤖 מה אפשר לעשות:\n' +
  '• "כתוב מאמר על …" — כותב מאמר SEO+GEO בעברית\n' +
  '• "מה המצב" / "דירוגים" — סיכום הזדמנויות\n' +
  '• "נוכחות ב-AI" — Citation Score\n' +
  '• "עזרה" — התפריט הזה';

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

  if (intent === 'status') {
    return await humanizeHe(
      'סיכום מצב: חבר Google Search Console (בדשבורד) ואשלח לך כל בוקר את מילות ה-Striking Distance, ' +
        'שינויי הדירוג, וההזדמנויות. בינתיים אפשר "כתוב מאמר על …".'
    );
  }

  if (intent === 'geo') {
    return await humanizeHe(
      'נוכחות ב-AI: אני בודק ב-ChatGPT, Gemini, Claude ו-Perplexity אם מצטטים אותך, מחשב Citation Score, ' +
        'ומאתר פערים. הפעל את הבדיקה ב-GEO Monitor או בקש "כתוב patch על …".'
    );
  }

  return HELP;
}
