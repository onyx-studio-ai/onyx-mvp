import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { storagePathFromRef } from '@/lib/supabase-server';

/*
  配音員請款發票檔(簽名發票 / 公司發票)—— 存「私有」invoices bucket 的 payout/ 前綴。
  發票含姓名/身分證字號/金額,屬個資+金流敏感檔,不走公開網址(Wing 2026-08-05,
  自 casting 公開桶搬來;歷史檔已搬移、DB 已改存 path)。
    POST { fileName } → 一次性簽名上傳網址 { path, token };前端 uploadToSignedUrl 後
      PATCH /api/talent/payout-request 把 path 存進 invoice_url。
    GET ?id=<payout_request id> → 本人請款單發票的短效簽名網址 { url }(5 分鐘)。
*/
const BUCKET = 'invoices';
const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string };

  let body: { fileName?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const ext = ((body.fileName || '').split('.').pop() || '').toLowerCase();
  if (!ext || !ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: '發票請上傳 PDF 或圖片(pdf / png / jpg)。' }, { status: 400 });
  }

  const path = `payout/${talent.id}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const { data, error } = await r.db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not prepare upload' }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token });
}

export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string };

  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // 只能看自己請款單上的發票(ownership 以請款單歸屬為準)。
  const { data: pr } = await r.db.from('payout_requests')
    .select('invoice_url').eq('id', id).eq('talent_id', talent.id).maybeSingle();
  if (!pr?.invoice_url) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const path = storagePathFromRef(String(pr.invoice_url), BUCKET);
  const { data, error } = await r.db.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message || 'Could not generate link' }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
