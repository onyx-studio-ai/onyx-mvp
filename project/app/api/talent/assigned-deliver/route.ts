import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';

/*
  POST /api/talent/assigned-deliver { order_id, delivery_url, file_name } — deliver
  against a DIRECTLY-ASSIGNED production order (managed casting; no quote, no client
  payment gate). Verified as the talent's own assigned order. Adds a version + flags
  the order 'delivered' for Onyx to QC in the admin order workflow.
*/
export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string; name: string };

  // 一次可交整批檔:files=[{delivery_url,file_name}]。相容舊的單檔 {delivery_url,file_name}。
  // 整批只算「一次交付」——版本一次插完、只發一封 produce@ 通知(不會 7 個檔轟 7 封)。
  let body: { order_id?: string; delivery_url?: string; file_name?: string; files?: { delivery_url?: string; file_name?: string }[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const orderId = String(body.order_id || '');
  const rawFiles = Array.isArray(body.files) && body.files.length
    ? body.files
    : [{ delivery_url: body.delivery_url, file_name: body.file_name }];
  const files = rawFiles
    .map((f) => {
      const url = String(f.delivery_url || '').slice(0, 1000);
      const name = String(f.file_name || '').slice(0, 200) || (url.split('/').pop()?.split('?')[0] || 'delivery');
      return { url, name };
    })
    .filter((f) => /^https?:\/\//i.test(f.url));
  if (!orderId || !files.length) return NextResponse.json({ error: 'order_id and at least one valid delivery_url required' }, { status: 400 });

  const { data: order } = await r.db.from('voice_orders').select('id, status, talent_id, order_number, revision_fee, revision_fee_status').eq('id', orderId).eq('talent_id', talent.id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'not your assigned order' }, { status: 403 });
  if (order.status === 'completed') return NextResponse.json({ error: '已完成無法再上傳。' }, { status: 400 });
  // 有待同意的加收修改費 → 先同意才開放上傳(前端也鎖,這裡防直接打 API 繞過)
  if (order.revision_fee_status === 'pending' && (Number(order.revision_fee) || 0) > 0) {
    return NextResponse.json({ error: '本輪修改有加收費用,請先在單卡按「同意」後再上傳。' }, { status: 400 });
  }

  // version_number = 「這個檔案的第幾版」,不是「這張單的第幾筆上傳」。
  // 舊算法(既有筆數+i+1)讓一次交 13 支不同影片的案子變成 V1~V13,看起來像同一支
  // 改了 13 次,後台完全分不出「交了幾支」與「哪支補交過」(2026-08-19 Wing 指出)。
  const { data: prevVers } = await r.db.from('voice_order_versions').select('file_name').eq('voice_order_id', order.id);
  const seen = new Map<string, number>();
  for (const p of prevVers || []) seen.set(String(p.file_name), (seen.get(String(p.file_name)) || 0) + 1);
  const rows = files.map((f) => {
    const n = (seen.get(f.name) || 0) + 1;
    seen.set(f.name, n);
    return {
      voice_order_id: order.id, file_url: f.url, file_name: f.name, notes: '配音員交付(指派)',
      version_number: n, status: 'pending_review',
    };
  });
  const { error } = await r.db.from('voice_order_versions').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // download_url 指向這批最後一個檔(客戶端「最新版」用)
  await r.db.from('voice_orders').update({ download_url: files[files.length - 1].url, status: 'delivered', updated_at: new Date().toISOString() }).eq('id', order.id);

  // Onyx 靠後台側欄「訂單」徽章看到「已交付待驗收」(status=delivered),不寄自我 email
  // (管理案沒有外部客戶要通知;內部通知一律走平台徽章。Wing 2026-08-05)。
  return NextResponse.json({ ok: true, count: files.length });
}

/*
  DELETE { order_id, version_id } — 配音員刪掉自己傳錯/重複的交付檔。
  只准刪「自己的單」上「還沒驗收(pending_review)」的版本;已 approved 或單已
  completed 一律擋(2026-07-17 xinyu:重傳顧冶後刪不掉舊檔)。
  刪到一個不剩 → 單退回 in_production、download_url 清掉;否則指向剩餘最新版。
*/
export async function DELETE(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string };

  let body: { order_id?: string; version_id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const orderId = String(body.order_id || '');
  const versionId = String(body.version_id || '');
  if (!orderId || !versionId) return NextResponse.json({ error: 'order_id and version_id required' }, { status: 400 });

  const { data: order } = await r.db.from('voice_orders').select('id, status, talent_id').eq('id', orderId).eq('talent_id', talent.id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'not your assigned order' }, { status: 403 });
  if (order.status === 'completed') return NextResponse.json({ error: '此單已完成,不能再改動交付檔。' }, { status: 400 });

  const { data: ver } = await r.db.from('voice_order_versions').select('id, status').eq('id', versionId).eq('voice_order_id', orderId).maybeSingle();
  if (!ver) return NextResponse.json({ error: '找不到這個檔案' }, { status: 404 });
  if (ver.status === 'approved') return NextResponse.json({ error: '這個檔已通過驗收,如需更換請用訊息聯絡我們。' }, { status: 400 });

  const { error } = await r.db.from('voice_order_versions').delete().eq('id', versionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: rest } = await r.db.from('voice_order_versions').select('file_url').eq('voice_order_id', orderId).order('version_number', { ascending: false }).limit(1);
  const latest = rest?.[0]?.file_url || null;
  await r.db.from('voice_orders').update({
    download_url: latest,
    ...(latest ? {} : { status: 'in_production' }),   // 刪光 = 回到待交付
    updated_at: new Date().toISOString(),
  }).eq('id', orderId);
  return NextResponse.json({ ok: true });
}
