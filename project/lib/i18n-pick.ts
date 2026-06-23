/*
  Pick the right language out of a value that may be a plain string (legacy /
  untranslated) or a {locale: text} object (auto-translated at publish).

  Fallback order: a Chinese viewer falls back to the other Chinese variant before
  English (never show English to a zh viewer just because one variant is blank);
  English falls back to Chinese only if there's no English.
*/
export function pickLocale(value: unknown, locale: string): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const o = value as Record<string, string>;
    const order = locale === 'en' ? ['en', 'zh-TW', 'zh-CN'] : locale === 'zh-CN' ? ['zh-CN', 'zh-TW', 'en'] : ['zh-TW', 'zh-CN', 'en'];
    for (const k of order) if (o[k]) return o[k];
    return Object.values(o).find(Boolean) || '';
  }
  return '';
}
