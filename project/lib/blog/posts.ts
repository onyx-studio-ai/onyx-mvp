// Blog content store — dependency-free, trilingual.
// Each post body is an array of typed blocks; inline **bold** is rendered by the page.
// zh-CN falls back to zh-TW (readable), then en — see `pick()`.

export type L = { en: string; 'zh-TW'?: string; 'zh-CN'?: string };

export type Block =
  | { t: 'h2'; text: L }
  | { t: 'p'; text: L };

export interface BlogPost {
  slug: string;
  date: string; // ISO yyyy-mm-dd
  readMins: number;
  cover: string; // path under /public
  tags: string[];
  title: L;
  dek: L; // subtitle / excerpt
  body: Block[];
}

export function pick(l: L | undefined, locale: string): string {
  if (!l) return '';
  if (locale === 'zh-TW') return l['zh-TW'] ?? l.en;
  if (locale === 'zh-CN') return l['zh-CN'] ?? l['zh-TW'] ?? l.en;
  return l.en;
}

const langQA: BlogPost = {
  slug: 'quality-check-ai-voice-language-you-dont-speak',
  date: '2026-06-14',
  readMins: 4,
  cover: '/blog/lang-qa-hero.png',
  tags: ['AI Voice', 'Localization', 'Text-to-Speech', 'Quality Assurance'],
  title: {
    en: 'AI Can Speak 40 Languages. The Data Says It Still Gets Them Wrong.',
    'zh-TW': 'AI 會講 40 種語言。但數據說,它還是會講錯。',
    'zh-CN': 'AI 会讲 40 种语言。但数据说,它还是会讲错。',
  },
  dek: {
    en: "Generative voice AI is fast and fluent. But accuracy in a language you can't hear is a measurable risk — here are the numbers, and why we built our whole process around a human.",
    'zh-TW': '生成式語音 AI 又快又流利。但在你聽不懂的語言裡,「正確性」是可量化的風險 —— 這是數字,以及我們為什麼把整套流程建在「真人」上。',
    'zh-CN': '生成式语音 AI 又快又流利。但在你听不懂的语言里,「正确性」是可量化的风险 —— 这是数字,以及我们为什么把整套流程建在「真人」上。',
  },
  body: [
    {
      t: 'p',
      text: {
        en: 'Generative voice AI has a genuinely impressive trick: type a script, choose a language, and seconds later you have a fluent voice in Japanese, Cantonese, Arabic, or Brazilian Portuguese. The speed is real. So is the blind spot hiding inside it — because if you don’t speak the language you just generated, you have no way of knowing whether it’s actually correct. And neither does the model. It simply sounds confident, which is not the same thing as being right.',
        'zh-TW': '生成式語音 AI 有個確實厲害的本事:打一段稿、選個語言,幾秒後就有一段流利的配音 —— 日文、粵語、阿拉伯文、巴西葡萄牙文都行。速度是真的;但藏在裡面的盲點也是真的 —— 因為你剛生成的那個語言,如果你自己不會,你就無從判斷它到底對不對。而模型也不知道。它只是「聽起來」很有自信,而那跟「正確」是兩回事。',
        'zh-CN': '生成式语音 AI 有个确实厉害的本事:打一段稿、选个语言,几秒后就有一段流利的配音 —— 日文、粤语、阿拉伯文、巴西葡萄牙文都行。速度是真的;但藏在里面的盲点也是真的 —— 因为你刚生成的那个语言,如果你自己不会,你就无从判断它到底对不对。而模型也不知道。它只是「听起来」很有自信,而那跟「正确」是两回事。',
      },
    },
    {
      t: 'p',
      text: {
        en: 'The numbers make the gap concrete. Mandarin is full of polyphones — characters whose pronunciation changes with context, like 乾 (gān or qián) or 行 (xíng or háng) — and choosing the wrong reading can change what a sentence means. Even the best published models for resolving them top out at around **94% accuracy** (Polyphone BERT, 2022). That sounds high until you translate it into practice: **roughly one wrong reading in every seventeen polyphonic characters**. A single paragraph can contain dozens, so the errors don’t stay isolated — they accumulate. And this is the best-case scenario; researchers building text-to-speech specifically for Taiwanese Mandarin (BreezyVoice, 2025) still describe polyphone disambiguation as an open, unsolved problem.',
        'zh-TW': '數字會讓這個落差變得具體。中文滿是多音字 —— 同一個字的讀音隨語境改變,例如「乾」(gān 或 qián)、「行」(xíng 或 háng)—— 讀錯一個,整句的意思就可能變了。而即使是目前已發表最好的多音字消歧模型,正確率也只到 **約 94%**(Polyphone BERT, 2022)。聽起來很高,換算成實務卻是:**大約每十七個多音字就會錯一個**。一個段落動輒幾十個,於是錯誤不會單獨存在 —— 它們會累加。而這還是最理想的情況;連專門為台灣國語打造語音合成的研究(BreezyVoice, 2025),都仍把多音字消歧形容為尚未解決的難題。',
        'zh-CN': '数字会让这个落差变得具体。中文满是多音字 —— 同一个字的读音随语境改变,例如「重」(zhòng 或 chóng)、「行」(xíng 或 háng)—— 读错一个,整句的意思就可能变了。而即使是目前已发表最好的多音字消歧模型,正确率也只到 **约 94%**(Polyphone BERT, 2022)。听起来很高,换算成实务却是:**大约每十七个多音字就会错一个**。一个段落动辄几十个,于是错误不会单独存在 —— 它们会累加。而这还是最理想的情况;连专门为台湾普通话打造语音合成的研究(BreezyVoice, 2025),都仍把多音字消歧形容为尚未解决的难题。',
      },
    },
    {
      t: 'p',
      text: {
        en: "A mispronunciation in a language you can't hear might feel like a cosmetic detail. It isn't. CSA Research's well-known “Can't Read, Won't Buy” study, which surveyed 8,709 consumers across 29 countries, found that **76% of people prefer to buy in their own language, and 40% won't buy from content in another language at all**. Your audience hears the error you can't — a brand name said wrong, a polyphone that quietly flips a sentence — and what reads to you as “good enough AI output” reads to them as a company that didn't care enough to get their language right. The cost isn't the glitch; it's the trust you lose in the exact market you paid to enter.",
        'zh-TW': '在一個你聽不懂的語言裡唸錯字,感覺像小細節。但它不是。CSA Research 著名的「Can’t Read, Won’t Buy」研究,調查了 29 國、8,709 位消費者,發現 **76% 的人偏好用自己的語言購買,而 40% 根本不會購買非母語的內容**。你聽不出來的錯,你的受眾聽得出來 —— 一個唸錯的品牌名、一個悄悄把句意改掉的多音字 —— 在你看來是「還行的 AI 成品」,在他們聽來卻是「這家公司連把我的語言講對都不夠在乎」。代價不是那個瑕疵本身,而是你在「花了錢想打進的市場」裡流失掉的信任。',
        'zh-CN': '在一个你听不懂的语言里念错字,感觉像小细节。但它不是。CSA Research 著名的「Can’t Read, Won’t Buy」研究,调查了 29 国、8,709 位消费者,发现 **76% 的人偏好用自己的语言购买,而 40% 根本不会购买非母语的内容**。你听不出来的错,你的受众听得出来 —— 一个念错的品牌名、一个悄悄把句意改掉的多音字 —— 在你看来是「还行的 AI 成品」,在他们听来却是「这家公司连把我的语言讲对都不够在乎」。代价不是那个瑕疵本身,而是你在「花了钱想打进的市场」里流失掉的信任。',
      },
    },
    {
      t: 'p',
      text: {
        en: 'And pronunciation is only one of the things a non-speaker can’t catch. The register can be wrong — formal where it should be warm. The prosody can be subtly off — the rhythm and stress that tell a native listener “a person made this.” The accent can miss entirely, delivering mainland Mandarin when the brief called for Taiwan. A native speaker notices all of it in a single listen. The person who pressed “generate” notices none of it.',
        'zh-TW': '而發音還只是非母語者抓不到的其中一項。語域可能不對 —— 該溫暖的地方卻很官腔;節奏可能微妙地走樣 —— 那種讓母語者覺得「這是人做的」的韻律;口音可能整個跑掉 —— 你要台灣國語,它卻給你大陸腔。這些,母語者聽一遍就全抓到;按下「生成」的那個人,一個都抓不到。',
        'zh-CN': '而发音还只是非母语者抓不到的其中一项。语域可能不对 —— 该温暖的地方却很官腔;节奏可能微妙地走样 —— 那种让母语者觉得「这是人做的」的韵律;口音可能整个跑掉 —— 你要台湾普通话,它却给你大陆腔。这些,母语者听一遍就全抓到;按下「生成」的那个人,一个都抓不到。',
      },
    },
    {
      t: 'p',
      text: {
        en: 'This is the rule we kept when we moved from running a voice studio — which Onyx has done since 2008, with more than 1,500 voice actors — into AI. Pure-AI tools quietly skip it: every Onyx delivery, in any language where accuracy matters, is checked by a native human before it reaches the client. Not re-recorded — verified. A native proofreader confirms the pronunciation of names, brands and numbers, checks that every polyphone is read correctly in context, makes sure the meaning is intact, the tone matches the brief, and the rhythm sounds natural to someone who actually speaks the language. If it passes, it ships. If it doesn’t, we fix it before the client ever hears it. It isn’t glamorous, but it is the entire difference between “AI-generated” and “ready to broadcast.”',
        'zh-TW': '這正是我們從「經營配音公司」(Onyx 從 2008 年就在做,旗下超過 1,500 位配音員)走進 AI 時,堅持保留的一條規則 —— 而這條規則,純 AI 工具悄悄略過了:每一筆 Onyx 的交付,只要是正確性會出事的語言,在送到客戶手上前,都會經過一位母語真人。不是重錄,是驗證。母語校對確認人名、品牌、數字的發音,檢查每個多音字在語境裡讀對,確保語意完整、語氣符合需求、節奏對真正會這個語言的人來說自然。過了就出貨;沒過,我們在客戶聽到前就修掉。這份工作不光鮮,但它就是「AI 生成」與「可上線播出」之間的全部差別。',
        'zh-CN': '这正是我们从「经营配音公司」(Onyx 从 2008 年就在做,旗下超过 1,500 位配音员)走进 AI 时,坚持保留的一条规则 —— 而这条规则,纯 AI 工具悄悄略过了:每一笔 Onyx 的交付,只要是正确性会出事的语言,在送到客户手上前,都会经过一位母语真人。不是重录,是验证。母语校对确认人名、品牌、数字的发音,检查每个多音字在语境里读对,确保语意完整、语气符合需求、节奏对真正会这个语言的人来说自然。过了就出货;没过,我们在客户听到前就修掉。这份工作不光鲜,但它就是「AI 生成」与「可上线播出」之间的全部差别。',
      },
    },
    {
      t: 'p',
      text: {
        en: 'For anyone buying multilingual audio, that difference is the whole point. You can confidently ship ads, dubbing, e-learning or audiobooks in languages you will never personally verify, knowing a real native speaker signed off on every second. You get the speed of AI without paying the silent-error tax that comes with trusting a model you can’t audit.',
        'zh-TW': '對任何要買多語配音的人來說,這個差別就是重點。你可以放心地把廣告、配音、線上課程、有聲書,交付在你這輩子都不會親自驗證的語言上 —— 因為你知道,每一秒都有一位真正的母語者簽了名。你得到 AI 的速度,卻不必付出「信任一個你無法稽核的模型」所帶來的靜默錯誤稅。',
        'zh-CN': '对任何要买多语配音的人来说,这个差别就是重点。你可以放心地把广告、配音、在线课程、有声书,交付在你这辈子都不会亲自验证的语言上 —— 因为你知道,每一秒都有一位真正的母语者签了名。你得到 AI 的速度,却不必付出「信任一个你无法稽核的模型」所带来的静默错误税。',
      },
    },
    {
      t: 'p',
      text: {
        en: 'A quality layer is only as strong as the people in it, and we’re expanding ours. Onyx is building a Language QA network of fast, reliable native proofreaders — Mandarin (Taiwan), Cantonese, Japanese, Korean, Thai, Spanish and more. If you have a native ear for natural delivery, or work as a professional translator or proofreader and turn jobs around quickly, we’d like to hear from you at onyxstudios.ai.',
        'zh-TW': '把關層的強度,取決於裡面的人,而我們正在擴大它。Onyx 正在建立一個 Language QA 網絡,徵求快速、可靠的母語校對 —— 台灣國語、粵語、日文、韓文、泰文、西班牙文等等。如果你對自然的語感有耳朵,或你是專業翻譯/校對而且回件迅速,我們很想在 onyxstudios.ai 認識你。',
        'zh-CN': '把关层的强度,取决于里面的人,而我们正在扩大它。Onyx 正在建立一个 Language QA 网络,招募快速、可靠的母语校对 —— 台湾普通话、粤语、日文、韩文、泰文、西班牙文等等。如果你对自然的语感有耳朵,或你是专业翻译/校对而且交件迅速,我们很想在 onyxstudios.ai 认识你。',
      },
    },
    {
      t: 'p',
      text: {
        en: 'AI can now generate a voice in almost any language. Making sure that voice is actually right still takes a human who speaks it — and that is the part we refuse to skip.',
        'zh-TW': 'AI 如今幾乎能用任何語言生出一個聲音。但要確定那個聲音「是對的」,仍然需要一個真的會這個語言的人 —— 而這一塊,我們不省。',
        'zh-CN': 'AI 如今几乎能用任何语言生出一个声音。但要确定那个声音「是对的」,仍然需要一个真的会这个语言的人 —— 而这一块,我们不省。',
      },
    },
  ],
};

export const posts: BlogPost[] = [langQA];

export function getAllPosts(): BlogPost[] {
  return [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}
