'use client';

/*
  後台「公開徵集」(Wing 2026-08-07):LINE 群免登入投稿的 demo 統一試聽/統籌頁。
  篩語系案件+狀態、內建播放器逐檔聽、標記(入選/備取/婉拒)、匯出 CSV。
  獲選後續(建帳號/派案)照既有人才流程人工處理。
*/

import { useState, useEffect } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import JSZip from 'jszip';
import { OPENCALL_CAMPAIGNS, allCaseLabels } from '@/lib/opencall-campaigns';

type Row = {
  id: string; name: string; email: string; phone: string | null;
  cases: string[]; demos: { case: string; url: string; name?: string }[]; note: string | null; status: string; admin_note: string | null; created_at: string;
  messenger_app: string | null; messenger_id: string | null; referrer: string | null;
  campaign: string; native_language: string | null; accent: string | null; location: string | null; expected_fee: string | null;
};

const CASE_LABEL: Record<string, string> = allCaseLabels();

// 檔案在 Supabase 網域上,<a download> 會被跨域忽略(只會開新分頁播放)——
// 一律 fetch 成 blob 再觸發下載,才是真的存到電腦(Wing 2026-08-12:這頁下載不了音檔)。
const cleanName = (s: string) => s.replace(/[\\/:*?"<>|·\s]+/g, '_').trim();
async function downloadBlob(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('fetch failed');
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = blobUrl; a.download = filename; a.click();
  URL.revokeObjectURL(blobUrl);
}
const STATUS_LABEL: Record<string, string> = { new: '未處理', shortlisted: '備取', picked: '入選', passed: '婉拒' };
const STATUS_CLS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700', shortlisted: 'bg-amber-100 text-amber-800',
  picked: 'bg-green-100 text-green-800', passed: 'bg-gray-100 text-gray-400',
};

export default function AdminOpencallPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [zipBusy, setZipBusy] = useState(false);
  const [zipProg, setZipProg] = useState('');
  const [caseFilter, setCaseFilter] = useState('');
  const [campFilter, setCampFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/opencall').then((r) => r.json()).then((j) => setRows(j.rows || [])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const patch = async (id: string, updates: Record<string, string>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    await fetch('/api/admin/opencall', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) });
  };

  const visible = rows.filter((r) => (!campFilter || r.campaign === campFilter) && (!caseFilter || r.cases.includes(caseFilter)) && (!statusFilter || r.status === statusFilter));

  // 目前篩選出來的所有音檔打包成 zip(檔名=投稿者_語系案別)。
  const downloadAllAudio = async () => {
    const files = visible.flatMap((r) => (r.demos || []).map((d, i) => ({ r, d, i })));
    if (!files.length) { alert('目前沒有音檔可下載'); return; }
    setZipBusy(true); setZipProg(`0/${files.length}`);
    const zip = new JSZip();
    let done = 0, fail = 0;
    for (const { r, d, i } of files) {
      try {
        const res = await fetch(d.url);
        if (!res.ok) throw new Error('fetch failed');
        const ext = (d.url.split('?')[0].split('.').pop() || 'mp3').slice(0, 4);
        zip.file(`${cleanName(r.name)}_${cleanName(CASE_LABEL[d.case] || `demo${i + 1}`)}.${ext}`, await res.blob());
      } catch { fail++; }
      done++; setZipProg(`${done}/${files.length}`);
    }
    try {
      const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
      const a = document.createElement('a');
      a.href = url; a.download = `公開徵集_音檔_${visible.length}人.zip`; a.click();
      URL.revokeObjectURL(url);
      if (fail) alert(`有 ${fail} 個檔案下載失敗,其餘已打包`);
    } catch { alert('打包失敗'); }
    setZipBusy(false);
  };

  const exportCsv = () => {
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['活動', '姓名', 'Email', '電話', '通訊軟體', '通訊ID', '母語', '口音', '現居地', '期望酬勞', '推薦人', '應徵語系', '狀態', '備註', '內部備註', 'demo 連結', '投稿時間'].join(','),
      ...visible.map((r) => [
        esc(r.campaign), esc(r.name), esc(r.email), esc(r.phone), esc(r.messenger_app), esc(r.messenger_id), esc(r.native_language), esc(r.accent), esc(r.location), esc(r.expected_fee), esc(r.referrer),
        esc(r.cases.map((c) => CASE_LABEL[c] || c).join('、')), esc(STATUS_LABEL[r.status] || r.status),
        esc(r.note), esc(r.admin_note), esc((r.demos || []).map((d) => `${CASE_LABEL[d.case] || d.case}: ${d.url}`).join('\n')), esc(r.created_at),
      ].join(',')),
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'opencall_submissions.csv'; a.click();
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold">公開徵集</h1>
        <button onClick={load} className="text-gray-400 hover:text-gray-600"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        <button onClick={downloadAllAudio} disabled={zipBusy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50">
          <Download className="w-4 h-4" /> {zipBusy ? `打包中… ${zipProg}` : `下載全部音檔(${visible.reduce((n, r) => n + (r.demos || []).length, 0)})`}
        </button>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
          <Download className="w-4 h-4" /> 匯出 CSV
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-5">LINE 群免登入投稿的 Freetalk demo。逐檔試聽、標記入選/備取;入選後照人才流程建帳號派案。共 {rows.length} 筆,顯示 {visible.length} 筆。</p>

      {OPENCALL_CAMPAIGNS.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {OPENCALL_CAMPAIGNS.map((c) => (
            <button key={c.slug} onClick={() => setCampFilter(campFilter === c.slug ? '' : c.slug)}
              className={`rounded-full px-3 py-1.5 text-sm border ${campFilter === c.slug ? 'bg-black text-white border-black' : 'text-gray-600 hover:bg-gray-50'}`}>{c.slug}</button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setCaseFilter('')} className={`rounded-full px-3 py-1.5 text-sm border ${!caseFilter ? 'bg-black text-white border-black' : 'text-gray-600 hover:bg-gray-50'}`}>全部語系</button>
        {Object.entries(CASE_LABEL).map(([code, label]) => (
          <button key={code} onClick={() => setCaseFilter(caseFilter === code ? '' : code)}
            className={`rounded-full px-3 py-1.5 text-sm border ${caseFilter === code ? 'bg-black text-white border-black' : 'text-gray-600 hover:bg-gray-50'}`}>{label}</button>
        ))}
        <span className="mx-1 border-l" />
        {Object.entries(STATUS_LABEL).map(([st, label]) => (
          <button key={st} onClick={() => setStatusFilter(statusFilter === st ? '' : st)}
            className={`rounded-full px-3 py-1.5 text-sm border ${statusFilter === st ? 'bg-black text-white border-black' : 'text-gray-600 hover:bg-gray-50'}`}>{label}</button>
        ))}
      </div>

      {loading && !rows.length && <p className="text-gray-400 text-sm">載入中…</p>}
      {!loading && !visible.length && <p className="text-gray-400 text-sm">沒有符合的投稿。</p>}

      <div className="space-y-4">
        {visible.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-semibold">{r.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[r.status] || ''}`}>{STATUS_LABEL[r.status] || r.status}</span>
              {r.cases.map((c) => <span key={c} className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs">{CASE_LABEL[c] || c}</span>)}
              <span className="ml-auto text-xs text-gray-400">{new Date(r.created_at).toLocaleString('zh-TW')}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              {r.email}{r.phone ? ` · ${r.phone}` : ''}{r.messenger_id ? ` · ${({ line: 'LINE', wechat: '微信', whatsapp: 'WhatsApp' } as Record<string, string>)[r.messenger_app || 'line']}:${r.messenger_id}` : ''}{r.referrer ? ` · 推薦人:${r.referrer}` : ''}
            </p>
            <p className="text-[13px] text-gray-700 mb-1">
              {r.native_language ? `母語:${r.native_language}` : ''}{r.accent ? ` · 口音:${r.accent}` : ''}{r.location ? ` · 現居:${r.location}` : ''}{r.expected_fee ? ` · 期望酬勞:${r.expected_fee}` : ''}
            </p>
            {r.note && <p className="text-[13px] text-gray-500 mb-2 whitespace-pre-wrap">{r.note}</p>}
            <div className="space-y-1.5 mb-3">
              {(r.demos || []).map((d, i) => {
                const ext = (d.url.split('?')[0].split('.').pop() || 'mp3').slice(0, 4);
                return (
                  <div key={d.url} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-blue-700 w-24 shrink-0">{CASE_LABEL[d.case] || `demo ${i + 1}`}</span>
                    <audio controls preload="none" src={d.url} className="h-9 w-full max-w-md" />
                    <button type="button" title="下載這個音檔"
                      onClick={() => downloadBlob(d.url, `${cleanName(r.name)}_${cleanName(CASE_LABEL[d.case] || `demo${i + 1}`)}.${ext}`).catch(() => alert('下載失敗,請稍後再試'))}
                      className="shrink-0 text-xs text-blue-600 hover:underline whitespace-nowrap">下載</button>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['picked', 'shortlisted', 'passed', 'new'] as const).map((st) => (
                <button key={st} onClick={() => patch(r.id, { status: st })} disabled={r.status === st}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${r.status === st ? 'opacity-40' : 'hover:bg-gray-50'}`}>
                  {st === 'new' ? '重設' : `標記${STATUS_LABEL[st]}`}
                </button>
              ))}
              <input defaultValue={r.admin_note || ''} placeholder="內部備註…"
                onBlur={(e) => { if (e.target.value !== (r.admin_note || '')) patch(r.id, { admin_note: e.target.value }); }}
                className="flex-1 min-w-[160px] rounded-lg border px-3 py-1.5 text-xs outline-none focus:border-gray-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
