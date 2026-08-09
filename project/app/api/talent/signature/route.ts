import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { latestSignaturePath, SIGNATURE_BUCKET } from '@/lib/talent-signature';

/*
  配音員簽名檔(Wing 2026-08-09:簽名上傳一次存檔,之後請款勾「使用已存簽名檔」
  即可由系統直接開立已簽名發票,不必每次列印→簽名→掃描→上傳)。

  存私有 invoices 桶 `signature/{talentId}/{ts}.{ext}`;不加 DB 欄位 —— 以
  「該前綴下最新檔案」為現行簽名(檔名帶時間戳,重傳即換新,免 migration)。

  GET  → { exists, url }  現行簽名檔的 5 分鐘簽名網址(給頁面預覽)
  POST { fileName } → { path, token }  一次性簽名上傳網址(前端 uploadToSignedUrl)
*/

const BUCKET = SIGNATURE_BUCKET;
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp'];

export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talentId = (r.talent as { id: string }).id;
  const path = await latestSignaturePath(r.db, talentId);
  if (!path) return NextResponse.json({ exists: false });
  const { data } = await r.db.storage.from(BUCKET).createSignedUrl(path, 300);
  return NextResponse.json({ exists: true, url: data?.signedUrl || null });
}

export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talentId = (r.talent as { id: string }).id;

  let body: { fileName?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const ext = ((body.fileName || '').split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: '簽名檔請用 PNG / JPG / WEBP 圖檔。' }, { status: 400 });
  }
  const path = `signature/${talentId}/${Date.now()}.${ext}`;
  const { data, error } = await r.db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'upload prep failed' }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token });
}
