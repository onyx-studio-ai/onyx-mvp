'use client';

/*
  Talent "Opportunities" (案源) — Phase 3c.

  Login-gated (reuses the existing Supabase session from /talent; if none,
  points the talent to log in there rather than duplicating the login form).
  Lists open voice-over briefs and lets the talent submit a quote. The talent
  always sees their NET take-home (after the 20% commission) — gross is what the
  client pays. Onyx mediates the award (managed model), so there's no public
  client-facing auction here. Tri-lingual via the useLocale()+tx() idiom.
*/

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Briefcase, CheckCircle2, Archive } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { caseCode } from '@/lib/casting';
import { toMp3 } from '@/lib/to-mp3';
import ReviewBox from '@/components/marketplace/ReviewBox';
import { StatModule, EntityCard, InfoPills } from '@/components/dashboard/cards';

const COMMISSION = 0.2; // display rate; server (net_amount) is source of truth

// The deal currency is fixed by what the CLIENT set at posting — the talent quotes
// in it (no picking a different one), so order + checkout bill that currency.
// Prefer the structured budget_currency; fall back to parsing the budget/rate text
// (e.g. "USD 7500", "NT$3,000"); default USD.
function parseCcy(s: string | null | undefined): string | null {
  if (!s) return null;
  const code = s.toUpperCase().match(/\b(USD|TWD|CNY|RMB|GBP|EUR|JPY|KRW|HKD)\b/);
  if (code) return code[1] === 'RMB' ? 'CNY' : code[1];
  if (/NT\$/i.test(s)) return 'TWD';
  if (/US\$/i.test(s)) return 'USD';
  if (/£/.test(s)) return 'GBP';
  if (/€/.test(s)) return 'EUR';
  return null;
}
function dealCurrency(brief: { budget_currency?: string | null; budget?: string | null; rate_note?: string | null }): string {
  return (brief.budget_currency && brief.budget_currency.toUpperCase())
    || parseCcy(brief.budget) || parseCcy(brief.rate_note) || 'USD';
}

type Role = { name?: string; gender?: string; age?: string; timbre?: string; personality?: string; emotion?: string; speed?: string; volume?: string; note?: string; sample_line?: string; is_lead?: boolean; image?: string };
type Brief = {
  id: string;
  brief_number: string;
  kind?: string | null;             // 'casting' = admin casting call
  source?: 'platform' | 'client';   // who posted it (no client identity leaked)
  title?: string | null;
  roles?: Role[] | null;
  audition_script?: string | null;  // shown view-only (no download)
  reference_links?: string[] | null;
  reference_files?: { name?: string; url: string }[] | null;
  recording_start?: string | null;
  recording_methods?: string[] | null;
  rate_note?: string | null;
  base_revisions?: number | null;
  audition_cap?: number | null;
  categories: string[] | null;
  content_type: string | null;
  media_scope: string | null;
  territory: string | null;
  license_term: string | null;
  accent: string | null;
  voice_style: string | null;
  voice_age: string | null;
  script_status: string | null;
  has_singing: boolean | null;
  wants_director: boolean | null;
  wants_live_session: boolean | null;
  live_session_tool: string | null;
  audition_deadline: string | null;
  language: string | null;
  length: string | null;
  budget: string | null;
  budget_type: string | null;
  budget_currency?: string | null; // currency the client set at posting — locks the quote currency
  deadline: string | null;
  brief: string;
  created_at: string;
};
type Quote = {
  id: string;
  brief_id: string;
  role_name?: string | null;
  gross_amount: number;
  net_amount: number;
  currency: string;
  status: string;
  message: string | null;
  sample_url?: string | null;
  delivery_url?: string | null;
  delivery_uploaded_at?: string | null;
  reaudition_note?: string | null;
  reaudition_requested_at?: string | null;
  agreement_accepted_at?: string | null;
  included_revisions?: number | null;
};
type Demo = { url: string; name?: string; category?: string; language?: string };
type Tpl = { name: string; body: string };
type Templates = { intro?: Tpl[]; revision?: Tpl[] };

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-400/60 transition';

// A text field with quick templates: a built-in starter chip + the talent's saved
// templates (click to fill, ✕ to delete) + "存成範本" to save the current text.
function TemplatedField({ kind, label, optional, multiline, value, onChange, builtin, saved, token, onTemplates, tx }: {
  kind: 'intro' | 'revision'; label: string; optional?: boolean; multiline?: boolean;
  value: string; onChange: (v: string) => void; builtin: string; saved: Tpl[]; token: string;
  onTemplates: (t: Templates) => void; tx: (tw: string, cn: string, en: string) => string;
}) {
  async function save() {
    const body = value.trim();
    if (!body) return;
    const name = window.prompt(tx('範本名稱(例:廣告 / 遊戲)', '范本名称(例:广告 / 游戏)', 'Template name (e.g. Ad / Game)'));
    if (!name || !name.trim()) return;
    const r = await fetch('/api/talent/templates', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ kind, name: name.trim(), body }) });
    const j = await r.json().catch(() => ({})); if (r.ok) onTemplates(j.templates);
  }
  async function del(name: string) {
    const r = await fetch(`/api/talent/templates?kind=${kind}&name=${encodeURIComponent(name)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({})); if (r.ok) onTemplates(j.templates);
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-gray-300">{label}{optional && <span className="text-gray-500"> {tx('選填', '选填', 'optional')}</span>}</div>
        <button type="button" onClick={save} className="text-[11px] text-amber-300 hover:underline">💾 {tx('存成範本', '存成范本', 'Save template')}</button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        <button type="button" onClick={() => onChange(builtin)} className="text-[11px] bg-white/5 border border-white/10 rounded-full px-2.5 py-1 text-gray-300 hover:border-white/30 transition">{tx('內建範本', '内建范本', 'Starter')}</button>
        {saved.map((t) => (
          <span key={t.name} className="inline-flex items-center text-[11px] bg-white/5 border border-white/10 rounded-full pl-2.5 pr-1 py-1 text-gray-300">
            <button type="button" onClick={() => onChange(t.body)} className="hover:text-white">{t.name}</button>
            <button type="button" onClick={() => del(t.name)} className="text-gray-500 hover:text-red-300 px-1" title={tx('刪除', '删除', 'Delete')}>✕</button>
          </span>
        ))}
      </div>
      {multiline
        ? <textarea className={`${inputCls} min-h-[56px] resize-y`} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

const builtinIntro = (name: string, tx: (tw: string, cn: string, en: string) => string) => tx(
  `您好,我是配音員 ${name || '(您的藝名)'}。很高興收到這個邀請,我對這個案子很有興趣;我的聲音與經驗很適合這類型,期待有機會與您合作。`,
  `您好,我是配音员 ${name || '(您的艺名)'}。很高兴收到这个邀请,我对这个案子很有兴趣;我的声音与经验很适合这类型,期待有机会与您合作。`,
  `Hi, I'm ${name || '(your name)'}, a voice actor. Thanks for the invitation — I'm interested in this project and my voice and experience fit it well. I'd love to work with you.`);
const builtinRev = (tx: (tw: string, cn: string, en: string) => string) => tx('含 2 次修改;超出部分每次另計。', '含 2 次修改;超出部分每次另计。', '2 revisions included; extra revisions billed separately.');

// Won-job delivery: the talent hands in finished recordings against an accepted
// quote. MULTIPLE files allowed (each upload adds one + future revisions); each
// becomes a client-reviewable version. Files preserve 48k/24-bit (not transcoded).
function DeliveryUpload({ quote, deliveries, token, tx, onChanged }: {
  quote: Quote; deliveries: { id: string; file_name: string; file_url: string }[]; token: string;
  tx: (a: string, b: string, c: string) => string; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function upload(file: File) {
    setErr(''); setBusy(true);
    try {
      const u = await fetch('/api/talent/delivery-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name }),
      });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(uj.error || tx('上傳準備失敗', '上传准备失败', 'Upload prep failed'));
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      const p = await fetch('/api/talent/quotes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: quote.id, delivery_url: uj.publicUrl, file_name: file.name }),
      });
      const pj = await p.json().catch(() => ({}));
      if (!p.ok) throw new Error(pj.error || tx('儲存失敗', '保存失败', 'Save failed'));
      onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : tx('上傳失敗', '上传失败', 'Upload failed')); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setErr(''); setBusy(true);
    try {
      const p = await fetch('/api/talent/quotes', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: quote.id, delete_version_id: id }),
      });
      if (!p.ok) { const j = await p.json().catch(() => ({})); throw new Error(j.error || 'failed'); }
      onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : tx('刪除失敗', '删除失败', 'Delete failed')); } finally { setBusy(false); }
  }
  const ACCEPT = '.wav,.mp3,.m4a,.aac,.ogg,.flac,.zip';
  return (
    <div className="mt-1.5 space-y-1.5">
      {deliveries.length > 0 && deliveries.map((d) => (
        <div key={d.id} className="flex items-center gap-2 text-xs bg-[#6FCF97]/[0.06] border border-[#6FCF97]/25 rounded-lg px-3 py-1.5">
          <span className="text-[#6FCF97]">✓</span>
          <span className="text-gray-200 truncate flex-1">{d.file_name}</span>
          <a href={d.file_url} target="_blank" rel="noreferrer" className="text-gray-400 underline hover:text-white shrink-0">{tx('檢視', '查看', 'View')}</a>
          <button onClick={() => remove(d.id)} disabled={busy} title={tx('刪除', '删除', 'Remove')} className="text-gray-500 hover:text-red-300 disabled:opacity-50 shrink-0">✕</button>
        </div>
      ))}
      <label className="inline-flex items-center gap-1.5 text-xs bg-[#6FCF97]/15 border border-[#6FCF97]/40 text-[#6FCF97] rounded-lg px-3 py-1.5 cursor-pointer hover:bg-[#6FCF97]/25 transition">
        {busy ? tx('處理中…', '处理中…', 'Working…') : deliveries.length ? tx('⬆ 上傳更多檔', '⬆ 上传更多档', '⬆ Upload more') : tx('⬆ 上傳完成音檔', '⬆ 上传完成音档', '⬆ Upload final audio')}
        <input type="file" accept={ACCEPT} className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      <p className="text-[10px] text-gray-500">{tx('可上傳多個完成檔 / 修改檔(建議 48kHz/24-bit WAV;多檔可打包 zip)', '可上传多个完成档 / 修改档(建议 48kHz/24-bit WAV;多档可打包 zip)', 'Upload several final / revision files (48kHz/24-bit WAV preferred; zip for bundles)')}</p>
      {err && <p className="text-[10px] text-red-400">{err}</p>}
    </div>
  );
}

// Re-audition: the client asked for a second take. Upload a new sample, which
// replaces sample_url and clears the request (same upload pipeline as auditions).
function ReauditUpload({ quote, token, tx, onDone }: { quote: Quote; token: string; tx: (a: string, b: string, c: string) => string; onDone: (q: Quote) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function upload(rawFile: File) {
    setErr(''); setBusy(true);
    try {
      const file = await toMp3(rawFile);
      const u = await fetch('/api/talent/audition-upload', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(uj.error || tx('上傳準備失敗', '上传准备失败', 'Upload prep failed'));
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      const p = await fetch('/api/talent/quotes', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: quote.id, sample_url: uj.publicUrl }) });
      const pj = await p.json().catch(() => ({}));
      if (!p.ok) throw new Error(pj.error || tx('儲存失敗', '保存失败', 'Save failed'));
      onDone({ ...quote, sample_url: uj.publicUrl, reaudition_requested_at: null, reaudition_note: null });
    } catch (e) { setErr(e instanceof Error ? e.message : tx('上傳失敗', '上传失败', 'Upload failed')); } finally { setBusy(false); }
  }
  return (
    <div className="mt-1.5">
      <label className="inline-flex items-center gap-1.5 text-xs bg-sky-500/15 border border-sky-500/40 text-sky-300 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-sky-500/25 transition">
        {busy ? tx('上傳中…', '上传中…', 'Uploading…') : tx('⬆ 上傳新的試音', '⬆ 上传新的试音', '⬆ Upload new take')}
        <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {err && <p className="text-[10px] text-red-400 mt-1">{err}</p>}
    </div>
  );
}

// Format a Date as YYYY/MM/DD (locale-agnostic, no timezone noise).
function fmtDay(d: Date | null): string {
  return d ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}` : '—';
}

// Derive the license window the way Voices' Job Agreement shows it: a Start Date
// (when the job is awarded — the order's creation date) and an Expiry Date (start +
// the parsed duration from the license term). Buyout / perpetual terms have no
// expiry; an unparseable duration falls back to showing the raw term only.
function licenseWindow(term: string | null | undefined, startISO: string | null | undefined): { start: Date | null; expiry: Date | null; perpetual: boolean; unknown: boolean } {
  const start = startISO ? new Date(startISO) : null;
  const t = (term || '').toString();
  const perpetual = /買斷|永久|無限|不限|perpetual|buyout|forever|in perpetuity|unlimited/i.test(t);
  if (perpetual) return { start, expiry: null, perpetual: true, unknown: false };
  if (!start) return { start: null, expiry: null, perpetual: false, unknown: !!term };
  const y = t.match(/(\d+)\s*(年|year|yr)/i);
  const mo = t.match(/(\d+)\s*(個?月|month|mo)/i);
  const w = t.match(/(\d+)\s*(週|周|week|wk)/i);
  const d = t.match(/(\d+)\s*(天|日|day)/i);
  const e = new Date(start);
  if (y) e.setFullYear(e.getFullYear() + parseInt(y[1], 10));
  else if (mo) e.setMonth(e.getMonth() + parseInt(mo[1], 10));
  else if (w) e.setDate(e.getDate() + parseInt(w[1], 10) * 7);
  else if (d) e.setDate(e.getDate() + parseInt(d[1], 10));
  else return { start, expiry: null, perpetual: false, unknown: true };
  return { start, expiry: e, perpetual: false, unknown: false };
}

// Job agreement (授權書) — shown on a won job. Modelled on the Voices.com Job
// Agreement so the talent sees the full deal before accepting: project, service &
// skill (incl. the use-case), license scope + period (start / expiry dates),
// payment, schedule and instructions. Must be accepted before uploading a
// delivery. Auto-generated from the brief + the won quote.
function JobAgreement({ brief, quote, token, tx, onAccepted }: {
  brief: { brief_number?: string | null; title?: string | null; content_type?: string | null; language?: string | null; accent?: string | null; media_scope?: string | null; territory?: string | null; license_term?: string | null; deadline?: string | null; order_created?: string | null; final_script?: string | null; final_script_url?: string | null };
  quote: Quote; token: string; tx: (a: string, b: string, c: string) => string; onAccepted: (at: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lic = licenseWindow(brief.license_term, brief.order_created);
  // Service & skill line: 真人配音 (Voice Over) + the use-case (content_type), e.g. 線上廣告.
  const skill = [tx('真人配音 Voice Over', '真人配音 Voice Over', 'Voice Over'), brief.content_type].filter(Boolean).join(' · ');
  const voice = [brief.language, brief.accent].filter(Boolean).join(' · ');
  async function accept() {
    setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/talent/quotes', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: quote.id, accept_agreement: true }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || tx('接單失敗', '接单失败', 'Failed'));
      onAccepted(j.quote?.agreement_accepted_at || new Date().toISOString());
    } catch (e) { setErr(e instanceof Error ? e.message : tx('接單失敗', '接单失败', 'Failed')); } finally { setBusy(false); }
  }
  // One label:value row inside a section. Skips itself when there's no value.
  const row = (k: string, v: React.ReactNode, opts?: { gold?: boolean }) => v ? (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[12px] text-gray-400 shrink-0">{k}</span>
      <span className={`text-sm text-right ${opts?.gold ? 'text-[#6FCF97] font-semibold' : 'text-gray-100'}`}>{v}</span>
    </div>
  ) : null;
  // A titled section block.
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="px-4 py-3 border-b border-white/[0.06] last:border-0">
      <p className="text-[11px] tracking-[0.14em] text-[#C9A86A] uppercase mb-1">{title}</p>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </div>
  );
  return (
    <div className="rounded-xl border border-[#C9A86A]/40 bg-[#1a1714]/60 overflow-hidden">
      {/* header — title + 案號, like the License # on a Voices agreement */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#C9A86A]/25 bg-[#C9A86A]/[0.08]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">📄</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#E4CB94]">{tx('授權書 · Job Agreement', '授权书 · Job Agreement', 'Job Agreement')}</p>
            <p className="text-[11px] text-gray-400">{tx('接單前請確認以下條款,雙方依此履約。', '接单前请确认以下条款,双方依此履约。', 'Review the full terms before accepting.')}</p>
          </div>
        </div>
        {brief.brief_number && <span className="text-[11px] font-mono text-[#C9A86A]/80 shrink-0">#{brief.brief_number}</span>}
      </div>

      {/* Project */}
      <Section title={tx('專案 Project', '专案 Project', 'Project')}>
        {row(tx('案件', '案件', 'Title'), `${brief.title || brief.content_type || '—'}${quote.role_name ? ` · ${quote.role_name}` : ''}`)}
        {row(tx('委託', '委托', 'Engaged by'), tx('客戶委託(經 Onyx 平台居中)', '客户委托(经 Onyx 平台居中)', 'Client engagement via Onyx'))}
      </Section>

      {/* Service & Skill — with the use-case spelled out */}
      <Section title={tx('服務與技能 Service & Skill', '服务与技能 Service & Skill', 'Service & Skill')}>
        {row(tx('服務', '服务', 'Service'), skill)}
        {row(tx('聲音', '声音', 'Voice'), voice)}
      </Section>

      {/* License — scope + the period (start / expiry), the part that was missing */}
      <Section title={tx('授權 License', '授权 License', 'License')}>
        {row(tx('使用範圍', '使用范围', 'Usage'), brief.media_scope)}
        {row(tx('地區', '地区', 'Territory'), brief.territory)}
        {row(tx('授權期間', '授权期间', 'Term'), brief.license_term)}
        {row(tx('授權開始', '授权开始', 'Start date'), lic.start ? fmtDay(lic.start) : tx('接單日起算', '接单日起算', 'On award'))}
        {row(tx('授權到期', '授权到期', 'Expiry date'),
          lic.perpetual ? tx('永久(買斷)', '永久(买断)', 'Perpetual (buyout)')
            : lic.expiry ? fmtDay(lic.expiry)
              : (brief.license_term ? tx('依授權期間計算', '依授权期间计算', 'Per term above') : '—'))}
      </Section>

      {/* Payment */}
      <Section title={tx('報酬 Payment', '报酬 Payment', 'Payment')}>
        {row(tx('您實拿', '您实拿', 'You receive'), <span>{quote.currency} {quote.net_amount}</span>, { gold: true })}
        {quote.included_revisions != null && row(tx('含修改', '含修改', 'Revisions'), `${quote.included_revisions} ${tx('次', '次', '×')}`)}
        {row(tx('結算', '结算', 'Settlement'), tx('完成驗收後由 Onyx 平台付款', '完成验收后由 Onyx 平台付款', 'Paid by Onyx after approval'))}
      </Section>

      {/* Schedule */}
      <Section title={tx('時程 Schedule', '时程 Schedule', 'Schedule')}>
        {row(tx('開始', '开始', 'Start'), tx('接單後即可開始錄製', '接单后即可开始录制', 'Begin once accepted'))}
        {row(tx('交付期限', '交付期限', 'Delivery due'), brief.deadline || tx('與客戶議定', '与客户议定', 'TBD with client'))}
      </Section>

      {/* Instructions & Files for the talent */}
      <Section title={tx('給配音員 Instructions & Files', '给配音员 Instructions & Files', 'Instructions & Files')}>
        {row(tx('正式稿件', '正式稿件', 'Final script'),
          brief.final_script ? tx('已附(見上方,請依此錄製)', '已附(见上方,请依此录制)', 'Provided above — record from it')
            : brief.final_script_url ? tx('已附稿件檔(見上方)', '已附稿件档(见上方)', 'File attached above')
              : tx('將由客戶提供', '将由客户提供', 'Client will provide'))}
        {row(tx('技術規格', '技术规格', 'Spec'), tx('正式錄製 48kHz / 24-bit、乾淨無雜訊', '正式录制 48kHz / 24-bit、干净无杂讯', '48kHz / 24-bit, clean, noise-free'))}
      </Section>

      {/* Terms + accept */}
      <div className="p-4 space-y-3 border-t border-[#C9A86A]/25 bg-black/20">
        <p className="text-xs text-gray-300 leading-relaxed">{tx('按「同意並接單」即表示您同意依上述條款交付,並授予客戶上述使用範圍、地區與期間之授權;完成後在此上傳交付檔,由 Onyx 平台居中驗收與結算。未接單前無法上傳。', '按「同意并接单」即表示您同意依上述条款交付,并授予客户上述使用范围、地区与期间之授权;完成后在此上传交付档,由 Onyx 平台居中验收与结算。未接单前无法上传。', 'Accepting means you agree to deliver per the terms above and grant the client the usage, territory and term shown; upload your delivery here when done — Onyx handles review and payment. You can\'t upload before accepting.')}</p>
        {err && <p className="text-[11px] text-red-400">{err}</p>}
        <button onClick={accept} disabled={busy} className="w-full rounded-lg px-4 py-2.5 text-sm disabled:opacity-50" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 700 }}>
          {busy ? tx('處理中…', '处理中…', '…') : tx('✓ 同意並接單', '✓ 同意并接单', '✓ Accept & take the job')}
        </button>
      </div>
    </div>
  );
}

export default function Opportunities() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [phase, setPhase] = useState<'loading' | 'nologin' | 'ready'>('loading');
  const [token, setToken] = useState('');
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, Record<string, number>>>({});
  const [myDemos, setMyDemos] = useState<Demo[]>([]);
  const [wonBriefs, setWonBriefs] = useState<{ id: string; brief_number: string; title?: string | null; content_type?: string | null; language?: string | null; accent?: string | null; rate_note?: string | null; status: string; media_scope?: string | null; territory?: string | null; license_term?: string | null; deadline?: string | null; order_created?: string | null; order_id?: string | null; order_status?: string | null; final_script?: string | null; final_script_url?: string | null; deliveries?: { id: string; file_name: string; file_url: string; status?: string | null; client_feedback?: string | null }[] }[]>([]);
  const [endedBriefs, setEndedBriefs] = useState<{ id: string; brief_number: string; title?: string | null; content_type?: string | null; status: string }[]>([]);
  const [myName, setMyName] = useState('');
  const [templates, setTemplates] = useState<Templates>({});

  const load = useCallback(async (accessToken: string) => {
    setToken(accessToken);
    const res = await fetch('/api/talent/briefs', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 401) return setPhase('nologin');
    const j = await res.json().catch(() => ({}));
    setBriefs(j.briefs || []);
    setQuotes(j.myQuotes || []);
    setRoleCounts(j.roleCounts || {});
    setMyDemos(j.myDemos || []);
    setWonBriefs(j.wonBriefs || []);
    setEndedBriefs(j.endedBriefs || []);
    setMyName(j.myName || '');
    setTemplates(j.templates || {});
    setPhase('ready');
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await load(data.session.access_token);
      else setPhase('nologin');
    })();
  }, [load]);

  // Left-aligned container matching the client dashboard pages (the talent layout
  // already provides the sidebar offset + top padding).
  const shell = (inner: React.ReactNode) => (
    <div className="text-white p-6 lg:p-10">
      <div className="max-w-5xl">{inner}</div>
    </div>
  );

  if (phase === 'loading') return shell(<p className="text-gray-500 text-sm text-center py-20">{tx('載入中…', '加载中…', 'Loading…')}</p>);

  if (phase === 'nologin') {
    return shell(
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold mb-3">{tx('案件', '案件', 'Cases')}</h1>
        <p className="text-gray-400 text-sm mb-6">{tx('請先登入您的配音員後台。', '请先登录您的配音员后台。', 'Please sign in to your talent dashboard first.')}</p>
        <Link href="/talent" className="text-green-400 hover:underline text-sm">{tx('前往登入 →', '前往登录 →', 'Go to sign in →')}</Link>
      </div>
    );
  }

  return shell(
    <>
      <div className="flex items-start justify-between gap-3 mb-8">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-medium">{tx('配音員入口', '配音员入口', 'Talent portal')}</p>
          <h1 className="text-3xl font-bold tracking-tight">{tx('案件機會', '案件机会', 'Opportunities')}</h1>
          <p className="text-gray-500 text-sm mt-1">{tx('開放中的試音案、您接到的案件與應徵紀錄。', '开放中的试音案、您接到的案件与应征记录。', 'Open auditions, jobs you won, and your audition history.')}</p>
        </div>
        <Link href="/talent" className="text-xs text-gray-400 hover:text-white transition whitespace-nowrap shrink-0 pt-1">{tx('← 我的檔案', '← 我的资料', '← My profile')}</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatModule icon={Briefcase} label={tx('開放中', '开放中', 'Open')} value={briefs.length} />
        <StatModule icon={CheckCircle2} label={tx('我接到的', '我接到的', 'Won')} value={wonBriefs.length} />
        <StatModule icon={Archive} label={tx('已結束', '已结束', 'Ended')} value={endedBriefs.length} />
      </div>

      {(() => {
        const reaudits = quotes.filter((q) => q.reaudition_requested_at);
        if (!reaudits.length) return null;
        const titleOf = (bid: string) => { const bb = briefs.find((x) => x.id === bid); return bb?.title || bb?.content_type || tx('配音案', '配音案', 'Voice case'); };
        return (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-sky-300 mb-3">🔁 {tx('客戶請你重錄', '客户请你重录', 'Client asked for a re-record')}</h2>
            <div className="grid grid-cols-1 gap-4">
              {reaudits.map((q) => (
                <EntityCard key={q.id} icon={Briefcase} accent="sky" code={q.role_name || undefined}
                  title={titleOf(q.brief_id)}
                  badge={<span className="text-xs px-2.5 py-1 rounded-full border bg-sky-500/15 text-sky-200 border-sky-500/30 whitespace-nowrap">{tx('二次試音', '二次试音', 'Second take')}</span>}>
                  {q.reaudition_note && <p className="text-sm text-gray-300 whitespace-pre-wrap mb-2"><span className="text-gray-500">{tx('客戶方向', '客户方向', 'Direction')}:</span> {q.reaudition_note}</p>}
                  {q.sample_url && <audio controls src={q.sample_url} className="w-full h-9 mb-1" />}
                  <ReauditUpload quote={q} token={token} tx={tx} onDone={(nq) => setQuotes((prev) => prev.map((x) => (x.id === nq.id ? nq : x)))} />
                  <p className="text-[11px] text-gray-500 mt-1">{tx('上傳新版本後,這個請求就會清除。', '上传新版本后,这个请求就会清除。', 'Uploading a new take clears this request.')}</p>
                </EntityCard>
              ))}
            </div>
          </div>
        );
      })()}

      {wonBriefs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[#6FCF97] mb-3">{tx('✓ 我接到的案件', '✓ 我接到的案件', '✓ Jobs I won')}</h2>
          <div className="grid grid-cols-1 gap-4">
            {wonBriefs.map((w) => {
              const myAccepted = quotes.filter((q) => q.brief_id === w.id && q.status === 'accepted');
              return (
                <EntityCard
                  key={w.id}
                  icon={CheckCircle2}
                  accent="green"
                  code={w.brief_number}
                  title={w.title || w.content_type || tx('配音案', '配音案', 'Voice case')}
                  badge={w.order_status === 'completed'
                    ? <span className="text-xs px-2.5 py-1 rounded-full border bg-[#6FCF97]/20 text-[#6FCF97] border-[#6FCF97]/40 whitespace-nowrap">{tx('已完成', '已完成', 'Completed')}</span>
                    : <span className="text-xs px-2.5 py-1 rounded-full border bg-green-500/15 text-green-200 border-green-500/30 whitespace-nowrap">{tx('製作中', '制作中', 'In production')}</span>}
                >
                  {(w.final_script || w.final_script_url) && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1.5">{tx('正式稿件(客戶提供 · 請依此錄製)', '正式稿件(客户提供 · 请依此录制)', 'Final script (from the client — record this)')}</p>
                      {w.final_script && (
                        <div className="text-sm text-gray-100 whitespace-pre-wrap bg-black/40 border border-white/10 rounded-lg p-3 max-h-60 overflow-y-auto select-none"
                          style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>
                          {w.final_script}
                        </div>
                      )}
                      {w.final_script_url && (
                        <a href={w.final_script_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:underline mt-1.5">📄 {tx('下載正式稿件檔', '下载正式稿件档', 'Download script file')}</a>
                      )}
                    </div>
                  )}
                  {(() => {
                    const rev = (w.deliveries || []).filter((d) => d.status === 'revision_requested').slice(-1)[0];
                    if (!rev) return null;
                    return (
                      <div className="mb-3 rounded-lg border border-sky-500/30 bg-sky-500/[0.08] px-3 py-2.5">
                        <p className="text-sm font-semibold text-sky-300 mb-1">🔁 {tx('客戶要求修改', '客户要求修改', 'Client requested changes')}</p>
                        {rev.client_feedback && <p className="text-sm text-gray-200 whitespace-pre-wrap"><span className="text-gray-500">{tx('客戶意見', '客户意见', 'Notes')}:</span> {rev.client_feedback}</p>}
                        <p className="text-[11px] text-gray-400 mt-1">{tx('請依意見修改後,在下方重新上傳修改版。', '请依意见修改后,在下方重新上传修改版。', 'Revise per the notes and upload the new version below.')}</p>
                      </div>
                    );
                  })()}
                  {myAccepted.map((q) => (
                    <div key={q.id} className="mb-2">
                      <div className="text-xs text-gray-400 mb-1">{q.role_name ? `${q.role_name} · ` : ''}{tx('實拿', '实拿', 'You earn')} <span className="text-[#6FCF97] font-medium">{q.currency} {q.net_amount}</span></div>
                      {q.agreement_accepted_at ? (
                        <DeliveryUpload quote={q} deliveries={w.deliveries || []} token={token} tx={tx} onChanged={() => load(token)} />
                      ) : (
                        <JobAgreement brief={w} quote={q} token={token} tx={tx} onAccepted={(at) => setQuotes((prev) => prev.map((x) => (x.id === q.id ? { ...x, agreement_accepted_at: at } : x)))} />
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    <p className="text-[11px] text-gray-500">{tx('接單後即可開始錄製,完成在此上傳交付檔。', '接单后即可开始录制,完成在此上传交付档。', 'Once you accept, record and upload your delivery here.')}</p>
                    <Link href={`/talent/messages?brief=${w.id}`} className="inline-flex items-center gap-1 text-[11px] text-sky-300 hover:text-sky-200 hover:underline">💬 {tx('與客戶直接對話', '与客户直接对话', 'Message the client')} →</Link>
                  </div>
                  {w.order_status === 'completed' && w.order_id && (
                    <div className="mt-3"><ReviewBox orderId={w.order_id} myType="talent" /></div>
                  )}
                </EntityCard>
              );
            })}
          </div>
        </div>
      )}

      {endedBriefs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">{tx('我應徵過 · 已結束', '我应征过 · 已结束', 'Auditioned · ended')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {endedBriefs.map((e) => {
              const label = e.status === 'cancelled'
                ? tx('此案已取消', '此案已取消', 'Cancelled')
                : e.status === 'awarded'
                  ? tx('已選定其他配音員', '已选定其他配音员', 'Another talent was chosen')
                  : tx('此案已結束', '此案已结束', 'Closed');
              return (
                <EntityCard
                  key={e.id}
                  icon={Archive}
                  accent="gray"
                  code={e.brief_number}
                  title={<span className="text-gray-300">{e.title || e.content_type || tx('配音案', '配音案', 'Voice case')}</span>}
                  badge={<span className="text-xs px-2.5 py-1 rounded-full border bg-white/10 text-gray-400 border-white/15 whitespace-nowrap">{label}</span>}
                />
              );
            })}
          </div>
        </div>
      )}

      {briefs.length > 0 && (wonBriefs.length > 0 || endedBriefs.length > 0) && (
        <h2 className="text-sm font-semibold text-white mb-3">{tx('開放中的案件', '开放中的案件', 'Open cases')}</h2>
      )}

      {briefs.length === 0 && wonBriefs.length === 0 && endedBriefs.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-16">{tx('目前沒有開放中的案件。之後有新案件會出現在這裡。', '目前没有开放中的案件。之后有新案件会出现在这里。', 'No open cases right now. New ones will appear here.')}</p>
      )}

      <div className="space-y-3">
        {briefs.map((b) => (
          <BriefCard
            key={b.id}
            brief={b}
            defaultOpen={false}
            myQuotes={quotes.filter((q) => q.brief_id === b.id)}
            roleCounts={roleCounts[b.id] || {}}
            myDemos={myDemos}
            myName={myName}
            templates={templates}
            onTemplates={setTemplates}
            token={token}
            tx={tx}
            onQuoted={(q) => setQuotes((prev) => [q, ...prev])}
          />
        ))}
      </div>
    </>
  );
}

function BriefCard({
  brief,
  defaultOpen,
  myQuotes,
  roleCounts,
  myDemos,
  myName,
  templates,
  onTemplates,
  token,
  tx,
  onQuoted,
}: {
  brief: Brief;
  defaultOpen?: boolean;
  myQuotes: Quote[];
  roleCounts: Record<string, number>;
  myDemos: Demo[];
  myName: string;
  templates: Templates;
  onTemplates: (t: Templates) => void;
  token: string;
  tx: (tw: string, cn: string, en: string) => string;
  onQuoted: (q: Quote) => void;
}) {
  const popularThreshold = Number(brief.audition_cap) || 5;
  const isCasting = brief.kind === 'casting';
  const hasRoles = (brief.roles || []).length > 0; // casting WITHOUT roles = general single-voice call
  const myQuote = myQuotes[0]; // regular briefs have a single quote per talent
  const [open, setOpen] = useState(!!defaultOpen);
  const [gross, setGross] = useState('');
  const currency = dealCurrency(brief); // fixed by the client's posting budget — not picked by the talent
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const grossN = Number(gross);
  const netPreview = isFinite(grossN) && grossN > 0 ? Math.round(grossN * (1 - COMMISSION) * 100) / 100 : 0;

  async function submitQuote() {
    setErr('');
    if (!isFinite(grossN) || grossN <= 0) return setErr(tx('請輸入大於 0 的金額', '请输入大于 0 的金额', 'Enter an amount greater than 0'));
    setBusy(true);
    const res = await fetch('/api/talent/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brief_id: brief.id, gross_amount: grossN, currency, message }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', '送出失败', 'Submit failed'));
    onQuoted(j.quote);
  }

  return (
    <div className={`bg-white/[0.03] backdrop-blur-sm border rounded-xl overflow-hidden transition ${open ? 'border-white/15' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
      <CaseHeader brief={brief} isCasting={isCasting} roleCount={(brief.roles || []).length} hasMine={myQuotes.length > 0} open={open} onToggle={() => setOpen((o) => !o)} tx={tx} />

      {open && (
      <div className="px-5 pb-5">
      {isCasting ? (
        <>
          {brief.brief && <p className="text-sm text-gray-200 whitespace-pre-wrap mb-3">{brief.brief}</p>}

          {/* stat-card summary — only show facts that exist (no 待定 clutter). Rate
              shows the client budget for client cases, the Onyx rate for platform. */}
          {(() => {
            const stats = [
              brief.source === 'client'
                ? (brief.budget ? { l: tx('客戶預算', '客户预算', 'Budget'), v: `${brief.budget_type ? `${brief.budget_type} ` : ''}${brief.budget}`, gold: true } : null)
                : (brief.rate_note ? { l: tx('報酬', '报酬', 'Rate'), v: brief.rate_note, gold: true } : null),
              brief.audition_deadline ? { l: tx('試音截止', '试音截止', 'Audition due'), v: brief.audition_deadline } : null,
              brief.deadline ? { l: tx('交付截止', '交付截止', 'Delivery'), v: brief.deadline } : null,
              brief.length ? { l: tx('規模', '规模', 'Scale'), v: brief.length } : null,
            ].filter(Boolean) as { l: string; v: string; gold?: boolean }[];
            return stats.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                {stats.map((s, i) => (
                  <div key={i} className="bg-[#1d1b25] border border-white/[0.08] rounded-xl p-3.5">
                    <p className="text-[11px] text-gray-500">{s.l}</p>
                    <p className={`text-lg font-semibold mt-0.5 ${s.gold ? 'text-[#E4CB94]' : 'text-white'}`} style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{s.v}</p>
                  </div>
                ))}
              </div>
            ) : null;
          })()}
          {/* detail grid — every other field filled in, in a tidy key:value block */}
          {(() => {
            const methodLabel = (m: string) => (m === 'home' ? tx('在家錄', '在家录', 'Home') : m === 'studio' ? tx('錄音室', '录音室', 'Studio') : m === 'online' ? tx('線上監錄', '线上监录', 'Online') : m);
            const info: [string, string][] = ([
              [tx('語言', '语言', 'Language'), brief.language],
              [tx('口音', '口音', 'Accent'), brief.accent],
              [tx('聲音風格', '声音风格', 'Style'), brief.voice_style],
              [tx('聲音年齡', '声音年龄', 'Voice age'), brief.voice_age],
              [tx('使用範圍', '使用范围', 'Usage'), brief.media_scope],
              [tx('地區', '地区', 'Territory'), brief.territory],
              [tx('授權', '授权', 'License'), brief.license_term],
              [tx('預計開錄', '预计开录', 'Records'), brief.recording_start],
              [tx('含修改', '含修改', 'Revisions'), brief.base_revisions != null ? `${brief.base_revisions} ${tx('次', '次', '×')}` : ''],
              [tx('錄音方式', '录音方式', 'Recording'), (brief.recording_methods || []).map(methodLabel).join(' / ')],
            ] as [string, string | null | undefined][]).filter((x): x is [string, string] => !!x[1]);
            return info.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 text-sm bg-[#1d1b25] border border-white/[0.08] rounded-xl p-4 mb-4">
                {info.map(([k, v], i) => <div key={i} className="min-w-0"><span className="text-gray-500">{k} </span><span className="text-gray-200">{v}</span></div>)}
              </div>
            ) : null;
          })()}

          {/* Direction + reference — moved down, just above the audition action.
              Reference renders by file type (audio player / image / link) so an
              image is never played as audio. */}
          {brief.audition_script && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1.5">{tx('試音方向 / 聲音方向(僅供線上閱讀)', '试音方向 / 声音方向(仅供线上阅读)', 'Audition / voice direction (read-only)')}</p>
              <div className="text-sm text-gray-200 whitespace-pre-wrap bg-black/40 border border-white/10 rounded-lg p-3 select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>
                {brief.audition_script}
              </div>
            </div>
          )}
          {(() => {
            const refs = [
              ...(brief.reference_files || []).map((f) => ({ url: f.url, name: f.name })),
              ...(brief.reference_links || []).map((l) => ({ url: l, name: undefined as string | undefined })),
            ].filter((r) => r.url);
            if (!refs.length) return null;
            const ext = (u: string) => (u.split('?')[0].split('.').pop() || '').toLowerCase();
            const isAudio = (u: string) => ['wav', 'wave', 'mp3', 'm4a', 'aac', 'ogg', 'flac'].includes(ext(u));
            const isImg = (u: string) => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp'].includes(ext(u));
            return (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1.5">{tx('參考素材', '参考素材', 'Reference')}</p>
                <div className="space-y-2">
                  {refs.map((r, i) => (
                    isAudio(r.url) ? <audio key={i} controls src={r.url} className="w-full h-9" />
                      : isImg(r.url) ? <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"><img src={r.url} alt={r.name || 'reference'} className="max-h-40 rounded-lg border border-white/10" /></a>
                      : <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:underline break-all">🔗 {r.name || r.url}</a>
                  ))}
                </div>
              </div>
            );
          })()}

          {hasRoles ? (
            <div className="border-t border-white/10 pt-4">
              {/* submission rules — official, so talent knows the requirements up front */}
              <div className="grid sm:grid-cols-3 gap-2.5 mb-4">
                {[
                  { t: tx('一角一檔 · 請勿整軌', '一角一档 · 请勿整轨', 'One file per role'), d: tx('每個角色個別上傳,系統各自建檔;請勿把多角色錄在同一段音檔。', '每个角色个别上传,系统各自建档;请勿把多角色录在同一段音档。', 'Upload each role separately; do not record multiple roles in one file.') },
                  { t: tx('檔名自動帶入', '档名自动带入', 'Auto-named files'), d: tx('提交後系統自動命名「案號_角色_藝名」,無須自行更名。', '提交后系统自动命名「案号_角色_艺名」,无须自行更名。', 'Files are auto-named "case_role_artist" on submit.') },
                  { t: tx('音檔格式', '音档格式', 'Audio format'), d: tx('試音檔 MP3 / WAV / M4A 皆可(建議 MP3)。環境安靜、口齒清楚即可;正式錄製再要求 48kHz / 24-bit。', '试音档 MP3 / WAV / M4A 皆可(建议 MP3)。环境安静、口齿清楚即可;正式录制再要求 48kHz / 24-bit。', 'MP3 / WAV / M4A accepted (MP3 preferred). Quiet room, clear delivery; full 48k/24-bit only for final record.') },
                ].map((r, i) => (
                  <div key={i} className="bg-[#1d1b25] border border-white/[0.08] rounded-xl p-3.5">
                    <p className="text-sm font-medium text-[#E4CB94] mb-1">{r.t}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{r.d}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-baseline justify-between mb-1">
                <h4 className="text-lg font-semibold text-white" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{tx('試音角色', '试音角色', 'Roles')}</h4>
                {(() => { const rs = brief.roles || []; const m = rs.filter((r) => (r.gender || '').includes('男')).length; const f = rs.filter((r) => (r.gender || '').includes('女')).length; return <span className="text-xs text-gray-500">{tx(`共 ${rs.length} 角 · 男 ${m} / 女 ${f}`, `共 ${rs.length} 角 · 男 ${m} / 女 ${f}`, `${rs.length} roles · ${m}M / ${f}F`)}</span>; })()}
              </div>
              <p className="text-xs text-gray-400 mb-3">{tx('挑選角色 → 唸出台詞並錄音 → 上傳試音並報價。可應徵多個角色。', '挑选角色 → 念出台词并录音 → 上传试音并报价。可应征多个角色。', 'Pick a role → read its line aloud and record → upload your audition and quote. You may audition for several roles.')}</p>
              <div className="space-y-3">
                {(brief.roles || []).map((ro, i) => (
                  <RoleAudition
                    key={i}
                    brief={brief}
                    role={ro}
                    count={roleCounts[ro.name || ''] || 0}
                    popularThreshold={popularThreshold}
                    done={myQuotes.find((q) => (q.role_name || '') === (ro.name || ''))}
                    token={token}
                    tx={tx}
                    onQuoted={onQuoted}
                    myName={myName}
                    templates={templates}
                    onTemplates={onTemplates}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* General (single-voice) call — respond with an existing demo OR an upload + price. */
            <GeneralResponse brief={brief} myDemos={myDemos} done={myQuotes[0]} token={token} tx={tx} onQuoted={onQuoted} myName={myName} templates={templates} onTemplates={onTemplates} />
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-gray-200 whitespace-pre-wrap mb-2">{brief.brief}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
            {brief.media_scope && <span>{tx('媒體', '媒体', 'Media')}: {brief.media_scope}</span>}
            {brief.territory && <span>{tx('地區', '地区', 'Territory')}: {brief.territory}</span>}
            {brief.license_term && <span>{tx('授權', '授权', 'License')}: {brief.license_term}</span>}
            {brief.audition_deadline && <span>{tx('試音截止', '试音截止', 'Audition')}: {brief.audition_deadline}</span>}
            {brief.length && <span>{tx('長度', '长度', 'Length')}: {brief.length}</span>}
            {brief.budget && <span>{tx('預算', '预算', 'Budget')}: {brief.budget_type ? `${brief.budget_type} ` : ''}{brief.budget}</span>}
          </div>

          {myQuote ? (
            <div className="border-t border-white/10 pt-3 text-sm">
              <span className="text-green-300">{tx('已報價', '已报价', 'Quoted')}: {myQuote.currency} {myQuote.net_amount} {tx('(淨收入)', '(净收入)', '(net)')}</span>
              <span className="text-gray-500 ml-2">· {tx('狀態', '状态', 'Status')}: {myQuote.status}</span>
            </div>
          ) : (
            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex gap-2">
                <span className={`${inputCls} w-24 flex items-center justify-center font-medium text-gray-200 bg-white/[0.07]`} title={tx('幣別依案件預算', '币别依案件预算', 'Currency set by the brief')}>{currency}</span>
                <input type="number" min="0" className={inputCls} value={gross} onChange={(e) => setGross(e.target.value)}
                  placeholder={tx('客戶支付金額(報價)', '客户支付金额(报价)', 'Amount the client pays (your quote)')} />
              </div>
              {grossN > 0 && (
                <p className="text-xs text-green-300">{tx('您的淨收入', '您的净收入', 'Your net take-home')}: {currency} {netPreview} <span className="text-gray-500">({tx('已扣 20% 平台費', '已扣 20% 平台费', 'after 20% fee')})</span></p>
              )}
              <textarea className={`${inputCls} min-h-[60px] resize-y`} value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder={tx('附註(選填):為什麼您適合這個案子…', '附注(选填):为什么您适合这个案子…', 'Note (optional): why you fit this brief…')} />
              {err && <p className="text-red-400 text-xs">{err}</p>}
              <button onClick={submitQuote} disabled={busy} className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2 text-sm transition">
                {busy ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出報價', '送出报价', 'Submit quote')}
              </button>
            </div>
          )}
        </>
      )}
      </div>
      )}
    </div>
  );
}

// Compact, always-visible case header (Voices-style list row). Click to expand the
// full detail below. Shows the headline facts so several cases scan at a glance.
function CaseHeader({
  brief, isCasting, roleCount, hasMine, open, onToggle, tx,
}: {
  brief: Brief;
  isCasting: boolean;
  roleCount: number;
  hasMine: boolean;
  open: boolean;
  onToggle: () => void;
  tx: (tw: string, cn: string, en: string) => string;
}) {
  const due = brief.audition_deadline || brief.deadline;
  const cat = brief.content_type || (brief.categories || [])[0];
  return (
    <button onClick={onToggle} className="w-full text-left px-5 py-4 hover:bg-white/[0.02] transition">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg border mt-0.5 shrink-0 bg-amber-500/10 border-amber-500/20"><Briefcase className="w-4 h-4 text-amber-400" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="text-xs text-gray-500 font-mono">{isCasting ? caseCode(brief) : brief.brief_number}</span>
            {brief.source === 'client'
              ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#7fb2e8]/15 text-[#9ec4ee] border border-[#7fb2e8]/30">{tx('客戶委託', '客户委托', 'Client brief')}</span>
              : <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#C9A86A]/15 text-[#E4CB94] border border-[#C9A86A]/30">{tx('平台發案', '平台发案', 'Onyx-posted')}</span>}
            {isCasting
              ? <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 600 }}>{tx('試音案', '试音案', 'Casting')}</span>
              : cat && <span className="text-[11px] bg-amber-500/15 text-amber-200 px-2 py-0.5 rounded-full">{cat}</span>}
            {brief.language && <span className="text-[11px] bg-white/[0.06] border border-white/10 text-gray-300 px-2 py-0.5 rounded-full">{brief.language}</span>}
            {brief.has_singing && <span className="text-[11px] bg-pink-500/15 text-pink-200 px-2 py-0.5 rounded-full">{tx('含唱歌', '含唱歌', 'Singing')}</span>}
            {brief.wants_live_session && <span className="text-[11px] bg-sky-500/15 text-sky-200 px-2 py-0.5 rounded-full">{tx('線上監錄', '线上监录', 'Live')}</span>}
            {brief.wants_director && <span className="text-[11px] bg-sky-500/15 text-sky-200 px-2 py-0.5 rounded-full">{tx('聲音導演', '声音导演', 'Director')}</span>}
          </div>
          <h3 className="text-xl font-semibold text-white leading-snug truncate" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>
            {brief.title || cat || tx('配音案', '配音案', 'Voice case')}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs">
            {brief.rate_note && <span className="text-[#E4CB94] font-medium">{brief.rate_note}</span>}
            {isCasting && roleCount > 0 && <span className="text-gray-400">{tx(`共 ${roleCount} 角`, `共 ${roleCount} 角`, `${roleCount} roles`)}</span>}
            {!isCasting && brief.budget && <span className="text-gray-400">{tx('預算', '预算', 'Budget')} {brief.budget_type ? `${brief.budget_type} ` : ''}{brief.budget}</span>}
            {due && <span className="text-amber-300/80">{tx('截止', '截止', 'Due')} {due}</span>}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 pt-0.5">
          {hasMine && <span className="text-[11px] text-[#6FCF97] whitespace-nowrap">{tx('已試', '已试', 'Done')}</span>}
          <span className={`text-gray-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </div>
    </button>
  );
}

// One role's audition: view its line → upload audition → write your price/terms.
// Full roles are disabled (no count shown); near-full nudges to try another.
function RoleAudition({
  brief, role, count, popularThreshold, done, token, tx, onQuoted, myName, templates, onTemplates,
}: {
  brief: Brief;
  role: Role;
  count: number;          // how many have auditioned this role (shown to talents)
  popularThreshold: number; // soft nudge threshold — NOT a hard cap
  done?: Quote;
  token: string;
  tx: (tw: string, cn: string, en: string) => string;
  onQuoted: (q: Quote) => void;
  myName: string;
  templates: Templates;
  onTemplates: (t: Templates) => void;
}) {
  const isPopular = count >= popularThreshold;
  const [open, setOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gross, setGross] = useState('');
  const currency = dealCurrency(brief); // fixed by the client's posting budget — not picked by the talent
  const [intro, setIntro] = useState('');
  const [revPolicy, setRevPolicy] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const meta = [role.gender, role.age].filter(Boolean).join('·');

  async function uploadAudio(rawFile: File) {
    setErr(''); setUploading(true);
    try {
      const file = await toMp3(rawFile); // normalize to MP3 (falls back to original on failure)
      const u = await fetch('/api/talent/audition-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name }),
      });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(uj.error || tx('上傳準備失敗', '上传准备失败', 'Upload prep failed'));
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      setAudioUrl(uj.publicUrl);
    } catch (e) { setErr(e instanceof Error ? e.message : tx('上傳失敗', '上传失败', 'Upload failed')); } finally { setUploading(false); }
  }

  async function submit() {
    setErr('');
    if (!audioUrl) return setErr(tx('請先上傳試音音檔', '请先上传试音音档', 'Please upload your audition first'));
    const earn = Number(gross); // input = the talent's take-home fee
    if (!isFinite(earn) || earn <= 0) return setErr(tx('請填報價', '请填报价', 'Enter your price'));
    // client cases: platform adds 20% on top → the client pays earn / 0.8
    const grossAmount = brief.source === 'client' ? Math.round((earn / 0.8) * 100) / 100 : earn;
    const message = [intro.trim(), revPolicy.trim() && `${tx('修改政策', '修改政策', 'Revisions')}: ${revPolicy.trim()}`].filter(Boolean).join('\n\n');
    setBusy(true);
    const res = await fetch('/api/talent/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brief_id: brief.id, role_name: role.name, sample_url: audioUrl, gross_amount: grossAmount, currency, intro, message, extra_revision_price: revPolicy.trim() || undefined }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', '送出失败', 'Submit failed'));
    onQuoted(j.quote);
  }

  // Horizontal card — portrait on the left, all info on the right, so it stays
  // compact and several roles fit on screen at once.
  const imageLeft = (
    <div className="w-28 sm:w-36 shrink-0 relative bg-[#14131a]">
      {role.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={role.image} alt={role.name} className="absolute inset-0 w-full h-full object-cover object-top" />
      ) : <div className="absolute inset-0 flex items-center justify-center text-3xl text-gray-600">🎭</div>}
      {role.is_lead && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded font-medium z-10" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)' }}>★ {tx('主角', '主角', 'Lead')}</span>}
    </div>
  );
  const nameRow = (
    <div className="flex items-start justify-between gap-2">
      <span className="text-lg font-semibold text-white leading-tight" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{role.name}</span>
      {meta && <span className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ color: '#7fb2e8', background: 'rgba(127,178,232,.14)' }}>{meta}</span>}
    </div>
  );

  // Already auditioned this role.
  if (done) {
    return (
      <div className="flex rounded-2xl overflow-hidden bg-[#1d1b25] border border-[#6FCF97]/30">
        {imageLeft}
        <div className="flex-1 min-w-0 p-4">
          {nameRow}
          <p className="text-sm text-[#6FCF97] mt-1.5">{tx('✓ 已試音', '✓ 已试音', '✓ Auditioned')}</p>
          {done.sample_url && <audio controls src={done.sample_url} className="w-full h-9 mt-2" />}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex rounded-2xl overflow-hidden bg-[#1d1b25] border transition ${role.is_lead ? 'border-[#C9A86A]/50' : 'border-white/[0.08]'} hover:border-[#C9A86A]/40`}>
      {imageLeft}
      <div className="flex-1 min-w-0 p-4 space-y-2.5">
        {nameRow}
        {role.timbre && <p className="text-sm text-[#C9A86A] leading-snug">{tx('聲線', '声线', 'Voice')} · {role.timbre}</p>}
        {role.personality && <p className="text-sm text-gray-400 leading-snug">{role.personality}</p>}

        {(role.emotion || role.speed || role.volume) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {role.emotion && <span><span className="text-gray-500">{tx('情緒', '情绪', 'Emotion')} </span><span className="text-gray-200">{role.emotion}</span></span>}
            {role.speed && <span><span className="text-gray-500">{tx('語速', '语速', 'Pace')} </span><span className="text-gray-200">{role.speed}</span></span>}
            {role.volume && <span><span className="text-gray-500">{tx('台詞量', '台词量', 'Volume')} </span><span className="text-gray-200">{role.volume}</span></span>}
          </div>
        )}

        {role.sample_line && (
          <div className="bg-[#14131a] border border-white/[0.08] rounded-xl px-3.5 py-3 select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>
            <span className="inline-block text-[11px] tracking-[0.18em] text-[#C9A86A] mb-1">{tx('試音樣詞', '试音样词', 'Audition line')}</span>
            <p className="text-[15px] leading-relaxed text-gray-100 whitespace-pre-wrap">{role.sample_line}</p>
          </div>
        )}
        {role.note && <p className="text-xs text-gray-500 leading-snug"><span className="text-gray-600">{tx('備註', '备注', 'Note')} </span>{role.note}</p>}

        <div className="flex items-center justify-between">
          <span className={`text-xs ${isPopular ? 'text-[#E4CB94]' : 'text-gray-500'}`}>{count} {tx('人已試', '人已试', 'auditioned')}{isPopular && tx(' · 熱門', ' · 热门', ' · popular')}</span>
          <button onClick={() => setOpen((o) => !o)} className="text-sm rounded-xl px-4 py-2 transition"
            style={open ? { border: '1px solid rgba(201,168,106,.4)', color: '#E4CB94', background: 'transparent' } : { color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 600 }}>
            {open ? tx('收起', '收起', 'Close') : tx('試這個角色 →', '试这个角色 →', 'Audition →')}
          </button>
        </div>
        {isPopular && !open && <p className="text-[11px] text-[#E4CB94]/70">{tx('很多人試了,試別的中選機會更高', '很多人试了,试别的中选机会更高', 'Popular — try another for better odds')}</p>}

        {open && (
          <div className="space-y-2 border-t border-white/[0.08] pt-3">
            <label className="block">
              <span className="text-xs text-gray-400">{tx('上傳這個角色的試音(唸上面的樣詞)', '上传这个角色的试音(念上面的样词)', 'Upload your audition (read the line above)')}</span>
              <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }}
                className="block w-full text-xs text-gray-400 mt-1 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs" />
            </label>
            {uploading && <p className="text-xs text-gray-400">{tx('上傳中…', '上传中…', 'Uploading…')}</p>}
            {audioUrl && <audio controls src={audioUrl} className="w-full h-9" />}
            {(() => {
              const isClient = brief.source === 'client';
              const net = Number(gross) || 0;
              const clientPays = isClient ? Math.round((net / 0.8) * 100) / 100 : net;
              const fee = isClient ? Math.round((clientPays - net) * 100) / 100 : 0;
              const budgetN = Number(String(brief.budget || '').replace(/[^\d.]/g, '')) || 0;
              const over = isClient && budgetN > 0 && clientPays > budgetN;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">{tx('你的報價', '你的报价', 'Your quote')}</span>
                    <span className="bg-white/[0.07] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-gray-200 font-medium" title={tx('幣別依案件預算', '币别依案件预算', 'Currency set by the brief')}>{currency}</span>
                  </div>
                  <div className={`grid ${isClient ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                    <div className="bg-[#1d1b25] border border-[#C9A86A]/50 rounded-xl px-3 py-2">
                      <div className="text-[11px] text-[#E4CB94] mb-0.5">{tx('您的報酬', '您的报酬', 'You receive')}</div>
                      <div className="flex items-baseline gap-1"><span className="text-xs text-gray-500">{currency}</span>
                        <input type="number" min="0" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="0" className="w-full bg-transparent border-0 outline-none text-white text-lg font-semibold p-0" /></div>
                    </div>
                    {isClient && (
                      <div className="bg-[#1d1b25] border border-white/10 rounded-xl px-3 py-2">
                        <div className="text-[11px] text-gray-400 mb-0.5">{tx('平台費', '平台费', 'Platform fee')} 20%</div>
                        <div className="flex items-baseline gap-1"><span className="text-xs text-gray-500">{currency}</span>
                          <input type="number" min="0" value={fee || ''} onChange={(e) => { const f = Number(e.target.value) || 0; setGross(String(Math.round(f * 4 * 100) / 100)); }} placeholder="0" className="w-full bg-transparent border-0 outline-none text-white text-lg font-semibold p-0" /></div>
                      </div>
                    )}
                  </div>
                  {isClient ? (
                    <p className={`text-[11px] ${over ? 'text-[#f0997b]' : 'text-gray-400'}`}>{tx('客戶支付', '客户支付', 'Client pays')} {currency} {clientPays.toLocaleString()}{budgetN > 0 && (over ? ` · ${tx(`超過客戶預算 ${currency} ${budgetN}`, `超过客户预算 ${currency} ${budgetN}`, `over budget ${currency} ${budgetN}`)}` : ` · ${tx('在客戶預算內 ✓', '在客户预算内 ✓', 'within budget ✓')}`)}</p>
                  ) : <p className="text-[11px] text-[#6FCF97]">{tx('平台發案 · 報價即您實得', '平台发案 · 报价即您实得', 'Platform-posted — your quote is what you get')}</p>}
                </div>
              );
            })()}
            <TemplatedField kind="intro" multiline label={tx('自我介紹', '自我介绍', 'About you')} value={intro} onChange={setIntro}
              builtin={builtinIntro(myName, tx)} saved={templates.intro || []} token={token} onTemplates={onTemplates} tx={tx} />
            <TemplatedField kind="revision" optional label={tx('修改政策', '修改政策', 'Revisions')} value={revPolicy} onChange={setRevPolicy}
              builtin={builtinRev(tx)} saved={templates.revision || []} token={token} onTemplates={onTemplates} tx={tx} />
            {err && <p className="text-red-400 text-xs">{err}</p>}
            <button onClick={submit} disabled={busy || uploading} className="w-full disabled:opacity-50 rounded-xl px-4 py-2 text-sm"
              style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 700 }}>
              {busy ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出試音', '送出试音', 'Submit audition')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// General (single-voice) casting response: apply with an EXISTING platform demo
// or upload one, then quote a price. No per-role audition — used for ad/narration/
// IVR/audiobook etc. One response per call.
function GeneralResponse({
  brief, myDemos, done, token, tx, onQuoted, myName, templates, onTemplates,
}: {
  brief: Brief;
  myDemos: Demo[];
  done?: Quote;
  token: string;
  tx: (tw: string, cn: string, en: string) => string;
  onQuoted: (q: Quote) => void;
  myName: string;
  templates: Templates;
  onTemplates: (t: Templates) => void;
}) {
  const [src, setSrc] = useState<'demo' | 'upload'>(myDemos.length ? 'demo' : 'upload');
  const [pickedDemo, setPickedDemo] = useState(myDemos[0]?.url || '');
  const [audioUrl, setAudioUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gross, setGross] = useState('');
  const currency = dealCurrency(brief); // fixed by the client's posting budget — not picked by the talent
  const [intro, setIntro] = useState('');
  const [revPolicy, setRevPolicy] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sampleUrl = src === 'demo' ? pickedDemo : audioUrl;
  const grossN = Number(gross);

  async function uploadAudio(rawFile: File) {
    setErr(''); setUploading(true);
    try {
      const file = await toMp3(rawFile); // normalize to MP3 (falls back to original on failure)
      const u = await fetch('/api/talent/audition-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name }),
      });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(uj.error || tx('上傳準備失敗', '上传准备失败', 'Upload prep failed'));
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      setAudioUrl(uj.publicUrl);
    } catch (e) { setErr(e instanceof Error ? e.message : tx('上傳失敗', '上传失败', 'Upload failed')); } finally { setUploading(false); }
  }

  async function submit() {
    setErr('');
    if (!sampleUrl) return setErr(tx('請選一個 demo 或上傳一段', '请选一个 demo 或上传一段', 'Pick a demo or upload one'));
    if (!isFinite(grossN) || grossN <= 0) return setErr(tx('請填報價', '请填报价', 'Enter your price'));
    const grossAmount = brief.source === 'client' ? Math.round((grossN / 0.8) * 100) / 100 : grossN; // client: +20% on top
    const message = [intro.trim(), revPolicy.trim() && `${tx('修改政策', '修改政策', 'Revisions')}: ${revPolicy.trim()}`].filter(Boolean).join('\n\n');
    setBusy(true);
    const res = await fetch('/api/talent/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brief_id: brief.id, sample_url: sampleUrl, gross_amount: grossAmount, currency, intro, message, extra_revision_price: revPolicy.trim() || undefined }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', '送出失败', 'Submit failed'));
    onQuoted(j.quote);
  }

  if (done) {
    return (
      <div className="border-t border-white/10 pt-3 text-sm">
        <span className="text-green-300">{tx('已應徵', '已应征', 'Applied')}: {done.currency} {done.net_amount} {tx('(淨收入)', '(净收入)', '(net)')}</span>
        <span className="text-gray-500 ml-2">· {tx('狀態', '状态', 'Status')}: {done.status}</span>
        {done.sample_url && <audio controls src={done.sample_url} className="w-full h-9 mt-2" />}
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 pt-3 space-y-2">
      <p className="text-xs text-gray-500">{tx('用你的 demo 應徵(挑平台現有的,或上傳一段),再報價即可。', '用你的 demo 应征(挑平台现有的,或上传一段),再报价即可。', 'Apply with a demo — pick an existing one or upload — then quote.')}</p>
      {myDemos.length > 0 && (
        <div className="flex gap-2 text-xs">
          {([['demo', '挑現有 demo', '挑现有 demo', 'My demos'], ['upload', '上傳新 demo', '上传新 demo', 'Upload']] as const).map(([k, twl, cnl, enl]) => (
            <button key={k} type="button" onClick={() => setSrc(k)}
              className={`flex-1 rounded-lg px-2 py-1.5 border transition ${src === k ? 'bg-green-500/20 border-green-400/60 text-green-100' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>{tx(twl, cnl, enl)}</button>
          ))}
        </div>
      )}
      {src === 'demo' && myDemos.length > 0 && (
        <div className="space-y-1.5">
          <select className={inputCls} value={pickedDemo} onChange={(e) => setPickedDemo(e.target.value)}>
            {myDemos.map((d, i) => (<option key={i} value={d.url} className="bg-black">{[d.category, d.name, d.language].filter(Boolean).join(' · ') || `Demo ${i + 1}`}</option>))}
          </select>
          {pickedDemo && <audio controls src={pickedDemo} className="w-full h-9" />}
        </div>
      )}
      {src === 'upload' && (
        <>
          <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }}
            className="block w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs" />
          {uploading && <p className="text-xs text-gray-400">{tx('上傳中…', '上传中…', 'Uploading…')}</p>}
          {audioUrl && <audio controls src={audioUrl} className="w-full h-9" />}
        </>
      )}
      {/* 報價 — Voices 式:您的報酬 ↔ 平台費 連動;客戶支付比對客戶預算 */}
      {(() => {
        const isClient = brief.source === 'client';
        const net = Number(gross) || 0;
        const clientPays = isClient ? Math.round((net / 0.8) * 100) / 100 : net;
        const fee = isClient ? Math.round((clientPays - net) * 100) / 100 : 0;
        const budgetN = Number(String(brief.budget || '').replace(/[^\d.]/g, '')) || 0;
        const over = isClient && budgetN > 0 && clientPays > budgetN;
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-300">{tx('你的報價', '你的报价', 'Your quote')}</span>
              <span className="bg-white/[0.07] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-gray-200 font-medium" title={tx('幣別依案件預算', '币别依案件预算', 'Currency set by the brief')}>{currency}</span>
            </div>
            <div className={`grid ${isClient ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
              <div className="bg-[#1d1b25] border border-[#C9A86A]/50 rounded-xl px-3 py-2">
                <div className="text-[11px] text-[#E4CB94] mb-0.5">{tx('您的報酬', '您的报酬', 'You receive')}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-gray-500">{currency}</span>
                  <input type="number" min="0" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="0" className="w-full bg-transparent border-0 outline-none text-white text-lg font-semibold p-0" />
                </div>
              </div>
              {isClient && (
                <div className="bg-[#1d1b25] border border-white/10 rounded-xl px-3 py-2">
                  <div className="text-[11px] text-gray-400 mb-0.5">{tx('平台費', '平台费', 'Platform fee')} 20%</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-gray-500">{currency}</span>
                    <input type="number" min="0" value={fee || ''} onChange={(e) => { const f = Number(e.target.value) || 0; setGross(String(Math.round(f * 4 * 100) / 100)); }} placeholder="0" className="w-full bg-transparent border-0 outline-none text-white text-lg font-semibold p-0" />
                  </div>
                </div>
              )}
            </div>
            {isClient ? (
              <p className={`text-xs ${over ? 'text-[#f0997b]' : 'text-gray-400'}`}>
                {tx('客戶支付', '客户支付', 'Client pays')} {currency} {clientPays.toLocaleString()}
                {budgetN > 0 && (over
                  ? ` · ${tx(`超過客戶預算 ${currency} ${budgetN}`, `超过客户预算 ${currency} ${budgetN}`, `over budget ${currency} ${budgetN}`)}`
                  : ` · ${tx('在客戶預算內 ✓', '在客户预算内 ✓', 'within budget ✓')}`)}
              </p>
            ) : <p className="text-xs text-[#6FCF97]">{tx('平台發案 · 不收取平台費,報價即您實得', '平台发案 · 不收取平台费,报价即您实得', 'Platform-posted — no fee; your quote is what you get')}</p>}
          </div>
        );
      })()}

      <TemplatedField kind="intro" multiline label={tx('自我介紹', '自我介绍', 'About you')} value={intro} onChange={setIntro}
        builtin={builtinIntro(myName, tx)} saved={templates.intro || []} token={token} onTemplates={onTemplates} tx={tx} />
      <TemplatedField kind="revision" optional label={tx('修改政策', '修改政策', 'Revisions')} value={revPolicy} onChange={setRevPolicy}
        builtin={builtinRev(tx)} saved={templates.revision || []} token={token} onTemplates={onTemplates} tx={tx} />
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <button onClick={submit} disabled={busy || uploading} className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2 text-sm">
        {busy ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出應徵', '送出应征', 'Submit')}
      </button>
    </div>
  );
}
