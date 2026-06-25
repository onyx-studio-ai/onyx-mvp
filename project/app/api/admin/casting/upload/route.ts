import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  POST /api/admin/casting/upload — host a reference material on our `casting`
  bucket. Two modes:
    { fileName }  → returns a signed upload URL (client uploads the file).
    { fetchUrl }  → server downloads a DIRECT file URL and re-hosts it (so a
                    client's link lives on our platform, can't expire). Only
                    direct file URLs work — Drive/WeTransfer (auth/redirect)
                    won't; those should be stored as a plain reference_link.
  Returns { publicUrl } (fetch mode) or { path, token, publicUrl } (upload mode).
*/
const BUCKET = 'casting';
const MAX_FETCH_BYTES = 60 * 1024 * 1024; // 60 MB cap for auto-rehost

function publicUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let b: { fileName?: string; fetchUrl?: string };
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const db = getSupabaseServiceClient();

  // ── mode 2: fetch a direct URL and re-host ────────────────────────────────
  if (b.fetchUrl) {
    let url: URL;
    try {
      url = new URL(b.fetchUrl);
    } catch {
      return NextResponse.json({ error: '連結格式不正確' }, { status: 400 });
    }
    if (!/^https?:$/.test(url.protocol)) return NextResponse.json({ error: '只接受 http(s) 連結' }, { status: 400 });
    try {
      const res = await fetch(url.toString(), { redirect: 'follow' });
      if (!res.ok) return NextResponse.json({ error: `抓取失敗 (${res.status}) — 這個連結可能需要登入,請改用「貼連結」` }, { status: 400 });
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_FETCH_BYTES) return NextResponse.json({ error: '檔案過大 (>60MB)' }, { status: 400 });
      const ct = res.headers.get('content-type') || 'application/octet-stream';
      const ext = (url.pathname.split('.').pop() || 'bin').toLowerCase().slice(0, 8).replace(/[^a-z0-9]/g, '') || 'bin';
      const path = `reference/${Date.now()}_${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ publicUrl: publicUrl(path), name: url.pathname.split('/').pop() || 'reference' });
    } catch {
      return NextResponse.json({ error: '抓取失敗 — 連結可能無法直接下載,請改用「貼連結」' }, { status: 400 });
    }
  }

  // ── mode 1: signed upload URL ─────────────────────────────────────────────
  const ext = ((b.fileName || '').split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `reference/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not prepare upload' }, { status: 500 });
  return NextResponse.json({ path: data.path, token: data.token, publicUrl: publicUrl(data.path) });
}
