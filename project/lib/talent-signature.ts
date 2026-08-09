import type { SupabaseClient } from '@supabase/supabase-js';

/*
  配音員簽名檔共用邏輯:存私有 invoices 桶 `signature/{talentId}/{ts}.{ext}`,
  不加 DB 欄位 —— 以「該前綴下最新檔案」為現行簽名(檔名帶時間戳,重傳即換新)。
*/
export const SIGNATURE_BUCKET = 'invoices';

// 該配音員現行簽名檔路徑(prefix 下按檔名時間戳取最新);沒有 → null。
export async function latestSignaturePath(db: SupabaseClient, talentId: string): Promise<string | null> {
  const { data } = await db.storage.from(SIGNATURE_BUCKET).list(`signature/${talentId}`, { limit: 1, sortBy: { column: 'name', order: 'desc' } });
  return data?.[0] ? `signature/${talentId}/${data[0].name}` : null;
}

// 下載簽名檔轉 data URI(嵌進發票 HTML 用);失敗 → null。
export async function signatureDataUri(db: SupabaseClient, talentId: string): Promise<string | null> {
  const path = await latestSignaturePath(db, talentId);
  if (!path) return null;
  const { data } = await db.storage.from(SIGNATURE_BUCKET).download(path);
  if (!data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  const ext = (path.split('.').pop() || 'png').toLowerCase();
  const mime = ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}
