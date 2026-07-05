import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  Admin-only writes for vibes (service_role, requireAdmin gate).

  背景同 audio_showcases:/admin/vibes 原本前端 anon client 直接 insert/update/delete,
  等於開 anon 寫入,任何人可拿公開 anon key 塗改音樂目錄。改走此 API 後收緊 RLS
  (移除 anon 寫入、保留公開 SELECT 給 VibesGrid)。音檔 / 封面仍走 showcases 儲存桶上傳。

  action:
    - 'create'  新增一筆
    - 'update'  依 id 更新
    - 'delete'  依 id 刪除
*/

type VibeBody = {
  action?: 'create' | 'update' | 'delete';
  id?: string;
  title?: string;
  genre?: string;
  description?: string;
  image_url?: string;
  audio_url?: string;
};

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: VibeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = body.action || 'create';

  try {
    const db = getSupabaseServiceClient();

    if (action === 'delete') {
      if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const { error } = await db.from('vibes').delete().eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const title = String(body.title || '').trim();
    const genre = String(body.genre || '').trim();
    if (!title || !genre) {
      return NextResponse.json({ error: 'title and genre are required' }, { status: 400 });
    }
    // image_url / audio_url NOT NULL in schema — default to '' so a metadata-only
    // save doesn't 500 on the DB constraint.
    const payload = {
      title,
      genre,
      description: body.description || '',
      image_url: body.image_url || '',
      audio_url: body.audio_url || '',
    };

    if (action === 'update') {
      if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const { data, error } = await db.from('vibes').update(payload).eq('id', body.id).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ vibe: data });
    }

    const { data, error } = await db.from('vibes').insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vibe: data });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/vibes');
  }
}
