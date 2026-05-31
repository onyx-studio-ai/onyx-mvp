// ─────────────────────────────────────────────────────────────────────────────
// LOCKED — hardcoded fictional voice catalogue has been removed.
//
// Prior to Paddle going live this file shipped ~20 hand-written fictional voice
// entries (Adam, Eric Voice, Sophia, Min-ho, Hans, …) keyed by language. Those
// were placeholders the marketing site rendered alongside real database
// talents, which conflated trained/available voices with mockups. After
// payment went live a customer browsing /voices could click a fictional voice
// that had no underlying model and no fulfillment path — destroying trust.
//
// Public pages now source voices exclusively from the `talents` table via
// /api/talents, which itself filters to `voice_id_status='verified'`. This
// keeps the catalogue honest at the cost of looking sparse until more real
// talents are onboarded.
//
// Type definitions are preserved because other files import them.
// `voicesByLanguage` and `featuredVoices` are intentionally empty.
// ─────────────────────────────────────────────────────────────────────────────

export type Voice = {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
  audioPreviewUrl: string;
  archetype?: string;
  tags?: string[];
  badge?: string;
  gradientColors?: string[];
  isFeatured?: boolean;
};

export type VoicesByLanguage = {
  [key: string]: Voice[];
};

export const languages = [
  { code: 'en', name: 'English', zhName: '英語' },
  { code: 'zh-CN', name: 'Mandarin (Simplified)', zhName: '普通話' },
  { code: 'zh-TW', name: 'Mandarin (Traditional)', zhName: '台灣繁體' },
  { code: 'yue', name: 'Cantonese', zhName: '粵語' },
  { code: 'ja', name: 'Japanese', zhName: '日語' },
  { code: 'ko', name: 'Korean', zhName: '韓語' },
  { code: 'th', name: 'Thai', zhName: '泰語' },
  { code: 'vi', name: 'Vietnamese', zhName: '越南語' },
  { code: 'id', name: 'Indonesian', zhName: '印尼語' },
  { code: 'ms', name: 'Malay', zhName: '馬來語' },
  { code: 'tl', name: 'Tagalog (Filipino)', zhName: '菲律賓語' },
  { code: 'hi', name: 'Hindi', zhName: '印地語' },
  { code: 'ta', name: 'Tamil', zhName: '坦米爾語' },
  { code: 'bn', name: 'Bengali', zhName: '孟加拉語' },
  { code: 'ar', name: 'Arabic', zhName: '阿拉伯語' },
  { code: 'fa', name: 'Persian (Farsi)', zhName: '波斯語' },
  { code: 'es', name: 'Spanish', zhName: '西班牙語' },
  { code: 'pt', name: 'Portuguese', zhName: '葡萄牙語' },
  { code: 'fr', name: 'French', zhName: '法語' },
  { code: 'de', name: 'German', zhName: '德語' },
  { code: 'it', name: 'Italian', zhName: '義大利語' },
  { code: 'nl', name: 'Dutch', zhName: '荷蘭語' },
  { code: 'ru', name: 'Russian', zhName: '俄語' },
  { code: 'pl', name: 'Polish', zhName: '波蘭語' },
  { code: 'tr', name: 'Turkish', zhName: '土耳其語' },
  { code: 'sv', name: 'Swedish', zhName: '瑞典語' },
  { code: 'no', name: 'Norwegian', zhName: '挪威語' },
  { code: 'da', name: 'Danish', zhName: '丹麥語' },
  { code: 'fi', name: 'Finnish', zhName: '芬蘭語' },
];

// LOCKED — empty until real voices are linked here.
export const voicesByLanguage: VoicesByLanguage = {};

export const getVoicesForLanguage = (languageCode: string): Voice[] => {
  return voicesByLanguage[languageCode] || [];
};

export const findLanguageByVoiceName = (voiceName: string): string | null => {
  for (const [langCode, voices] of Object.entries(voicesByLanguage)) {
    if (voices.some((v) => v.name === voiceName)) return langCode;
  }
  return null;
};

// LOCKED — featured voices are sourced from `audio_showcases` table where
// section='featured_voices' AND audio_url IS NOT NULL. See FeaturedVoices.tsx.
export const featuredVoices: Voice[] = [];

export const getFeaturedVoices = (): Voice[] => {
  return featuredVoices;
};
