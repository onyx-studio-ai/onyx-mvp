import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import * as OpenCC from 'opencc-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { extractXlsxImages } from '@/lib/xlsx-images';

/*
  POST /api/admin/casting/import-lines?brief_id=… — 匯入「客戶台詞表 xlsx」到製作單。

  遊戲量產案(如女王百貨)的台詞表格式:每個角色一個分頁(+「其他角色」大雜燴頁),
  每列一句台詞,欄位含 角色名/聲音年齡段/性格特點/臺詞功能/語速/角色介紹/畫面解讀/
  臺詞核心情緒/原版臺詞/TW(繁中台詞)。【分配】等總表分頁略過。

  行為:解析全部台詞 → 按角色分組 → 組成帶錄製指引的製作稿 → 寫進該案(brief_id)
  同名角色的 voice_orders.script_text。角色名比對:兩邊都簡轉繁+去空白;對不到的
  角色回報 unmatched(先在後台把角色單建好或改名,再匯一次即可,重匯只是覆寫稿件)。
*/

export const runtime = 'nodejs';
// 台詞表夾 170+ 張角色圖(sharp 壓縮+逐張上傳),60 秒會被切斷 → 提到 5 分鐘(Vercel Pro 上限內)。
export const maxDuration = 300;

let _s2t: ((s: string) => string) | null = null;
function s2t(input: string): string {
  try {
    if (!_s2t) _s2t = OpenCC.Converter({ from: 'cn', to: 'twp' });
    return _s2t(input).replace(/瞭/g, '了');
  } catch { return input; }
}
const normName = (s: string) => s2t(String(s || '')).replace(/\s+/g, '').trim();
// 主角色 key:皮膚變體「福爾森-寒城謎箋」、附註「林炎(rapper)」「杉浦迎之/禮賓員」都歸回
// 主名(同一配音員同一張單);變體全名保留在每句標頭,配音員知道是哪個皮膚。
const mainKey = (s: string) => normName(s).split(/[-—/(（]/)[0];
// 分頁名/訂單名對比用:再去掉中點類符號(「塞伦沃克」分頁 vs 「塞倫・沃克」訂單)。
const looseKey = (s: string) => mainKey(s).replace(/[・·•.]/g, '');

type Line = { idx: number; role: string; variant?: string; text: string; orig?: string; emotion?: string; speed?: string; func?: string; scene?: string; age?: string; gender?: string; trait?: string; introd?: string };

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const briefId = new URL(request.url).searchParams.get('brief_id') || '';
  if (!briefId) return NextResponse.json({ error: 'missing brief_id' }, { status: 400 });

  // 兩種進件:JSON {path}(前端先簽名上傳到 casting bucket;繞過 Vercel 4.5MB body 上限,
  // 女王百貨這種夾 170+ 張圖的 xlsx 直接 POST 必 413)/ 或舊式 FormData 直傳(小檔)。
  let buf: Buffer;
  const isJson = (request.headers.get('content-type') || '').includes('application/json');
  if (isJson) {
    let path = '';
    try { path = String((await request.json())?.path || ''); } catch { /* fallthrough */ }
    if (!path || !path.startsWith('reference/')) return NextResponse.json({ error: 'missing path' }, { status: 400 });
    const db0 = getSupabaseServiceClient();
    const { data, error } = await db0.storage.from('casting').download(path);
    if (error || !data) return NextResponse.json({ error: `下載台詞表失敗:${error?.message || '檔案不存在'}` }, { status: 400 });
    buf = Buffer.from(await data.arrayBuffer());
    // 台詞表含客戶完整稿件,解析進記憶體後立刻從公開 bucket 移除(best-effort)。
    db0.storage.from('casting').remove([path]).catch(() => {});
  } else {
    try {
      const form = await request.formData();
      const file = form.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'missing file' }, { status: 400 });
      buf = Buffer.from(await file.arrayBuffer());
    } catch { return NextResponse.json({ error: 'bad form data' }, { status: 400 }); }
  }

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { return NextResponse.json({ error: '不是有效的 xlsx' }, { status: 400 }); }

  // ── 解析:每個角色分頁 → 台詞列(+ 每列嵌入的角色/皮膚圖)──
  const byRole = new Map<string, Line[]>();
  const roleSheet = new Map<string, string>();   // 角色鍵 → 所在分頁(looseKey),做「分頁歸戶」
  const rowInfoBySheet = new Map<string, Record<number, { key: string; fullRole: string }>>();
  const imgJobs: { key: string; name: string; buffer: Buffer }[] = [];
  const cellStr = (c: ExcelJS.CellValue): string => {
    if (c == null) return '';
    if (typeof c === 'object' && 'richText' in (c as object)) return ((c as { richText: { text: string }[] }).richText || []).map((r) => r.text).join('');
    if (typeof c === 'object' && 'result' in (c as object)) return String((c as { result: unknown }).result ?? '');
    return String(c);
  };
  for (const ws of wb.worksheets) {
    if (/分配|分派|說明|说明/.test(ws.name)) continue;   // 總表/說明頁略過
    const sheetKey = looseKey(ws.name);
    // 找標題列(含「角色名」與台詞欄「TW」或「原版臺詞」)
    let headerRow = 0; const col: Record<string, number> = {};
    ws.eachRow((row, n) => {
      if (headerRow) return;
      const labels: Record<number, string> = {};
      row.eachCell({ includeEmpty: false }, (c, i) => { labels[i] = cellStr(c.value).replace(/\s/g, ''); });
      const entries = Object.entries(labels);
      const has = (re: RegExp) => entries.find(([, v]) => re.test(v));
      if (has(/角色名/) && (has(/^TW$/i) || has(/原版臺詞|原版台词/))) {
        headerRow = n;
        for (const [i, v] of entries) {
          if (/角色名/.test(v)) col.role = Number(i);
          else if (/^TW$/i.test(v)) col.tw = Number(i);
          else if (/原版臺詞|原版台词/.test(v)) col.orig = Number(i);
          else if (/核心情緒|核心情绪/.test(v)) col.emotion = Number(i);
          else if (/語速|语速/.test(v)) col.speed = Number(i);
          else if (/功能/.test(v)) col.func = Number(i);
          else if (/畫面解讀|画面解读/.test(v)) col.scene = Number(i);
          else if (/年齡|年龄/.test(v)) col.age = Number(i);
          else if (/性別|性别/.test(v)) col.gender = Number(i);
          else if (/性格特點|性格特点/.test(v)) col.trait = Number(i);
          else if (/角色介紹|角色介绍/.test(v)) col.introd = Number(i);
        }
      }
    });
    if (!headerRow || !col.role) continue;
    const rowInfo: Record<number, { key: string; fullRole: string }> = {};
    ws.eachRow((row, n) => {
      if (n <= headerRow) return;
      const get = (i?: number) => (i ? s2t(cellStr(row.getCell(i).value)).trim() : '');
      const tw = get(col.tw);
      const orig = get(col.orig);
      const text = tw || orig;                             // 錄的是 TW;沒 TW 先帶原版(標示待翻)
      const fullRole = normName(get(col.role));
      if (!fullRole || !text) return;
      const key = mainKey(fullRole);                       // 皮膚變體歸回主角色(同一張單)
      const arr = byRole.get(key) || [];
      // 原版與 TW 都保留 —— Wing 要配音員兩個都看得到(對照語氣/斷句)。
      arr.push({ idx: arr.length + 1, role: key, variant: fullRole !== key ? fullRole : undefined, text, orig: orig && orig !== text ? orig : undefined, emotion: get(col.emotion), speed: get(col.speed), func: get(col.func), scene: get(col.scene), age: get(col.age), gender: get(col.gender), trait: get(col.trait), introd: get(col.introd) });
      byRole.set(key, arr);
      if (!roleSheet.has(key)) roleSheet.set(key, sheetKey);
      rowInfo[n] = { key, fullRole };
    });
    rowInfoBySheet.set(ws.name, rowInfo);
  }
  // 嵌入圖:不用 exceljs 的 getImages/getImage(WPS 檔 imageId 對應會錯亂、漏圖 ——
  // 2026-07-15 女王百貨角色圖張冠李戴的根因)→ 解 drawing XML 拿「錨點列↔圖」。
  try {
    const sheetImgs = await extractXlsxImages(buf);
    // 跨分頁漂浮圖(同一張圖錨在多個分頁,如雜訊圖 image98)→ 該列有替代圖時排除
    const bufSheets = new Map<Buffer, Set<string>>();
    for (const [sn, items] of sheetImgs) for (const it of items) { const s = bufSheets.get(it.buffer) || new Set<string>(); s.add(sn); bufSheets.set(it.buffer, s); }
    for (const [sn, items] of sheetImgs) {
      if (/分配|分派|說明|说明/.test(sn)) continue;
      const rowInfo = rowInfoBySheet.get(sn);
      if (!rowInfo) continue;
      const byRow = new Map<number, Set<Buffer>>();
      for (const it of items) { const s = byRow.get(it.row) || new Set<Buffer>(); s.add(it.buffer); byRow.set(it.row, s); }
      for (const [row, set] of byRow) {
        const info = rowInfo[row] || rowInfo[row + 1] || rowInfo[row - 1];
        if (!info) continue;
        let list = [...set];
        const nonStray = list.filter((bb) => (bufSheets.get(bb)?.size || 0) < 2);
        if (nonStray.length) list = nonStray;
        for (const bb of list) imgJobs.push({ key: info.key, name: info.fullRole, buffer: bb });
      }
    }
  } catch { /* 圖抽不出來就沒圖,台詞照樣匯 */ }
  if (!byRole.size) return NextResponse.json({ error: '沒解析到任何台詞(找不到「角色名 + TW/原版臺詞」標題列)' }, { status: 400 });

  // ── 匹配該案的角色訂單,寫入製作稿 ──
  const db = getSupabaseServiceClient();

  // 嵌入圖:壓成 480px jpeg 上傳 casting bucket(8 併發,單張失敗不擋整批),按角色歸集。
  const imgsByKey = new Map<string, { name: string; url: string }[]>();
  const pubBase = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  for (let i = 0; i < imgJobs.length; i += 8) {
    await Promise.all(imgJobs.slice(i, i + 8).map(async (j) => {
      try {
        const small = await sharp(j.buffer).resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
        const path = `reference/roleimg/${Date.now()}_${crypto.randomUUID()}.jpg`;
        const { error } = await db.storage.from('casting').upload(path, small, { contentType: 'image/jpeg', upsert: false });
        if (error) return;
        const arr = imgsByKey.get(j.key) || [];
        arr.push({ name: j.name, url: `${pubBase}/storage/v1/object/public/casting/${path}` });
        imgsByKey.set(j.key, arr);
      } catch { /* 單張 best-effort */ }
    }));
  }
  const { data: orders } = await db.from('voice_orders').select('id, role_name, order_number, talent_id, pay_unit, pay_rate').eq('brief_id', briefId);
  const orderByName = new Map((orders || []).filter((o) => o.role_name).map((o) => [mainKey(String(o.role_name)), o]));
  const orderByLoose = new Map((orders || []).filter((o) => o.role_name).map((o) => [looseKey(String(o.role_name)), o]));
  // 無分隔符的皮膚名(顧冶擊劍皮膚、谷川翔一決勝時刻)用「以訂單角色名為前綴」合併;
  // 長名優先,避免短名訂單誤吞別的角色。
  const anchors = [...orderByName.entries()].sort((a, b) => b[0].length - a[0].length);

  type Ord = { id: string; role_name?: string | null; order_number?: string | null; talent_id?: string | null; pay_unit?: string | null; pay_rate?: number | null };
  const byOrder = new Map<string, { roleName: string; order: Ord; lines: Line[]; images: { name: string; url: string }[] }>();
  const unmatched: { role: string; lines: number }[] = [];
  for (const [role, lines] of byRole) {
    let order = orderByName.get(role);
    if (!order) { const hit = anchors.find(([k]) => k.length >= 2 && role.startsWith(k)); order = hit?.[1]; }
    // 分頁歸戶:皮膚列常不帶主角前綴(顾冶分頁裡直接寫「緋夜共舞」),列名對不到
    // 訂單時,用「所在分頁的主角」找訂單(2026-07-15 女王百貨顧冶 11 句漏 4 句的根因)。
    if (!order) { const sk = roleSheet.get(role); if (sk) order = orderByLoose.get(sk); }
    if (!order) { unmatched.push({ role, lines: lines.length }); continue; }
    const slot = byOrder.get(String(order.id)) || { roleName: String(order.role_name || role), order: order as Ord, lines: [], images: [] };
    const anchor = mainKey(slot.roleName);
    for (const l of lines) slot.lines.push({ ...l, variant: l.variant || (role !== anchor ? role : undefined) });
    for (const img of imgsByKey.get(role) || []) slot.images.push(img);
    byOrder.set(String(order.id), slot);
  }

  const matched: { role: string; lines: number; images?: number; pay?: string }[] = [];
  for (const [orderId, { roleName, order, lines, images }] of byOrder) {
    const first = lines[0];
    // 每句一律標「錄音台詞:」(要錄的台灣版);有大陸原版就附上當語氣/斷句對照 ——
    // Wing 2026-07-15:不標清楚配音員會不曉得要錄哪行,不能有光禿禿的一行字。
    const head = [`【角色】${roleName}`, [first.gender, first.age && `${first.age.replace(/[歲岁]/g, '')}歲`, first.trait, first.introd].filter(Boolean).join(' · '), `共 ${lines.length} 句 —— 每句只錄「錄音台詞:」那一行;「大陸原版:」只是語氣/斷句對照,不用錄。(【】內為皮膚/變體名)`].filter(Boolean).join('\n');
    const body = lines.map((l, i) => {
      const tags = [l.func, l.emotion && `情緒:${l.emotion}`, l.speed && `語速:${l.speed}`].filter(Boolean).join(' | ');
      return [
        `${i + 1}. ${l.variant ? `【${l.variant}】` : ''}${tags ? `(${tags})` : ''}`,
        l.orig ? `大陸原版:${l.orig}` : '',
        `錄音台詞:${l.text}`,
        l.scene ? `   ▸ 畫面:${l.scene}` : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n');
    const upd: Record<string, unknown> = { script_text: `${head}\n\n${body}`, role_images: images.length ? images : null };
    // 按句計價的單:酬勞 = 單價 × 句數,匯入時自動算(重匯會依最新句數重算)。
    let payNote: string | undefined;
    const rate = Number(order.pay_rate) || 0;
    if (order.pay_unit === 'per_line' && rate > 0) {
      const total = rate * lines.length;
      upd.talent_price = total;
      payNote = `${rate}×${lines.length}句=${total}`;
    }
    const { error } = await db.from('voice_orders').update(upd).eq('id', orderId);
    if (error) { unmatched.push({ role: roleName, lines: lines.length }); continue; }
    matched.push({ role: roleName, lines: lines.length, images: images.length, pay: payNote });
    // 分潤紀錄同步(per_line 在指派時跳過建立,這裡補建/更新成正確總額)。
    if (order.pay_unit === 'per_line' && rate > 0 && order.talent_id) {
      const total = rate * lines.length;
      const { data: exist } = await db.from('talent_earnings').select('id').eq('order_id', orderId).maybeSingle();
      if (exist) await db.from('talent_earnings').update({ order_total: total, commission_amount: total }).eq('id', exist.id);
      else await db.from('talent_earnings').insert({ talent_id: order.talent_id, order_id: orderId, order_type: 'voice', order_number: order.order_number, tier: 'managed', order_total: total, commission_rate: 1, commission_amount: total, status: 'pending' });
    }
  }
  return NextResponse.json({ ok: true, matched, unmatched, totalRoles: byRole.size });
}
