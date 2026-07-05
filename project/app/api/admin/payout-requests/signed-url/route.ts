import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse, storagePathFromRef } from '@/lib/supabase-server';

/*
  GET /api/admin/payout-requests/signed-url?u=<invoice_url 或 storage path>
  換一條短效簽名網址讓後台「看發票」一定打得開 —— 撥款發票是配音員上傳的簽名發票
  (含真實姓名/公司),屬金流敏感檔,不該用永久公開連結。發票檔存 casting bucket 的
  invoices/ 前綴。requireAdminOnly(僅 admin,production 角色不可看金流)。
  鏡像 app/api/admin/costs/invoices/signed-url/route.ts(同一個 casting bucket)。
*/
const BUCKET = 'casting';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  const raw = new URL(request.url).searchParams.get('u');
  if (!raw) return NextResponse.json({ error: 'Missing file reference' }, { status: 400 });

  const path = storagePathFromRef(raw, BUCKET);
  if (!path || path.startsWith('http')) {
    return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 });
  }

  try {
    const db = getSupabaseServiceClient();
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 300); // 5 分鐘
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || 'Could not generate link' }, { status: 500 });
    }
    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/payout-requests/signed-url');
  }
}
