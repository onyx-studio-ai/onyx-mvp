import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { decryptJson, payoutEncConfigured } from '@/lib/payout-crypto';
import { generatePayoutCertificateCode, deductionsForPayout } from '@/lib/payout-notify';
import { payoutPaidEmail } from '@/lib/mail-templates';
import { sendEmail, emailLocaleForTalent } from '@/lib/mail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';

/*
  後台請款單(admin-role only,敏感金流)。
   GET   → 列所有請款單(帶配音員名字/email),可 ?status= 過濾
   PATCH → { id, status: 'paid'|'rejected'|'pending', admin_note? } 更新;
           paid 時蓋 paid_at + 生成撥款證明碼 + 寄收款通知信給配音員(寄信失敗不影響撥款)
*/
export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;
  const db = getSupabaseServiceClient();
  const status = new URL(request.url).searchParams.get('status');
  let q = db.from('payout_requests')
    .select('id, talent_id, invoice_number, amount, currency, note, invoice_type, invoice_url, consent_at, status, admin_note, paid_at, certificate_code, created_at, talents(name, email)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 每張請款單附訂單明細(匯款對帳鏈:請款單號→訂單→案卡;Wing 2026-08-17)。
  // earnings 掛 payout_id;案名再從 voice_orders 補。查詢失敗不擋列表(明細顯示空)。
  const reqs = (data || []) as { id: string }[];
  const byPayout: Record<string, { order_number: string | null; order_type: string | null; commission_amount: number | null; project_name?: string | null }[]> = {};
  try {
    const ids = reqs.map((r) => r.id);
    if (ids.length) {
      const { data: es } = await db.from('talent_earnings')
        .select('payout_id, order_id, order_number, order_type, commission_amount')
        .in('payout_id', ids);
      const orderIds = [...new Set((es || []).map((e) => e.order_id).filter(Boolean))] as string[];
      const nameById = new Map<string, string>();
      for (let i = 0; i < orderIds.length; i += 100) {
        const { data: os } = await db.from('voice_orders').select('id, project_name, voice_selection').in('id', orderIds.slice(i, i + 100));
        for (const o of os || []) nameById.set(String(o.id), String(o.project_name || o.voice_selection || ''));
      }
      for (const e of es || []) {
        const k = String(e.payout_id);
        (byPayout[k] ||= []).push({
          order_number: e.order_number, order_type: e.order_type,
          commission_amount: e.commission_amount,
          project_name: e.order_id ? nameById.get(String(e.order_id)) || null : null,
        });
      }
    }
  } catch { /* 明細補不到就空著,列表照出 */ }
  return NextResponse.json({ requests: reqs.map((r) => ({ ...r, earnings: byPayout[r.id] || [] })) });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  let body: { id?: string; status?: string; admin_note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = String(body.id || '');
  const status = body.status;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (status && !['paid', 'rejected', 'pending', 'invoice_uploaded', 'completed'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const db = getSupabaseServiceClient();
  // 狀態機把關:先讀現況,已撥款(paid)的單子不可再變更,防重複撥款 / 重蓋 paid_at / 狀態亂跳。
  const { data: cur } = await db.from('payout_requests')
    .select('status, talent_id, invoice_number, amount, currency, certificate_code')
    .eq('id', id).maybeSingle();
  if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });
  // paid 之後只剩一條路:標「撥款已完成」(不寄信、純狀態);completed 為終態不可再動。
  if (cur.status === 'completed') return NextResponse.json({ error: '此請款單已完成,無法再變更。' }, { status: 400 });
  if (cur.status === 'paid' && status !== 'completed') return NextResponse.json({ error: '此請款單已撥款,只能標記「撥款完成」。' }, { status: 400 });

  const isPaying = status === 'paid';
  const paidAtIso = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: paidAtIso };
  // completed 保留原 paid_at(那是安排撥款的時間);其餘照舊
  if (status === 'completed') updates.status = 'completed';
  else if (status) { updates.status = status; updates.paid_at = isPaying ? paidAtIso : null; }
  if (typeof body.admin_note === 'string') updates.admin_note = body.admin_note.slice(0, 500);

  // 撥款時生成證明碼(idempotent:已有就沿用,不覆寫)。撥款單號 = 收款憑證 + 對帳鍵。
  const certificateCode = isPaying ? (cur.certificate_code || generatePayoutCertificateCode(cur.invoice_number)) : cur.certificate_code;
  if (isPaying && !cur.certificate_code) updates.certificate_code = certificateCode;

  const { error } = await db.from('payout_requests').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 🔒 同步回寫 earnings(2026-08-09:少了這步,已撥款的人仍顯示有餘額、名單全誤報):
  // 撥款 → 鏈結的 earnings 標 paid;退回(rejected)→ 解除鏈結還原 pending 讓配音員可再請。
  if (isPaying) {
    await db.from('talent_earnings')
      .update({ status: 'paid', talent_paid: true, talent_paid_at: paidAtIso, updated_at: paidAtIso })
      .eq('payout_id', id);
  } else if (status === 'rejected') {
    // 退回 → 解除鏈結(status 本來就還是 pending),配音員可重新請款
    await db.from('talent_earnings')
      .update({ payout_id: null, updated_at: paidAtIso })
      .eq('payout_id', id).neq('status', 'paid');
  }

  // ── 撥款完成 → 寄收款通知信給配音員 ──────────────────────────────
  // 交易優先於通知:撥款狀態已成功寫入,寄信在 try/catch 內,失敗只記 log + 回 warning,
  // 絕不讓通知信把撥款動作整個 fail 掉(老闆按了「已撥款」就一定算數)。
  let emailWarning: string | undefined;
  if (isPaying) {
    try {
      // 🚨 別 select 不存在的欄位:生產 talents 無 locale 欄,select 到會整查詢炸掉回 null,
      // 曾被誤報成「配音員無 email」(2026-08-07 布魯麵撥款)。語系用 languages 推即可。
      const { data: talent, error: talentErr } = await db.from('talents')
        .select('name, email, languages').eq('id', cur.talent_id).maybeSingle();
      if (talentErr) {
        emailWarning = `查配音員資料失敗(${talentErr.message}),通知信未寄。`;
      } else if (!talent?.email) {
        emailWarning = '配音員無 email,已跳過通知信。';
      } else {
        // 解密收款資料以推扣繳試算(生產環境 PAYOUT_ENC_KEY 在 Vercel)。解不到就以「無扣繳明細」寄出,信照發。
        let details: Record<string, unknown> | null = null;
        if (payoutEncConfigured()) {
          const { data: pd } = await db.from('talent_payout_details')
            .select('enc_payload').eq('talent_id', cur.talent_id).maybeSingle();
          if (pd?.enc_payload) {
            try { details = decryptJson(pd.enc_payload as string); } catch { /* 解密失敗→無扣繳明細,不擋信 */ }
          }
        }
        const locale = emailLocaleForTalent(null, talent.languages);
        const dd = deductionsForPayout(Number(cur.amount) || 0, cur.currency, details, locale);
        const { subject, html } = payoutPaidEmail({
          talentName: talent.name as string | undefined,
          certificateCode: certificateCode as string,
          invoiceNumber: cur.invoice_number,
          currency: cur.currency,
          gross: Number(cur.amount) || 0,
          tax: dd.tax, nhi: dd.nhi, fee: dd.fee, feeNote: dd.feeNote, net: dd.net,
          paidAt: paidAtIso,
          methodLabel: dd.methodLabel,
          dashboardLink: `${SITE_URL}/talent/earnings`,
          locale,
        });
        const res = await sendEmail({ category: 'BILLING', to: talent.email as string, subject, html });
        if (!res.success) emailWarning = `通知信寄送失敗:${res.error || '未知錯誤'}(撥款已完成,可稍後手動補發)。`;
      }
    } catch (e) {
      // 通知信任何例外都不影響撥款結果。
      emailWarning = `通知信處理發生例外:${e instanceof Error ? e.message : '未知錯誤'}(撥款已完成)。`;
      console.error('[payout-requests] paid notice failed:', e);
    }
  }

  return NextResponse.json({ ok: true, certificate_code: certificateCode || undefined, ...(emailWarning ? { warning: emailWarning } : {}) });
}
