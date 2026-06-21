/*
  Per-language sentence pools for the live human-verification recording.
  The talent reads ONE randomly-picked, neutral everyday sentence in their own
  language. Randomness (a pool, not a fixed line) is what makes it AI-resistant:
  the talent can't pre-generate the clip because they don't know which line they'll get.
  Sentences are deliberately mundane/friendly — no names, no sensitive content —
  so they're natural to read and easy to A/B against the talent's demo by ear.
*/

export type LivenessLang = 'tw' | 'cn' | 'en' | 'yue' | 'ja';

const POOLS: Record<LivenessLang, string[]> = {
  tw: [
    '今天天氣真的很不錯,希望你有個愉快的一天。',
    '謝謝你抽空聽我說話,很高興認識你。',
    '窗外的陽光很好,讓人心情也跟著放鬆下來。',
    '我喜歡在早晨喝杯熱茶,慢慢開始這一天。',
    '希望接下來的每一天,你都過得平安順心。',
    '剛剛走在路上,看到一隻很可愛的小貓。',
  ],
  cn: [
    '今天天气真不错,祝你拥有美好的一天。',
    '谢谢你抽空听我说话,很高兴认识你。',
    '窗外阳光正好,让人的心情也跟着轻松起来。',
    '我喜欢在早晨喝杯热茶,慢慢开始新的一天。',
    '希望接下来的每一天,你都过得平安顺心。',
    '刚刚走在路上,看到一只特别可爱的小猫。',
  ],
  en: [
    "The weather is really lovely today, I hope you have a great one.",
    "Thanks for taking the time to listen — it's nice to meet you.",
    "The sunshine outside makes the whole morning feel a little brighter.",
    "I like to start my day slowly with a warm cup of tea.",
    "I hope the days ahead are kind to you and go smoothly.",
    "On my walk just now I saw the friendliest little cat.",
  ],
  yue: [
    '今日天氣真係幾好,祝你有個愉快嘅一日。',
    '多謝你抽時間聽我講嘢,好開心識到你。',
    '出面啲陽光好靚,成個朝早都精神咗。',
    '我鍾意朝早飲杯熱茶,慢慢開始新一日。',
    '希望之後嘅每一日,你都平平安安、順順利利。',
    '頭先行緊街,見到一隻好得意嘅貓仔。',
  ],
  ja: [
    '今日はとても良い天気ですね。素敵な一日になりますように。',
    'お時間をいただきありがとうございます。お会いできて嬉しいです。',
    '窓の外の日差しが気持ちよくて、朝から心が和みます。',
    '私は朝に温かいお茶を飲んで、ゆっくり一日を始めるのが好きです。',
    'これからの毎日が、あなたにとって穏やかでありますように。',
    'さっき道を歩いていたら、とても可愛い猫に出会いました。',
  ],
};

const LANG_LABEL: Record<LivenessLang, string> = {
  tw: '繁體中文', cn: '简体中文', en: 'English', yue: '粵語', ja: '日本語',
};

/** Normalize a talent's stored language (code or name) to a pool key. */
function toPoolLang(raw: string): LivenessLang | null {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return null;
  if (s === 'zh-tw' || s.includes('traditional') || s.includes('繁') || s === 'taiwanese mandarin') return 'tw';
  if (s === 'zh-cn' || s.includes('simplified') || s.includes('简') || s.includes('简体')) return 'cn';
  if (s.includes('cantonese') || s.includes('粵') || s.includes('粤') || s === 'yue' || s === 'zh-hk') return 'yue';
  if (s.startsWith('ja') || s.includes('japanese') || s.includes('日本')) return 'ja';
  if (s.startsWith('en') || s.includes('english')) return 'en';
  // Generic Chinese with no region → default to Traditional (our main roster).
  if (s.startsWith('zh') || s.includes('mandarin') || s.includes('中文') || s.includes('chinese')) return 'tw';
  return null;
}

/**
 * Pick a random verification sentence in the talent's language.
 * Falls back to English if the language isn't covered yet.
 */
export function pickLivenessSentence(languages?: string[] | string | null): {
  lang: LivenessLang; langLabel: string; sentence: string;
} {
  const list = Array.isArray(languages) ? languages : languages ? [languages] : [];
  let lang: LivenessLang = 'en';
  for (const l of list) {
    const mapped = toPoolLang(l);
    if (mapped) { lang = mapped; break; }
  }
  const pool = POOLS[lang];
  const sentence = pool[Math.floor(Math.random() * pool.length)];
  return { lang, langLabel: LANG_LABEL[lang], sentence };
}
