'use client';

/*
  公開徵集表單元件(Wing 2026-08-07)—— 免登入、手機優先、三語(繁中/簡中/英文)。
  活動內容(標題/文案/案件)來自 lib/opencall-campaigns.ts;每個勾選語系各自一個上傳格,
  檔案自動綁語系。資料進 opencall_submissions + prospects(見 /api/opencall)。
  亮度守則:深色底內文 ≥ gray-200,詳見記憶 dark-ui-min-brightness。
*/

import { useState, useEffect, useRef } from 'react';
import { Mic, Upload, CheckCircle2, Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCampaign, pickL3, type OpencallCampaign } from '@/lib/opencall-campaigns';

const AUDIO_EXT = ['m4a', 'mp3', 'wav', 'aac', 'ogg', 'oga', 'opus', 'flac', 'amr', 'awb', 'mp4', 'm4r', '3gp', '3gpp', 'caf', 'aif', 'aiff', 'wma', 'webm', 'weba'];

export default function OpencallForm({ locale, slug }: { locale: string; slug?: string }) {
  const tx = (tw: string, cn: string, en: string) => (locale === 'zh-CN' ? cn : locale.startsWith('zh') ? tw : en);
  const campaign: OpencallCampaign | null = getCampaign(slug);
  const L = (v: [string, string, string]) => pickL3(v, locale);

  const [lineUrl, setLineUrl] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: '', email: '', phone: '', messenger_app: 'line', messenger_id: '', native_language: '', accent: '', location: '', expected_fee: '', referrer: '', note: '', website: '' });
  const [files, setFiles] = useState<{ case: string; name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingCase = useRef('');

  useEffect(() => {
    fetch('/api/opencall').then((r) => r.json()).then((j) => setLineUrl(j.lineUrl || null)).catch(() => {});
  }, []);

  const MESSENGERS = [
    { v: 'line', label: 'LINE', hint: tx('LINE ID(台灣地區)', 'LINE ID(台湾地区)', 'LINE ID (Taiwan)') },
    { v: 'wechat', label: tx('微信', '微信', 'WeChat'), hint: tx('微信號(大陸地區)', '微信号(大陆地区)', 'WeChat ID (mainland China)') },
    { v: 'whatsapp', label: 'WhatsApp', hint: tx('WhatsApp 電話(香港地區)', 'WhatsApp 电话(香港地区)', 'WhatsApp number (Hong Kong)') },
  ];

  if (!campaign || !campaign.active) {
    return (
      <main className="min-h-screen bg-black text-white px-5 pt-32 pb-16 text-center">
        <p className="text-xl font-bold mb-2">{tx('此徵集不存在或已結束', '此征集不存在或已结束', 'This open call has ended or does not exist.')}</p>
        <p className="text-gray-300">{tx('歡迎關注我們的官方 LINE 或網站,取得最新徵集消息。', '欢迎关注我们的官方渠道,获取最新征集消息。', 'Follow our official channels for future open calls.')}</p>
      </main>
    );
  }

  const toggle = (code: string) => setSel((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const cs = pendingCase.current;
    setErr('');
    for (const f of Array.from(list)) {
      if (files.filter((x) => x.case === cs).length >= 2) { setErr(tx('每個語系最多 2 個檔案', '每个语系最多 2 个档案', 'Up to 2 files per dialect')); break; }
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!f.type.startsWith('audio/') && !AUDIO_EXT.includes(ext)) { setErr(tx(`「${f.name}」看起來不是音訊檔 —— 手機錄音的格式都可以`, `「${f.name}」看起来不是音频档 —— 手机录音的格式都可以`, `"${f.name}" doesn't look like an audio file — any phone recording format works`)); continue; }
      if (f.size > 80 * 1024 * 1024) { setErr(tx(`「${f.name}」超過 80MB`, `「${f.name}」超过 80MB`, `"${f.name}" exceeds 80MB`)); continue; }
      setUploading(true);
      try {
        const u = await fetch('/api/opencall/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: f.name }) });
        const uj = await u.json();
        if (!u.ok) throw new Error(uj.error || tx('上傳準備失敗', '上传准备失败', 'Upload failed to start'));
        const { error } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, f);
        if (error) throw new Error(error.message);
        setFiles((prev) => [...prev, { case: cs, name: f.name, url: uj.publicUrl }]);
      } catch (e) { setErr(e instanceof Error ? e.message : tx('上傳失敗,請重試', '上传失败,请重试', 'Upload failed — please retry')); }
      finally { setUploading(false); }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function submit() {
    setErr('');
    if (!form.name.trim()) return setErr(tx('請填姓名或藝名', '请填姓名或艺名', 'Please enter your name'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErr(tx('請填正確的 Email', '请填正确的 Email', 'Please enter a valid email'));
    if (!form.native_language.trim()) return setErr(tx('請填母語 / 從小講的語言', '请填母语 / 从小讲的语言', 'Please enter your native language'));
    if (!form.location.trim()) return setErr(tx('請填現居地', '请填现居地', 'Please enter where you live'));
    if (!sel.size) return setErr(tx('請至少勾選一個語系', '请至少勾选一个语系', 'Please pick at least one dialect'));
    const missing = [...sel].filter((c) => !files.some((f) => f.case === c));
    if (missing.length) return setErr(`${tx('還缺這些語系的 demo:', '还缺这些语系的 demo:', 'Missing demos for: ')}${missing.map((c) => { const k = campaign!.cases.find((x) => x.code === c); return k ? L(k.label) : c; }).join(tx('、', '、', ', '))}`);
    setSending(true);
    try {
      const r = await fetch('/api/opencall', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, campaign: campaign!.slug, cases: [...sel], demos: files.filter((f) => sel.has(f.case)).map((f) => ({ case: f.case, url: f.url, name: f.name })) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || tx('送出失敗', '送出失败', 'Submission failed'));
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message : tx('送出失敗,請重試', '送出失败,请重试', 'Submission failed — please retry')); }
    finally { setSending(false); }
  }

  const inputCls = 'w-full rounded-xl border border-white/25 bg-white/[0.08] px-4 py-3.5 text-[16px] text-white outline-none placeholder:text-gray-400 focus:border-white/60 transition-colors';

  if (done) {
    return (
      <main className="min-h-screen bg-black text-white px-5 pt-28 pb-16">
        <div className="max-w-md md:max-w-xl mx-auto text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/10"><CheckCircle2 className="h-7 w-7 text-green-400" /></div>
          <h1 className="text-2xl font-bold mb-3">{tx('已收到您的 demo,謝謝!', '已收到您的 demo,谢谢!', 'Got your demo — thank you!')}</h1>
          <p className="text-gray-200 text-[16px] leading-8 mb-4">{tx('我們會逐一試聽,獲選會透過 Email 或通訊軟體通知您,並協助建立平台帳號、安排正式錄製與簽約。想補傳檔案,重新填一次表單即可,我們會合併。', '我们会逐一试听,获选会透过 Email 或通讯软件通知您,并协助建立平台账号、安排正式录制与签约。想补传档案,重新填一次表单即可,我们会合并。', "We'll listen to every demo. If selected, we'll contact you by email or messenger, help you set up an account, and arrange the formal recording and agreement. To add more files, simply submit the form again — we'll merge them.")}</p>
          <p className="text-gray-400 text-[14px] leading-7 mb-8">{tx('身邊有說這些語言的朋友,歡迎把這頁轉發給他們。', '身边有说这些语言的朋友,欢迎把这页转发给他们。', 'Know someone who speaks these dialects? Feel free to share this page.')}</p>
          {lineUrl && (
            <a href={lineUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#06C755] px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90 transition-opacity">
              {tx('加入官方 LINE 接收通知', '加入官方 LINE 接收通知', 'Add our official LINE for updates')}
            </a>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-5 pt-24 pb-16">
      <div className="max-w-md md:max-w-3xl mx-auto">
        <p className="text-[12px] tracking-[0.28em] text-gray-300 mb-3">{tx('ONYX STUDIOS · 配音徵集', 'ONYX STUDIOS · 配音征集', 'ONYX STUDIOS · OPEN CALL')}</p>
        <h1 className="text-[26px] md:text-4xl font-bold leading-snug mb-3 whitespace-pre-line">{L(campaign.title)}</h1>
        <p className="text-gray-100 text-[15.5px] leading-7 mb-2">{L(campaign.intro)}</p>
        <p className="text-gray-300 text-[14px] leading-7 mb-5">{tx('獲選後我們會與您聯繫,協助建立帳號、確認細節,再進行正式錄製。投稿截止 ', '获选后我们会与您联系,协助建立账号、确认细节,再进行正式录制。投稿截止 ', 'If selected, we will contact you, help set up your account, confirm details, then arrange the formal recording. Submissions close ')}{campaign.deadline}。</p>

        {/* 酬勞+授權+資格 */}
        <div className="rounded-2xl border border-white/25 bg-white/[0.06] px-5 py-4 mb-7 space-y-3">
          <div>
            <p className="text-[14px] font-bold text-white mb-1">{tx('酬勞', '酬劳', 'Compensation')}</p>
            <p className="text-[14px] leading-7 text-gray-200">{L(campaign.payNote)}</p>
          </div>
          <div>
            <p className="text-[14px] font-bold text-white mb-1">{tx('用途與授權(投稿前請先確認能接受)', '用途与授权(投稿前请先确认能接受)', 'Usage & licensing (please confirm before submitting)')}</p>
            <p className="text-[14px] leading-7 text-gray-200 mb-1.5">{tx('本案為 TTS / 語音合成訓練語料。獲選後、正式錄製前會簽署書面授權書,內容大致如下(以簽署版為準):', '本案为 TTS / 语音合成训练语料。获选后、正式录制前会签署书面授权书,内容大致如下(以签署版为准):', 'These recordings form a TTS / speech-synthesis training corpus. A written authorization agreement is signed before formal recording; its key terms are roughly as follows (the signed version prevails):')}</p>
            <ul className="text-[14px] leading-7 text-gray-200 list-disc pl-5 space-y-0.5">
              <li>{tx('錄音及其衍生資料授權用於 AI 語音模型的訓練、開發與合成 —— 模型可能生成帶有您聲音特質的合成語音', '录音及其衍生资料授权用于 AI 语音模型的训练、开发与合成 —— 模型可能生成带有您声音特质的合成语音', 'Recordings and derived data are licensed for AI voice-model training, development and synthesis — models may generate synthetic speech carrying your vocal characteristics')}</li>
              <li>{tx('授權為永久、全球、一次性買斷,無後續分潤或版稅', '授权为永久、全球、一次性买断,无后续分润或版税', 'The license is perpetual, worldwide, one-time buyout — no ongoing royalties')}</li>
              <li>{tx('可轉授權給委託客戶及其終端客戶,同樣僅限模型訓練與合成用途', '可转授权给委托客户及其终端客户,同样仅限模型训练与合成用途', 'Sublicensable to the commissioning client and their end customers, for the same training/synthesis purposes only')}</li>
              <li>{tx('含必要的資料處理(切檔、清理、標註);原始錄音不會作為內容公開播出', '含必要的资料处理(切档、清理、标注);原始录音不会作为内容公开播出', 'Includes necessary processing (segmentation, cleanup, annotation); raw recordings are never published as content')}</li>
              <li>{tx('您的姓名與身分不會公開附在資料上', '您的姓名与身份不会公开附在资料上', 'Your name and identity are never publicly attached to the dataset')}</li>
              <li>{tx('酬勞與付款方式於合約中明定,完成驗收後支付', '酬劳与付款方式于合约中明定,完成验收后支付', 'Fee and payment terms are set in the contract, paid after delivery acceptance')}</li>
            </ul>
          </div>
          <div>
            <p className="text-[14px] font-bold text-white mb-1">{tx('資格與流程', '资格与流程', 'Eligibility & process')}</p>
            <ul className="text-[14px] leading-7 text-gray-200 list-disc pl-5 space-y-0.5">
              <li>{tx('限母語者或從小生活使用該語系者,要求自然、地道的口語(非照稿朗讀腔)', '限母语者或从小生活使用该语系者,要求自然、地道的口语(非照稿朗读腔)', 'Native speakers (or raised speaking the dialect) only — natural, authentic colloquial speech, not read-aloud style')}</li>
              <li>{tx('正式錄製為兩人自然對聊形式,需分次進棚,總錄製時間約 12-15 小時,獲選後一起安排', '正式录制为两人自然对聊形式,需分次进棚,总录制时间约 12-15 小时,获选后一起安排', 'Formal recording is two people chatting naturally, in several studio sessions totalling roughly 12-15 hours, scheduled together once selected')}</li>
              <li>{tx('滾動式選角:合適就會先聯繫,不必等截止日,歡迎盡早投稿', '滚动式选角:合适就会先联系,不必等截止日,欢迎尽早投稿', 'Rolling selection: we reach out as soon as we hear a fit — no need to wait for the deadline, early submissions welcome')}</li>
            </ul>
          </div>
          <p className="text-[13px] leading-6 text-gray-400">{tx('投稿的 demo 僅供內部選角試聽,未獲選不作任何其他用途;聯絡資料僅用於本次選角聯繫。', '投稿的 demo 仅供内部选角试听,未获选不作任何其他用途;联络资料仅用于本次选角联系。', 'Demos are used only for internal casting review; unselected files are never used for anything else. Contact details are used solely for this casting.')}</p>
        </div>

        {/* 語系(可複選) */}
        <p className="text-[15px] font-semibold text-white mb-2">{tx('想應徵的語系(可複選)*', '想应征的语系(可复选)*', 'Dialects you are applying for (multi-select) *')}</p>
        <div className="grid gap-2 md:grid-cols-2 mb-6">
          {campaign.cases.map((c) => (
            <button key={c.code} onClick={() => toggle(c.code)}
              className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[16px] font-medium transition-colors ${sel.has(c.code) ? 'border-white bg-white/15 text-white' : 'border-white/30 text-gray-100 hover:border-white/60'}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${sel.has(c.code) ? 'border-white bg-white' : 'border-gray-500'}`}>
                {sel.has(c.code) && <CheckCircle2 className="h-4 w-4 text-black" />}
              </span>
              {L(c.label)}
            </button>
          ))}
        </div>

        {/* 聯絡資料 */}
        <div className="grid gap-3 md:grid-cols-2 mb-6">
          <input className={inputCls} placeholder={tx('姓名或藝名 *', '姓名或艺名 *', 'Name or stage name *')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={inputCls} type="tel" placeholder={tx('電話(選填)', '电话(选填)', 'Phone (optional)')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className={inputCls} placeholder={tx('現居地(城市)*,例:台北 / 廈門 / 香港', '现居地(城市)*,例:厦门 / 上海 / 香港', 'Where you live (city) * — e.g. Taipei / Xiamen / Hong Kong')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <input className={inputCls} placeholder={tx('母語 / 從小講的語言 *,例:台語+國語', '母语 / 从小讲的语言 *,例:闽南话+普通话', 'Native language(s) * — e.g. Hokkien + Mandarin')} value={form.native_language} onChange={(e) => setForm({ ...form, native_language: e.target.value })} />
          <input className={inputCls} placeholder={tx('口音(選填),例:泉州腔', '口音(选填),例:泉州腔', 'Accent (optional) — e.g. Quanzhou')} value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} />
          <div className="md:col-span-2">
            <p className="text-[13.5px] text-gray-300 mb-2">{tx('我們主要透過通訊軟體聯繫 —— 台灣請留 LINE、大陸請留微信、香港請留 WhatsApp:', '我们主要透过通讯软件联系 —— 台湾请留 LINE、大陆请留微信、香港请留 WhatsApp:', 'We mainly reach out via messenger — LINE for Taiwan, WeChat for mainland China, WhatsApp for Hong Kong:')}</p>
            <div className="flex gap-2 mb-2">
              {MESSENGERS.map((m) => (
                <button key={m.v} type="button" onClick={() => setForm({ ...form, messenger_app: m.v })}
                  className={`rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${form.messenger_app === m.v ? 'border-white bg-white text-black' : 'border-white/30 text-gray-100 hover:border-white/60'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <input className={inputCls} placeholder={MESSENGERS.find((m) => m.v === form.messenger_app)?.hint}
              value={form.messenger_id} onChange={(e) => setForm({ ...form, messenger_id: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <input className={inputCls} placeholder={tx('期望酬勞(選填,可自由報價,例:NT$25,000 / 整案)', '期望酬劳(选填,可自由报价,例:RMB 6,000 / 整案)', 'Expected fee (optional — quote freely, e.g. NT$25,000 per project)')} value={form.expected_fee} onChange={(e) => setForm({ ...form, expected_fee: e.target.value })} />
            <p className="text-[13px] text-gray-400 mt-1.5">{tx('留空也可以,由我們依資歷提議。', '留空也可以,由我们依资历提议。', 'Leave blank and we will propose based on your background.')}</p>
          </div>
          <div className="md:col-span-2">
            <input className={inputCls} placeholder={tx('推薦人(選填,填他的名字或 LINE)', '推荐人(选填,填他的名字或微信)', 'Referrer (optional — their name or contact)')} value={form.referrer} onChange={(e) => setForm({ ...form, referrer: e.target.value })} />
            <p className="text-[13px] text-gray-400 mt-1.5">{tx('是朋友介紹你來的嗎?填上推薦人,讓我們知道要謝謝誰。', '是朋友介绍你来的吗?填上推荐人,让我们知道要谢谢谁。', 'Referred by a friend? Let us know who to thank.')}</p>
          </div>
          <textarea className={`${inputCls} resize-none md:col-span-2`} rows={2} placeholder={tx('想補充的話(選填,例:母語背景、配音經歷)', '想补充的话(选填,例:母语背景、配音经历)', 'Anything to add (optional — e.g. native background, VO experience)')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          {/* honeypot(真人看不到) */}
          <input className="hidden md:col-span-2" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </div>

        {/* 錄音小指南 */}
        <div className="rounded-2xl border border-white/25 bg-white/[0.06] px-5 py-4 mb-6">
          <p className="text-[14px] font-bold text-white mb-1.5">{tx('怎麼錄?很簡單', '怎么录?很简单', 'How to record — it’s easy')}</p>
          <p className="text-[14px] leading-7 text-gray-200 mb-2">{tx('找個安靜的地方,用你應徵的語系像跟朋友聊天一樣,挑一個主題講 1-3 分鐘:', '找个安静的地方,用你应征的语系像跟朋友聊天一样,挑一个主题讲 1-3 分钟:', 'Find a quiet spot and chat in the dialect you are applying for, like talking to a friend — pick one topic and speak for 1-3 minutes:')}</p>
          <ul className="text-[14px] leading-7 text-gray-200 list-disc pl-5 space-y-0.5 md:columns-2">
            <li>{tx('你最喜歡吃的東西、常去的一家店', '你最喜欢吃的东西、常去的一家店', 'Your favorite food or a go-to restaurant')}</li>
            <li>{tx('最想去旅行的地方', '最想去旅行的地方', 'A place you dream of traveling to')}</li>
            <li>{tx('最近在追的劇、電影或遊戲', '最近在追的剧、电影或游戏', 'A show, movie or game you are into lately')}</li>
            <li>{tx('你的家鄉、小時候的回憶', '你的家乡、小时候的回忆', 'Your hometown and childhood memories')}</li>
            <li>{tx('平常的興趣或工作日常', '平常的兴趣或工作日常', 'Your hobbies or daily work life')}</li>
            <li>{tx('最近一件開心的小事', '最近一件开心的小事', 'A small happy moment recently')}</li>
          </ul>
          <p className="text-[13px] leading-6 text-gray-400 mt-2">{tx('自然、地道最重要,講錯、停頓都沒關係,不用重錄到完美。', '自然、地道最重要,讲错、停顿都没关系,不用重录到完美。', 'Natural and authentic matters most — slips and pauses are fine, no need for a perfect take.')}</p>
        </div>

        {/* demo 上傳:每個勾選語系一格 */}
        <p className="text-[15px] font-semibold text-white mb-2">{tx('Freetalk demo 音檔(每個語系一段)*', 'Freetalk demo 音档(每个语系一段)*', 'Free-talk demo (one per dialect) *')}</p>
        <input ref={fileRef} type="file" accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.oga,.opus,.flac,.amr,.mp4,.3gp,.caf,.aiff,.wma,.webm" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        {sel.size === 0 && <p className="text-[14px] text-gray-400 border border-dashed border-white/25 rounded-xl px-4 py-5 text-center mb-2">{tx('先在上面勾選語系,這裡就會出現對應的上傳格', '先在上面勾选语系,这里就会出现对应的上传格', 'Pick your dialects above and upload slots will appear here')}</p>}
        <div className="space-y-3 mb-2">
          {[...sel].map((code) => {
            const c = campaign.cases.find((x) => x.code === code);
            const mine = files.filter((f) => f.case === code);
            return (
              <div key={code} className="rounded-xl border border-white/25 bg-white/[0.06] px-4 py-3.5">
                <p className="text-[14.5px] font-semibold text-white mb-2">{c ? L(c.label) : code} <span className="text-gray-400 font-normal">{tx('— 請用這個語系錄', '— 请用这个语系录', '— record in this dialect')}</span></p>
                <button onClick={() => { pendingCase.current = code; fileRef.current?.click(); }} disabled={uploading || mine.length >= 2}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/40 px-4 py-3.5 text-[14px] text-gray-100 hover:border-white/70 transition-colors disabled:opacity-40">
                  {uploading && pendingCase.current === code
                    ? <><Mic className="h-4 w-4 animate-pulse" /> {tx('上傳中…請稍候', '上传中…请稍候', 'Uploading…')}</>
                    : <><Upload className="h-4 w-4" /> {tx('上傳這個語系的錄音(最多 2 檔,每檔 ≤80MB)', '上传这个语系的录音(最多 2 档,每档 ≤80MB)', 'Upload your recording for this dialect (max 2 files, ≤80MB each)')}</>}
                </button>
                {mine.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {mine.map((f) => (
                      <div key={f.url} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-[14px] text-gray-100">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                        <span className="truncate flex-1">{f.name}</span>
                        <button onClick={() => setFiles(files.filter((x) => x.url !== f.url))} className="text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[13px] text-gray-400 mb-6">{tx('iPhone 可直接用「語音備忘錄」錄,Android 用內建錄音機;漏傳想補檔,再送出一次表單即可,我們會合併。', 'iPhone 可直接用「语音备忘录」录,Android 用内建录音机;漏传想补档,再送出一次表单即可,我们会合并。', 'On iPhone use Voice Memos; on Android use the built-in recorder. Forgot a file? Submit the form again and we will merge.')}</p>

        {err && <p className="text-[13px] text-red-400 mb-3">{err}</p>}
        <button onClick={submit} disabled={sending || uploading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white text-black text-[16px] font-bold px-6 py-4 hover:bg-gray-200 transition-colors disabled:opacity-40">
          {sending ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出 demo', '送出 demo', 'Submit demo')} <Send className="h-4 w-4" />
        </button>
        <p className="mt-4 text-center text-[13px] text-gray-400">{tx('送出即表示同意 demo 供 Onyx 內部選角試聽使用;未獲選之檔案不作其他用途。', '送出即表示同意 demo 供 Onyx 内部选角试听使用;未获选之档案不作其他用途。', 'By submitting you agree your demo may be reviewed internally by Onyx for casting; unselected files are not used for anything else.')}</p>
      </div>
    </main>
  );
}
