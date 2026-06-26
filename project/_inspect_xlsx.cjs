const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  const ws = wb.worksheets[0];
  console.log('SHEET:', ws.name, '| rows:', ws.rowCount, '| sheets:', wb.worksheets.map(w=>w.name).join(','));
  // print first ~40 rows, all cell text
  console.log('=== ROWS (row: [col1, col2, ...]) ===');
  for (let r = 1; r <= Math.min(ws.rowCount, 40); r++) {
    const vals = [];
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      let v = cell.text || '';
      if (typeof v === 'string') v = v.replace(/\s+/g,' ').slice(0,40);
      if (v) vals.push(`c${col}:${v}`);
    });
    if (vals.length) console.log(`r${r}:`, vals.join(' | '));
  }
  // images with anchors
  const imgs = ws.getImages();
  console.log('=== IMAGES:', imgs.length, '===');
  imgs.forEach((im) => {
    const tl = im.range && im.range.tl ? `tl(r${Math.round(im.range.tl.nativeRow ?? im.range.tl.row)},c${Math.round(im.range.tl.nativeCol ?? im.range.tl.col)})` : '?';
    const media = wb.model.media && wb.model.media[im.imageId];
    console.log(`imageId=${im.imageId} ${tl} ext=${media&&media.extension} bytes=${media&&media.buffer&&media.buffer.length}`);
  });
})().catch(e=>{console.error('ERR', e.message);});
