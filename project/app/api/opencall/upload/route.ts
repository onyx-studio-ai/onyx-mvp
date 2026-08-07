import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  公開徵集 demo 上傳(免登入):簽發一次性上傳 URL 到 casting bucket 的 opencall/ 路徑
  (沿用 script-upload 模式;bucket 不開匿名寫入,靠 service-role 簽名授權單次上傳)。
  只收音檔;檔名用亂數路徑,原始檔名可能含個資不入 URL。
*/
const BUCKET = 'casting';
const AUDIO_EXT = ['m4a', 'mp3', 'wav', 'aac', 'ogg', 'oga', 'opus', 'flac', 'amr', 'awb', 'mp4', 'm4r', '3gp', '3gpp', 'caf', 'aif', 'aiff', 'wma', 'webm', 'weba'];

export async function POST(request: NextRequest) {
  let body: { fileName?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const ext = ((body.fileName || '').split('.').pop() || '').toLowerCase();
  if (!ext || !AUDIO_EXT.includes(ext)) {
    return NextResponse.json({ error: '請上傳音訊檔(手機錄音的格式都可以)' }, { status: 400 });
  }
  const path = `opencall/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  try {
    const db = getSupabaseServiceClient();
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message || '無法準備上傳' }, { status: 500 });
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    return NextResponse.json({ path: data.path, token: data.token, publicUrl: `${base}/storage/v1/object/public/${BUCKET}/${data.path}` });
  } catch {
    return NextResponse.json({ error: '無法準備上傳' }, { status: 500 });
  }
}
