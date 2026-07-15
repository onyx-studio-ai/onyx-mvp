import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import * as OpenCC from 'opencc-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

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
export const maxDuration = 60;

let _s2t: ((s: string) => string) | null = null;
function s2t(input: string): string {
  try {
    if (!_s2t) _s2t = OpenCC.Converter({ from: 'cn', to: 'twp' });
    return _s2t(input).replace(/瞭/g, '了');
  } catch { return input; }
}
const normName = (s: string) => s2t(String(s || '')).replace(/\s+/g, '').trim();

type Line = { idx: number; role: string; text: string; emotion?: string; speed?: string; func?: string; scene?: string; age?: string; gender?: string; trait?: string; introd?: string };

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const briefId = new URL(request.url).searchParams.get('brief_id') || '';
  if (!briefId) return NextResponse.json({ error: 'missing brief_id' }, { status: 400 });

  let buf: Buffer;
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'missing file' }, { status: 400 });
    buf = Buffer.from(await file.arrayBuffer());
  } catch { return NextResponse.json({ error: 'bad form data' }, { status: 400 }); }

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf as unknown as ArrayBuffer); } catch { return NextResponse.json({ error: '不是有效的 xlsx' }, { status: 400 }); }

  // ── 解析:每個角色分頁 → 台詞列 ──
  const byRole = new Map<string, Line[]>();
  const cellStr = (c: ExcelJS.CellValue): string => {
    if (c == null) return '';
    if (typeof c === 'object' && 'richText' in (c as object)) return ((c as { richText: { text: string }[] }).richText || []).map((r) => r.text).join('');
    if (typeof c === 'object' && 'result' in (c as object)) return String((c as { result: unknown }).result ?? '');
    return String(c);
  };
  for (const ws of wb.worksheets) {
    if (/分配|分派|說明|说明/.test(ws.name)) continue;   // 總表/說明頁略過
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
    ws.eachRow((row, n) => {
      if (n <= headerRow) return;
      const get = (i?: number) => (i ? s2t(cellStr(row.getCell(i).value)).trim() : '');
      const text = get(col.tw) || get(col.orig);          // 優先 TW 繁中稿,沒有就用原版
      const role = normName(get(col.role));
      if (!role || !text) return;
      const arr = byRole.get(role) || [];
      arr.push({ idx: arr.length + 1, role, text, emotion: get(col.emotion), speed: get(col.speed), func: get(col.func), scene: get(col.scene), age: get(col.age), gender: get(col.gender), trait: get(col.trait), introd: get(col.introd) });
      byRole.set(role, arr);
    });
  }
  if (!byRole.size) return NextResponse.json({ error: '沒解析到任何台詞(找不到「角色名 + TW/原版臺詞」標題列)' }, { status: 400 });

  // ── 匹配該案的角色訂單,寫入製作稿 ──
  const db = getSupabaseServiceClient();
  const { data: orders } = await db.from('voice_orders').select('id, role_name').eq('brief_id', briefId);
  const orderByName = new Map((orders || []).filter((o) => o.role_name).map((o) => [normName(String(o.role_name)), o]));

  const matched: { role: string; lines: number }[] = [];
  const unmatched: { role: string; lines: number }[] = [];
  for (const [role, lines] of byRole) {
    const order = orderByName.get(role);
    if (!order) { unmatched.push({ role, lines: lines.length }); continue; }
    const first = lines[0];
    const head = [`【角色】${role}`, [first.gender, first.age && `${first.age}歲`, first.trait, first.introd].filter(Boolean).join(' · '), `共 ${lines.length} 句,請依每句指引錄製。`].filter(Boolean).join('\n');
    const body = lines.map((l) => {
      const tags = [l.func, l.emotion && `情緒:${l.emotion}`, l.speed && `語速:${l.speed}`].filter(Boolean).join(' | ');
      return [`${l.idx}. ${tags ? `(${tags})` : ''}`, l.text, l.scene ? `   ▸ 畫面:${l.scene}` : ''].filter(Boolean).join('\n');
    }).join('\n\n');
    const { error } = await db.from('voice_orders').update({ script_text: `${head}\n\n${body}` }).eq('id', order.id);
    if (error) unmatched.push({ role, lines: lines.length });
    else matched.push({ role, lines: lines.length });
  }
  return NextResponse.json({ ok: true, matched, unmatched, totalRoles: byRole.size });
}
