import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse, storagePathFromRef } from '@/lib/supabase-server';

/*
  GET /api/admin/costs/invoices/signed-url?u=<invoice_url 或 storage path>
  換一條短效簽名網址讓「看發票」一定打得開 —— 不管 casting bucket 是公開還是
  之後被鎖成私有(專案近期在做 RLS/儲存鎖定)。發票=財務資料 → requireAdminOnly。
  參考 app/api/admin/voice-id/signed-url/route.ts。
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
    return supabaseErrorResponse(err, 'admin/costs/invoices/signed-url');
  }
}
