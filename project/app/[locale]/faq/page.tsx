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
            'AI 配音方案最低從 $29 起。費用依字數、語言、交期與是否包含人類導演精修而定。完整費率及方案比較請參閱 onyxstudios.ai/pricing。',
            'AI 配音方案最低从 $29 起。费用依字数、语言、交期与是否包含真人导演精修而定。完整费率及方案比较请参阅 onyxstudios.ai/pricing。',
            'AI voiceover plans start from $29. Pricing depends on word count, language, delivery speed, and whether human director polish is included. See full tier breakdowns at onyxstudios.ai/pricing.'
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
            'Onyx Studios 涵蓋 16+ 主要商業語言：英文（美式 / 英式）、普通話（繁體 / 簡體）、粵語、日文、韓文、西班牙文、法文、德文、葡萄牙文、義大利文、俄文、阿拉伯文、印地文、印尼文、越南文、泰文。稀有語言（達里語、斯瓦希里語、緬甸語等）可按需求提供。',
            'Onyx Studios 涵盖 16+ 主要商业语言：英文（美式 / 英式）、普通话（繁体 / 简体）、粤语、日文、韩文、西班牙文、法文、德文、葡萄牙文、意大利文、俄文、阿拉伯文、印地文、印尼文、越南文、泰文。稀有语言（达里语、斯瓦希里语、缅甸语等）可按需提供。',
            'Onyx Studios covers 16+ major commercial languages: English (US / UK), Mandarin (Traditional / Simplified), Cantonese, Japanese, Korean, Spanish, French, German, Portuguese, Italian, Russian, Arabic, Hindi, Indonesian, Vietnamese, and Thai. Rare languages (Dari, Swahili, Burmese, etc.) are available on request.'
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
            '預設以廣播品質 WAV（48 kHz / 24-bit）交付。可依需求提供 MP3 或其他格式。配音專案交付物含配音音軌，視情況附字幕檔（SRT / VTT）。',
            '默认以广播品质 WAV（48 kHz / 24-bit）交付。可按需提供 MP3 或其他格式。配音项目交付物含配音音轨，视情况附字幕文件（SRT / VTT）。',
            'Deliverables are provided as broadcast-quality WAV (48 kHz / 24-bit) by default. MP3 and other formats are available on request. Dubbing projects include dubbed audio tracks and, where applicable, subtitle files (SRT / VTT).'
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
            '什麼是唇形同步配音？',
            '什么是唇形同步配音？',
            'What is lip-sync dubbing and how does it work?'
          ),
          a: tx(
            '唇形同步配音將配音音頻的時序對齊原演員螢幕上的嘴型動作，使聲音看起來自然。Onyx Studios 使用 AI 輔助唇形同步，在不重新剪輯畫面的情況下，將音素時長和語句與原片對齊。',
            '唇形同步配音将配音音频的时序对齐原演员屏幕上的口型动作，使声音看起来自然。Onyx Studios 使用 AI 辅助唇形同步，在不重新剪辑画面的情况下，将音素时长和语句与原片对齐。',
            'Lip-sync dubbing aligns the timing of dubbed audio to the on-screen mouth movements of the original actor so speech appears natural when viewed. Onyx Studios uses AI-assisted lip-sync to match phoneme duration and phrasing to the original video without re-editing the picture.'
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
      ],
    },
    {
      category: tx('語音數據', '语音数据', 'Speech Data'),
      items: [
        {
          q: tx(
            '什麼是 AI 語音數據採集？',
            '什么是 AI 语音数据采集？',
            'What is AI speech data collection?'
          ),
          a: tx(
            'AI 語音數據採集是錄製、切分、轉寫及標註大量人聲音頻以訓練 TTS / ASR AI 模型的完整流程。Onyx Studios 管理整個流程：招募與指導配音人才、品質管控音頻、按規格切分錄音，並交付已標註、可用於模型訓練的數據集。',
            'AI 语音数据采集是录制、切分、转写及标注大量人声音频以训练 TTS / ASR AI 模型的完整流程。Onyx Studios 管理整个流程：招募与指导配音人才、质量管控音频、按规格切分录音，并交付已标注、可用于模型训练的数据集。',
            'AI speech data collection is the end-to-end process of recording, segmenting, transcribing, and annotating large volumes of human voice audio to train TTS and ASR AI models. Onyx Studios manages the full pipeline: recruiting and directing voice talent, QC-ing audio quality, segmenting recordings to specification, and delivering labeled datasets ready for model training.'
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
            '是的。Onyx Studios 與廣告代理商、串流平台、線上教育公司、遊戲發行商，以及打造自有聲音模型的 AI 公司合作。我們支援客製 SLA、NDA、白牌交付及專屬製作產能。企業洽詢請聯繫 support@onyxstudios.ai。',
            '是的。Onyx Studios 与广告代理商、流媒体平台、在线教育公司、游戏发行商，以及打造自有声音模型的 AI 公司合作。我们支持定制 SLA、NDA、白牌交付及专属制作产能。企业咨询请联系 support@onyxstudios.ai。',
            'Yes. Onyx Studios works with advertising agencies, streaming platforms, e-learning companies, game publishers, and AI companies building proprietary voice models. We support custom SLAs, NDAs, white-label delivery, and dedicated production capacity. Contact support@onyxstudios.ai for enterprise inquiries.'
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
