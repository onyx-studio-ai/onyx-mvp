import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { aiTwinVisible } from '@/lib/ai-twin';
import { createHash } from 'crypto';
import { CONTRACT_EN, CONTRACT_ZH, CONTRACT_VERSION } from '@/lib/ai-twin-contract';
import { sendEmail } from '@/lib/mail';
import { plainNoticeEmail } from '@/lib/mail-templates';

/*
  AI 聲音分身計畫 — 配音員端(Phase 2,內測閘門見 lib/ai-twin)。
  GET  → 我的報名狀態(含語料清單)
  POST → 簽署+意願送出 { scopes: { ads, cross_lingual, proofreader, proof_langs[] }, signature_name }
  PUT  → 登記一段語料 { tone, url, file_name } (檔案先走 /api/talent/ai-twin/upload 拿 signed URL)
*/
export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name, email');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!aiTwinVisible(String(r.talent.email || ''))) return NextResponse.json({ error: 'not_available' }, { status: 404 });
  const { data } = await r.db.from('ai_twin_enrollments').select('*').eq('talent_id', r.talent.id).maybeSingle();
  return NextResponse.json({ enrollment: data || null });
}

export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name, email');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!aiTwinVisible(String(r.talent.email || ''))) return NextResponse.json({ error: 'not_available' }, { status: 404 });
  let b: { scopes?: { ads?: boolean; cross_lingual?: boolean; proofreader?: boolean; proof_langs?: string[] }; signature_name?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const sig = String(b.signature_name || '').trim();
  if (!sig) return NextResponse.json({ error: '請輸入姓名作為簽署' }, { status: 400 });
  const scopes = {
    standard: true,
    ads: !!b.scopes?.ads,
    cross_lingual: !!b.scopes?.cross_lingual,
    proofreader: !!b.scopes?.proofreader,
    proof_langs: Array.isArray(b.scopes?.proof_langs) ? b.scopes!.proof_langs!.slice(0, 10).map(String) : [],
  };
  // 簽署證據鏈:IP/UA/合約版本/全文雜湊(可歸屬性+完整性;欄位未 migration 前自動略過)
  const contractHash = createHash('sha256').update(CONTRACT_EN + CONTRACT_VERSION).digest('hex');
  const signatureMeta = {
    version: CONTRACT_VERSION,
    contract_sha256: contractHash,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    user_agent: (request.headers.get('user-agent') || '').slice(0, 250),
    signed_at: new Date().toISOString(),
  };
  const { data: existing } = await r.db.from('ai_twin_enrollments').select('id, status').eq('talent_id', r.talent.id).maybeSingle();
  if (existing) {
    let { error } = await r.db.from('ai_twin_enrollments')
      .update({ scopes, signature_name: sig, signed_at: new Date().toISOString(), status: 'submitted', updated_at: new Date().toISOString(), signature_meta: signatureMeta })
      .eq('id', existing.id);
    if (error && /signature_meta/.test(error.message)) {
      ({ error } = await r.db.from('ai_twin_enrollments')
        .update({ scopes, signature_name: sig, signed_at: new Date().toISOString(), status: 'submitted', updated_at: new Date().toISOString() })
        .eq('id', existing.id));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    let { error } = await r.db.from('ai_twin_enrollments')
      .insert({ talent_id: r.talent.id, scopes, signature_name: sig, signed_at: new Date().toISOString(), status: 'submitted', signature_meta: signatureMeta });
    if (error && /signature_meta/.test(error.message)) {
      ({ error } = await r.db.from('ai_twin_enrollments')
        .insert({ talent_id: r.talent.id, scopes, signature_name: sig, signed_at: new Date().toISOString(), status: 'submitted' }));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // 合約副本信(法律留痕:簽了什麼、何時、指紋)
  try {
    const email = String(r.talent.email || '');
    if (email && !email.endsWith('@invite.onyxstudios.ai')) {
      const note = plainNoticeEmail({
        subject: `您的 AI 聲音授權合約副本(${CONTRACT_VERSION})`,
        headline: '合約簽署完成', sub: 'AI 聲音分身計畫', cardTitle: '簽署紀錄',
        paragraphs: [
          `${sig} 您好,您已完成 AI 聲音授權合約之電子簽署。`,
          `版本:${CONTRACT_VERSION} · 簽署時間:${new Date().toISOString()} · 文件指紋:${contractHash.slice(0, 16)}…`,
          '以下為合約中文對照全文(英文正本可隨時於後台查看):',
        ],
        quote: CONTRACT_ZH.slice(0, 5000),
        ctaText: '前往後台', ctaUrl: 'https://www.onyxstudios.ai/zh-TW/talent/ai-twin',
      });
      sendEmail({ category: 'HELLO', to: email, subject: note.subject, html: note.html }).catch(() => {});
    }
  } catch { /* 副本信 best-effort */ }
  return NextResponse.json({ ok: true });
}

export async function PUT(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, email');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!aiTwinVisible(String(r.talent.email || ''))) return NextResponse.json({ error: 'not_available' }, { status: 404 });
  let b: { tone?: string; url?: string; file_name?: string; remove?: boolean };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const tone = String(b.tone || '').slice(0, 40);
  if (!tone) return NextResponse.json({ error: 'tone required' }, { status: 400 });
  const { data: en } = await r.db.from('ai_twin_enrollments').select('id, samples').eq('talent_id', r.talent.id).maybeSingle();
  if (!en) return NextResponse.json({ error: '請先完成簽署' }, { status: 400 });
  let samples = (Array.isArray(en.samples) ? en.samples : []) as { tone: string; url: string; file_name?: string }[];
  samples = samples.filter((s) => s.tone !== tone);
  if (!b.remove) {
    const url = String(b.url || '');
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
    samples.push({ tone, url, file_name: String(b.file_name || '').slice(0, 120) });
  }
  const { error } = await r.db.from('ai_twin_enrollments').update({ samples, updated_at: new Date().toISOString() }).eq('id', en.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, samples });
}
