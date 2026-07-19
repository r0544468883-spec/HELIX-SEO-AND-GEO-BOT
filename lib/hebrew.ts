// Hebrew writing skill — the shared standard every Hebrew content loop routes
// through. Two forms:
//   1) HEBREW_STYLE — a system-prompt fragment (baldiga principles) injected into
//      generation prompts, so Hebrew comes out human on the first pass (no extra call).
//   2) humanizeHe() — a dedicated rewrite/proofread pass for long-form content
//      (the article engine), where a second pass is worth the cost.
import { claude } from './claude';

const HE = /[֐-׿]/;
export function isHebrew(text: string): boolean {
  return HE.test(text);
}

// Injected into any Hebrew generation prompt.
export const HEBREW_STYLE =
  'כתוב בעברית ישראלית אנושית וטבעית לחלוטין — לא "מתורגמת" ולא כמו בינה מלאכותית. ' +
  'ללא סופרלטיבים ריקים, ללא קלישאות שיווקיות, ללא מבנים נוקשים. ' +
  'משפטים באורך משתנה, ריתמוס אנושי, כתיב ודקדוק מדויקים. שפה ישירה שכיף לקרוא.';

// Dedicated humanize + proofread pass (for the article/content engine).
// No-op for non-Hebrew. Never throws — never blocks the loop.
export async function humanizeHe(text: string): Promise<string> {
  if (!text.trim() || !isHebrew(text)) return text;
  try {
    return await claude(
      'אתה עורך עברית מוביל. שכתב את הטקסט כך שיישמע אנושי-ישראלי טבעי לחלוטין (לא כמו בינה מלאכותית), ' +
        'ותקן כל שגיאת כתיב או דקדוק. שמור על המשמעות, הטון והאורך. החזר אך ורק את הטקסט המתוקן.',
      text,
      2000
    );
  } catch {
    return text;
  }
}
