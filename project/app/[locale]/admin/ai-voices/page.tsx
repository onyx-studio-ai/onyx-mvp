'use client';

/*
  AI 聲音管理(Phase 1)— Wing 自助:配音員錄音 → whisper 逐字稿(過目可修)→
  clone → 試聽 → 上架。交接:VOICE_LAB/交接_Phase1_AI聲音管理頁.md。
  上:建立新聲音(五步);下:既有聲音列表(每 voice×tone 一列,試聽/上下架/預設)。
  ref 錄音走既有 /api/admin/casting/upload 簽名上傳(公開 casting bucket,fal 要公開 URL)。
*/

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type VoiceRow = { id: string; voice_key: string; talent_id: string | null; label: string | null; tone: string; embedding_url: string; ref_text: string; temperature: number | null; is_default_tone: boolean | null; status: string; created_at: string };
type Talent = { id: string; name: string; talent_no?: number };

const input = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500';
const TONE_LABEL: Record<string, string> = { professional: '專業 Professional', energetic: '活力 Energetic', soothing: '舒緩 Soothing', trailer: '預告片 Trailer', friendly: '親切 Friendly' };
const AUTH_MSG = '後台登入已逾時 —— 請重新整理頁面並重新登入,再試一次。';

export default function AiVoicesPage() {
  const [rows, setRows] = useState<VoiceRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [talents, setTalents] = useState<Talent[]>([]);

  // ── 建立新聲音的五步 state ──
  const [talentId, setTalentId] = useState('');
  const [voiceKey, setVoiceKey] = useState('');
  const [label, setLabel] = useState('');
  const [tone, setTone] = useState('professional');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioName, setAudioName] = useState('');
  const [refText, setRefText] = useState('');
  const [temp, setTemp] = useState('');
  const [busy, setBusy] = useState('');          // 'upload' | 'transcribe' | 'clone' | rowId…
  const [testAudio, setTestAudio] = useState(''); // 最近一次試聽音檔
  const [testRowId, setTestRowId] = useState(''); // 試聽音檔屬於哪一列(播放器長在該列,Safari 擋 autoplay 也看得到)
  const [testText, setTestText] = useState('您好,歡迎來到 Onyx Studios,很高興為您服務。');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/ai-voices', { credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    setRows(j.voices || []); setLoaded(true);
  }, []);
  useEffect(() => {
    load();
    fetch('/api/admin/talents', { credentials: 'include' }).then((r) => (r.ok ? r.json() : []))
      .then((all) => setTalents((Array.isArray(all) ? all : []).map((t: { id: string; name?: string; talent_no?: number }) => ({ id: t.id, name: t.name || '(未命名)', talent_no: t.talent_no })).sort((a: Talent, b: Talent) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, [load]);

  // 選 talent → 自動帶 voice_key(t+編號)與 label
  function pickTalent(id: string) {
    setTalentId(id);
    const t = talents.find((x) => x.id === id);
    if (t) { setVoiceKey(t.talent_no ? `talent-${t.talent_no}` : ''); setLabel(t.name); }
  }

  async function uploadRef(file: File) {
    const pasted = refText.trim();   // 先貼好的逐字稿優先,不自動轉稿也不蓋掉
    setBusy('upload'); setAudioUrl('');
    try {
      const u = await fetch('/api/admin/casting/upload', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok || !uj.path) throw new Error((u.status === 401 || u.status === 403) ? AUTH_MSG : (uj.error || '上傳準備失敗'));
      const { error } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (error) throw new Error(error.message);
      setAudioUrl(uj.publicUrl); setAudioName(file.name);
      if (pasted) { toast.success('錄音已上傳。已沿用你貼的逐字稿(未自動轉稿)—— 請確認它跟這段錄音一字不差!'); return; }
      toast.success('錄音已上傳,開始自動轉逐字稿…');
      // 自動轉稿(refText 鐵律:必須是這個音檔的真實逐字稿)
      setBusy('transcribe');
      const tr = await fetch('/api/admin/ai-voices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'transcribe', audio_url: uj.publicUrl }) });
      const tj = await tr.json().catch(() => ({}));
      if (!tr.ok) throw new Error(tj.error || '轉稿失敗');
      setRefText(tj.text);
      if (tj.warning) toast.error(tj.warning, { duration: 12000 });
      else toast.success('逐字稿完成 —— 請逐字核對,轉錯字會毀掉 clone!');
    } catch (e) { toast.error(e instanceof Error ? e.message : '失敗'); } finally { setBusy(''); }
  }

  async function doClone() {
    if (!voiceKey.trim() || !audioUrl || !refText.trim()) { toast.error('請先完成:選配音員/上傳錄音/核對逐字稿'); return; }
    setBusy('clone');
    try {
      const res = await fetch('/api/admin/ai-voices', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clone', voice_key: voiceKey.trim(), label: label.trim() || voiceKey.trim(), tone, audio_url: audioUrl, ref_text: refText.trim(), talent_id: talentId || undefined, temperature: temp.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((res.status === 401 || res.status === 403) ? AUTH_MSG : (j.error || '建立失敗'));
      toast.success('聲音已建立(未上架)—— 先在下方列表試聽,滿意再上架', { duration: 8000 });
      setAudioUrl(''); setAudioName(''); setRefText('');
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : '建立失敗'); } finally { setBusy(''); }
  }

  async function testRow(r: VoiceRow) {
    setBusy(r.id); setTestAudio(''); setTestRowId(r.id);
    try {
      const res = await fetch('/api/admin/ai-voices', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', id: r.id, text: testText }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || '試聽失敗');
      setTestAudio(j.audioUrl || j.url || '');
      if (!(j.audioUrl || j.url)) toast.error('生成完成但沒拿到音檔網址');
    } catch (e) { toast.error(e instanceof Error ? e.message : '試聽失敗'); } finally { setBusy(''); }
  }

  async function patchRow(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/ai-voices', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || '更新失敗');
      toast.success(okMsg); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : '更新失敗'); } finally { setBusy(''); }
  }

  const groups = [...new Set(rows.map((r) => r.voice_key))];

  return (
    <div className="p-6 lg:p-10 max-w-5xl text-gray-900">
      <h1 className="text-xl font-semibold mb-1">AI 聲音</h1>
      <p className="text-gray-500 text-sm mb-6">配音員錄音 → 自動逐字稿(務必逐字核對)→ 建立聲音 → 試聽 → 上架。一顆聲音服務十種語言;clone 一次約 NT$0.3,生成約 NT$3/千字。</p>

      {/* ── 建立新聲音 ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <h2 className="text-base font-semibold mb-3">建立新聲音</h2>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          選單列的是全名冊,「選配音員」只是把聲音<b>掛在誰名下</b> —— 名字本身不會產生聲音。
          必須在②上傳<b>那位配音員本人的錄音</b>(30 秒~1 分鐘乾淨人聲就夠,不需要大量語料、不需要訓練),才會建立出他的 AI 聲音。
          沒上傳過錄音的人,前台就不會有他的 AI 聲音。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">① 配音員</span>
            <select className={input} value={talentId} onChange={(e) => pickTalent(e.target.value)}>
              <option value="">— 選配音員 —</option>
              {talents.map((t) => <option key={t.id} value={t.id}>{t.name}{t.talent_no ? `(T-${t.talent_no})` : ''}</option>)}
            </select></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">聲音代號(對外 voiceId)</span>
            <input className={input} value={voiceKey} onChange={(e) => setVoiceKey(e.target.value)} placeholder="talent-9" /></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">顯示名稱</span>
            <input className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Onyx …" /></label>
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">語氣 Tone</span>
            <select className={input} value={tone} onChange={(e) => setTone(e.target.value)}>
              {Object.entries(TONE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></label>
        </div>

        <div className="mb-3">
          <span className="text-xs text-gray-600 mb-1 block">② 參考錄音(30 秒~1 分鐘,手機錄可;非 mp3 也行)</span>
          <label className={`inline-flex items-center gap-2 text-xs rounded-lg px-3 py-2 cursor-pointer border ${busy === 'upload' || busy === 'transcribe' ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700'}`}>
            {busy === 'upload' ? '上傳中…' : busy === 'transcribe' ? '轉逐字稿中…' : audioName ? `已上傳:${audioName}(點擊可換)` : '+ 上傳錄音'}
            <input type="file" accept="audio/*,.mp3,.wav,.m4a" className="hidden" disabled={!!busy} onChange={(e) => e.target.files?.[0] && uploadRef(e.target.files[0])} />
          </label>
          {audioUrl && <audio controls src={audioUrl} className="h-8 mt-2 w-full max-w-md" />}
        </div>

        <div className="mb-3">
          <span className="text-xs text-red-600 font-medium mb-1 block">③ 逐字稿 —— 必須跟錄音內容一模一樣,轉錯字會毀掉 clone</span>
          <textarea rows={8} className={`${input} min-h-[200px] resize-y text-sm leading-relaxed`} value={refText} onChange={(e) => setRefText(e.target.value)}
            placeholder={'兩種用法:\n· 手上有逐字稿 → 直接貼在這裡,再上傳錄音(就不會自動轉稿)\n· 沒有逐字稿 → 留空,上傳錄音後會自動轉出來,再逐字核對修正'} />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="text-xs text-gray-600 mb-1 block">Temperature(選填,0.5 穩~0.9 活;空=預設 0.7)</span>
            <input className={`${input} w-32`} value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="0.7" /></label>
          <button onClick={doClone} disabled={!!busy || !audioUrl || !refText.trim()}
            className="text-sm bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg px-5 py-2">
            {busy === 'clone' ? '建立中…(約 30 秒)' : '④ 建立聲音'}
          </button>
          <span className="text-xs text-gray-500">建立後先「試聽」,滿意再「上架」—— 上架前客戶看不到。</span>
        </div>
      </div>

      {/* ── 既有聲音 ── */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-base font-semibold">聲音庫({rows.length} 列)</h2>
        <input className={`${input} max-w-xs`} value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="試聽用短句…" />
      </div>
      {!loaded ? <p className="text-sm text-gray-500">載入中…</p>
        : rows.length === 0 ? <p className="text-sm text-gray-500">還沒有聲音 —— 表尚未建立或還沒 clone 過。跑完 migration 後,Eric/阿宏 的既有聲音會出現在這裡。</p>
        : groups.map((vk) => (
          <div key={vk} className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <p className="font-semibold text-sm mb-2">{rows.find((r) => r.voice_key === vk)?.label || vk} <span className="text-xs text-gray-400 font-normal">voiceId: {vk}</span></p>
            <div className="space-y-2">
              {rows.filter((r) => r.voice_key === vk).map((r) => (
                <div key={r.id} className="border border-gray-100 rounded-lg px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium w-40">{TONE_LABEL[r.tone] || r.tone}{r.is_default_tone ? ' ⭐預設' : ''}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${r.status === 'live' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{r.status === 'live' ? '已上架' : '未上架'}</span>
                    <span className="text-[11px] text-gray-400">temp {r.temperature ?? '預設'}</span>
                    <span className="text-[11px] text-gray-400 truncate max-w-[240px]" title={r.ref_text}>ref:{r.ref_text.slice(0, 24)}…</span>
                    <span className="ml-auto flex gap-1.5">
                      <button onClick={() => testRow(r)} disabled={busy === r.id} className="text-xs px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-100">{busy === r.id ? '生成中…' : '試聽'}</button>
                      {r.status === 'live'
                        ? <button onClick={() => patchRow(r.id, { status: 'off' }, '已下架')} className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">下架</button>
                        : <button onClick={() => patchRow(r.id, { status: 'live' }, '已上架,客戶端立即可用')} className="text-xs px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-500">上架</button>}
                      {!r.is_default_tone && <button onClick={() => patchRow(r.id, { is_default_tone: true }, '已設為預設 tone')} className="text-xs px-3 py-1 rounded-lg border border-gray-300 hover:bg-gray-100">設預設</button>}
                    </span>
                  </div>
                  {testRowId === r.id && testAudio && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 flex-shrink-0">試聽(按 ▶ 播放):</span>
                      <audio controls src={testAudio} className="h-8 w-full max-w-md" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
