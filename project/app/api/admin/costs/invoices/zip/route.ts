import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, storagePathFromRef } from '@/lib/supabase-server';

/*
  GET /api/admin/costs/invoices/zip?period=YYYY-MM
  把某月所有已上傳的發票打包成一個 zip 下載,交給會計。
  檔名 = 「工具名_原檔名」。與 casting 下載 zip 同一個 JSZip nodebuffer 模式。

  發票存在 (可能私有的) casting bucket,所以優先用 service client 直接 download,
  失敗才退回 fetch 公開網址。財務資料 → requireAdminOnly。
*/
export const maxDuration = 60;

const BUCKET = 'casting';
const PERIOD_RE = /^\d{4}-\d{2}$/;
const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60) || '_';
const extOf = (url: string) => { const m = url.split('?')[0].match(/\.([a-z0-9]{1,5})$/i); return m ? m[1].toLowerCase() : 'pdf'; };

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '';
  if (!PERIOD_RE.test(period)) return NextResponse.json({ error: '月份格式需為 YYYY-MM' }, { status: 400 });

  const db = getSupabaseServiceClient();
  // 同 GET:不走 PostgREST 內嵌 join(避免外鍵缺失時整支查詢報錯),改成先撈發票、
  // 再單獨撈工具名在程式端併起來當 zip 檔名。
  const { data: invoices, error } = await db
    .from('platform_cost_invoices')
    .select('invoice_url, file_name, cost_id')
    .eq('period', period)
    .order('uploaded_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoices || !invoices.length) return NextResponse.json({ error: `${period} 沒有已上傳的發票` }, { status: 404 });

  const costIds = [...new Set(invoices.map((i) => i.cost_id).filter(Boolean))];
  const nameById: Record<string, string> = {};
  if (costIds.length) {
    const { data: costs } = await db.from('platform_costs').select('id, name').in('id', costIds);
    for (const c of costs || []) nameById[c.id] = c.name;
  }

  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;
  for (const inv of invoices) {
    const url = String(inv.invoice_url);
    const tool = clean(String((inv.cost_id && nameById[inv.cost_id]) || '工具'));
    const original = String(inv.file_name || '');
    const ext = extOf(original || url);
    let name = `${tool}_${clean(original.replace(/\.[a-z0-9]+$/i, '') || '發票')}.${ext}`;
    for (let n = 2; used.has(name); n++) name = `${tool}_發票_${n}.${ext}`;
    used.add(name);

    // 先用 service client 直接下載(私有 bucket 也能拿),失敗再退回 fetch。
    let bytes: ArrayBuffer | null = null;
    try {
      const path = storagePathFromRef(url, BUCKET);
      if (path && !path.startsWith('http')) {
        const { data: blob } = await db.storage.from(BUCKET).download(path);
        if (blob) bytes = await blob.arrayBuffer();
      }
    } catch { /* fall through to fetch */ }
    if (!bytes) {
      try {
        const res = await fetch(url);
        if (res.ok) bytes = await res.arrayBuffer();
      } catch { /* skip */ }
    }
    if (bytes) { zip.file(name, bytes); added++; }
  }
  if (!added) return NextResponse.json({ error: '發票下載失敗,請稍後再試' }, { status: 502 });

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const zipName = `Onyx_營運發票_${period}.zip`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
    },
  });
}
