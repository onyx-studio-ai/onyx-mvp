/*
  Auto-translation for talent profile free-text. Used at publish time to turn a
  talent's single-language input (bio, clients, notable work, awards, special
  skills) into a {zh-TW, zh-CN, en} object so the public profile shows each viewer
  their own language.

  Two tools, each for what it's good at:
  - OpenCC for 繁↔簡 (Traditional ↔ Simplified). DeepL does NOT convert between the
    two Chinese scripts — asked "Chinese → Simplified" it returns Chinese source
    unchanged — so a Traditional bio would otherwise show Traditional on the 简体
    page. OpenCC does the script conversion correctly and needs no API key.
  - DeepL for cross-language (Chinese ↔ English). Free-tier key ends with ":fx".

  Everything degrades gracefully: with no key (or on error) we still do the 繁簡
  conversion via OpenCC; only the English variant falls back to the source.
*/

import { Converter } from 'opencc-js';

const KEY = process.env.DEEPL_API_KEY || '';
const BASE = KEY.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

export const hasTranslate = () => !!KEY;

// OpenCC converters (sync). "to: tw/cn" only rewrites the *other* script's chars,
// leaving chars already in the target script untouched — safe on either input.
const toTrad = Converter({ from: 'cn', to: 'tw' });
const toSimp = Converter({ from: 'tw', to: 'cn' });

const cjkRatio = (s: string) => {
  const cjk = (s.match(/[一-鿿]/g) || []).length;
  return cjk / (s.replace(/\s/g, '').length || 1);
};
const isChinese = (s: string) => cjkRatio(s) > 0.3;
const isLatin = (s: string) => /[a-zA-Z]/.test(s) && cjkRatio(s) < 0.1;

async function deepl(text: string, target: string): Promise<string> {
  const res = await fetch(`${BASE}/v2/translate`, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: [text], target_lang: target }),
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}`);
  const j = (await res.json()) as { translations?: { text: string }[] };
  return j.translations?.[0]?.text ?? text;
}

export type I18nText = { 'zh-TW'?: string; 'zh-CN'?: string; en?: string };

/*
  Localize a person's NAME — names are never machine-translated/transliterated
  (Wang vs Wong, personal English names…). 繁↔簡 is safe via OpenCC; the English
  variant is the talent's self-provided romanized name, or the original as fallback.
*/
export function localizeName(name: string, englishName?: string): I18nText {
  const n = (name || '').trim();
  const en = (englishName || '').trim();
  return { 'zh-TW': toTrad(n), 'zh-CN': toSimp(n), en: en || n };
}

// Build {zh-TW, zh-CN, en} for one text, picking the right tool per source language.
async function translateOne(text: string): Promise<I18nText> {
  if (isChinese(text)) {
    // Chinese source: 繁簡 via OpenCC (perfect, keeps the talent's own wording),
    // English via DeepL.
    let en = text;
    if (KEY) { try { en = await deepl(text, 'EN-US'); } catch { /* keep source */ } }
    return { 'zh-TW': toTrad(text), 'zh-CN': toSimp(text), en };
  }
  // Non-Chinese source: DeepL into Chinese, then OpenCC-normalize the script so a
  // stray simplified/traditional char from DeepL can't leak into the wrong page.
  if (!KEY) return { 'zh-TW': text, 'zh-CN': text, en: text };
  try {
    const [tw, cn] = await Promise.all([deepl(text, 'ZH-HANT'), deepl(text, 'ZH-HANS')]);
    const en = isLatin(text) ? text : await deepl(text, 'EN-US');
    return { 'zh-TW': toTrad(tw), 'zh-CN': toSimp(cn), en };
  } catch {
    return { 'zh-TW': text, 'zh-CN': text, en: text };
  }
}

/*
  Translate a map of {field: text} into {field: {zh-TW, zh-CN, en}}. Empty fields
  are skipped (caller falls back to the stored value). A single field failing
  degrades to its source string rather than aborting the whole publish.
*/
export async function translateFields(
  fields: Record<string, string>
): Promise<Record<string, I18nText | string>> {
  const out: Record<string, I18nText | string> = {};
  for (const [k, raw] of Object.entries(fields)) {
    const text = (raw || '').trim();
    if (!text) continue;
    try { out[k] = await translateOne(text); }
    catch { out[k] = text; }
  }
  return out;
}
