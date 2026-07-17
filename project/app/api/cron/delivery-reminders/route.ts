import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { notifyTalentTelegram } from '@/lib/telegram';
import { notifyTalentLine } from '@/lib/line';
import { zonedTimeToUtc, fmtInTz, tzLabel } from '@/lib/case-time';

/*
  交件自動催件(每小時跑,vercel.json cron)。
  規則:已發出(released)、有期限、還沒交任何版本的訂單,進入「截止前 24 小時」
  窗口時,自動提醒該配音員一次(每張單只提醒一次,delivery_reminder_at 防重)。
  管道:站內訊息(必發)+ email(真信箱才寄;@invite.onyxstudios.ai 占位信箱跳過)
  + Telegram(有綁才發)。
  沒填 deadline_time 的單,視為當天 18:00(案件時區)截止 —— 與「下班前」口徑一致。
*/

export const runtime = 'nodejs';
export const maxDuration = 60;

const SITE = 'https://www.onyxstudios.ai';
const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  // ── 授權(同 health-check:CRON_SECRET / x-vercel-cron / admin cookie)──
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  const viaCronSecret = !!cronSecret && auth === `Bearer ${cronSecret}`;
  const viaVercelCron = !cronSecret && !!request.headers.get('x-vercel-cron');
  if (!viaCronSecret && !viaVercelCron) {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;
  }

  const db = getSupabaseServiceClient();
  const now = Date.now();

  const { data: orders, error } = await db.from('voice_orders')
    .select('id, order_number, project_name, role_name, talent_id, brief_id, deadline, deadline_time, status')
    .not('released_at', 'is', null)
    .not('deadline', 'is', null)
    .not('talent_id', 'is', null)
    .is('delivery_reminder_at', null)
    .not('status', 'in', '(completed,cancelled,refunded)');
  if (error) {
    // migration(delivery_reminder_at 欄位)還沒跑之前先安靜待命,不讓 cron 報錯
    if (/delivery_reminder_at/.test(error.message)) return NextResponse.json({ ok: false, note: 'waiting for migration: delivery_reminder_at' });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!orders?.length) return NextResponse.json({ ok: true, reminded: 0 });

  // 已交過任何版本的單不催
  const { data: vers } = await db.from('voice_order_versions')
    .select('voice_order_id').in('voice_order_id', orders.map((o) => o.id));
  const delivered = new Set((vers || []).map((v) => v.voice_order_id));

  // 案件時區(brief 沒有就台北)
  const briefIds = [...new Set(orders.map((o) => o.brief_id).filter(Boolean))];
  const tzByBrief = new Map<string, string>();
  if (briefIds.length) {
    const { data: briefs } = await db.from('marketplace_briefs').select('id, timezone').in('id', briefIds);
    for (const b of briefs || []) tzByBrief.set(b.id, b.timezone || 'Asia/Taipei');
  }

  // 進入 24 小時窗口(未逾期)的單,依 brief+talent 分組 → 每人一則
  type Group = { talentId: string; briefId: string | null; project: string; roles: string[]; orderIds: string[]; deadlineText: string };
  const groups = new Map<string, Group>();
  for (const o of orders) {
    if (delivered.has(o.id)) continue;
    const tz = (o.brief_id && tzByBrief.get(o.brief_id)) || 'Asia/Taipei';
    const hasTime = !!o.deadline_time;
    const inst = zonedTimeToUtc(String(o.deadline).slice(0, 10), String(o.deadline_time || '18:00'), tz);
    if (!inst) continue;
    const diff = inst.getTime() - now;
    if (diff <= 0 || diff > WINDOW_MS) continue;
    const key = `${o.brief_id || 'direct'}:${o.talent_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        talentId: o.talent_id, briefId: o.brief_id, project: o.project_name || '您的案件',
        roles: [], orderIds: [], deadlineText: `${fmtInTz(inst, tz, hasTime)}(${tzLabel(tz)})`,
      });
    }
    const g = groups.get(key)!;
    g.roles.push(o.role_name || o.order_number);
    g.orderIds.push(o.id);
  }
  if (!groups.size) return NextResponse.json({ ok: true, reminded: 0 });

  const talentIds = [...new Set([...groups.values()].map((g) => g.talentId))];
  const { data: talents } = await db.from('talents').select('id, name, email').in('id', talentIds);
  const tMap = new Map((talents || []).map((t) => [t.id, t]));

  const results: string[] = [];
  for (const g of groups.values()) {
    const t = tMap.get(g.talentId);
    const name = t?.name || '配音員';
    const body = `【${g.project}】交件提醒:${name} 您好,以下 ${g.roles.length} 個角色即將於 ${g.deadlineText} 截止,目前尚未收到音檔:${g.roles.join('、')}。再麻煩您於截止前在後台各製作單上傳;若時間上有困難,請直接回覆這則訊息告知您最快可交件的時間。謝謝您!— Onyx Studios 製作部`;

    // 站內訊息(有 brief 才有訊息串)
    if (g.briefId) {
      await db.from('marketplace_messages').insert({
        brief_id: g.briefId, talent_id: g.talentId, sender_type: 'admin', sender_name: 'Onyx', body,
      });
    }
    // email(占位邀請信箱收不到,跳過)
    const email = t?.email || '';
    if (email && !email.endsWith('@invite.onyxstudios.ai')) {
      await sendEmail({
        category: 'PRODUCTION', to: email,
        subject: `【${g.project}】交件提醒 —— ${g.deadlineText} 截止`,
        html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.7;color:#222"><p>${name} 您好,</p><p>「<strong>${g.project}</strong>」以下 <strong>${g.roles.length}</strong> 個角色即將於 <strong>${g.deadlineText}</strong> 截止,目前尚未收到音檔:</p><p>${g.roles.join('、')}</p><p>再麻煩您於截止前至後台各製作單上傳音檔。若時間上有困難,請在後台傳訊息告知您最快可交件的時間。</p><p><a href="${SITE}/talent/opportunities">前往後台 →</a></p><p>Onyx Studios 製作部</p></div>`,
      });
    }
    // Telegram(有綁才發;helper 內部自己判斷)
    await notifyTalentTelegram(db, g.talentId, `⏰ 交件提醒(${g.project}):${g.roles.join('、')} 將於 ${g.deadlineText} 截止,尚未收到音檔。請盡快到後台上傳,來不及請在後台留言。${SITE}/talent/opportunities`);
    await notifyTalentLine(db, g.talentId, `⏰ 交件提醒(${g.project}):${g.roles.join('、')} 將於 ${g.deadlineText} 截止,尚未收到音檔。請盡快到後台上傳,來不及請在後台留言。${SITE}/talent/opportunities`);

    await db.from('voice_orders').update({ delivery_reminder_at: new Date().toISOString() }).in('id', g.orderIds);
    results.push(`${name}: ${g.roles.length} 單`);
  }

  return NextResponse.json({ ok: true, reminded: results.length, detail: results });
}
