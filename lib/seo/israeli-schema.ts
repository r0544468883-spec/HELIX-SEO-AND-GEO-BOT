// Israeli business structured data + hreflang builders. Generic Article/FAQ schema
// lives in content-engine; this covers the SITE-level entity: LocalBusiness with the
// Israeli specifics AI/Google expect — Sun–Thu week + Friday early close, kosher
// certification, +972 phone, ILS currency, and Speakable for voice/AI extraction.

export type IsraeliBusiness = {
  name: string;
  url: string;
  type?: string; // LocalBusiness subtype, e.g. Restaurant, Store
  phone?: string; // any format; normalized to +972
  streetAddress?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  priceRange?: string;
  kosher?: { certifier: string }; // e.g. { certifier: 'רבנות תל אביב' }
  sameAs?: string[]; // official profiles (LinkedIn, Facebook, Wikidata…)
  friClose?: string; // Friday early-close time, default 14:00
};

/** Normalize an Israeli phone to +972 international format. */
export function toIntlPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+972')) return digits;
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0')) return '+972-' + digits.slice(1);
  return phone;
}

export function buildLocalBusinessSchema(biz: IsraeliBusiness): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': biz.type || 'LocalBusiness',
    name: biz.name,
    url: biz.url,
  };

  if (biz.phone) schema.telephone = toIntlPhone(biz.phone);
  if (biz.priceRange) schema.priceRange = biz.priceRange;

  if (biz.streetAddress || biz.city) {
    schema.address = {
      '@type': 'PostalAddress',
      ...(biz.streetAddress ? { streetAddress: biz.streetAddress } : {}),
      ...(biz.city ? { addressLocality: biz.city } : {}),
      ...(biz.region ? { addressRegion: biz.region } : {}),
      ...(biz.postalCode ? { postalCode: biz.postalCode } : {}),
      addressCountry: 'IL',
    };
  }

  // Israeli work week: Sun–Thu full day, Friday early close, Saturday closed (omitted).
  schema.openingHoursSpecification = [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      opens: '09:00',
      closes: '18:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Friday',
      opens: '09:00',
      closes: biz.friClose || '14:00',
    },
  ];

  // Currency + kosher certification (Israeli trust signals).
  schema.currenciesAccepted = 'ILS';
  if (biz.kosher) {
    schema.additionalProperty = [
      {
        '@type': 'PropertyValue',
        name: 'Kosher Certification',
        value: biz.kosher.certifier,
      },
    ];
  }

  if (biz.sameAs?.length) schema.sameAs = biz.sameAs;

  // Speakable — helps voice assistants + AI answer engines extract the key content.
  schema.speakable = {
    '@type': 'SpeakableSpecification',
    cssSelector: ['h1', '.summary', '.faq-answer'],
  };

  return schema;
}

/** hreflang <link> tags for a bilingual Israeli site. he-IL (not just he) + x-default→en. */
export function buildHreflangTags(pairs: { he: string; en?: string }): string {
  const lines: string[] = [`<link rel="alternate" hreflang="he-IL" href="${pairs.he}" />`];
  if (pairs.en) {
    lines.push(`<link rel="alternate" hreflang="en" href="${pairs.en}" />`);
    lines.push(`<link rel="alternate" hreflang="x-default" href="${pairs.en}" />`);
  } else {
    lines.push(`<link rel="alternate" hreflang="x-default" href="${pairs.he}" />`);
  }
  return lines.join('\n');
}
