'use client';

/*
  AI 聲音分身計畫 — 配音員報名頁(Phase 2,2026-07-19)。
  流程:說明 → 合約(英正本+中對照)→ 勾選+簽名 → 分語氣語料上傳(WAV 48k/24bit 硬檢)。
  🔒 內測閘門在後端 API(lib/ai-twin);未開放者 GET 404 → 顯示「尚未開放」。
*/

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { authedFetch } from '@/lib/authed-fetch';
import { CONTRACT_EN, CONTRACT_ZH, CONTRACT_VERSION } from '@/lib/ai-twin-contract';
import { Loader2, CheckCircle2, UploadCloud, Trash2, Sparkles } from 'lucide-react';

const TONES = [
  { tone: 'Professional', label: '專業 Professional', script: '歡迎了解我們的服務。自 2008 年成立以來,我們已為超過 1,500 位客戶,提供橫跨 40 個國家的專業方案。您可能會問:品質如何確保?答案是三層審核,加上為期 12 個月的完整保固。我們相信,長期的信任,來自每一次準確的交付。' },
  { tone: 'Energetic', label: '活力 Energetic', script: '準備好了嗎?年度最大檔期終於開跑!全館 5 折起,滿 3,000 再送 500!你沒聽錯,只有 72 小時!新品、經典款、限量聯名,一次到齊。還在等什麼?現在就出發,錯過再等一年!' },
  { tone: 'Friendly', label: '親切 Friendly', script: '嘿,好久不見,最近過得怎麼樣?我上週去了一趟花蓮,天氣好得不得了。對了,你上次說想學做菜,後來有開始嗎?其實我也想試試看,不然我們約個週末,一起研究幾道簡單的家常菜,你覺得如何?' },
  { tone: 'Soothing', label: '舒緩 Soothing', script: '現在,請慢慢閉上眼睛,深深吸一口氣,再緩緩地吐出來。感受肩膀一點一點放鬆下來。今天辛苦了。無論發生什麼,此刻都可以先放下。讓呼吸帶著你,回到安靜的地方,好好休息。' },
  { tone: 'Trailer', label: '預告片 Trailer', script: '在一個被遺忘的城市,沉睡著一個千年的秘密。當黑夜降臨,誰能阻止命運的齒輪?他,是最後的守望者。這個冬天,見證傳奇的誕生——《暗夜黎明》,即將震撼登場。' },
];
const PROOF_LANGS = ['中文', 'English', '日本語', '한국어', 'Español', 'Português', 'Français', 'Deutsch', 'Italiano', 'Русский', '其他'];

type Enrollment = {
  id: string; status: string; signature_name: string; signed_at: string;
  scopes: { ads?: boolean; cross_lingual?: boolean; proofreader?: boolean; proof_langs?: string[] };
  samples: { tone: string; url: string; file_name?: string }[];
  review_note?: string | null;
};

// 讀 WAV header 驗 48kHz/24bit(RIFF fmt chunk)
async function checkWav(file: File): Promise<string | null> {
  const buf = await file.slice(0, 64 * 1024).arrayBuffer();
  const dv = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return '這不是 WAV 檔,請以 WAV 48kHz/24bit 匯出。';
  let off = 12;
  while (off + 8 <= dv.byteLength) {
    const id = tag(off); const size = dv.getUint32(off + 4, true);
    if (id === 'fmt ') {
      const rate = dv.getUint32(off + 12, true);
      const bits = dv.getUint16(off + 22, true);
      if (rate !== 48000) return `採樣率是 ${rate}Hz,需要 48000Hz(48kHz)。請重新匯出。`;
      if (bits !== 24) return `位深是 ${bits}bit,需要 24bit。請重新匯出。`;
      return null;
    }
    off += 8 + size + (size % 2);
  }
  return '讀不到 WAV 格式資訊,請確認檔案完整。';
}

export default function AiTwinPage() {
  const locale = useLocale();
  const isZhCN = locale === 'zh-CN';
  const isZh = locale.startsWith('zh');
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const [phase, setPhase] = useState<'loading' | 'unavailable' | 'ready'>('loading');
  const [en, setEn] = useState<Enrollment | null>(null);
  const [ads, setAds] = useState(false);
  const [crossLingual, setCrossLingual] = useState(true);
  const [proofreader, setProofreader] = useState(false);
  const [proofLangs, setProofLangs] = useState<string[]>([]);
  const [otherLang, setOtherLang] = useState('');
  const [agree, setAgree] = useState(false);
  const [sig, setSig] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showZh, setShowZh] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/talent/ai-twin');
    if (res.status === 404) { setPhase('unavailable'); return; }
    const j = await res.json().catch(() => ({}));
    if (j.enrollment) {
      setEn(j.enrollment);
      setAds(!!j.enrollment.scopes?.ads);
      setCrossLingual(!!j.enrollment.scopes?.cross_lingual);
      setProofreader(!!j.enrollment.scopes?.proofreader);
      setProofLangs(j.enrollment.scopes?.proof_langs || []);
    }
    setPhase('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!agree) { setErr('請先勾選「我已閱讀並同意英文正本合約」'); return; }
    if (!sig.trim()) { setErr('請輸入姓名作為電子簽署'); return; }
    setBusy(true); setErr('');
    const res = await authedFetch('/api/talent/ai-twin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature_name: sig.trim(), scopes: { ads, cross_lingual: crossLingual, proofreader, proof_langs: proofLangs.filter((l) => l !== '其他').concat(otherLang.trim() ? [`其他:${otherLang.trim()}`] : []) } }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error || '送出失敗'); return; }
    load();
  }

  async function uploadTone(tone: string, file: File) {
    setErr('');
    const bad = await checkWav(file);
    if (bad) { setErr(`【${tone}】${bad}`); return; }
    setUploading(tone);
    try {
      const r1 = await authedFetch('/api/talent/ai-twin/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: file.name, tone }),
      });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1.error || '取得上傳位置失敗');
      const put = await fetch(j1.upload_url, { method: 'PUT', headers: { 'Content-Type': 'audio/wav' }, body: file });
      if (!put.ok) throw new Error('上傳失敗,請重試');
      const r2 = await authedFetch('/api/talent/ai-twin', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, url: j1.public_url, file_name: file.name }),
      });
      if (!r2.ok) throw new Error((await r2.json()).error || '登記失敗');
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : '上傳失敗'); }
    setUploading(null);
  }

  async function removeTone(tone: string) {
    await authedFetch('/api/talent/ai-twin', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tone, remove: true }) });
    load();
  }

  if (phase === 'loading') return <main className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="w-6 h-6 text-gray-500 animate-spin" /></main>;
  if (phase === 'unavailable') return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <p className="text-gray-400 text-sm">{tx('此計畫尚未開放,敬請期待。', '此计划尚未开放,敬请期待。', 'This program is not yet available.')}</p>
    </main>
  );

  const signed = en && en.status !== 'draft';
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400/60';

  return (
    <main className="min-h-screen bg-[#050505] text-white px-4 md:px-8 py-10 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-emerald-400" /><h1 className="text-2xl font-semibold" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>AI 聲音分身計畫</h1></div>
      <p className="text-sm text-gray-400 mb-8">錄一組語氣參考音,建立您的 AI 聲音分身。客戶每次使用,您分得牌價的 25% —— 後台逐筆可查的被動收入。您隨時可以喊停。</p>

      {!signed && (
        <>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium">授權合約({CONTRACT_VERSION})</p>
              <button onClick={() => setShowZh(!showZh)} className="text-xs text-emerald-300 hover:underline">{showZh ? 'View English master' : '看中文對照'}</button>
            </div>
            <div className="max-h-72 overflow-y-auto text-xs leading-relaxed text-gray-300 whitespace-pre-wrap border border-white/5 rounded-lg p-4 bg-black/30">
              {showZh ? CONTRACT_ZH : CONTRACT_EN}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">英文版為正本;中文版僅供對照參考。</p>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6 space-y-3">
            <p className="font-medium mb-1">授權範圍</p>
            <label className="flex items-center gap-2 text-sm text-gray-400"><input type="checkbox" checked readOnly className="accent-emerald-500" />標準商用(旁白/有聲書/課程等)— 必含</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} className="accent-emerald-500" />廣告投放(付費媒體,永久全通路)— 分潤機會較高</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={crossLingual} onChange={(e) => setCrossLingual(e.target.checked)} className="accent-emerald-500" />跨語言生成(您的聲音講英/日/韓/歐語)</label>
            <div className="border-t border-white/5 pt-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={proofreader} onChange={(e) => setProofreader(e.target.checked)} className="accent-emerald-500" />我也願意接「AI 校對」兼職(聽 AI 音檔標錯句,按音檔分鐘計酬)</label>
              {proofreader && (
                <>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {PROOF_LANGS.map((l) => (
                      <button key={l} onClick={() => setProofLangs((s) => s.includes(l) ? s.filter((x) => x !== l) : [...s, l])}
                        className={`text-xs px-2.5 py-1 rounded-full border ${proofLangs.includes(l) ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' : 'bg-white/5 border-white/10 text-gray-400'}`}>{l}</button>
                    ))}
                  </div>
                  {proofLangs.includes('其他') && (
                    <input className={inputCls + ' mt-2'} value={otherLang} onChange={(e) => setOtherLang(e.target.value)} placeholder="其他語言(例:粵語、泰語、越南語…)" />
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6 space-y-3">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="accent-emerald-500 mt-0.5" />
              <span>我已閱讀並同意上述合約之<b>英文正本</b>(I have read and agree to the English master version)</span>
            </label>
            <input className={inputCls} value={sig} onChange={(e) => setSig(e.target.value)} placeholder="輸入您的姓名作為電子簽署" />
            <button onClick={submit} disabled={busy} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium inline-flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}簽署並加入計畫
            </button>
          </div>
        </>
      )}

      {signed && (
        <>
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 mb-6 flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>已於 {new Date(en!.signed_at).toLocaleString('zh-TW')} 由「{en!.signature_name}」簽署({CONTRACT_VERSION})。狀態:{en!.status === 'submitted' ? '待審核' : en!.status === 'approved' ? '已核准' : en!.status}</span>
          </div>

          <p className="font-medium mb-1">語氣參考錄音</p>
          <p className="text-xs text-gray-400 mb-4">每段 30–60 秒,安靜無回音空間+宅錄設備,<b className="text-gray-200">只收 WAV 48kHz/24bit</b>(上傳時自動檢查)。至少完成「專業」一段即可送審,其餘可陸續補。</p>
          <div className="space-y-4">
            {TONES.map((t) => {
              const done = en!.samples?.find((s) => s.tone === t.tone);
              return (
                <div key={t.tone} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{t.label}{done && <span className="ml-2 text-xs text-emerald-300">✓ 已上傳 {done.file_name}</span>}</p>
                    <div className="flex items-center gap-2">
                      {done && <button onClick={() => removeTone(t.tone)} className="text-gray-500 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>}
                      <label className="text-xs bg-white/10 hover:bg-white/15 rounded-lg px-3 py-1.5 cursor-pointer inline-flex items-center gap-1.5">
                        {uploading === t.tone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                        {done ? '重新上傳' : '上傳 WAV'}
                        <input type="file" accept=".wav" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTone(t.tone, f); e.target.value = ''; }} />
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed bg-black/30 border border-white/5 rounded-lg p-3">{t.script}</p>
                </div>
              );
            })}
          </div>
          {en!.review_note && <p className="text-sm text-amber-300 mt-4">審核備註:{en!.review_note}</p>}
        </>
      )}

      {err && <p className="text-sm text-red-300 mt-4">{err}</p>}
    </main>
  );
}
