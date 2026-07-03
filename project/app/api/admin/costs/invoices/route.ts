import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  月結發票:每個工具逐月上傳一張發票。

  上傳走專案現有的 signed-URL 模式(同 /api/talent/invoice-upload):
    1) 前端 POST { cost_id, period, fileName } → 回 { path, token, publicUrl }
       前端拿 supabase.storage.from('casting').uploadToSignedUrl(path, token, file) 上傳
    2) 上傳成功後前端再 POST { cost_id, period, invoice_url, file_name, record: true }
       在此把 invoice 記進 platform_cost_invoices。
  (兩步都走 POST,用 record 旗標區分,少開一支 route。)

  - GET    ?period=YYYY-MM 列出某月所有發票(join 工具名),不帶 period 則全部
  - POST   兩用:準備上傳網址 / 記一筆發票(見上)
  - DELETE ?id= 移除一筆發票紀錄

  費用發票=財務資料 → requireAdminOnly。
*/

const BUCKET = 'casting'; // 沿用專案發票上傳的同一個 bucket
const PREFIX = 'admin-cost-invoices';
const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
const PERIOD_RE = /^\d{4}-\d{2}$/;

function str(v: unknown, max = 500): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const db = getSupabaseServiceClient();
    let q = db
      .from('platform_cost_invoices')
      .select('*, platform_costs:cost_id(name)')
      .order('uploaded_at', { ascending: false });
    if (period && PERIOD_RE.test(period)) q = q.eq('period', period);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/costs/invoices GET');
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const costId = str(body.cost_id, 64);
    const period = str(body.period, 7);
    if (!costId) return NextResponse.json({ error: 'Missing cost_id' }, { status: 400 });
    if (!period || !PERIOD_RE.test(period)) return NextResponse.json({ error: '月份格式需為 YYYY-MM' }, { status: 400 });

    const db = getSupabaseServiceClient();

    // 第二步:記一筆發票
    if (body.record) {
      const invoiceUrl = str(body.invoice_url, 1000);
      if (!invoiceUrl) return NextResponse.json({ error: 'Missing invoice_url' }, { status: 400 });
      const { data, error } = await db
        .from('platform_cost_invoices')
        .insert([{ cost_id: costId, period, invoice_url: invoiceUrl, file_name: str(body.file_name, 300) }])
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // 第一步:準備 signed upload URL
    const ext = ((str(body.fileName, 200) || '').split('.').pop() || '').toLowerCase();
    if (!ext || !ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: '發票請上傳 PDF 或圖片(pdf / png / jpg)。' }, { status: 400 });
    }
    const path = `${PREFIX}/${costId}/${period}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message || 'Could not prepare upload' }, { status: 500 });
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    return NextResponse.json({
      path: data.path,
      token: data.token,
      publicUrl: `${base}/storage/v1/object/public/${BUCKET}/${data.path}`,
    });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/costs/invoices POST');
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const db = getSupabaseServiceClient();
    const { error } = await db.from('platform_cost_invoices').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/costs/invoices DELETE');
  }
}
