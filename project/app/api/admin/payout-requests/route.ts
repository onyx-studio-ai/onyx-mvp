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
  return NextResponse.json({ requests: data || [] });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  let body: { id?: string; status?: string; admin_note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = String(body.id || '');
  const status = body.status;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (status && !['paid', 'rejected', 'pending', 'invoice_uploaded'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const db = getSupabaseServiceClient();
  // 狀態機把關:先讀現況,已撥款(paid)的單子不可再變更,防重複撥款 / 重蓋 paid_at / 狀態亂跳。
  const { data: cur } = await db.from('payout_requests')
    .select('status, talent_id, invoice_number, amount, currency, certificate_code')
    .eq('id', id).maybeSingle();
  if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (cur.status === 'paid') return NextResponse.json({ error: '此請款單已撥款,無法再變更。' }, { status: 400 });

  const isPaying = status === 'paid';
  const paidAtIso = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: paidAtIso };
  if (status) { updates.status = status; updates.paid_at = isPaying ? paidAtIso : null; }
  if (typeof body.admin_note === 'string') updates.admin_note = body.admin_note.slice(0, 500);

  // 撥款時生成證明碼(idempotent:已有就沿用,不覆寫)。撥款單號 = 收款憑證 + 對帳鍵。
  const certificateCode = isPaying ? (cur.certificate_code || generatePayoutCertificateCode(cur.invoice_number)) : cur.certificate_code;
  if (isPaying && !cur.certificate_code) updates.certificate_code = certificateCode;

  const { error } = await db.from('payout_requests').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── 撥款完成 → 寄收款通知信給配音員 ──────────────────────────────
  // 交易優先於通知:撥款狀態已成功寫入,寄信在 try/catch 內,失敗只記 log + 回 warning,
  // 絕不讓通知信把撥款動作整個 fail 掉(老闆按了「已撥款」就一定算數)。
  let emailWarning: string | undefined;
  if (isPaying) {
    try {
      const { data: talent } = await db.from('talents')
        .select('name, email, locale, languages').eq('id', cur.talent_id).maybeSingle();
      if (!talent?.email) {
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
        const locale = emailLocaleForTalent(talent.locale as string | null, talent.languages);
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
