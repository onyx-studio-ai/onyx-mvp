import JSZip from 'jszip';

/*
  直接解 xlsx 內部 XML 抽「每列的嵌入圖」。
  為什麼不用 exceljs 的 ws.getImages()/wb.getImage():對 WPS 產的檔,exceljs 的
  imageId ↔ media 對應會錯亂(同 id 出現在不同列、部分圖漏抓),2026-07-15 女王百貨
  角色圖全部張冠李戴的根因。drawing XML 的錨點列 ↔ 圖檔關係寫死在檔案裡,絕對準:
    workbook.xml(分頁名→rId)→ workbook.xml.rels(rId→sheetN.xml)
    → sheetN.xml.rels(→drawingX.xml)→ drawingX.xml(錨點列+r:embed)
    → drawingX.xml.rels(r:embed→media/imageN.png)
  回傳:分頁名 → [{ row(1-based), buffer }],同一 media 檔共用同一個 Buffer。
*/
export async function extractXlsxImages(buf: Buffer): Promise<Map<string, { row: number; buffer: Buffer }[]>> {
  const out = new Map<string, { row: number; buffer: Buffer }[]>();
  const zip = await JSZip.loadAsync(buf);
  const read = async (p: string) => { const f = zip.file(p); return f ? await f.async('string') : ''; };
  const relsOf = (xml: string) => {
    const m = new Map<string, string>();
    for (const t of xml.match(/<Relationship\b[^>]*>/g) || []) {
      const id = t.match(/Id="([^"]+)"/)?.[1];
      const target = t.match(/Target="([^"]+)"/)?.[1];
      if (id && target) m.set(id, target);
    }
    return m;
  };

  const wbXml = await read('xl/workbook.xml');
  const wbRels = relsOf(await read('xl/_rels/workbook.xml.rels'));
  const mediaCache = new Map<string, Buffer>();

  for (const tag of wbXml.match(/<sheet\b[^>]*>/g) || []) {
    const name = tag.match(/name="([^"]+)"/)?.[1];
    const rid = tag.match(/r:id="([^"]+)"/)?.[1];
    if (!name || !rid) continue;
    const sheetTarget = (wbRels.get(rid) || '').replace(/^\//, '');            // worksheets/sheet1.xml
    const sheetFile = sheetTarget.split('/').pop() || '';
    const sheetRels = relsOf(await read(`xl/worksheets/_rels/${sheetFile}.rels`));
    const drawingTarget = [...sheetRels.values()].find((t) => t.includes('drawing'));
    if (!drawingTarget) continue;
    const drawingFile = drawingTarget.split('/').pop() || '';
    const dXml = await read(`xl/drawings/${drawingFile}`);
    const dRels = relsOf(await read(`xl/drawings/_rels/${drawingFile}.rels`));
    const items: { row: number; buffer: Buffer }[] = [];
    for (const anchor of dXml.match(/<xdr:(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g) || []) {
      const row = anchor.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)?.[1];
      const embed = anchor.match(/r:embed="([^"]+)"/)?.[1];
      if (row == null || !embed) continue;
      const mediaPath = 'xl/media/' + ((dRels.get(embed) || '').split('/').pop() || '');
      let mbuf = mediaCache.get(mediaPath);
      if (!mbuf) {
        const f = zip.file(mediaPath);
        if (!f) continue;
        mbuf = Buffer.from(await f.async('uint8array'));
        mediaCache.set(mediaPath, mbuf);
      }
      items.push({ row: Number(row) + 1, buffer: mbuf });
    }
    if (items.length) out.set(name, items);
  }
  return out;
}
