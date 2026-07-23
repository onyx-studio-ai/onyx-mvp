import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

/*
  社群發文媒體上傳 —— 把後台選的圖片/影片上傳到「公開」的 social-media bucket,
  回傳 public URL,給 FB /photos 的 url、IG /media 的 image_url/video_url 使用。

  為何必須先上到公開 URL:Meta Graph API 發圖/發影片時只吃「公開可訪問的 URL」,
  由 Facebook / Instagram 伺服器端自己去抓,不接受直接上傳二進位。
  詳見 migration 20260723140000_social_media_bucket.sql。

  authedFetch 不適用(這是 admin 頁,沿用 credentials:'include' 的 admin session),
  故用 requireAdmin 驗證。
*/

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKET = 'social-media';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// 前後端一致:允許的 MIME 與大小上限(和 bucket migration 對齊)
const MAX_BYTES = 209715200; // 200MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
]);

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** 依 MIME 推副檔名,讓 public URL 帶正確結尾(某些抓取端會看副檔名) */
function extForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    default:
      return 'bin';
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase 儲存設定缺失(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤(需 multipart/form-data)' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '未收到檔案' }, { status: 400 });
  }

  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: `不支援的檔案類型(${mime});僅支援 JPG/PNG/WEBP/GIF 圖片或 MP4/MOV 影片` },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `檔案過大(${(file.size / 1048576).toFixed(1)}MB),上限 200MB` },
      { status: 400 },
    );
  }

  const kind = mime.startsWith('video/') ? 'video' : 'image';
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}.${extForMime(mime)}`;

  try {
    const db = getServiceClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await db.storage.from(BUCKET).upload(path, buffer, {
      contentType: mime,
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ error: `上傳失敗:${error.message}` }, { status: 500 });
    }
    const publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ ok: true, publicUrl, kind });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `上傳發生錯誤:${msg}` }, { status: 500 });
  }
}
