import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { prospectInviteEmail } from '@/lib/mail-templates';
import { briefMatchesTalentLangs } from '@/lib/languages';

/*
  邀請潛在名單(prospects)。兩種來源:
   1. 指定名單(名單頁勾選)→ body.prospect_ids[](Wing 挑好的人),不做語言配對。
   2. 按案件語言自動配對(案卡按鈕)→ 不給 prospect_ids 時,配對 active 配音員 prospect。
  兩者都自動排除:已入駐(joined)/黑名單(suppressed)/本案冷卻期內已邀(prospect_invites)。
  send:false 只回預覽(人數+名單);send:true 才寄。信件依收件人語言(繁/簡/英)出稿。
  GET → 回開放中的試音案清單,給名單頁的「選案件」下拉用。
*/
const SITE = 'https://www.onyxstudios.ai';
const COOLDOWN_DEFAULT = 7;

// 依 prospect 的語言挑信件語言:非中文→英文;大陸方言/普通話→簡體;其餘中文→繁中。
function pickLang(languages: string[]): 'zh-TW' | 'zh-CN' | 'en' {
  const j = (languages || []).join(' ').toLowerCase();
  const anyChinese = /mandarin|cantonese|chinese|taiwanese|hokkien|shanghai|wu|中文|粵|粤|閩|闽|台|上海|吳|吴/.test(j);
  if (!anyChinese) return 'en';
  if (/mainland|大陸|大陆|简|shanghainese|minnan|guangdong|廣州|广州/.test(j)) return 'zh-CN';
  return 'zh-TW';
}

export async function GET(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;
  const db = getSupabaseServiceClient();
  // 開放中的案子(可邀去試音);casting + 一般 brief 都列,方便選。
  const { data } = await db.from('marketplace_briefs')
    .select('id, title, content_type, language, kind, status, audition_deadline')
    .eq('status', 'open').order('created_at', { ascending: false }).limit(100);
  const briefs = (data || []).map((b) => ({
    id: b.id, title: b.title || b.content_type || '(未命名案件)', language: b.language || '', kind: b.kind,
  }));
  return NextResponse.json({ briefs });
}

export async function POST(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const briefId = String(b.brief_id || '');
  const send = b.send === true;
  const cooldownDays = Math.max(0, Number(b.cooldown_days) || COOLDOWN_DEFAULT);
  const ids = Array.isArray(b.prospect_ids) ? b.prospect_ids.map(String).filter(Boolean) : null;
  if (!briefId) return NextResponse.json({ error: 'missing brief_id' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: brief } = await db.from('marketplace_briefs')
    .select('id,title,content_type,language,kind,status,audition_deadline,audition_deadline_time,timezone,ai_type')
    .eq('id', briefId).maybeSingle();
  if (!brief) return NextResponse.json({ error: 'brief not found' }, { status: 404 });
  if (send && brief.status !== 'open') return NextResponse.json({ error: '案件未發佈(open),無法邀請' }, { status: 400 });

  // 取候選 prospect:指定名單模式用 id;自動模式用語言配對 active 配音員。
  type P = { id: string; email: string; name: string | null; company: string | null; languages: string[]; unsub_token: string; status: string };
  let pool: P[];
  if (ids && ids.length) {
    // 🚨 分批查:一次 .in() 幾百個 UUID 會讓 URL 過長 → Bad Request(同 2026-08-12 被邀次數歸零 bug)。
    const rows: P[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await db.from('prospects')
        .select('id,email,name,company,languages,unsub_token,status').in('id', ids.slice(i, i + 100));
      if (error) return NextResponse.json({ error: `名單查詢失敗:${error.message}` }, { status: 500 });
      rows.push(...((data || []) as P[]));
    }
    // 硬規則:黑名單/已入駐一律不寄(即使被勾選)。
    pool = rows.filter((p) => p.status === 'active');
  } else {
    const { data } = await db.from('prospects')
      .select('id,email,name,company,languages,unsub_token,status').eq('kind', 'talent').eq('status', 'active');
    pool = ((data || []) as P[]).filter((p) =>
      briefMatchesTalentLangs(String(brief.language || ''), Array.isArray(p.languages) ? p.languages : []));
  }

  // 冷卻:本案冷卻窗內已邀過的排除(避免重複轟炸)。
  const sinceIso = new Date(Date.now() - cooldownDays * 86400_000).toISOString();
  const { data: recent } = await db.from('prospect_invites')
    .select('prospect_id').eq('brief_id', briefId).gte('sent_at', sinceIso);
  const recentSet = new Set((recent || []).map((r) => r.prospect_id));
  const eligible = pool.filter((p) => !recentSet.has(p.id));

  const deadline = brief.audition_deadline
    ? `${brief.audition_deadline}${brief.audition_deadline_time ? ' ' + brief.audition_deadline_time : ''}` : '';
  const joinLink = `${SITE}/casting/join/${briefId}`;
  const title = String(brief.title || brief.content_type || '');
  const buildMail = (p: P) => prospectInviteEmail({
    briefTitle: title,
    language: brief.language ? String(brief.language) : undefined,
    joinLink, unsubLink: `${SITE}/api/prospects/unsubscribe?token=${p.unsub_token}`, deadline,
    lang: pickLang(p.languages || []),
    name: p.name || undefined, company: p.company || undefined,
    aiType: (brief as { ai_type?: 'clone' | 'training' | null }).ai_type || null,
  });

  if (!send) {
    // 預覽:附上「實際會寄出的信」—— 收件人語言各給一封範例(用該語言第一個人渲染),你看過再送。
    const byLang = new Map<string, P>();
    for (const p of eligible) { const l = pickLang(p.languages || []); if (!byLang.has(l)) byLang.set(l, p); }
    const emails = [...byLang.entries()].map(([lang, p]) => {
      const m = buildMail(p);
      return { lang, forName: p.name || p.email, subject: m.subject, html: m.html };
    });
    return NextResponse.json({
      ok: true, sent: false,
      selected: ids ? ids.length : undefined,
      matched: pool.length,
      cooldown_excluded: pool.length - eligible.length,
      eligible: eligible.length,
      sample: eligible.slice(0, 30).map((p) => ({ name: p.name, email: p.email, lang: pickLang(p.languages || []) })),
      emails,
    });
  }

  let sent = 0;
  for (const p of eligible) {
    const unsubLink = `${SITE}/api/prospects/unsubscribe?token=${p.unsub_token}`;
    const mail = prospectInviteEmail({
      briefTitle: title,
      language: brief.language ? String(brief.language) : undefined,
      joinLink, unsubLink, deadline,
      lang: pickLang(p.languages || []),
      name: p.name || undefined,
      company: p.company || undefined,
      aiType: (brief as { ai_type?: 'clone' | 'training' | null }).ai_type || null,
    });
    const r = await sendEmail({ category: 'HELLO', to: p.email, subject: mail.subject, html: mail.html, bcc: 'onyxstudios.ai@gmail.com' })
      .catch(() => ({ success: false } as { success: boolean }));
    if (r.success) {
      await db.from('prospect_invites').insert({ prospect_id: p.id, brief_id: briefId, brief_title: title, channel: 'resend' });
      await db.from('prospects').update({ last_invited_at: new Date().toISOString() }).eq('id', p.id);
      sent++;
    }
  }
  return NextResponse.json({ ok: true, sent: true, count: sent });
}
