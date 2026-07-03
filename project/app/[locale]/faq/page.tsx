import { Link } from '@/i18n/navigation';
import Footer from '@/components/landing/Footer';
import { ArrowRight } from 'lucide-react';

export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const faqs: { category: string; items: { q: string; a: string }[] }[] = [
    {
      category: tx('關於 Onyx Studios', '关于 Onyx Studios', 'About Onyx Studios'),
      items: [
        {
          q: tx('什麼是 Onyx Studios？', '什么是 Onyx Studios？', 'What is Onyx Studios?'),
          a: tx(
            'Onyx Studios（onyxstudios.ai）是一間成立於 2008 年、總部位於台灣的 AI 配音與音樂製作工作室。我們提供 AI 配音、多語 AI 配音、AI 輔助音樂製作，以及企業級語音數據採集服務。所有 AI 輸出均由資深人類聲音導演審核與精修後才交付。',
            '什么是 Onyx Studios？Onyx Studios（onyxstudios.ai）是一家成立于 2008 年、总部位于台湾的 AI 配音与音乐制作工作室。我们提供 AI 配音、多语 AI 配音、AI 辅助音乐制作，以及企业级语音数据采集服务。所有 AI 输出均由资深真人声音导演审核与精修后才交付。',
            'Onyx Studios (onyxstudios.ai) is a professional AI voice and music production studio founded in 2008, headquartered in Taiwan. We offer AI voiceover, multilingual AI dubbing, AI-assisted music production, and enterprise speech data collection. All AI output is reviewed and refined by experienced human voice directors before delivery.'
          ),
        },
        {
          q: tx(
            '如何開始？可以線上付款嗎？還是要先詢問？',
            '如何开始？可以线上付款吗？还是要先询问？',
            'How do I get started? Can I pay online, or should I enquire first?'
          ),
          a: tx(
            '兩種路徑都可以。若您已確認需求，線上下單是最快的方式——提交腳本、選擇方案、完成付款後製作即刻排程，通常 24 小時內交付。若您希望先了解更多、討論客製需求、或有大型 / 企業級專案，歡迎來信 support@onyxstudios.ai 或使用聯繫表單，我們將在一個工作日內回覆並安排後續流程。',
            '两种路径都可以。若您已确认需求，线上下单是最快的方式——提交脚本、选择方案、完成付款后制作即刻排程，通常 24 小时内交付。若您希望先了解更多、讨论定制需求、或有大型 / 企业级项目，欢迎来信 support@onyxstudios.ai 或使用联系表单，我们将在一个工作日内回复并安排后续流程。',
            'Both paths work. If you already know what you need, online checkout is the fastest route — submit your script, select a plan, complete payment, and production is scheduled immediately, typically delivered within 24 hours. If you would like to discuss your requirements first, explore custom options, or have a large-scale or enterprise project, email us at support@onyxstudios.ai or use the contact form. We respond within one business day and can handle everything offline from there.'
          ),
        },
        {
          q: tx(
            'Onyx Studios 和其他 AI 配音平台有什麼不同？',
            'Onyx Studios 和其他 AI 配音平台有什么不同？',
            'What makes Onyx Studios different from other AI voice platforms?'
          ),
          a: tx(
            'Onyx Studios 不是自助式 TTS 工具。每個專案由製作團隊端到端處理：AI 生成初版，人類聲音導演再精修語調、節奏、發音與情感，直到可交付為止。我們的聲音模型均來自授權合作的簽約專業配音員，而非爬取或匿名來源。',
            'Onyx Studios 不是自助式 TTS 工具。每个项目由制作团队端到端处理：AI 生成初版，真人声音导演再精修语调、节奏、发音与情感，直到可交付为止。我们的声音模型均来自授权合作的签约专业配音员，而非抓取或匿名来源。',
            'Onyx Studios is not a self-serve TTS tool. Every project is handled end-to-end by a production team: AI generates the first pass, then human voice directors refine tone, pacing, pronunciation, and emotion for delivery-ready results. Our voice models are built from recordings by contracted, consenting voice actors — not scraped or anonymous data.'
          ),
        },
      ],
    },
    {
      category: tx('AI 配音服務', 'AI 配音服务', 'AI Voiceover'),
      items: [
        {
          q: tx(
            'AI 配音費用是多少？',
            'AI 配音费用是多少？',
            'How much does AI voiceover cost?'
          ),
          a: tx(
            'AI 配音方案最低從 $39 起（0–60 秒 AI 即時配音）。費用依字數、語言、交期與是否包含人類導演精修而定。完整費率及方案比較請參閱 onyxstudios.ai/pricing。',
            'AI 配音方案最低从 $39 起（0–60 秒 AI 即时配音）。费用依字数、语言、交期与是否包含真人导演精修而定。完整费率及方案比较请参阅 onyxstudios.ai/pricing。',
            'AI voiceover plans start from $39 (0–60s AI Instant Voice package). Pricing depends on word count, language, delivery speed, and whether human director polish is included. See full tier breakdowns at onyxstudios.ai/pricing.'
          ),
        },
        {
          q: tx('交付時間需要多久？', '交付时间需要多久？', 'How long does delivery take?'),
          a: tx(
            '大多數 AI 配音訂單標準交期為 24 小時內。部分方案提供加急（當日）服務。大型專案（如多語配音或語音數據採集）交期於需求確認階段另行討論。',
            '大多数 AI 配音订单标准交期为 24 小时内。部分方案提供加急（当日）服务。大型项目（如多语配音或语音数据采集）交期于需求确认阶段另行讨论。',
            'Standard delivery is within 24 hours for most AI voiceover orders. Rush (same-day) delivery is available on select plans. Large-scale projects — multilingual dubbing or speech data collection — have custom timelines discussed at the briefing stage.'
          ),
        },
        {
          q: tx(
            '可以修改幾次？不滿意怎麼辦？',
            '可以修改几次？不满意怎么办？',
            'How many revisions do I get? What if I\'m not satisfied?'
          ),
          a: tx(
            '可修改次數依方案而定，詳見定價頁各方案說明。修改涵蓋依調整指示重新生成（語調、節奏、發音等）。若交付物有客觀錯誤（發音有誤、漏讀台詞、技術品質問題），不計修改次數，我們免費重做。已完成交付不提供退款；若您的專案有特殊要求，建議在製作前於需求單中詳細說明，確保雙方對成品有一致預期。',
            '可修改次数依方案而定，详见定价页各方案说明。修改涵盖依调整指示重新生成（语调、节奏、发音等）。若交付物有客观错误（发音有误、漏读台词、技术质量问题），不计修改次数，我们免费重做。已完成交付不提供退款；如您的项目有特殊要求，建议在制作前于需求单中详细说明，确保双方对成品有一致预期。',
            'Revision allowances vary by plan — see each tier\'s details on the pricing page. Revisions cover re-generation with adjusted direction notes (tone, pacing, pronunciation). If a delivery has objective errors — mispronounced words, missing lines, or technical quality issues — we redo it at no charge, regardless of revision count. Completed deliveries are non-refundable; if your project has specific requirements, state them clearly in your brief before production begins so both sides share the same expectations.'
          ),
        },
        {
          q: tx(
            'AI 生成的配音能和真人錄音一樣好嗎？',
            'AI 生成的配音能和真人录音一样好吗？',
            'Is AI-generated voiceover as good as a human recording?'
          ),
          a: tx(
            '對於旁白、線上課程、廣告和品牌內容而言，我們的人導 AI 配音在大多數製作情境下與真人錄音室錄音幾乎無異。我們使用以專業錄音室素材訓練的專屬聲音模型，搭配人類導演審核，確保自然表達與準確發音。若有高情感或角色演繹需求，我們也提供 100% 真人錄音升級選項。',
            '对于旁白、在线课程、广告和品牌内容而言，我们的真人导演 AI 配音在大多数制作场景中与真人录音室录音几乎无异。我们使用以专业录音室素材训练的专属声音模型，结合真人导演审核，确保自然表达与准确发音。如需高情感或角色演绎，我们也提供 100% 真人录音升级选项。',
            'For narration, e-learning, ads, and branded content, our human-directed AI voiceover is virtually indistinguishable from a studio recording in most production contexts. We use proprietary voice models trained on professional studio recordings, combined with human director review. For highly emotional or character-driven performance, a 100% human studio recording upgrade is also available.'
          ),
        },
        {
          q: tx(
            '什麼是「人導 AI 配音製作」？',
            '什么是「真人导演 AI 配音制作」？',
            'What is human-directed AI voice production?'
          ),
          a: tx(
            '人導 AI 配音是我們的核心方法論：AI 合成音頻初稿，資深聲音導演聆聽、調整節奏、修正發音、重新生成問題片段，並核准最終檔案。結合 AI 的速度與成本效率，以及專業錄音師的品質保障。',
            '真人导演 AI 配音是我们的核心方法论：AI 合成音频初稿，资深声音导演聆听、调整节奏、修正发音、重新生成问题片段，并审核最终文件。结合 AI 的速度与成本效率，以及专业录音师的品质保障。',
            'Human-directed AI voice production is our core methodology: AI synthesizes the audio draft, then a trained voice director listens through, adjusts pacing, catches mispronunciations, re-generates problem segments, and signs off on the final file. It combines the speed and cost efficiency of AI with the quality assurance of a seasoned studio professional.'
          ),
        },
        {
          q: tx(
            'Onyx Studios 支援哪些語言？',
            'Onyx Studios 支持哪些语言？',
            'What languages does Onyx Studios support?'
          ),
          a: tx(
            'Onyx Studios 涵蓋 30+ 語言，包括主要商業語言：英文（美式 / 英式）、普通話（繁體 / 簡體）、粵語、日文、韓文、西班牙文、法文、德文、葡萄牙文、義大利文、俄文、阿拉伯文、印地文、印尼文、越南文、泰文等。稀有語言（達里語、斯瓦希里語、緬甸語等）可按需求提供。',
            'Onyx Studios 涵盖 30+ 语言，包括主要商业语言：英文（美式 / 英式）、普通话（繁体 / 简体）、粤语、日文、韩文、西班牙文、法文、德文、葡萄牙文、意大利文、俄文、阿拉伯文、印地文、印尼文、越南文、泰文等。稀有语言（达里语、斯瓦希里语、缅甸语等）可按需提供。',
            'Onyx Studios covers 30+ languages, including major commercial languages: English (US / UK), Mandarin (Traditional / Simplified), Cantonese, Japanese, Korean, Spanish, French, German, Portuguese, Italian, Russian, Arabic, Hindi, Indonesian, Vietnamese, and Thai. Rare languages (Dari, Swahili, Burmese, etc.) are available on request.'
          ),
        },
        {
          q: tx(
            '可以指定口音嗎？（例如美式英文 vs 英式英文）',
            '可以指定口音吗？（例如美式英文 vs 英式英文）',
            'Can I request a specific accent within a language?'
          ),
          a: tx(
            '可以。下單或提交需求時，您可以指定所需的口音或區域變體，例如美式英文 vs. 英式英文、台灣普通話 vs. 大陸普通話、巴西葡萄牙文 vs. 歐洲葡萄牙文。我們的聲音陣容涵蓋最常見的區域變體。若特定口音對您的專案至關重要，請提早說明，以便我們在製作前確認可用性。',
            '可以。下单或提交需求时，您可以指定所需的口音或地区变体，例如美式英文 vs. 英式英文、台湾普通话 vs. 大陆普通话、巴西葡萄牙文 vs. 欧洲葡萄牙文。我们的声音阵容涵盖最常见的地区变体。若特定口音对您的项目至关重要，请提前说明，以便我们在制作前确认可用性。',
            'Yes. When ordering or submitting a brief, you can specify the accent or regional variant you need — for example, US English vs. UK English, Taiwanese Mandarin vs. Mainland Mandarin, or Brazilian Portuguese vs. European Portuguese. Our roster covers the most common regional variants. If a specific accent is critical to your project, mention it early so we can confirm availability before production begins.'
          ),
        },
        {
          q: tx(
            '可以複製我的品牌聲音或建立客製聲音模型嗎？',
            '可以复制我的品牌声音或建立定制声音模型吗？',
            'Can you clone a specific voice or build a custom voice model?'
          ),
          a: tx(
            '可以，但有前提條件。Onyx Studios 可依配音員的錄音建立客製 AI 聲音模型，適用品牌代言人、內部旁白，或透過我們的人才網絡媒合的配音員。配音員必須在任何模型訓練開始前提供明確書面同意並簽署授權協議——我們不在無書面同意的情況下複製任何聲音。客製聲音開發費用單獨報價，請聯繫我們並附上需求說明進行可行性評估。',
            '可以，但有前提条件。Onyx Studios 可依配音员的录音建立定制 AI 声音模型，适用品牌代言人、内部旁白，或通过我们的人才网络匹配的配音员。配音员必须在任何模型训练开始前提供明确书面同意并签署授权协议——我们不在无书面同意的情况下克隆任何声音。定制声音开发费用单独报价，请联系我们并附上需求说明进行可行性评估。',
            'Yes, with conditions. Onyx Studios can build a custom AI voice model from recordings of a consenting, contracted voice actor — whether that is your brand spokesperson, an internal narrator, or a talent sourced through our network. The voice actor must provide explicit written consent and sign a licensing agreement before any model training begins. We do not clone voices without documented consent. Custom voice development is quoted separately; contact us with your requirements for a feasibility assessment.'
          ),
        },
        {
          q: tx(
            '訂單包含哪些商業版權？',
            '订单包含哪些商业版权？',
            'What commercial rights do I receive with my order?'
          ),
          a: tx(
            '所有標準訂單均附授權範圍內的完整商業版權，涵蓋廣告、品牌影片、線上課程、內部通訊及數位發行，並附可驗證的授權憑證。廣播版權、永久全球版權與轉售授權可於高階方案或客製授權中取得。',
            '所有标准订单均附授权范围内的完整商业版权，涵盖广告、品牌视频、在线课程、内部通讯及数字发行，并附可验证的授权证书。广播版权、永久全球版权与转售授权可在高阶方案或定制授权中取得。',
            'All standard orders include full commercial rights for the licensed use case — ads, branded video, e-learning, internal communications, and digital distribution — plus a verifiable License Certificate. Broadcast rights, perpetual global rights, and resale rights are available on higher-tier plans or via custom licensing.'
          ),
        },
        {
          q: tx(
            '交付的檔案格式是什麼？',
            '交付的文件格式是什么？',
            'What file formats do you deliver?'
          ),
          a: tx(
            '配音成品預設以 WAV + MP3 廣播品質格式交付。語音數據與現場弦樂錄製專案預設為 48 kHz / 24-bit WAV。配音專案交付物含配音音軌，視情況附字幕檔（SRT / VTT）。如有特殊格式需求請在提案時說明。',
            '配音成品预设以 WAV + MP3 广播品质格式交付。语音数据与现场弦乐录制项目预设为 48 kHz / 24-bit WAV。配音项目交付物含配音音轨，视情况附字幕文件（SRT / VTT）。如有特殊格式需求请在提案时说明。',
            'Voiceover deliverables are provided as broadcast-quality WAV + MP3 by default. Speech data and live strings recording projects default to 48 kHz / 24-bit WAV. Dubbing projects include dubbed audio tracks and, where applicable, subtitle files (SRT / VTT). If you have specific format requirements, include them in your brief.'
          ),
        },
      ],
    },
    {
      category: tx('多語 AI 配音', '多语 AI 配音', 'AI Dubbing'),
      items: [
        {
          q: tx(
            'Onyx Studios 如何保留原聲演員的聲音？',
            'Onyx Studios 如何保留原声演员的声音？',
            'How does Onyx Studios preserve the original actor\'s voice in dubbing?'
          ),
          a: tx(
            '我們的 AI 配音技術複製原聲演員的音色指紋、音調輪廓與聲線質感，再以該聲音合成目標語言的翻譯稿。觀眾聽到的是原演員的聲音識別，而非通用 TTS 聲音——即使是在完全不同語言的版本中。',
            '我们的 AI 配音技术复制原声演员的音色指纹、音调轮廓与声线质感，再以该声音合成目标语言的翻译稿。观众听到的是原演员的声音识别，而非通用 TTS 声音——即使是完全不同语言的版本。',
            'Our AI dubbing technology clones the tonal fingerprint, pitch contour, and vocal texture of the original speaker, then synthesizes that voice speaking the translated script in the target language. The audience hears the original actor\'s voice identity — not a generic TTS voice — even in a completely different language version.'
          ),
        },
        {
          q: tx(
            '什麼是唇形同步配音？影片長度會改變嗎？',
            '什么是唇形同步配音？影片长度会改变吗？',
            'What is lip-sync dubbing, and will my video length change?'
          ),
          a: tx(
            '唇形同步配音將配音音頻的時序對齊原演員螢幕上的嘴型動作，使聲音看起來自然。Onyx Studios 使用 AI 輔助唇形同步，在不重新剪輯畫面的情況下，將音素時長和語句對齊原片。\n\n需要特別說明的是：由於不同語言的音節結構與語句長度存在差異（例如英文語句通常比中文長），配音版影片的總時長可能與原片略有不同，一般誤差約在數秒至十數秒之間（如原片 4:00，配音版可能為 4:10）。這是語言特性造成的正常現象，而非品質問題，業界的配音專案普遍如此。若您對總時長有嚴格要求，請在提案階段告知我們，我們將針對需求進行評估。',
            '唇形同步配音将配音音频的时序对齐原演员屏幕上的口型动作，使声音看起来自然。Onyx Studios 使用 AI 辅助唇形同步，在不重新剪辑画面的情况下，将音素时长和语句对齐原片。\n\n需要特别说明的是：由于不同语言的音节结构与语句长度存在差异（例如英文语句通常比中文长），配音版影片的总时长可能与原片略有不同，一般误差约在数秒至十数秒之间（如原片 4:00，配音版可能为 4:10）。这是语言特性造成的正常现象，而非质量问题，业界配音项目普遍如此。如您对总时长有严格要求，请在提案阶段告知我们，我们将针对需求进行评估。',
            'Lip-sync dubbing aligns the timing of dubbed audio to the on-screen mouth movements of the original actor so speech appears natural when viewed. Onyx Studios uses AI-assisted lip-sync to match phoneme duration and phrasing to the original video without re-editing the picture.\n\nOne important note: because different languages vary in syllable structure and sentence length — for example, English phrases are often longer than their Mandarin equivalents — the total duration of a dubbed video may differ slightly from the original. A typical drift is a few seconds to around ten seconds per four minutes of content (e.g., a 4:00 original may become a 4:10 dubbed version). This is a normal characteristic of cross-language dubbing, not a quality issue, and is standard across the industry. If you have strict runtime requirements, please let us know at the briefing stage and we will assess feasibility.'
          ),
        },
        {
          q: tx(
            '配音服務包含翻譯嗎？還是需要自備腳本？',
            '配音服务包含翻译吗？还是需要自备脚本？',
            'Does dubbing include translation, or do I need to provide the script?'
          ),
          a: tx(
            '預設情況下，客戶需提供已翻譯並經審核的腳本，我們依稿製作。若您需要翻譯服務，可作為加購項目另行報價——請在需求單中說明來源語言、目標語言及內容性質，我們將隨製作報價一併提供翻譯報價。',
            '默认情况下，客户需提供已翻译并经审核的脚本，我们依稿制作。如您需要翻译服务，可作为加购项目另行报价——请在需求单中说明来源语言、目标语言及内容性质，我们将随制作报价一并提供翻译报价。',
            'By default, clients provide the translated, approved script and we produce from it. If you need translation included, it can be arranged as a paid add-on — include the source language, target language, and content type in your brief and we will provide a translation quote alongside the production quote.'
          ),
        },
      ],
    },
    {
      category: tx('音樂製作', '音乐制作', 'Music Production'),
      items: [
        {
          q: tx(
            'Onyx Studios 的 AI 輔助音樂製作是什麼？',
            'Onyx Studios 的 AI 辅助音乐制作是什么？',
            'What is AI-assisted music production at Onyx Studios?'
          ),
          a: tx(
            'Onyx Studios 提供混合 AI 音樂製作：AI 工具生成編曲草圖與方向 Demo，再由資深製作人發展成完整製作，涵蓋編曲、管絃配器、混音與母帶。成品是原創、可上線的音樂，時間與成本遠低於傳統錄音室創作。',
            'Onyx Studios 提供混合 AI 音乐制作：AI 工具生成编曲草图与方向 Demo，再由资深制作人发展成完整制作，涵盖编曲、管弦配器、混音与母带。成品是原创、可上线的音乐，时间与成本远低于传统录音室创作。',
            'Onyx Studios offers hybrid AI music production: AI tools generate arrangement sketches and direction demos, which senior producers then develop into full production — arrangement, orchestration, mixing, and mastering. The result is original, production-ready music at a fraction of the time and cost of traditional studio composition.'
          ),
        },
        {
          q: tx(
            '我委製的音樂版權歸誰？',
            '我委制的音乐版权归谁？',
            'Who owns the music I commission?'
          ),
          a: tx(
            '視方案而定。AI Curator 與 Pro Arrangement 方案完款後取得永久商業使用授權，涵蓋串流、廣告、同步授權與廣播，但作品的底層著作權仍歸 Onyx Studios 所有，我們不會將您的委製作品轉售給其他客戶。Masterpiece 方案（頂階）則為完整著作權買斷（Work-for-hire），作品所有權全數移交給您。分軌原始檔可於 Pro Arrangement 以上方案取得。詳細授權範圍請參閱各方案說明。',
            '视方案而定。AI Curator 与 Pro Arrangement 方案完款后取得永久商业使用授权，涵盖流媒体、广告、同步授权与广播，但作品的底层著作权仍归 Onyx Studios 所有，我们不会将您的委制作品转售给其他客户。Masterpiece 方案（顶阶）则为完整著作权买断（Work-for-hire），作品所有权全数移交给您。分轨原始文件可在 Pro Arrangement 以上方案取得。详细授权范围请参阅各方案说明。',
            'It depends on the plan. AI Curator and Pro Arrangement plans include a perpetual commercial license upon full payment — covering streaming, advertising, sync, and broadcast — but the underlying composition copyright remains with Onyx Studios, and your commissioned piece is never re-sold to other clients. The Masterpiece tier is a full copyright buyout (work-for-hire): complete ownership transfers to you. Stems and source files are available from Pro Arrangement upward. See each plan\'s details for the exact licensing scope.'
          ),
        },
      ],
    },
    {
      category: tx('語音數據', '语音数据', 'Speech Data'),
      items: [
        {
          q: tx(
            '什麼是 AI 語音數據採集？你們有提供標注服務嗎？',
            '什么是 AI 语音数据采集？你们有提供标注服务吗？',
            'What is AI speech data collection? Do you offer annotation?'
          ),
          a: tx(
            'AI 語音數據採集是錄製、切分、轉寫大量人聲音頻以供 TTS / ASR 模型訓練使用的服務。Onyx Studios 的核心交付涵蓋：人才招募與錄音指導、音頻品質管控、依規格切分、逐字稿與基礎元數據標記，交付可直接進入訓練管線的數據集。\n\n標注服務可依需求加購，但可行性視語系與標注複雜度而定——基礎時間戳、語者識別等較標準的任務通常可承接；複雜的情緒標注、多維度語音分類等需個案評估。若您有標注需求，請在提案時一併說明，我們將依語系與規格提供可行性評估與報價。',
            'AI 语音数据采集是录制、切分、转写大量人声音频以供 TTS / ASR 模型训练使用的服务。Onyx Studios 的核心交付涵盖：人才招募与录音指导、音频质量管控、依规格切分、逐字稿与基础元数据标记，交付可直接进入训练管线的数据集。\n\n标注服务可依需求加购，但可行性视语系与标注复杂度而定——基础时间戳、说话人识别等较标准的任务通常可承接；复杂的情绪标注、多维语音分类等需个案评估。如您有标注需求，请在提案时一并说明，我们将依语系与规格提供可行性评估与报价。',
            'AI speech data collection covers recording, segmenting, and transcribing large volumes of human voice audio for TTS and ASR model training. Onyx Studios\' core deliverable includes talent recruitment and session direction, audio QC, spec-compliant segmentation, transcription, and basic metadata tagging — datasets delivered ready for training pipelines.\n\nAnnotation is available as an add-on, subject to language and complexity. Standard tasks such as timestamp alignment and speaker identification are generally feasible; more complex annotation types — emotion labeling, multi-dimensional phonetic classification, and similar — are evaluated on a case-by-case basis. If annotation is part of your requirement, include the spec in your brief and we will assess feasibility and provide a separate quote.'
          ),
        },
      ],
    },
    {
      category: tx('企業合作與版權', '企业合作与版权', 'Enterprise & Legal'),
      items: [
        {
          q: tx(
            'Onyx Studios 有企業合作方案嗎？',
            'Onyx Studios 有企业合作方案吗？',
            'Do you work with enterprise clients?'
          ),
          a: tx(
            '是的。Onyx Studios 與廣告代理商、串流平台、線上教育公司、遊戲發行商，以及打造自有聲音模型的 AI 公司合作。企業客戶可協商客製交期保證條款（SLA）、保密協議（NDA）及專屬製作產能配置。企業洽詢請聯繫 support@onyxstudios.ai。',
            '是的。Onyx Studios 与广告代理商、流媒体平台、在线教育公司、游戏发行商，以及打造自有声音模型的 AI 公司合作。企业客户可协商定制交期保证条款（SLA）、保密协议（NDA）及专属制作产能配置。企业咨询请联系 support@onyxstudios.ai。',
            'Yes. Onyx Studios works with advertising agencies, streaming platforms, e-learning companies, game publishers, and AI companies building proprietary voice models. Enterprise clients can negotiate custom delivery guarantee terms (SLA), NDAs, and dedicated production capacity. Contact support@onyxstudios.ai for enterprise inquiries.'
          ),
        },
        {
          q: tx(
            '我的腳本與專案內容會保密嗎？你們簽 NDA 嗎？',
            '我的脚本与项目内容会保密吗？你们签 NDA 吗？',
            'Is my content kept confidential? Do you sign NDAs?'
          ),
          a: tx(
            '是的。所有客戶腳本、需求內容與交付物均視為機密，不用於合約範圍以外的任何用途。若企業客戶在分享資料前需要正式 NDA，我們可以配合簽署——請在提交需求前聯繫我們，我們會優先安排。',
            '是的。所有客户脚本、需求内容与交付物均视为机密，不用于合同范围以外的任何用途。如企业客户在分享资料前需要正式 NDA，我们可以配合签署——请在提交需求前联系我们，我们会优先安排。',
            'Yes. All client scripts, project briefs, and deliverables are treated as confidential and are not used for any purpose beyond the contracted scope. If you require a formal NDA before sharing materials, we are happy to sign one — contact us before submitting your brief and we will arrange it promptly.'
          ),
        },
        {
          q: tx(
            'Onyx Studios 的 AI 聲音有合法授權嗎？',
            'Onyx Studios 的 AI 声音有合法授权吗？',
            'Are the AI voices at Onyx Studios legally licensed?'
          ),
          a: tx(
            '是的。Onyx Studios 的每個 AI 聲音均由簽約、知情且已獲報酬的配音員錄製素材構建。我們不使用爬取、未授權或匿名的聲音資料。每個聲音模型均受專屬授權協議保護，每筆訂單附可驗證的授權憑證。',
            '是的。Onyx Studios 的每个 AI 声音均由签约、知情且已获报酬的配音员录制素材构建。我们不使用抓取、未授权或匿名的声音数据。每个声音模型均受专属授权协议保护，每笔订单附可验证的授权证书。',
            'Yes. Every AI voice at Onyx Studios is built from recordings by consenting, contracted voice actors who have been compensated for their contribution. We do not use scraped, unauthorized, or anonymous voice data. Each voice model is covered by a proprietary licensing agreement, and every client order includes a verifiable License Certificate.'
          ),
        },
      ],
    },
  ];

  // Flatten for FAQPage schema — use English answers for max LLM discoverability
  const schemaFaqs = faqs.flatMap(cat =>
    cat.items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    }))
  );

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: schemaFaqs,
  };

  return (
    <>
      {/* FAQPage structured data for Google rich results + LLM citation */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="min-h-screen bg-black text-white">
        {/* Hero */}
        <section className="pt-28 pb-16 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-500/[0.08] px-5 py-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-sm tracking-wide text-gray-100 font-medium">
                {tx('常見問題', '常见问题', 'FAQ')}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight">
              {tx('常見問題', '常见问题', 'Frequently Asked\nQuestions')}
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              {tx(
                '關於 AI 配音、多語配音、音樂製作與語音數據服務的常見問題。',
                '关于 AI 配音、多语配音、音乐制作与语音数据服务的常见问题。',
                'Everything you need to know about our AI voiceover, dubbing, music production, and speech data services.'
              )}
            </p>
          </div>
        </section>

        {/* FAQ content */}
        <section className="pb-24 px-4">
          <div className="max-w-3xl mx-auto space-y-16">
            {faqs.map((cat, ci) => (
              <div key={ci}>
                {/* Category heading */}
                <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-purple-400 mb-8 pb-3 border-b border-white/10">
                  {cat.category}
                </h2>

                {/* Q&A items */}
                <div className="space-y-10">
                  {cat.items.map((item, qi) => (
                    <div key={qi}>
                      <h3 className="text-lg md:text-xl font-semibold text-white mb-3 leading-snug">
                        {item.q}
                      </h3>
                      <p className="text-gray-400 leading-relaxed text-[15px] md:text-base">
                        {item.a}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 border-t border-white/5 text-center">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
              {tx('還有其他問題？', '还有其他问题？', 'Still have questions?')}
            </h2>
            <p className="text-gray-400 mb-8 text-[15px] leading-relaxed">
              {tx(
                '我們的團隊隨時準備為您解答，也歡迎直接送出專案需求。',
                '我们的团队随时准备为您解答，也欢迎直接提交项目需求。',
                'Our team is ready to help. You can also submit a project brief directly and we\'ll get back to you within one business day.'
              )}
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white text-black px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors"
            >
              {tx('聯繫我們', '联系我们', 'Contact Us')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}
