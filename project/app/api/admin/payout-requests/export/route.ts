import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { decryptJson, payoutEncConfigured } from '@/lib/payout-crypto';
import { deductionsForPayout } from '@/lib/payout-notify';

/*
  GET /api/admin/payout-requests/export?period=YYYY 或 YYYY-MM
  匯出該期間「已撥款(paid)」請款單的對帳 CSV 給會計。以撥款日(paid_at)分期。
  欄位:撥款證明碼、配音員、email、發票編號、幣別、請款日、撥款日、
        請款額、所得稅、二代健保、手續費、實付淨額、付款方式。
  ⚠️ 刻意「不」輸出銀行帳號 / PayPal / 身分證等明文收款個資 —— 會計對帳只需金額+單號;
     真要看明文,走 payouts 頁按需解密(/api/admin/payout-details)。
  授權:財務資料 → requireAdminOnly(admin role 才行,production role 擋掉)。

  稅/健保/手續費需解密配音員稅籍才能算(只取 tax profile,不輸出帳號)。
  若 PAYOUT_ENC_KEY 未配置或解密失敗 → 該筆稅欄留空,淨額退回請款額,不擋匯出。
*/
export const maxDuration = 60;

const PERIOD_RE = /^\d{4}(-\d{2})?$/; // YYYY 或 YYYY-MM

// RFC4180:含逗號/引號/換行要用雙引號包起來、內部引號雙寫。
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  const period = new URL(request.url).searchParams.get('period') || '';
  if (!PERIOD_RE.test(period)) return NextResponse.json({ error: '期間格式需為 YYYY 或 YYYY-MM' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: rows, error } = await db.from('payout_requests')
    .select('certificate_code, invoice_number, amount, currency, paid_at, created_at, talent_id, talents(name, email)')
    .eq('status', 'paid')
    .order('paid_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 以撥款日 paid_at 落在該期間(YYYY 或 YYYY-MM)過濾。
  const inPeriod = (rows || []).filter((r) => (r.paid_at ? String(r.paid_at).slice(0, period.length) === period : false));
  if (!inPeriod.length) return NextResponse.json({ error: `${period} 沒有已撥款的請款單` }, { status: 404 });

  // 逐筆解密稅籍(只算金額,絕不寫帳號)。快取同一配音員的稅籍避免重複解密。
  const encOn = payoutEncConfigured();
  const taxCache = new Map<string, Record<string, unknown> | null>();
  async function taxProfile(talentId: string): Promise<Record<string, unknown> | null> {
    if (!encOn) return null;
    if (taxCache.has(talentId)) return taxCache.get(talentId) as Record<string, unknown> | null;
    let details: Record<string, unknown> | null = null;
    try {
      const { data: pd } = await db.from('talent_payout_details').select('enc_payload').eq('talent_id', talentId).maybeSingle();
      if (pd?.enc_payload) details = decryptJson(pd.enc_payload as string);
    } catch { details = null; }
    taxCache.set(talentId, details);
    return details;
  }

  const header = ['撥款證明碼', '配音員', 'Email', '發票編號', '幣別', '請款日期', '撥款日期', '請款額', '所得稅', '二代健保', '手續費', '實付淨額', '付款方式'];
  const lines: string[] = [header.map(csvCell).join(',')];
  const d = (iso: unknown) => (iso ? String(iso).slice(0, 10) : '');

  for (const r of inPeriod) {
    const t = (r.talents || {}) as { name?: string | null; email?: string | null };
    const details = await taxProfile(String(r.talent_id));
    const dd = deductionsForPayout(Number(r.amount) || 0, r.currency, details);
    // 解不到稅籍(本機無金鑰)→ 稅/健保留空、淨額=請款額,手續費也算不準故留空,避免給會計錯數字。
    const known = encOn && details !== null;
    lines.push([
      r.certificate_code || '',
      t.name || '',
      t.email || '',
      r.invoice_number || '',
      r.currency || '',
      d(r.created_at),
      d(r.paid_at),
      Number(r.amount) || 0,
      known ? dd.tax : '',
      known ? dd.nhi : '',
      known ? dd.fee : '',
      known ? dd.net : '',
      known ? dd.methodLabel : '',
    ].map(csvCell).join(','));
  }

  // UTF-8 BOM → Excel 開中文不亂碼。
  const csv = '﻿' + lines.join('\r\n') + '\r\n';
  const fname = `Onyx_撥款對帳_${period}.csv`;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
    },
  });
}
