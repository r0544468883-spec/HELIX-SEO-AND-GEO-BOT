// WhatsApp TEMPLATE CATALOG — one approved template per PROACTIVE message HELIX Rank
// sends over WhatsApp. Templates are the compliant way to open a conversation outside
// the 24h window (Meta §business-initiated). Each entry is BOTH:
//   1. a Meta registration payload (used by /api/templates/sync to create them), and
//   2. a runtime mapping (name + language + how to build the ordered {{n}} params)
//      used by the digest/alert runners to send via sendWhatsAppTemplate().
// Rank's proactive messages are alerts + reports → all UTILITY (transactional updates
// about the user's own tracked assets), never MARKETING.

export type TemplateCategory = 'UTILITY' | 'MARKETING';

export type TemplateDef = {
  /** WhatsApp template name (a–z0–9_ only, unique per WABA). */
  name: string;
  language: string; // 'he'
  category: TemplateCategory;
  /** Body with {{1}},{{2}}… placeholders, exactly as registered with Meta. */
  body: string;
  /** Human-readable list of what each {{n}} is, for the example block + docs. */
  params: string[];
  /** Optional dynamic URL button (e.g. open the dashboard). {{1}} = suffix. */
  urlButton?: { text: string; baseUrl: string }; // full url = baseUrl + {{1}}
  sampleParams: string[];
  sampleUrlSuffix?: string;
};

// Feature → template. `key` matches the proactive Rank event that triggers the send.
export const TEMPLATES: Record<string, TemplateDef> = {
  // A tracked keyword moved up or down in the SERP.
  ranking_change: {
    name: 'rank_ranking_change',
    language: 'he',
    category: 'UTILITY',
    body: 'עדכון דירוג ל־{{1}} 📈 המילה "{{2}}" {{3}} ממקום {{4}} למקום {{5}}. היכנס לדשבורד לפרטים ולתוכנית פעולה.',
    params: ['כתובת האתר', 'מילת המפתח', 'ביטוי כיוון (עלתה/ירדה)', 'מיקום קודם', 'מיקום נוכחי'],
    urlButton: { text: 'צפייה בדשבורד', baseUrl: '{{APP_URL}}/' },
    sampleParams: ['example.co.il', 'עורך דין גירושין', 'עלתה', '14', '7'],
    sampleUrlSuffix: '',
  },
  // A new Striking-Distance / low-difficulty opportunity was detected.
  new_opportunity: {
    name: 'rank_new_opportunity',
    language: 'he',
    category: 'UTILITY',
    body: 'הזדמנות חדשה ל־{{1}} 🎯 "{{2}}" יושבת במקום {{3}} עם {{4}} חשיפות בחודש — קפיצה למעל העמוד הראשון בהישג יד. {{5}}',
    params: ['כתובת האתר', 'שאילתה/מילת מפתח', 'מיקום נוכחי', 'חשיפות', 'שורת פעולה מומלצת'],
    sampleParams: ['example.co.il', 'ייעוץ מס לעצמאים', '12', '3,400', 'כתוב לי "כתוב מאמר על ייעוץ מס לעצמאים".'],
  },
  // Weekly SEO + GEO digest.
  weekly_report: {
    name: 'rank_weekly_report',
    language: 'he',
    category: 'UTILITY',
    body: 'הדוח השבועי של HELIX Rank ל־{{1}} 📊\nדירוג ממוצע: {{2}} | מילים בעשירייה הראשונה: {{3}} | Citation Score: {{4}}\n{{5}}',
    params: ['כתובת האתר', 'דירוג ממוצע', "מס' מילים בטופ 10", 'ציון נראות GEO', 'שורת סיכום/הזדמנויות'],
    urlButton: { text: 'הדוח המלא', baseUrl: '{{APP_URL}}/' },
    sampleParams: ['example.co.il', '11.4', '6', '72', '3 הזדמנויות חדשות ממתינות לך.'],
    sampleUrlSuffix: '',
  },
  // GEO visibility alert — gained or lost a citation in an AI answer engine.
  geo_visibility: {
    name: 'rank_geo_visibility',
    language: 'he',
    category: 'UTILITY',
    body: 'עדכון נראות ב-AI ל־{{1}} 🤖 {{2}} עבור השאילתה "{{3}}" ב־{{4}}. ה-Citation Score העדכני שלך: {{5}}.',
    params: ['כתובת האתר', 'ביטוי מצב (התחלת להיות מצוטט/הפסקת להיות מצוטט)', 'שאילתה', 'מנוע (ChatGPT/Gemini/Claude/Perplexity)', 'ציון ציטוט'],
    sampleParams: ['example.co.il', 'התחלת להיות מצוטט', 'תוכנת הנהלת חשבונות', 'ChatGPT', '72'],
  },
};

/** Runtime: build the ordered {{n}} params a template expects from render context. */
export function templateParams(
  key: string,
  ctx: {
    site?: string;
    keyword?: string;
    direction?: string;
    from?: string;
    to?: string;
    position?: string;
    impressions?: string;
    actionLine?: string;
    avgPosition?: string;
    top10?: string;
    citationScore?: string;
    summaryLine?: string;
    state?: string;
    query?: string;
    engine?: string;
  }
): { def: TemplateDef; params: string[]; urlSuffix?: string } | null {
  const def = TEMPLATES[key];
  if (!def) return null;
  const map: Record<string, string[]> = {
    ranking_change: [ctx.site ?? '', ctx.keyword ?? '', ctx.direction ?? '', ctx.from ?? '', ctx.to ?? ''],
    new_opportunity: [ctx.site ?? '', ctx.query ?? ctx.keyword ?? '', ctx.position ?? '', ctx.impressions ?? '', ctx.actionLine ?? ''],
    weekly_report: [ctx.site ?? '', ctx.avgPosition ?? '', ctx.top10 ?? '', ctx.citationScore ?? '', ctx.summaryLine ?? ''],
    geo_visibility: [ctx.site ?? '', ctx.state ?? '', ctx.query ?? '', ctx.engine ?? '', ctx.citationScore ?? ''],
  };
  return { def, params: map[key] ?? [], urlSuffix: def.urlButton ? (def.sampleUrlSuffix ?? '') : undefined };
}

/** Build the Meta message_templates registration payload for one template. */
export function registrationPayload(def: TemplateDef, appUrl: string): Record<string, unknown> {
  const components: Record<string, unknown>[] = [
    { type: 'BODY', text: def.body, example: { body_text: [def.sampleParams] } },
  ];
  if (def.urlButton) {
    const base = def.urlButton.baseUrl.replace('{{APP_URL}}', appUrl.replace(/\/$/, ''));
    components.push({
      type: 'BUTTONS',
      buttons: [{ type: 'URL', text: def.urlButton.text, url: `${base}{{1}}`, example: [`${base}${def.sampleUrlSuffix ?? 'sample'}`] }],
    });
  }
  return { name: def.name, language: def.language, category: def.category, components };
}

export function allRegistrationPayloads(appUrl: string): Record<string, unknown>[] {
  return Object.values(TEMPLATES).map((d) => registrationPayload(d, appUrl));
}
