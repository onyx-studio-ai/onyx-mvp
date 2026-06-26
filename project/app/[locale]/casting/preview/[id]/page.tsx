'use client';

/*
  Admin-only front-end preview of a casting call — see exactly what a talent sees,
  read-only (no audition controls). Works for any status, including a reviewing
  client request, so Onyx can review before publishing. Auth = admin cookie.
*/

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { caseCode } from '@/lib/casting';

const serif = { fontFamily: '"Songti TC","Noto Serif TC",serif' } as const;
const gold = { color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 600 } as const;

type Role = { name?: string; gender?: string; age?: string; timbre?: string; personality?: string; emotion?: string; speed?: string; volume?: string; note?: string; sample_line?: string; is_lead?: boolean; image?: string };
type Brief = {
  id: string; brief_number?: string | null; title?: string | null; content_type?: string | null; language?: string | null;
  rate_note?: string | null; status?: string | null; created_at?: string | null;
  audition_deadline?: string | null; deadline?: string | null; length?: string | null;
  media_scope?: string | null; territory?: string | null; license_term?: string | null;
  accent?: string | null; voice_style?: string | null; voice_age?: string | null;
  recording_methods?: string[] | null; recording_start?: string | null; base_revisions?: number | null;
  brief?: string | null; audition_script?: string | null;
  reference_links?: string[] | null; reference_files?: { name?: string; url: string }[] | null;
  roles?: Role[] | null;
};

const methodLabel = (m: string) => (m === 'home' ? '在家錄' : m === 'studio' ? '錄音室' : m === 'online' ? '線上監錄' : m);

export default function CastingPreview() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<'loading' | 'unauth' | 'invalid' | 'ready'>('loading');
  const [b, setB] = useState<Brief | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/casting/preview/${id}`, { credentials: 'include' });
    if (res.status === 401) return setPhase('unauth');
    if (!res.ok) return setPhase('invalid');
    const j = await res.json().catch(() => ({}));
    if (!j.brief) return setPhase('invalid');
    setB(j.brief); setPhase('ready');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const shell = (inner: React.ReactNode) => (
    <main className="min-h-screen bg-black text-white px-4 pt-24 pb-16"><div className="max-w-4xl mx-auto">{inner}</div></main>
  );
  if (phase === 'loading') return shell(<p className="text-gray-500 text-sm text-center py-20">載入中…</p>);
  if (phase === 'unauth') return shell(<p className="text-gray-400 text-sm text-center py-20">請先登入後台再預覽。</p>);
  if (phase === 'invalid' || !b) return shell(<p className="text-gray-400 text-sm text-center py-20">找不到這個案件。</p>);

  const roles = b.roles || [];
  const methods = b.recording_methods || [];
  const info: [string, string][] = ([
    ['語言', b.language], ['口音', b.accent], ['聲音風格', b.voice_style], ['聲音年齡', b.voice_age],
    ['使用範圍', b.media_scope], ['地區', b.territory], ['授權', b.license_term], ['預計開錄', b.recording_start],
    ['含修改', b.base_revisions != null ? `${b.base_revisions} 次` : ''],
    ['錄音方式', methods.map(methodLabel).join(' / ')],
  ] as [string, string | null | undefined][]).filter((x): x is [string, string] => !!x[1]);

  return shell(
    <>
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="bg-amber-500/15 text-amber-200 px-2.5 py-1 rounded-full">👁 前台預覽 · 唯讀{b.status && b.status !== 'open' ? ` · ${b.status}` : ''}</span>
        <span className="text-gray-500 font-mono">{caseCode(b)}</span>
      </div>

      {b.title && <h1 className="text-2xl font-semibold mb-2" style={serif}>{b.title}</h1>}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-xs px-2.5 py-1 rounded-full" style={gold}>試音案</span>
        {b.language && <span className="text-xs bg-white/[0.06] border border-white/10 text-gray-200 px-2.5 py-1 rounded-full">{b.language}</span>}
        {methods.map((m) => <span key={m} className="text-xs bg-sky-500/15 text-sky-200 px-2 py-0.5 rounded-full">{methodLabel(m)}</span>)}
      </div>
      {b.brief && <p className="text-sm text-gray-200 whitespace-pre-wrap mb-3">{b.brief}</p>}

      {b.audition_script && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1.5">試音方向 / 聲音方向</p>
          <div className="text-sm text-gray-200 whitespace-pre-wrap bg-black/40 border border-white/10 rounded-lg p-3">{b.audition_script}</div>
        </div>
      )}
      {((b.reference_files || []).length > 0 || (b.reference_links || []).length > 0) && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1.5">參考素材</p>
          {(b.reference_files || []).map((f, i) => <div key={i} className="mb-1.5">{f.name && <span className="text-xs text-gray-400 block mb-0.5">{f.name}</span>}<audio controls src={f.url} className="w-full h-9" /></div>)}
          {(b.reference_links || []).map((l, i) => <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 hover:underline block truncate">{l}</a>)}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
        {[
          { l: '報酬', v: b.rate_note || '面議', g: true },
          { l: '試音截止', v: b.audition_deadline || '待定' },
          { l: '交付截止', v: b.deadline || '待定' },
          { l: '規模', v: b.length || '待定' },
        ].map((s, i) => (
          <div key={i} className="bg-[#1d1b25] border border-white/[0.08] rounded-xl p-3.5">
            <p className="text-[11px] text-gray-500">{s.l}</p>
            <p className={`text-lg font-semibold mt-0.5 ${s.g ? 'text-[#E4CB94]' : 'text-white'}`} style={serif}>{s.v}</p>
          </div>
        ))}
      </div>
      {info.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 text-sm bg-[#1d1b25] border border-white/[0.08] rounded-xl p-4 mb-4">
          {info.map(([k, v], i) => <div key={i} className="min-w-0"><span className="text-gray-500">{k} </span><span className="text-gray-200">{v}</span></div>)}
        </div>
      )}

      {roles.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-lg font-semibold text-white" style={serif}>試音角色</h4>
            <span className="text-xs text-gray-500">{`共 ${roles.length} 角 · 男 ${roles.filter((r) => (r.gender || '').includes('男')).length} / 女 ${roles.filter((r) => (r.gender || '').includes('女')).length}`}</span>
          </div>
          <div className="space-y-3">
            {roles.map((r, i) => {
              const meta = [r.gender, r.age].filter(Boolean).join(' · ');
              return (
                <div key={i} className={`flex rounded-2xl overflow-hidden bg-[#1d1b25] border ${r.is_lead ? 'border-[#C9A86A]/50' : 'border-white/[0.08]'}`}>
                  <div className="w-28 sm:w-36 shrink-0 relative bg-[#14131a]">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt={r.name} className="absolute inset-0 w-full h-full object-cover object-top" />
                    ) : <div className="absolute inset-0 flex items-center justify-center text-3xl text-gray-600">🎭</div>}
                    {r.is_lead && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded font-medium z-10" style={gold}>★ 主角</span>}
                  </div>
                  <div className="flex-1 min-w-0 p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-lg font-semibold text-white leading-tight" style={serif}>{r.name}</span>
                      {meta && <span className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ color: '#7fb2e8', background: 'rgba(127,178,232,.14)' }}>{meta}</span>}
                    </div>
                    {r.timbre && <p className="text-sm text-[#C9A86A] leading-snug">聲線 · {r.timbre}</p>}
                    {r.personality && <p className="text-sm text-gray-400 leading-snug">{r.personality}</p>}
                    {(r.emotion || r.speed || r.volume) && (
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        {r.emotion && <span><span className="text-gray-500">情緒 </span><span className="text-gray-200">{r.emotion}</span></span>}
                        {r.speed && <span><span className="text-gray-500">語速 </span><span className="text-gray-200">{r.speed}</span></span>}
                        {r.volume && <span><span className="text-gray-500">台詞量 </span><span className="text-gray-200">{r.volume}</span></span>}
                      </div>
                    )}
                    {r.sample_line && (
                      <div className="bg-[#14131a] border border-white/[0.08] rounded-xl px-3.5 py-3">
                        <span className="inline-block text-[11px] tracking-[0.18em] text-[#C9A86A] mb-1">試音樣詞</span>
                        <p className="text-[15px] leading-relaxed text-gray-100 whitespace-pre-wrap">{r.sample_line}</p>
                      </div>
                    )}
                    {r.note && <p className="text-xs text-gray-500 leading-snug"><span className="text-gray-600">備註 </span>{r.note}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
