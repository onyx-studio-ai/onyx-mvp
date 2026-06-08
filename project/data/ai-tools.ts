export type ToolCategory = 'voice' | 'music' | 'dubbing' | 'audio' | 'transcription';
export type ToolPricing = 'free' | 'freemium' | 'paid';

export interface AiTool {
  id: string;
  name: string;
  url: string;
  category: ToolCategory;
  pricing: ToolPricing;
  tags: string[];
  emoji: string;
  description: { en: string; tw: string; cn: string };
}

export const AI_TOOLS: AiTool[] = [
  // ── AI Voice & TTS ────────────────────────────────────────────────────────
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    url: 'https://elevenlabs.io',
    category: 'voice',
    pricing: 'freemium',
    tags: ['TTS', 'Voice Cloning', 'API'],
    emoji: '🎙️',
    description: {
      en: 'Industry-leading voice cloning and TTS in 29 languages. Clone any voice in under 1 minute, with a developer API for real-time streaming.',
      tw: '業界領先的語音複製與 TTS，支援 29 種語言。不到 1 分鐘複製任何聲音，提供即時串流開發者 API。',
      cn: '业界领先的语音克隆与 TTS，支持 29 种语言。不到 1 分钟克隆任何声音，提供实时流式传输开发者 API。',
    },
  },
  {
    id: 'murf',
    name: 'Murf.ai',
    url: 'https://murf.ai',
    category: 'voice',
    pricing: 'freemium',
    tags: ['TTS', 'Studio', 'Voiceover'],
    emoji: '🔊',
    description: {
      en: 'Studio-quality TTS with 120+ AI voices across 20 languages. Built-in slide sync and video editor for content creators.',
      tw: '超過 120 種 AI 聲音的高品質 TTS，涵蓋 20 種語言。內建投影片同步與影片編輯器，適合內容創作者。',
      cn: '超过 120 种 AI 声音的高品质 TTS，涵盖 20 种语言。内置幻灯片同步与视频编辑器，适合内容创作者。',
    },
  },
  {
    id: 'playht',
    name: 'Play.ht',
    url: 'https://play.ht',
    category: 'voice',
    pricing: 'freemium',
    tags: ['TTS', 'API', 'Streaming'],
    emoji: '▶️',
    description: {
      en: 'Ultra-realistic TTS with voice cloning and real-time streaming. 900+ AI voices with a developer-first API.',
      tw: '超真實 TTS 與語音複製，支援即時串流。900+ 種 AI 聲音，以開發者為核心的 API。',
      cn: '超真实 TTS 与语音克隆，支持实时流式传输。900+ 种 AI 声音，以开发者为核心的 API。',
    },
  },
  {
    id: 'resemble',
    name: 'Resemble AI',
    url: 'https://www.resemble.ai',
    category: 'voice',
    pricing: 'freemium',
    tags: ['Voice Cloning', 'Real-time', 'Emotion'],
    emoji: '🧬',
    description: {
      en: 'Real-time voice cloning with emotion and style control. Trusted by game studios and enterprise media teams for production use.',
      tw: '即時語音複製，支援情感與風格控制。受遊戲工作室與企業媒體團隊信賴，適合正式製作使用。',
      cn: '实时语音克隆，支持情感与风格控制。受游戏工作室与企业媒体团队信赖，适合正式制作使用。',
    },
  },

  // ── AI Music ──────────────────────────────────────────────────────────────
  {
    id: 'suno',
    name: 'Suno',
    url: 'https://suno.com',
    category: 'music',
    pricing: 'freemium',
    tags: ['Music Gen', 'Vocals', 'Full Song'],
    emoji: '🎵',
    description: {
      en: 'Generate complete songs with vocals and lyrics from a text prompt in seconds. Best for demos and rapid creative exploration.',
      tw: '只需文字描述，幾秒內生成含人聲與歌詞的完整歌曲。最適合製作 demo 與快速創意發想。',
      cn: '只需文字描述，几秒内生成含人声与歌词的完整歌曲。最适合制作 demo 与快速创意探索。',
    },
  },
  {
    id: 'udio',
    name: 'Udio',
    url: 'https://udio.com',
    category: 'music',
    pricing: 'freemium',
    tags: ['Music Gen', 'High Quality', 'Diverse'],
    emoji: '🎶',
    description: {
      en: 'High-fidelity AI music generation across diverse genres. Known for natural transitions, expressive vocals, and nuanced arrangements.',
      tw: '高保真 AI 音樂生成，涵蓋多元曲風。以自然的段落過渡、富有表情的人聲與細膩編曲聞名。',
      cn: '高保真 AI 音乐生成，涵盖多元风格。以自然的段落过渡、富有表情的人声与细腻编曲著称。',
    },
  },
  {
    id: 'aiva',
    name: 'AIVA',
    url: 'https://www.aiva.ai',
    category: 'music',
    pricing: 'freemium',
    tags: ['Orchestral', 'Cinematic', 'Game Music'],
    emoji: '🎼',
    description: {
      en: 'AI composer specializing in orchestral, cinematic, and game soundtracks. Produces royalty-free original music for media projects.',
      tw: '專精管弦樂、電影配樂與遊戲音樂的 AI 作曲家。為媒體專案生成版稅免費的原創音樂。',
      cn: '专精管弦乐、影视配乐与游戏音乐的 AI 作曲家。为媒体项目生成版税免费的原创音乐。',
    },
  },
  {
    id: 'stable-audio',
    name: 'Stable Audio',
    url: 'https://stability.ai/stable-audio',
    category: 'music',
    pricing: 'freemium',
    tags: ['Loops', 'Sound FX', 'Stems'],
    emoji: '🔁',
    description: {
      en: 'Generate music loops, stems, and sound effects from text. By Stability AI, supporting outputs up to 3 minutes long.',
      tw: '從文字生成音樂循環、分軌與音效。由 Stability AI 開發，支援最長 3 分鐘的輸出。',
      cn: '从文字生成音乐循环、分轨与音效。由 Stability AI 开发，支持最长 3 分钟的输出。',
    },
  },

  // ── AI Dubbing & Video ────────────────────────────────────────────────────
  {
    id: 'heygen',
    name: 'HeyGen',
    url: 'https://www.heygen.com',
    category: 'dubbing',
    pricing: 'freemium',
    tags: ['Video Dubbing', 'Lip Sync', 'Avatar'],
    emoji: '🎬',
    description: {
      en: 'AI video translation with lip-sync dubbing in 40+ languages. Also generates AI avatar spokesperson videos from scripts.',
      tw: 'AI 影片翻譯配音，支援 40+ 語言的唇形同步。也可從腳本生成 AI 虛擬人代言影片。',
      cn: 'AI 视频翻译配音，支持 40+ 语言的唇形同步。还可从脚本生成 AI 虚拟人代言视频。',
    },
  },
  {
    id: 'rask',
    name: 'Rask.ai',
    url: 'https://www.rask.ai',
    category: 'dubbing',
    pricing: 'freemium',
    tags: ['Localization', 'Voice Cloning', 'Subtitles'],
    emoji: '🌐',
    description: {
      en: 'Automated video localization with voice cloning across 130+ languages. Translates, dubs, and generates subtitles in one workflow.',
      tw: '自動化影片在地化，含語音複製功能，支援 130+ 語言。翻譯、配音、字幕一站搞定。',
      cn: '自动化视频本地化，含语音克隆功能，支持 130+ 语言。翻译、配音、字幕一站搞定。',
    },
  },
  {
    id: 'dubverse',
    name: 'Dubverse',
    url: 'https://dubverse.ai',
    category: 'dubbing',
    pricing: 'freemium',
    tags: ['Dubbing', 'Multi-language', 'Creator'],
    emoji: '🗣️',
    description: {
      en: "AI dubbing that preserves the original speaker's voice characteristics while producing natural-sounding dubs in multiple languages.",
      tw: '在保留原始說話者聲音特色的同時，生成自然流暢的多語言 AI 配音。',
      cn: '在保留原始说话者声音特色的同时，生成自然流畅的多语言 AI 配音。',
    },
  },
  {
    id: 'papercup',
    name: 'Papercup',
    url: 'https://www.papercup.com',
    category: 'dubbing',
    pricing: 'paid',
    tags: ['Enterprise', 'Broadcast', 'QC'],
    emoji: '📺',
    description: {
      en: 'Enterprise AI dubbing for broadcast and media companies. Human-in-the-loop QC delivers broadcast-ready results at scale.',
      tw: '專為廣電與媒體公司設計的企業級 AI 配音。透過人工品管流程，大規模交付廣播等級的配音成果。',
      cn: '专为广电与媒体公司设计的企业级 AI 配音。通过人工质检流程，规模化交付广播品质的配音成果。',
    },
  },

  // ── Audio Enhancement ─────────────────────────────────────────────────────
  {
    id: 'adobe-podcast',
    name: 'Adobe Podcast',
    url: 'https://podcast.adobe.com',
    category: 'audio',
    pricing: 'free',
    tags: ['Audio Enhance', 'Noise Removal', 'Free'],
    emoji: '🎧',
    description: {
      en: 'Free AI audio enhancement that makes any mic recording sound studio-quality. Upload audio, get a polished version in seconds.',
      tw: '免費 AI 音訊增強工具，讓任何麥克風的收音都達到錄音室水準。上傳音訊，幾秒內取得精修版本。',
      cn: '免费 AI 音频增强工具，让任何麦克风的录音都达到录音室水准。上传音频，几秒内获得精修版本。',
    },
  },
  {
    id: 'descript',
    name: 'Descript',
    url: 'https://www.descript.com',
    category: 'audio',
    pricing: 'freemium',
    tags: ['Audio Edit', 'Video Edit', 'Transcription'],
    emoji: '✂️',
    description: {
      en: 'Edit audio and video by editing the transcript text. AI noise removal, filler-word deletion, and Overdub voice cloning built in.',
      tw: '透過編輯逐字稿文字來剪輯音訊與影片。內建 AI 降噪、贅詞刪除與 Overdub 語音複製功能。',
      cn: '通过编辑转录文字来剪辑音频与视频。内置 AI 降噪、赘词删除与 Overdub 语音克隆功能。',
    },
  },
  {
    id: 'cleanvoice',
    name: 'Cleanvoice',
    url: 'https://cleanvoice.ai',
    category: 'audio',
    pricing: 'freemium',
    tags: ['Filler Words', 'Podcast', 'Cleanup'],
    emoji: '🧹',
    description: {
      en: 'Automatically remove filler words ("um", "uh"), mouth clicks, and background noise from podcast and voiceover recordings.',
      tw: '自動從 Podcast 與配音錄製中移除語助詞（嗯、呃）、嘴巴雜音與背景噪音。',
      cn: '自动从播客与配音录制中移除语助词（嗯、呃）、口腔杂音与背景噪音。',
    },
  },
  {
    id: 'krisp',
    name: 'Krisp',
    url: 'https://krisp.ai',
    category: 'audio',
    pricing: 'freemium',
    tags: ['Noise Cancel', 'Real-time', 'Virtual Mic'],
    emoji: '🔇',
    description: {
      en: 'Real-time AI noise cancellation that works as a virtual microphone system-wide. Ideal for remote recordings and online calls.',
      tw: '即時 AI 降噪，作為虛擬麥克風在全系統運作。非常適合遠端收音與線上通話。',
      cn: '实时 AI 降噪，作为虚拟麦克风在全系统运行。非常适合远程录音与在线通话。',
    },
  },

  // ── Transcription & ASR ───────────────────────────────────────────────────
  {
    id: 'whisper',
    name: 'Whisper (OpenAI)',
    url: 'https://github.com/openai/whisper',
    category: 'transcription',
    pricing: 'free',
    tags: ['Open Source', 'ASR', '99 Languages'],
    emoji: '👂',
    description: {
      en: "OpenAI's open-source speech recognition model. Supports 99 languages with near-human accuracy. Free to run locally.",
      tw: 'OpenAI 開源的語音辨識模型。支援 99 種語言，準確度接近人工轉錄。可在本機免費運行。',
      cn: 'OpenAI 开源的语音识别模型。支持 99 种语言，准确度接近人工转录。可在本地免费运行。',
    },
  },
  {
    id: 'otter',
    name: 'Otter.ai',
    url: 'https://otter.ai',
    category: 'transcription',
    pricing: 'freemium',
    tags: ['Meeting Notes', 'Speaker ID', 'Summary'],
    emoji: '📝',
    description: {
      en: 'AI meeting transcription with automatic speaker identification. Auto-generates summaries and action items from conversations.',
      tw: 'AI 會議逐字稿工具，自動辨識發言者。自動從對話中生成摘要與行動項目。',
      cn: 'AI 会议转录工具，自动识别发言者。自动从对话中生成摘要与行动项目。',
    },
  },
  {
    id: 'assemblyai',
    name: 'AssemblyAI',
    url: 'https://www.assemblyai.com',
    category: 'transcription',
    pricing: 'freemium',
    tags: ['ASR API', 'Sentiment', 'Developers'],
    emoji: '🔬',
    description: {
      en: 'Developer speech API with transcription, sentiment analysis, topic detection, and auto-summarization in one platform.',
      tw: '開發者語音 API，在單一平台整合逐字稿、情感分析、主題偵測與自動摘要功能。',
      cn: '开发者语音 API，在单一平台整合转录、情感分析、主题检测与自动摘要功能。',
    },
  },
  {
    id: 'deepgram',
    name: 'Deepgram',
    url: 'https://deepgram.com',
    category: 'transcription',
    pricing: 'freemium',
    tags: ['ASR API', 'Real-time', 'Fast'],
    emoji: '⚡',
    description: {
      en: 'Ultra-fast speech-to-text API with real-time streaming and word-level timestamps. Trusted by enterprise engineering teams.',
      tw: '超高速語音轉文字 API，支援即時串流與詞級時間戳。受企業工程團隊廣泛採用。',
      cn: '超高速语音转文字 API，支持实时流式传输与词级时间戳。受企业工程团队广泛采用。',
    },
  },
];

export const TOOL_CATEGORIES: {
  key: ToolCategory | 'all';
  labelEn: string;
  labelTw: string;
  labelCn: string;
}[] = [
  { key: 'all',           labelEn: 'All Tools',    labelTw: '全部工具', labelCn: '全部工具' },
  { key: 'voice',         labelEn: 'AI Voice',     labelTw: 'AI 語音',  labelCn: 'AI 语音'  },
  { key: 'music',         labelEn: 'AI Music',     labelTw: 'AI 音樂',  labelCn: 'AI 音乐'  },
  { key: 'dubbing',       labelEn: 'AI Dubbing',   labelTw: 'AI 配音',  labelCn: 'AI 配音'  },
  { key: 'audio',         labelEn: 'Audio Tools',  labelTw: '音訊工具', labelCn: '音频工具' },
  { key: 'transcription', labelEn: 'Transcription',labelTw: '語音辨識', labelCn: '语音识别' },
];
