import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import * as OpenCC from 'opencc-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

// Client sheets are simplified Chinese; Taiwan voice actors read traditional.
// Convert role text (name / personality / line) to Traditional (Taiwan). Lazy +
// fail-safe: if OpenCC can't init or convert (e.g. dicts not bundled), we just
// return the original text rather than failing the whole parse.
let _s2t: ((s: string) => string) | null = null;
function tw(s: string): string {
  if (!s) return s;
  try {
    if (!_s2t) _s2t = OpenCC.Converter({ from: 'cn', to: 'twp' });
    // OpenCC mis-converts the aspect particle 了 → 瞭 (e.g. "演了"→"演瞭"). In casting
    // scripts 瞭 is virtually always that mistake, so map it back to 了.
    return _s2t(s).replace(/瞭/g, '了');
  } catch {
    return s;
  }
}

/*
  POST /api/admin/casting/parse-xlsx — the poster uploads the client's audition
  spreadsheet; we parse the roles (name / gender / age / personality / line) and
  extract the embedded character images, re-hosting them on our `casting` bucket
  so voice actors can see the character's face. Best-effort: text always returns;
  image extraction is wrapped so a weird sheet still yields the roles.

  multipart form-data: { file }. Returns { roles: [{name,gender,age,personality,
  sample_line,is_lead,image}] }.
*/
export const maxDuration = 60; // client xlsx can be tens of MB w/ many images — give the parse room

const BUCKET = 'casting';
// header text → role field. `line` is matched EXACTLY (not "includes") so a
// 台词功能 ("line function") column never gets mistaken for the real 台词内容.
const COLS: Record<string, string> = {
  name: '角色名|角色名稱|角色', weight: '戲份|戏份|角色定位', gender: '性别|性別', age: '年龄|年齡|年龄段|年齡段|聲音年齡|声音年龄',
  timbre: '聲線|声线|音色', personality: '性格|个性|個性', intro: '角色介绍|角色介紹|角色简介|角色簡介|人物介绍|人物介紹',
  emotion: '台詞情緒|台词情绪|核心情绪|核心情緒|情绪|情緒|情感|語氣|语气', speed: '语速|語速',
  volume: '台詞量|台词量|台詞數|台词数', special: '特殊聲音|特殊声音|特殊表現|特殊表现',
  accent: '口音', imageUrl: '角色圖連結|角色图链接|角色圖|角色图|圖片連結|图片链接',
  line: '台词内容|台詞內容|台词|台詞',
};
const EXACT_ONLY = new Set(['name', 'line']); // these must equal the header, not just be contained in it
const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, '').trim();

function publicUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  // Two ways in. JSON { path }: the client already uploaded the xlsx straight to
  // Supabase (signed URL) — we download it server-side. This is the main path,
  // because a big client xlsx (tens of MB) can't go through a Vercel function
  // (≈4.5 MB body limit). Multipart { file } stays as a fallback for small files.
  let buf: Buffer;
  let tmpPath = '';
  let keep = false; // when true, don't delete the source after parsing (it's a persistent file)
  const ctype = request.headers.get('content-type') || '';
  try {
    if (ctype.includes('application/json')) {
      const body = (await request.json()) as { path?: string; keep?: boolean };
      keep = !!body.keep;
      tmpPath = String(body.path || '');
      if (!tmpPath) return NextResponse.json({ error: '缺少檔案路徑' }, { status: 400 });
      const db = getSupabaseServiceClient();
      const { data, error } = await db.storage.from(BUCKET).download(tmpPath);
      if (error || !data) return NextResponse.json({ error: '讀取上傳的檔案失敗,請重試' }, { status: 400 });
      buf = Buffer.from(await data.arrayBuffer());
    } else {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: '請選擇 xlsx 檔' }, { status: 400 });
      buf = Buffer.from(await file.arrayBuffer());
    }
  } catch {
    return NextResponse.json({ error: '讀取檔案失敗' }, { status: 400 });
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  } catch {
    return NextResponse.json({ error: '這不是有效的 xlsx 檔' }, { status: 400 });
  }

  // Pick the worksheet that has a 角色名/角色 column.
  let ws: ExcelJS.Worksheet | undefined;
  let headerRow = 0;
  const colIdx: Record<string, number> = {};
  for (const sheet of wb.worksheets) {
    for (let rn = 1; rn <= Math.min(6, sheet.rowCount); rn++) {
      const row = sheet.getRow(rn);
      const map: Record<string, number> = {};
      row.eachCell((cell, c) => {
        const t = norm(cell.value);
        for (const [field, pat] of Object.entries(COLS)) {
          if (map[field]) continue;
          if (pat.split('|').some((p) => t === p || (EXACT_ONLY.has(field) ? false : t.includes(p)))) map[field] = c;
        }
      });
      if (map.name) { ws = sheet; headerRow = rn; Object.assign(colIdx, map); break; }
    }
    if (ws) break;
  }
  if (!ws || !colIdx.name) return NextResponse.json({ error: '找不到「角色名」欄,請確認 xlsx 格式或改用手動輸入' }, { status: 422 });

  type R = { name: string; weight: string; gender: string; age: string; timbre: string; personality: string; emotion: string; speed: string; volume: string; special: string; accent: string; sample_line: string; is_lead: boolean; image?: string };
  const roles: R[] = [];
  const rowOfRole: Record<number, number> = {}; // sheet rowNumber → roles[] index
  const get = (row: ExcelJS.Row, field: string) => (colIdx[field] ? norm(row.getCell(colIdx[field]).value) : '');
  for (let rn = headerRow + 1; rn <= ws.rowCount; rn++) {
    const row = ws.getRow(rn);
    const rawName = colIdx.name ? String(row.getCell(colIdx.name).value ?? '').trim() : '';
    if (!rawName) continue;
    // Strip only trailing instruction notes (space / parens), KEEP colon names like
    // 「顧冶皮膚2:疾速之風」.
    const name = rawName.split(/\s|（|\(/)[0].trim();
    // personality = ONE faithful column (角色介紹, else 性格特點) — no merging/embellishment.
    const personality = (get(row, 'intro') || get(row, 'personality')).slice(0, 60);
    const weight = get(row, 'weight').slice(0, 20);
    const imageUrl = colIdx.imageUrl ? String(row.getCell(colIdx.imageUrl).value ?? '').trim() : '';
    roles.push({
      name: tw(name), weight: tw(weight), gender: get(row, 'gender'), age: get(row, 'age').replace(/[岁歲]/g, ''),
      timbre: tw(get(row, 'timbre')).slice(0, 80),
      personality: tw(personality), emotion: tw(get(row, 'emotion')).slice(0, 120), speed: tw(get(row, 'speed')).slice(0, 40),
      volume: tw(get(row, 'volume')).slice(0, 60), special: tw(get(row, 'special')).slice(0, 120), accent: tw(get(row, 'accent')).slice(0, 80),
      // 台詞 = the script the actor reads — convert to Traditional (with the 瞭→了
      // fix in tw()) so it's faithful content in TW characters, no embellishment.
      sample_line: tw((colIdx.line ? String(row.getCell(colIdx.line).value ?? '').trim() : '')).slice(0, 500),
      // image from a pasted URL column (fallback; an embedded image on the row overrides below).
      image: /^https?:\/\//i.test(imageUrl) ? imageUrl.slice(0, 1000) : undefined,
      is_lead: /主角/.test(rawName) || /主角/.test(weight),
    });
    rowOfRole[rn] = roles.length - 1;
  }
  if (!roles.length) return NextResponse.json({ error: '沒有解析到角色,請確認 xlsx 或改用手動' }, { status: 422 });

  // Extract embedded character images → re-host → attach to the role on that row.
  // Done in PARALLEL — a sheet can hold 30+ multi-MB portraits, and serial
  // sharp+upload would blow the function's time budget.
  try {
    const db = getSupabaseServiceClient();
    const seen = new Set<number>(); // one image per role (first wins)
    const jobs: { idx: number; imageId: string | number }[] = [];
    for (const im of ws.getImages()) {
      const anchorRow = (im.range?.tl?.nativeRow ?? -1) + 1; // nativeRow is 0-indexed
      let idx = rowOfRole[anchorRow];
      if (idx === undefined) { for (let k = anchorRow; k <= anchorRow + 1; k++) if (rowOfRole[k] !== undefined) { idx = rowOfRole[k]; break; } }
      if (idx === undefined || seen.has(idx)) continue;        // skip unmapped / already-claimed
      seen.add(idx);
      jobs.push({ idx, imageId: im.imageId });
    }

    await Promise.all(jobs.map(async ({ idx, imageId }) => {
      try {
        const media = wb.getImage(Number(imageId)) as { buffer?: Buffer } | undefined;
        if (!media?.buffer) return;
        // Downsize hard — embedded portraits are multi-MB; 480px jpeg ≈ tens of KB.
        const small = await sharp(media.buffer as Buffer).resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
        const path = `reference/roleimg/${Date.now()}_${crypto.randomUUID()}.jpg`;
        const { error } = await db.storage.from(BUCKET).upload(path, small, { contentType: 'image/jpeg', upsert: false });
        if (!error) roles[idx].image = publicUrl(path);
      } catch { /* per-image best-effort */ }
    }));
  } catch {
    // image extraction is best-effort — the roles still return without faces.
  }

  // Best-effort cleanup of the temp xlsx uploaded just for parsing. Skipped when
  // keep=true (e.g. a client's persistent role sheet attached to their brief).
  if (tmpPath && !keep) getSupabaseServiceClient().storage.from(BUCKET).remove([tmpPath]).catch(() => {});

  return NextResponse.json({ roles });
}
