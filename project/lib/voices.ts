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
  { code: 'zh', name: 'Mandarin Chinese', zhName: '國語' },
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

export const voicesByLanguage: VoicesByLanguage = {
  'zh': [
    {
      id: 'zh_male_1',
      name: 'Adam (Deep / Trailer)',
      gender: 'male',
      description: 'Deep, powerful voice perfect for trailers and dramatic content',
      audioPreviewUrl: '/demos/zh_male_1.mp3',
    },
    {
      id: 'zh_male_2',
      name: 'Eric (Ad / Energy)',
      gender: 'male',
      description: 'Energetic and dynamic, ideal for advertisements',
      audioPreviewUrl: '/demos/zh_male_2.mp3',
    },
    {
      id: 'zh_female_1',
      name: 'Li (Warm / Audiobook)',
      gender: 'female',
      description: 'Warm and soothing, perfect for audiobooks and narration',
      audioPreviewUrl: '/demos/zh_female_1.mp3',
    },
    {
      id: 'zh_female_2',
      name: 'Yaya (Promo / Vibrant)',
      gender: 'female',
      description: 'Vibrant and engaging, ideal for promotional content',
      audioPreviewUrl: '/demos/zh_female_2.mp3',
    },
  ],
  'en': [
    {
      id: 'en_male_1',
      name: 'James (Deep / Authority)',
      gender: 'male',
      description: 'Deep, authoritative voice for professional content',
      audioPreviewUrl: '/demos/en_male_1.mp3',
    },
    {
      id: 'en_male_2',
      name: 'Ryan (Casual / Conversational)',
      gender: 'male',
      description: 'Casual and conversational, perfect for storytelling',
      audioPreviewUrl: '/demos/en_male_2.mp3',
    },
    {
      id: 'en_female_1',
      name: 'Sophia (Soothing / Soft)',
      gender: 'female',
      description: 'Soothing and soft, ideal for meditation and wellness',
      audioPreviewUrl: '/demos/en_female_1.mp3',
    },
    {
      id: 'en_female_2',
      name: 'Emma (Corporate / Pro)',
      gender: 'female',
      description: 'Professional and polished, perfect for corporate content',
      audioPreviewUrl: '/demos/en_female_2.mp3',
    },
  ],
  'ja': [
    {
      id: 'ja_male_1',
      name: 'Ken (Artisan / Deep)',
      gender: 'male',
      description: 'Deep and refined, perfect for craftsmanship content',
      audioPreviewUrl: '/demos/ja_male_1.mp3',
    },
    {
      id: 'ja_male_2',
      name: 'Hiro (Anime / Energy)',
      gender: 'male',
      description: 'Energetic anime-style voice, great for dynamic content',
      audioPreviewUrl: '/demos/ja_male_2.mp3',
    },
    {
      id: 'ja_female_1',
      name: 'Sakura (Narration / Soft)',
      gender: 'female',
      description: 'Soft and gentle, perfect for narration',
      audioPreviewUrl: '/demos/ja_female_1.mp3',
    },
    {
      id: 'ja_female_2',
      name: 'Aiko (Idol / Cute)',
      gender: 'female',
      description: 'Cute and cheerful, ideal for upbeat content',
      audioPreviewUrl: '/demos/ja_female_2.mp3',
    },
  ],
  'ko': [
    {
      id: 'ko_male_1',
      name: 'Min-ho (K-Drama / Deep)',
      gender: 'male',
      description: 'Deep and dramatic, perfect for K-Drama style content',
      audioPreviewUrl: '/demos/ko_male_1.mp3',
    },
    {
      id: 'ko_male_2',
      name: 'Joon (Variety / Fast)',
      gender: 'male',
      description: 'Fast-paced and energetic, great for variety shows',
      audioPreviewUrl: '/demos/ko_male_2.mp3',
    },
    {
      id: 'ko_female_1',
      name: 'Ji-oo (News / Intellectual)',
      gender: 'female',
      description: 'Clear and intellectual, perfect for news and educational content',
      audioPreviewUrl: '/demos/ko_female_1.mp3',
    },
    {
      id: 'ko_female_2',
      name: 'Hana (Vlog / Lively)',
      gender: 'female',
      description: 'Lively and engaging, ideal for vlogs and social media',
      audioPreviewUrl: '/demos/ko_female_2.mp3',
    },
  ],
  'de': [
    {
      id: 'de_male_1',
      name: 'Hans (Authority / Auto)',
      gender: 'male',
      description: 'Authoritative and precise, perfect for automotive and technical content',
      audioPreviewUrl: '/demos/de_male_1.mp3',
    },
    {
      id: 'de_male_2',
      name: 'Lukas (Tech / Young)',
      gender: 'male',
      description: 'Young and tech-savvy, great for modern content',
      audioPreviewUrl: '/demos/de_male_2.mp3',
    },
    {
      id: 'de_female_1',
      name: 'Greta (Docu / Calm)',
      gender: 'female',
      description: 'Calm and measured, perfect for documentaries',
      audioPreviewUrl: '/demos/de_female_1.mp3',
    },
    {
      id: 'de_female_2',
      name: 'Lena (Guide / Friendly)',
      gender: 'female',
      description: 'Friendly and approachable, ideal for guides and tutorials',
      audioPreviewUrl: '/demos/de_female_2.mp3',
    },
  ],
};

export const getVoicesForLanguage = (languageCode: string): Voice[] => {
  return voicesByLanguage[languageCode] || [];
};

export const findLanguageByVoiceName = (voiceName: string): string | null => {
  for (const [langCode, voices] of Object.entries(voicesByLanguage)) {
    if (voices.some(v => v.name === voiceName)) return langCode;
  }
  return null;
};

export const featuredVoices: Voice[] = [
  {
    id: 'onyx_alpha',
    name: 'Onyx Alpha',
    gender: 'male',
    description: 'Deep, commanding presence for high-stakes narration',
    audioPreviewUrl: '/demos/en_male_1.mp3',
    archetype: 'The Authority',
    tags: ['News', 'Corporate', 'Deep'],
    badge: '✨ ONYX EXCLUSIVE',
    gradientColors: ['#1e3a8a', '#7c3aed'],
    isFeatured: true,
  },
  {
    id: 'onyx_nova',
    name: 'Onyx Nova',
    gender: 'female',
    description: 'Crystalline clarity with sophisticated warmth',
    audioPreviewUrl: '/demos/en_female_2.mp3',
    archetype: 'The Visionary',
    tags: ['Tech', 'Premium', 'Elegant'],
    badge: '✨ ONYX EXCLUSIVE',
    gradientColors: ['#06b6d4', '#8b5cf6'],
    isFeatured: true,
  },
  {
    id: 'onyx_titan',
    name: 'Onyx Titan',
    gender: 'male',
    description: 'Bold, dynamic energy for impactful storytelling',
    audioPreviewUrl: '/demos/en_male_2.mp3',
    archetype: 'The Catalyst',
    tags: ['Trailer', 'Action', 'Power'],
    badge: '✨ ONYX EXCLUSIVE',
    gradientColors: ['#dc2626', '#f97316'],
    isFeatured: true,
  },
];

export const getFeaturedVoices = (): Voice[] => {
  return featuredVoices;
};
