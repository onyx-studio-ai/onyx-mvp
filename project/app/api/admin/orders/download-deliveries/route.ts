import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  POST /api/admin/orders/download-deliveries { ids: string[] }
  勾選的語音訂單 → 每張單取「最新一版」配音員交付檔,打包成一個 zip。
  檔名 「單號_原檔名」;伺服器端抓檔(無 CORS 問題)。
  用途:Wing 批量下載後丟錄音室去噪。
*/
export const maxDuration = 300;   // 大 WAV 批量抓檔要時間

const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || '_';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let ids: string[] = [];
  try { ids = (await request.json())?.ids || []; } catch { /* 落到下面的檢查 */ }
  if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ error: '請先勾選訂單' }, { status: 400 });
  if (ids.length > 100) return NextResponse.json({ error: '一次最多 100 張單' }, { status: 400 });
  const db = getSupabaseServiceClient();

  const { data: orders } = await db.from('voice_orders').select('id, order_number').in('id', ids);
  const numById = new Map((orders || []).map((o) => [o.id, o.order_number]));

  const { data: versions } = await db.from('voice_order_versions')
    .select('voice_order_id, file_url, file_name, version_number')
    .in('voice_order_id', ids)
    .order('version_number', { ascending: true });

  // 每張單只留最新一版(照 version_number 升冪,後蓋前)
  const latest = new Map<string, { file_url: string; file_name: string }>();
  for (const v of versions || []) latest.set(v.voice_order_id, { file_url: v.file_url, file_name: v.file_name });
  if (!latest.size) return NextResponse.json({ error: '勾選的訂單裡還沒有任何交付檔' }, { status: 404 });

  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;
  const skipped: string[] = [];
  for (const [orderId, v] of latest) {
    const num = String(numById.get(orderId) || orderId.slice(0, 8));
    let name = `${clean(num)}_${clean(v.file_name)}`;
    for (let n = 2; used.has(name); n++) name = `${clean(num)}_${n}_${clean(v.file_name)}`;
    used.add(name);
    try {
      const res = await fetch(v.file_url);
      if (!res.ok) { skipped.push(num); continue; }
      zip.file(name, await res.arrayBuffer());
      added++;
    } catch { skipped.push(num); }
  }
  if (!added) return NextResponse.json({ error: '交付檔全部抓取失敗' }, { status: 502 });

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });   // 音檔已壓縮,STORE 最快
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="deliveries_${new Date().toISOString().slice(0, 10)}.zip"`,
      ...(skipped.length ? { 'X-Skipped-Orders': encodeURIComponent(skipped.join(',')) } : {}),
    },
  });
}
