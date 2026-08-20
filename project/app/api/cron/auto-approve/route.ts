import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { approveVoiceOrder } from '@/lib/approve-order';
import { AUTO_APPROVE_REMIND_DAYS_BEFORE, formatAutoApproveDate } from '@/lib/auto-approve';
import { isPlatformCase } from '@/lib/casting';
import { sendEmail } from '@/lib/mail';
import { plainNoticeEmail } from '@/lib/mail-templates';

/*
  GET /api/cron/auto-approve — 每天跑一次(Vercel cron)。

  兩件事:
  ① 到期前 2 天:寄提醒信給客戶(「再 2 天就會自動完成,要延期請按這裡」)。
     有這封信,自動完成才站得住腳 —— 客戶不能說「我完全不知道」。
  ② 已到期:走 approveVoiceOrder(和客戶手動按核准完全同一條路),標記交付檔、
     結案、建配音員收入、通知配音員。

  安全閘(這支會自己改單、自己撥收入,所以防護寫厚一點):
  ・只處理 status = 'delivered' 且 auto_approve_at 有值的單
  ・平台自營案一律跳過(它們本來就不該有 auto_approve_at,這裡雙重保險)
  ・?dry=1 只回報不動作,方便先看會影響哪些單
  授權:Vercel cron 自帶 Authorization: Bearer CRON_SECRET(不是傳說中的 x-vercel-cron header)。
*/
export const maxDuration = 60;

const SITE = 'https://www.onyxstudios.ai';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get('dry') === '1';
  const db = getSupabaseServiceClient();
  const now = Date.now();

  const { data: orders, error } = await db.from('voice_orders')
    .select('id, order_number, project_name, use_case, email, status, auto_approve_at, approve_extend_count, locale')
    .eq('status', 'delivered')
    .not('auto_approve_at', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due: string[] = [];
  const reminded: string[] = [];
  const skipped: string[] = [];

  for (const o of orders || []) {
    // 平台自營案不自動完成(帳務聯絡人是我們自己,自動結案沒有意義也沒人看信)
    if (isPlatformCase(o.email as string)) { skipped.push(`${o.order_number}(平台自營案)`); continue; }
    const at = new Date(o.auto_approve_at as string).getTime();
    if (Number.isNaN(at)) { skipped.push(`${o.order_number}(日期無效)`); continue; }
    const msLeft = at - now;
    const title = (o.project_name as string) || (o.use_case as string) || (o.order_number as string) || '配音案件';

    if (msLeft <= 0) {
      // ── 到期:自動完成 ──
      if (dry) { due.push(`${o.order_number}(將自動完成)`); continue; }
      const r = await approveVoiceOrder(db, o.id as string, { by: 'auto' });
      if (r.ok) {
        due.push(`${o.order_number}(已完成,標記 ${r.approvedFiles} 個交付檔)`);
        // 告知客戶已自動完成,並保留申訴管道
        if (o.email) {
          const m = plainNoticeEmail({
            subject: `訂單已自動完成 — ${o.order_number}`,
            headline: '訂單已自動完成',
            sub: '審核期限屆滿',
            cardTitle: String(o.order_number),
            paragraphs: [
              `您的訂單「${title}」已於審核期限屆滿後自動完成,所有交付檔案皆可在後台下載。`,
              '若對交付內容仍有疑問,請直接回覆本信與我們聯繫,我們會協助處理。',
            ],
            ctaText: '登入後台',
            ctaUrl: `${SITE}/dashboard`,
          });
          sendEmail({ category: 'PRODUCTION', to: o.email as string, subject: m.subject, html: m.html }).catch(() => {});
        }
      } else {
        skipped.push(`${o.order_number}(自動完成失敗:${r.error})`);
      }
      continue;
    }

    // ── 到期前 2 天:提醒 ──
    const daysLeft = Math.ceil(msLeft / 86400_000);
    if (daysLeft === AUTO_APPROVE_REMIND_DAYS_BEFORE && o.email) {
      if (dry) { reminded.push(`${o.order_number}(將寄提醒)`); continue; }
      const m = plainNoticeEmail({
        subject: `審核期限即將屆滿 — ${o.order_number}`,
        headline: '審核期限即將屆滿',
        sub: `${AUTO_APPROVE_REMIND_DAYS_BEFORE} 天後將自動完成`,
        cardTitle: String(o.order_number),
        paragraphs: [
          `您的訂單「${title}」的交付檔案仍待您確認。`,
          `依交付通知所載,若於 ${formatAutoApproveDate(o.auto_approve_at as string)} 前未收到您的回覆,系統將自動完成本訂單。`,
          '若您需要更多時間審核,可於訂單頁面自行延長 7 天,不限次數;若已確認無誤,亦可直接於訂單頁核准。',
        ],
        ctaText: '前往訂單頁',
        ctaUrl: `${SITE}/dashboard`,
      });
      const r = await sendEmail({ category: 'PRODUCTION', to: o.email as string, subject: m.subject, html: m.html });
      reminded.push(`${o.order_number}${r ? '' : '(寄送失敗)'}`);
    }
  }

  return NextResponse.json({
    ok: true, dry, checked: (orders || []).length,
    autoCompleted: due, remindersSent: reminded, skipped,
    at: new Date().toISOString(),
  });
}
