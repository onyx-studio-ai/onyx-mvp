import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { castingApprovedTalentEmail } from '@/lib/mail-templates';
import { notifyTalentTelegram } from '@/lib/telegram';
import { notifyTalentExtra } from '@/lib/notify-extra';

/*
  「核准交付」的單一真相(2026-08-20 抽出)。

  在此之前,客戶按核准的邏輯只寫在 /api/client/orders/[id]/review 裡。現在多了一條
  「7 天沒回覆自動完成」的路徑,如果各寫一套,兩邊遲早分歧(其中一邊漏建收入、漏通知,
  就是配音員收不到錢或不知道結案)。所以兩條路徑一律走這支。

  順便治本:舊寫法只把「最後一筆」version 標成 approved —— 多支影片的案子(照護系列 12 支、
  A422 講解 7 支)會留下一堆永遠停在 pending_review 的交付檔,訂單卻已完成,資料對不上。
  改成把所有待審的交付檔一起標記,這才符合「整批核准」的實際語意。
*/

type Db = SupabaseClient;
const SITE = 'https://www.onyxstudios.ai';

export type ApproveResult = { ok: true; status: string; approvedFiles: number } | { ok: false; error: string };

export async function approveVoiceOrder(db: Db, orderId: string, opts: { by: 'client' | 'auto' }): Promise<ApproveResult> {
  const { data: order } = await db.from('voice_orders')
    .select('id, order_number, project_name, use_case, status, talent_id, talent_price, quote_id, brief_id, download_url')
    .eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'Order not found' };

  // 待審的交付檔一次全部標記(不是只標最後一筆)。被要求修改的版本維持原狀。
  const { data: pending } = await db.from('voice_order_versions')
    .select('id').eq('voice_order_id', orderId).eq('status', 'pending_review');
  const ids = (pending || []).map((v) => v.id as string);
  if (ids.length) await db.from('voice_order_versions').update({ status: 'approved' }).in('id', ids);

  // 真人案:配音員交的檔就是成品,核准即結案;Onyx 自製案還要團隊備成品檔。
  const isCasting = !!order.talent_id;
  const newStatus = isCasting ? 'completed' : 'awaiting_final';
  const upd: Record<string, unknown> = {
    status: newStatus,
    auto_approve_at: null,        // 已有結論 → 倒數失效
    updated_at: new Date().toISOString(),
  };
  if (isCasting && order.download_url) upd.download_url = order.download_url;
  const { error } = await db.from('voice_orders').update(upd).eq('id', orderId);
  if (error) return { ok: false, error: error.message };

  // 真人案結案 → 冪等補一筆 pending 收入(talent_price 已是扣佣後淨額,故 commission_rate=1)
  if (isCasting && order.talent_id) {
    const { data: existing } = await db.from('talent_earnings').select('id').eq('order_id', orderId).maybeSingle();
    const net = Number(order.talent_price) || 0;
    if (!existing && net > 0) {
      const { error: teErr } = await db.from('talent_earnings').insert({
        talent_id: order.talent_id, order_id: orderId, order_type: 'voice', order_number: order.order_number,
        tier: 'marketplace', order_total: net, commission_rate: 1, commission_amount: net, status: 'pending',
        quote_id: order.quote_id || null, brief_id: order.brief_id || null,
      });
      if (teErr) console.error('[approveVoiceOrder] earnings insert failed', order.order_number, teErr.message);
    }
  }

  // 通知配音員。自動完成時講清楚是「期限到自動結案」,不要讓他以為客戶親自驗收過。
  const title = (order.project_name as string) || (order.use_case as string) || (order.order_number as string) || '配音案件';
  if (order.talent_id) {
    const msg = opts.by === 'auto'
      ? `✅ 案件已結案:${title}(客戶於審核期限內未提出修改,系統自動完成)。感謝您的配音!`
      : `✅ 客戶已驗收結案:${title}。感謝您的配音!`;
    try {
      const { data: talent } = await db.from('talents').select('name, email').eq('id', order.talent_id).maybeSingle();
      if (talent?.email) {
        const m = castingApprovedTalentEmail({ talentName: talent.name as string, title, url: `${SITE}/talent/opportunities`, locale: 'zh-TW' });
        sendEmail({ category: 'PRODUCTION', to: talent.email as string, subject: m.subject, html: m.html }).catch(() => {});
      }
      notifyTalentTelegram(db, order.talent_id as string, msg);
      notifyTalentExtra(db, order.talent_id as string, msg);
    } catch (e) { console.error('[approveVoiceOrder] notify failed', order.order_number, e); }
  }

  return { ok: true, status: newStatus, approvedFiles: ids.length };
}
