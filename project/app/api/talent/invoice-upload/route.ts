import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';

/*
  POST /api/talent/invoice-upload { fileName } — 配音員上傳「簽名後的發票」或「自家
  公司發票」用的一次性簽名上傳網址。存到 casting bucket 的 invoices/ 前綴。
  回 { path, token, publicUrl };前端 uploadToSignedUrl 後,PATCH /api/talent/payout-request
  把 invoice_url 掛到該請款單。
*/
const BUCKET = 'casting';
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

  const path = `invoices/${talent.id}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const { data, error } = await r.db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not prepare upload' }, { status: 500 });
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  return NextResponse.json({ path: data.path, token: data.token, publicUrl: `${base}/storage/v1/object/public/${BUCKET}/${data.path}` });
}
