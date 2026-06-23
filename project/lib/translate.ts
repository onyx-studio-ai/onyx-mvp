/*
  DeepL auto-translation for talent profile free-text. Used at publish time to
  turn a talent's single-language input (bio, clients, notable work, awards,
  special skills) into a {zh-TW, zh-CN, en} object so the public profile shows
  each viewer their own language.

  Free-tier key ends with ":fx" -> use api-free.deepl.com. Source language is
  auto-detected (we omit source_lang). Everything degrades gracefully: with no
  key or on any error, the original text is kept as-is (a plain string).
*/

const KEY = process.env.DEEPL_API_KEY || '';
const BASE = KEY.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

export const hasTranslate = () => !!KEY;

// Translate an array of texts to one DeepL target_lang (source auto-detected).
async function deeplBatch(texts: string[], target: string): Promise<string[]> {
  const res = await fetch(`${BASE}/v2/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts, target_lang: target }),
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}`);
  const j = (await res.json()) as { translations?: { text: string }[] };
  return (j.translations || []).map((t) => t.text);
}

export type I18nText = { 'zh-TW'?: string; 'zh-CN'?: string; en?: string };

/*
  Translate a map of {field: text} into {field: {zh-TW, zh-CN, en}}. Empty fields
  are skipped. With no key or on error, returns the originals as plain strings so
  callers can store them unchanged.
*/
export async function translateFields(
  fields: Record<string, string>
): Promise<Record<string, I18nText | string>> {
  const entries = Object.entries(fields).filter(([, v]) => v && v.trim());
  const out: Record<string, I18nText | string> = {};
  if (!KEY || entries.length === 0) {
    for (const [k, v] of entries) out[k] = v; // no key → keep original
    return out;
  }
  const texts = entries.map(([, v]) => v);
  try {
    const [tw, cn, en] = await Promise.all([
      deeplBatch(texts, 'ZH-HANT'),
      deeplBatch(texts, 'ZH-HANS'),
      deeplBatch(texts, 'EN-US'),
    ]);
    entries.forEach(([k], i) => {
      out[k] = { 'zh-TW': tw[i], 'zh-CN': cn[i], en: en[i] };
    });
  } catch {
    for (const [k, v] of entries) out[k] = v; // error → keep original
  }
  return out;
}
