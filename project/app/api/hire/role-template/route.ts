import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

/*
  GET /api/hire/role-template — generate the Onyx fixed-column casting role template
  (.xlsx) on the fly. Columns are kept in lock-step with the casting xlsx parser
  (parse-xlsx) so a client-filled sheet imports precisely. Used for game / drama /
  animation briefs, where each character is one row.
*/

// header label → column width. The header text MUST match what parse-xlsx looks for.
const COLUMNS: { h: string; w: number; req?: boolean }[] = [
  { h: '角色名', w: 14, req: true },
  { h: '戲份', w: 10 },
  { h: '性別', w: 8, req: true },
  { h: '聲音年齡', w: 12, req: true },
  { h: '聲線/音色', w: 18 },
  { h: '個性', w: 22 },
  { h: '台詞情緒', w: 12 },
  { h: '台詞量(估)', w: 14 },
  { h: '試音台詞', w: 44, req: true },
  { h: '角色圖連結', w: 24 },
  { h: '備註', w: 26 },
];

const SAMPLES: string[][] = [
  ['阿薇', '主角', '女', '青年', '清亮、溫暖、偏年輕', '開朗直率、講話快', '著急', '約 1,200 字 / 80 句', '別愣著!他們快追上來了,跟我走!', '', '被追殺、邊跑邊回頭喊同伴 —— 急促但不能尖。若有我們沒列到的需求,直接寫這裡'],
  ['守城老兵', '', '男', '熟齡', '低沉、沙啞、威嚴', '話少、沉穩內斂', '沉穩', '約 300 字 / 20 句', '城門一旦失守,我們就退無可退了。', '', '城牆上向年輕士兵交代'],
];

export async function GET() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Onyx Studios';
  const ws = wb.addWorksheet('角色表');

  // Row 1: a one-line filling note across the sheet.
  const noteRow = ws.addRow(['每列填一個角色 ·「角色名 / 性別 / 聲音年齡 / 試音台詞」為必填,其餘有填有加分。角色圖:此欄貼連結,或直接把圖片貼在該列任意位置(系統會自動抓取)。']);
  ws.mergeCells(1, 1, 1, COLUMNS.length);
  noteRow.getCell(1).font = { color: { argb: 'FF7A5C00' }, size: 11 };
  noteRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBF1DA' } };
  noteRow.getCell(1).alignment = { vertical: 'middle', wrapText: true };
  noteRow.height = 30;

  // Row 2: headers.
  const header = ws.addRow(COLUMNS.map((c) => (c.req ? `${c.h} ★` : c.h)));
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF111111' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5C25B' } };
    cell.alignment = { vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCFA23A' } } };
  });

  // Sample rows.
  for (const s of SAMPLES) ws.addRow(s);

  ws.columns.forEach((col, i) => { col.width = COLUMNS[i]?.w || 14; });
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="onyx-casting-roles.xlsx"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
