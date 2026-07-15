import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { notifyTalentTelegram } from '@/lib/telegram';

/*
  POST /api/admin/casting/release — 正式「發出」指派單給配音員。

  Wing 2026-07-15:指派≠通知。之前指派當下就寄信+Telegram,配音員搶在定稿匯入前
  就錄了。現在 assign 只建單(released_at=null,配音員端看不到、不通知);等 Wing 在
  製作管理把台詞/參考音/價格都確認好,按「發出通知」才:
    1. set released_at=now → 單子出現在配音員後台
    2. 同一配音員多角色併一封信 + Telegram 一則

  body: { brief_id: string, order_ids?: string[] }   // 不給 order_ids = 該案全部未發出的單
*/
const SITE = 'https://www.onyxstudios.ai';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: { brief_id?: string; order_ids?: string[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const briefId = String(body.brief_id || '');
  if (!briefId) return NextResponse.json({ error: 'missing brief_id' }, { status: 400 });
  const onlyIds = Array.isArray(body.order_ids) ? body.order_ids.map(String).filter(Boolean) : null;

  const db = getSupabaseServiceClient();
  const { data: brief } = await db.from('marketplace_briefs').select('id, title, content_type').eq('id', briefId).maybeSingle();
  if (!brief) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  let q = db.from('voice_orders')
    .select('id, role_name, talent_id, deadline')
    .eq('brief_id', briefId).is('released_at', null).not('talent_id', 'is', null);
  if (onlyIds?.length) q = q.in('id', onlyIds);
  const { data: pending, error: qErr } = await q;
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  if (!pending?.length) return NextResponse.json({ ok: true, released: 0, notified: 0 });

  const ids = pending.map((o) => String(o.id));
  const { error: uErr } = await db.from('voice_orders').update({ released_at: new Date().toISOString() }).in('id', ids);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  // 同一配音員多角色 → 併一封通知
  const byTalent = new Map<string, { roles: string[] }>();
  for (const o of pending) {
    const slot = byTalent.get(String(o.talent_id)) || { roles: [] };
    slot.roles.push(String(o.role_name || '角色'));
    byTalent.set(String(o.talent_id), slot);
  }
  const title = (brief.title as string) || (brief.content_type as string) || '配音案件';
  let notified = 0;
  const tIds = [...byTalent.keys()];
  const { data: ts } = await db.from('talents').select('id, email, name').in('id', tIds);
  const emailById = new Map((ts || []).map((t) => [String(t.id), String(t.email || '')]));
  for (const [tid, { roles }] of byTalent) {
    const email = emailById.get(tid) || '';
    const roleList = roles.join('、');
    // 佔位帳號(LINE 邀請沒真信箱)不寄 email,只發 Telegram(有綁才會到)
    if (email && !email.endsWith('@invite.onyxstudios.ai')) {
      sendEmail({
        category: 'PRODUCTION', to: email,
        subject: `台詞已就緒,可以開錄了 — ${title}(${roles.length} 個角色)`,
        html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.7;color:#222"><p>您好,</p><p>「<strong>${title}</strong>」指派給您的 <strong>${roles.length}</strong> 個角色(${roleList})台詞與參考資料已備妥,請登入後台在「製作中」查看稿件並錄製上傳。</p><p>若時程上無法配合完成日,請直接在後台傳訊息告訴我們可提供的時間。</p><p><a href="${SITE}/talent/opportunities">前往後台 →</a></p></div>`,
      }).catch(() => {});
      notified += 1;
    }
    notifyTalentTelegram(db, tid, `🎬 台詞已就緒,可以開錄了(${title})。您的角色:${roleList}。請到後台「製作中」查看稿件並錄製上傳。${SITE}/talent/opportunities`);
  }
  return NextResponse.json({ ok: true, released: ids.length, notified, talents: byTalent.size });
}
