// Multi-channel distribution — off-site content, the surface a pure on-site SEO tool
// (and our own content engine, which only wrote articles) skipped. Given a topic, it
// generates platform-tailored drafts for the channels an AI-visibility tool competes on
// (Reddit / YouTube / LinkedIn / Trustpilot / backlink outreach) — each shaped to that
// platform's norms, Hebrew-first. These are the "citations LLMs read off-site".
import { claude } from '../claude';

export type DistroChannel = 'reddit' | 'youtube' | 'linkedin' | 'trustpilot' | 'backlinks';
export const DISTRO_CHANNELS: DistroChannel[] = ['reddit', 'youtube', 'linkedin', 'trustpilot', 'backlinks'];

export type ChannelDraft = { channel: DistroChannel; title: string; body: string; notes: string };

const CHANNEL_SPEC: Record<DistroChannel, { label: string; guide: string }> = {
  reddit: {
    label: 'Reddit',
    guide:
      'כתוב פוסט Reddit אותנטי לסאב-רדיט רלוונטי: כותרת סקרנית בלי קליקבייט, גוף שמספר סיפור/שאלה אמיתית ונותן ערך לפני כל אזכור מותג (הזכר את המותג פעם אחת לכל היותר, בענווה). בלי שיווקיות. הוסף ב-notes את הסאב-רדיטים המומלצים וכללי-הזהב למניעת חסימה.',
  },
  youtube: {
    label: 'YouTube',
    guide:
      'כתוב תסריט קצר לסרטון (60-90 שניות): הוק ב-3 שניות, 3-4 נקודות ערך, קריאה-לפעולה רכה. ב-body החזר את התסריט; בכותרת כותרת-סרטון ממוטבת; ב-notes תיאור-סרטון עם טיימסטמפים ותגיות, ומילות-מפתח לחיפוש.',
  },
  linkedin: {
    label: 'LinkedIn',
    guide:
      'כתוב פוסט LinkedIn של מנהיגות-מחשבה בגוף ראשון: שורת-פתיחה שעוצרת גלילה, פסקאות קצרות עם שורות-רווח, תובנה מקצועית אחת חזקה, וסיום עם שאלה שמזמינה תגובות. בלי האשטגים מוגזמים (3-5). ב-notes שעת-פרסום מומלצת וסוג-מדיה.',
  },
  trustpilot: {
    label: 'Trustpilot / ביקורות',
    guide:
      'בנה אסטרטגיית מוניטין-ביקורות: ב-body כתוב 2 תבניות-מענה (לביקורת חיובית ולביקורת שלילית) בטון אנושי ומקצועי, ובקשת-ביקורת אחת ללקוח מרוצה. ב-notes תזמון בקשות, איך להזמין ביקורות בלי לעבור על כללי הפלטפורמה, וכיצד ביקורות מזינות אמון-מותג במנועי-AI.',
  },
  backlinks: {
    label: 'Backlinks / Outreach',
    guide:
      'בנה קמפיין-לינקים: ב-body כתוב מייל-outreach קצר ומותאם-אישית להשגת אזכור/לינק (guest post / mention / resource page). ב-notes רשימת 6-8 סוגי-יעדים ריאליים בישראל (בלוגים, מגזינים, קטלוגים, ספקים משלימים), וזווית-הערך שמצדיקה לינק.',
  },
};

async function draftFor(channel: DistroChannel, input: { topic: string; brand?: string; url?: string; lang: 'he' | 'en' }): Promise<ChannelDraft> {
  const spec = CHANNEL_SPEC[channel];
  const system = `אתה אסטרטג-הפצה רב-ערוצי של HELIX Rank. אתה כותב תוכן ${input.lang === 'he' ? 'בעברית טבעית' : 'in English'} שמתאים בול לכל פלטפורמה, בלי ריח של AI. החזר JSON בלבד: {"title": "...", "body": "...", "notes": "..."}.`;
  const user = `פלטפורמה: ${spec.label}
נושא/מוצר: "${input.topic}"
${input.brand ? `מותג: ${input.brand}\n` : ''}${input.url ? `קישור-יעד: ${input.url}\n` : ''}הנחיה: ${spec.guide}
החזר JSON בלבד.`;
  const raw = await claude(system, user, 1100);
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.search(/[{]/);
  let parsed: { title?: string; body?: string; notes?: string } = {};
  if (start >= 0) {
    try { parsed = JSON.parse(cleaned.slice(start)); } catch { parsed = {}; }
  }
  return {
    channel,
    title: parsed.title?.trim() || spec.label,
    body: parsed.body?.trim() || cleaned,
    notes: parsed.notes?.trim() || '',
  };
}

export async function generateDistribution(input: {
  topic: string;
  brand?: string;
  url?: string;
  lang?: 'he' | 'en';
  channels?: DistroChannel[];
}): Promise<ChannelDraft[]> {
  const channels = input.channels?.length ? input.channels : DISTRO_CHANNELS;
  const lang = input.lang ?? 'he';
  const results = await Promise.all(
    channels.map((c) => draftFor(c, { topic: input.topic, brand: input.brand, url: input.url, lang }).catch(() => null))
  );
  return results.filter(Boolean) as ChannelDraft[];
}
