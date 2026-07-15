'use client';

/*
  製作管理 — 遊戲/多角色量產案的分案後工作台(如女王百貨)。
  列出該案(brief)全部角色製作單,每張單可:
   - 匯入/編輯台詞(整案 xlsx 匯入 → 自動按角色分頁填稿;也可逐單手改)
   - 上傳參考音(大陸版角色參考 + 配音員中選聲線,可多檔;配音員端可聽+可下載)
   - 調價格(配音員酬勞 talent_price / 客戶價 price;admin 才能改金額)
  儲存走 PATCH /api/admin/orders(既有);參考音檔走 /api/admin/casting/upload(既有,
  公開 casting bucket);台詞匯入走 /api/admin/casting/import-lines。
*/

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';
import { mediaToMp3, needsMp3Convert } from '@/lib/media-to-mp3';
import { toast } from 'sonner';

type RefFile = { name?: string; url: string };
type Order = { id: string; order_number?: string | null; role_name?: string | null; talent_id?: string | null; talent_name?: string | null; status?: string | null; script_text?: string | null; production_notes?: string | null; reference_files?: RefFile[] | null; voice_sample_files?: RefFile[] | null; role_images?: RefFile[] | null; talent_price?: number | null; price?: number | null; pay_unit?: string | null; pay_rate?: number | null; currency?: string | null; deadline?: string | null; released_at?: string | null };
// 參考音(大陸版角色參考)與中選聲線(配音員自己的中選示範)分開存、分開傳(Wing 2026-07-15)。
type AudioField = 'reference_files' | 'voice_sample_files';

const input = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500';

export default function ProductionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [briefTitle, setBriefTitle] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [busy, setBusy] = useState<string | null>(null);   // orderId 或 'import'
  const [importSec, setImportSec] = useState(0);           // 匯入計時(顯示「還活著」)
  useEffect(() => {
    if (busy !== 'import') { setImportSec(0); return; }
    const t = setInterval(() => setImportSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  const importStage = importSec < 10 ? '上傳台詞表並解析各角色分頁…' : importSec < 30 ? '抽取角色/皮膚圖並壓縮…' : importSec < 75 ? '上傳角色圖到雲端(上百張,最花時間)…' : '寫入各角色製作稿與酬勞…';
  const [draft, setDraft] = useState<Record<string, { script: string; tp: string; price: string; notes: string; deadline: string }>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/casting/production?brief_id=${encodeURIComponent(id)}`, { credentials: 'include' });
    if (!res.ok) { setPhase('notfound'); return; }
    const j = await res.json().catch(() => ({}));
    setBriefTitle(j.brief?.title || '');
    const list: Order[] = j.orders || [];
    // 同一配音員的單排在一起(Wing:一人配多角時跳來跳去很難找),再按單號穩定排序。
    list.sort((a, b) => (a.talent_name || '').localeCompare(b.talent_name || '', 'zh-Hant') || String(a.order_number || '').localeCompare(String(b.order_number || '')));
    setOrders(list);
    setDraft(Object.fromEntries(list.map((o) => [o.id, { script: o.script_text || '', tp: o.talent_price != null ? String(o.talent_price) : '', price: o.price != null ? String(o.price) : '', notes: o.production_notes || '', deadline: (o.deadline || '').slice(0, 10) }])));
    setPhase('ready');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const buildUpdates = (d: { script: string; tp: string; price: string; notes: string; deadline: string }) => {
    const updates: Record<string, unknown> = { script_text: d.script, production_notes: d.notes.trim() || null, deadline: d.deadline.trim() || null };
    if (d.tp.trim() !== '') updates.talent_price = Number(d.tp) || 0;
    if (d.price.trim() !== '') updates.price = Number(d.price) || 0;
    return updates;
  };
  async function patchOrder(orderId: string, updates: Record<string, unknown>) {
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ orderId, orderType: 'voice', updates }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '儲存失敗');
  }
  async function saveOrder(o: Order) {
    const d = draft[o.id]; if (!d) return;
    setBusy(o.id);
    try {
      await patchOrder(o.id, buildUpdates(d));
      toast.success(`${o.role_name || '訂單'} 已儲存`);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : '儲存失敗'); } finally { setBusy(null); }
  }

  // 有改但沒按儲存的單(Wing:怕一張張按會漏)—— 發出通知前會自動全部存一遍。
  const isDirty = (o: Order) => {
    const d = draft[o.id]; if (!d) return false;
    return d.script !== (o.script_text || '')
      || d.notes !== (o.production_notes || '')
      || d.deadline !== (o.deadline || '').slice(0, 10)
      || d.tp !== (o.talent_price != null ? String(o.talent_price) : '')
      || d.price !== (o.price != null ? String(o.price) : '');
  };
  const dirtyOrders = orders.filter(isDirty);
  async function saveMany(list: Order[]) {
    let ok = 0; const fails: string[] = [];
    for (let i = 0; i < list.length; i += 6) {
      await Promise.all(list.slice(i, i + 6).map(async (o) => {
        const d = draft[o.id]; if (!d) return;
        try { await patchOrder(o.id, buildUpdates(d)); ok++; } catch { fails.push(o.role_name || o.id); }
      }));
    }
    return { ok, fails };
  }
  async function saveAll() {
    if (!dirtyOrders.length) return;
    setBusy('saveall');
    try {
      const { ok, fails } = await saveMany(dirtyOrders);
      if (fails.length) toast.error(`已儲存 ${ok} 張,失敗:${fails.join('、')}`);
      else toast.success(`已儲存全部 ${ok} 張修改`);
      load();
    } finally { setBusy(null); }
  }

  async function uploadRef(o: Order, raw: File, field: AudioField) {
    setBusy(o.id);
    try {
      // 非 mp3 的音檔/影片自動轉 mp3(Wing 不用手動轉;wav/mp4 太肥,省空間+配音員下載快)
      let file = raw;
      if (needsMp3Convert(raw)) {
        toast.info(`正在轉成 mp3(省空間):${raw.name}`, { duration: 6000 });
        file = await mediaToMp3(raw);
        if (file === raw) toast.warning('這個檔解不出音軌,改用原檔上傳');
      }
      // 既有 upload 端點:回 { path, token, publicUrl },前端用 signed URL 直傳 casting bucket。
      const u = await fetch('/api/admin/casting/upload', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok || !uj.path || !uj.token) throw new Error(uj.error || '上傳準備失敗');
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      await pushRef(o, { name: file.name, url: uj.publicUrl }, field);
    } catch (e) { toast.error(e instanceof Error ? e.message : '上傳失敗'); } finally { setBusy(null); }
  }
  async function pushRef(o: Order, f: RefFile, field: AudioField) {
    const next = [...(o[field] || []), f];
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ orderId: o.id, orderType: 'voice', updates: { [field]: next } }),
    });
    if (!res.ok) { toast.error('存檔失敗'); return; }
    toast.success(field === 'voice_sample_files' ? '中選聲線已加入' : '參考音已加入'); load();
  }
  async function removeRef(o: Order, idx: number, field: AudioField) {
    const next = (o[field] || []).filter((_, i) => i !== idx);
    await fetch('/api/admin/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ orderId: o.id, orderType: 'voice', updates: { [field]: next } }),
    });
    load();
  }

  // 台詞表大小 SOP(Wing 2026-07-15):遊戲檔內嵌上百張高解析角色圖動輒 100MB+,
  // 線上匯入(storage 50MB / serverless 記憶體)吞不下 → 選檔當下就判斷,直接告訴
  // Wing 怎麼辦,不讓他傳半天才失敗。20MB 內走線上;超過給三條路。
  const [bigFileMsg, setBigFileMsg] = useState('');

  async function importLines(file: File) {
    const mb = file.size / 1048576;
    if (mb > 20) {
      setBigFileMsg(`這份台詞表有 ${mb.toFixed(0)} MB,超過線上匯入的安全上限(20MB)。大檔幾乎都是內嵌的高解析角色圖造成,三個做法擇一:
① 最快 —— 檔案直接丟給 Claude 助理,由它在本機幫你匯入(結果跟平台匯入完全一樣,幾分鐘搞定)。
② 自己瘦身 —— 在 Excel/WPS 開啟後:選任一張圖 →「圖片工具/格式」→「壓縮圖片」→ 解析度選 96dpi、套用到「檔案中所有圖片」→ 另存新檔。通常會縮到十分之一,再回來匯。
③ 請客戶提供「無圖版」台詞表(圖片另外給)。`);
      return;
    }
    setBigFileMsg('');
    setBusy('import');
    try {
      // xlsx 夾上百張角色圖動輒 10MB+,直接 POST 會撞 Vercel 4.5MB body 上限(之前一直
      // 「匯入失敗」的根因)→ 改成先簽名上傳到 casting bucket,再把 path 交給匯入 API。
      const u = await fetch('/api/admin/casting/upload', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok || !uj.path || !uj.token) throw new Error(uj.error || '台詞表上傳準備失敗');
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(`台詞表上傳失敗:${upErr.message}`);
      const res = await fetch(`/api/admin/casting/import-lines?brief_id=${encodeURIComponent(id)}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: uj.path }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `匯入失敗(HTTP ${res.status})`);
      const okList = (j.matched || []).map((m: { role: string; lines: number; pay?: string }) => `${m.role}(${m.lines}句${m.pay ? `,酬勞 ${m.pay}` : ''})`).join('、');
      toast.success(`已填入 ${j.matched?.length || 0} 個角色的台詞:${okList || '—'}`, { duration: 8000 });
      if (j.unmatched?.length) toast.warning(`這些角色還沒有製作單,台詞先跳過:${j.unmatched.map((m: { role: string }) => m.role).join('、')} —— 先在案件建單再匯一次即可`, { duration: 12000 });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : '匯入失敗'); } finally { setBusy(null); }
  }

  // 發出通知:把未 released 的指派單正式開給配音員(可見+寄信+Telegram)。
  // 發出前自動把「改了但沒按儲存」的單全部存一遍(Wing:一張張按怕漏)。
  async function releaseOrders(orderIds?: string[]) {
    setBusy('release');
    try {
      if (dirtyOrders.length) {
        const { ok, fails } = await saveMany(dirtyOrders);
        if (fails.length) throw new Error(`有 ${fails.length} 張單儲存失敗(${fails.join('、')}),先處理再發出`);
        if (ok) toast.info(`已自動儲存 ${ok} 張未儲存的修改`);
      }
      const res = await fetch('/api/admin/casting/release', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ brief_id: id, ...(orderIds?.length ? { order_ids: orderIds } : {}) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `發出失敗(HTTP ${res.status})`);
      toast.success(`已發出 ${j.released} 張單給 ${j.talents} 位配音員(寄信 ${j.notified} 封,Telegram 有綁定就會收到)`, { duration: 8000 });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : '發出失敗'); } finally { setBusy(null); }
  }
  const unreleased = orders.filter((o) => !o.released_at && o.talent_id);

  if (phase === 'loading') return <div className="p-8 text-gray-500 text-sm">載入中…</div>;
  if (phase === 'notfound') return <div className="p-8 text-gray-500 text-sm">找不到這個案件。</div>;

  return (
    <div className="p-6 lg:p-10 max-w-5xl text-gray-900">
      <button onClick={() => router.push('/admin/marketplace')} className="text-xs text-gray-500 hover:text-gray-800">← 回案件 · 發案</button>
      <h1 className="text-xl font-semibold mt-2 mb-1">製作管理 · {briefTitle}</h1>
      <p className="text-gray-500 text-sm mb-4">每個角色一張製作單。台詞可整案 xlsx 匯入(按角色分頁自動填),參考音可多檔(角色參考 + 配音員中選聲線,配音員端可聽可下載),價格可調。</p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label className={`inline-flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2 ${busy === 'import' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-400 text-black cursor-pointer'}`}>
          {busy === 'import' ? '匯入中…' : '⬆ 匯入台詞表(xlsx)'}
          <input type="file" accept=".xlsx" className="hidden" disabled={busy === 'import'} onChange={(e) => e.target.files?.[0] && importLines(e.target.files[0])} />
        </label>
        {dirtyOrders.length > 0 && (
          <button onClick={saveAll} disabled={busy === 'saveall'}
            className="text-sm font-medium rounded-lg px-4 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white">
            {busy === 'saveall' ? '儲存中…' : `💾 儲存全部修改(${dirtyOrders.length} 張)`}
          </button>
        )}
        {unreleased.length > 0 && (
          <button onClick={() => releaseOrders()} disabled={busy === 'release'}
            className="text-sm font-medium rounded-lg px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black">
            {busy === 'release' ? '發出中…' : `📣 發出通知(${unreleased.length} 張未通知)`}
          </button>
        )}
      </div>
      {unreleased.length > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          有 {unreleased.length} 張指派單「尚未發出」—— 配音員還看不到也沒收到通知。等台詞/參考音/價格都確認好,按上面「發出通知」一次通知(同一人多角色只寄一封);也可以在單卡上逐張發出。
        </p>
      )}
      {bigFileMsg && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900 mb-1">台詞表太大,線上匯不動 —— 照下面做</p>
          <p className="text-xs text-amber-800 whitespace-pre-wrap leading-relaxed">{bigFileMsg}</p>
          <button onClick={() => setBigFileMsg('')} className="mt-2 text-xs text-amber-700 underline">知道了</button>
        </div>
      )}
      {busy === 'import' && (
        <div className="mb-6 rounded-xl border border-green-300 bg-green-50 p-4 flex items-center gap-3">
          <span className="w-5 h-5 rounded-full border-2 border-green-500 border-t-transparent animate-spin flex-none" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-green-900">正在匯入台詞表 —— {importStage}</p>
            <p className="text-xs text-green-700 mt-0.5">已進行 {importSec} 秒。台詞表夾了上百張角色圖,通常需 1~2 分鐘,請不要關閉或重新整理頁面;完成後會跳出結果通知。</p>
          </div>
        </div>
      )}

      {orders.length === 0 && <p className="text-sm text-gray-500">這個案子還沒有製作單 —— 先在「編輯案件」用「指派」把角色指派給配音員(每角色一單),再回來這裡。</p>}

      <div className="space-y-4">
        {orders.map((o) => {
          const d = draft[o.id] || { script: '', tp: '', price: '' };
          return (
            <div key={o.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold">{o.role_name || '(未命名角色)'}</span>
                <span className="text-xs text-gray-500">{o.talent_name || '(未指派)'}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${o.status === 'delivered' ? 'bg-sky-50 text-sky-700 border-sky-200' : o.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>{o.status === 'delivered' ? '已交付·待驗收' : o.status === 'completed' ? '已完成' : '待錄製'}</span>
                {!o.released_at && o.talent_id && (
                  <>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-300">未發出·配音員看不到</span>
                    <button onClick={() => releaseOrders([o.id])} disabled={busy === 'release'}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-medium">發出這張</button>
                  </>
                )}
                <span className="ml-auto text-[11px] text-gray-400">{o.order_number}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-2 max-w-2xl">
                <label className="block"><span className="text-xs text-gray-600 mb-1 block">配音員酬勞({o.currency || 'TWD'}){o.pay_unit === 'per_line' && o.pay_rate ? ` — 每句 ${o.pay_rate},匯台詞自動算` : ''}</span>
                  <input className={input} inputMode="decimal" value={d.tp} onChange={(e) => setDraft((s) => ({ ...s, [o.id]: { ...d, tp: e.target.value } }))} /></label>
                <label className="block"><span className="text-xs text-gray-600 mb-1 block">客戶價(選填)</span>
                  <input className={input} inputMode="decimal" value={d.price} onChange={(e) => setDraft((s) => ({ ...s, [o.id]: { ...d, price: e.target.value } }))} /></label>
                <label className="block"><span className="text-xs text-gray-600 mb-1 block">完成日(配音員端會顯示)</span>
                  <input type="date" className={`${input} [color-scheme:light]`} value={d.deadline} onChange={(e) => setDraft((s) => ({ ...s, [o.id]: { ...d, deadline: e.target.value } }))} /></label>
              </div>

              {(o.role_images || []).length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-gray-600 mb-1 block">角色圖(匯入台詞表時自動抽出,配音員端可見)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(o.role_images || []).map((im, i) => (
                      <a key={i} href={im.url} target="_blank" rel="noreferrer" title={im.name}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={im.url} alt={im.name || ''} className="h-16 rounded-lg border border-gray-200 object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <label className="block mb-2"><span className="text-xs text-gray-600 mb-1 block">製作備註(給配音員的細則,例:台詞語感可微調,但商品名/專有名詞不可改)</span>
                <textarea className={`${input} min-h-[56px] resize-y`} value={d.notes} placeholder="例:語氣詞可依口語習慣微調;角色名、品牌名、技能名稱一律照稿,不可改。" onChange={(e) => setDraft((s) => ({ ...s, [o.id]: { ...d, notes: e.target.value } }))} /></label>
              <label className="block mb-2"><span className="text-xs text-gray-600 mb-1 block">台詞 / 製作稿(配音員線上看)</span>
                <textarea className={`${input} min-h-[120px] resize-y font-mono text-[13px]`} value={d.script} onChange={(e) => setDraft((s) => ({ ...s, [o.id]: { ...d, script: e.target.value } }))} /></label>

              {([['reference_files', '參考音(大陸版角色參考,可多檔)', '+ 上傳參考音'], ['voice_sample_files', '中選聲線(配音員自己的中選示範,可多檔)', '+ 上傳中選聲線']] as [AudioField, string, string][]).map(([field, label, btn]) => (
                <div className="mb-3" key={field}>
                  <span className="text-xs text-gray-600 mb-1 block">{label}</span>
                  <div className="space-y-1.5">
                    {(o[field] || []).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                        <span className="text-xs text-gray-600 truncate max-w-[30%]">{f.name || '音檔'}</span>
                        <audio controls src={f.url} className="h-8 flex-1 min-w-0" />
                        <button onClick={() => removeRef(o, i, field)} className="text-xs text-red-500 hover:text-red-700 shrink-0">移除</button>
                      </div>
                    ))}
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 cursor-pointer mt-1.5">
                    {busy === o.id ? '處理中…' : btn}
                    <input type="file" accept="audio/*,video/mp4,video/quicktime,.mp3,.wav,.m4a,.mp4,.mov" className="hidden" disabled={busy === o.id} onChange={(e) => e.target.files?.[0] && uploadRef(o, e.target.files[0], field)} />
                  </label>
                </div>
              ))}

              <button onClick={() => saveOrder(o)} disabled={busy === o.id}
                className={`text-sm disabled:opacity-50 rounded-lg px-4 py-2 ${isDirty(o) ? 'bg-amber-500 hover:bg-amber-400 text-black font-medium' : 'bg-gray-900 hover:bg-gray-700 text-white'}`}>
                {busy === o.id ? '儲存中…' : isDirty(o) ? '儲存這張單(有未儲存的修改)' : '儲存這張單'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
