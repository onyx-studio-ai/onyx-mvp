import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  POST /api/admin/casting/parse-xlsx — the poster uploads the client's audition
  spreadsheet; we parse the roles (name / gender / age / personality / line) and
  extract the embedded character images, re-hosting them on our `casting` bucket
  so voice actors can see the character's face. Best-effort: text always returns;
  image extraction is wrapped so a weird sheet still yields the roles.

  multipart form-data: { file }. Returns { roles: [{name,gender,age,personality,
  sample_line,is_lead,image}] }.
*/
const BUCKET = 'casting';
// header text → role field
const COLS: Record<string, string> = {
  name: '角色名|角色名稱|角色', gender: '性别|性別', age: '年龄|年齡|年龄段|年齡段',
  personality: '性格|个性|個性', line: '台词|台詞|台词内容|台詞內容',
};
const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, '').trim();

function publicUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let buf: Buffer;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: '請選擇 xlsx 檔' }, { status: 400 });
    buf = Buffer.from(await file.arrayBuffer());
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
          if (pat.split('|').some((p) => t === p || (field === 'name' ? t === p : t.includes(p)))) map[field] = c;
        }
      });
      if (map.name) { ws = sheet; headerRow = rn; Object.assign(colIdx, map); break; }
    }
    if (ws) break;
  }
  if (!ws || !colIdx.name) return NextResponse.json({ error: '找不到「角色名」欄,請確認 xlsx 格式或改用手動輸入' }, { status: 422 });

  type R = { name: string; gender: string; age: string; personality: string; sample_line: string; is_lead: boolean; image?: string };
  const roles: R[] = [];
  const rowOfRole: Record<number, number> = {}; // sheet rowNumber → roles[] index
  const get = (row: ExcelJS.Row, field: string) => (colIdx[field] ? norm(row.getCell(colIdx[field]).value) : '');
  for (let rn = headerRow + 1; rn <= ws.rowCount; rn++) {
    const row = ws.getRow(rn);
    const rawName = colIdx.name ? String(row.getCell(colIdx.name).value ?? '').trim() : '';
    if (!rawName) continue;
    const name = rawName.split(/\s|（|\(|:|：/)[0].trim();
    roles.push({
      name, gender: get(row, 'gender'), age: get(row, 'age').replace(/[岁歲]/g, ''),
      personality: get(row, 'personality'), sample_line: colIdx.line ? String(row.getCell(colIdx.line).value ?? '').trim() : '',
      is_lead: /主角/.test(rawName),
    });
    rowOfRole[rn] = roles.length - 1;
  }
  if (!roles.length) return NextResponse.json({ error: '沒有解析到角色,請確認 xlsx 或改用手動' }, { status: 422 });

  // Extract embedded character images → re-host → attach to the role on that row.
  try {
    const db = getSupabaseServiceClient();
    const imgs = ws.getImages();
    for (const im of imgs) {
      const anchorRow = (im.range?.tl?.nativeRow ?? -1) + 1; // nativeRow is 0-indexed
      // map the image's anchor to a role row (only the row it sits on, ± 1)
      let idx = rowOfRole[anchorRow];
      if (idx === undefined) { for (let k = anchorRow; k <= anchorRow + 1; k++) if (rowOfRole[k] !== undefined) { idx = rowOfRole[k]; break; } }
      if (idx === undefined || roles[idx].image) continue;   // skip unmapped / already-has-image — no wasted upload
      const media = wb.getImage(Number(im.imageId)) as { buffer?: Buffer } | undefined;
      if (!media?.buffer) continue;
      // Downsize hard — embedded portraits are multi-MB; 480px jpeg ≈ tens of KB.
      const small = await sharp(media.buffer as Buffer).resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
      const path = `reference/roleimg/${Date.now()}_${crypto.randomUUID()}.jpg`;
      const { error } = await db.storage.from(BUCKET).upload(path, small, { contentType: 'image/jpeg', upsert: false });
      if (!error) roles[idx].image = publicUrl(path);
    }
  } catch {
    // image extraction is best-effort — the roles still return without faces.
  }

  return NextResponse.json({ roles });
}
