import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  Admin-only writes for audio_showcases (service_role, requireAdmin gate).

  背景:/admin/showcases 頁原本用前端 anon client 直接寫這張表(admin 登入是應用層
  cookie,對 DB 而言是 anon),等於要 anon INSERT/UPDATE 權限,任何人可拿公開 anon key
  塗改首頁展示。改走這支後端 API 後,收緊 RLS(移除 anon 寫入、保留公開 SELECT)。

  只處理「文字 / 欄位」寫入。音檔實體仍由前端上傳到 showcases 儲存桶(另一套 policy)。

  action:
    - 'upsert'  依 (section, slot_key) 建立或更新一個 slot
    - 'delete'  依 id 刪除(目前 UI 未用,保留完整 CRUD)
*/

type UpsertBody = {
  action?: 'upsert' | 'delete';
  id?: string;
  section?: string;
  slot_key?: string;
  audio_url?: string | null;
  label?: string | null;
  subtitle?: string | null;
  description?: string | null;
  image_url?: string | null;
  tags?: string[];
  sort_order?: number;
};

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: UpsertBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = body.action || 'upsert';

  try {
    const db = getSupabaseServiceClient();

    if (action === 'delete') {
      if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const { error } = await db.from('audio_showcases').delete().eq('id', body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // upsert
    const section = String(body.section || '').trim();
    const slotKey = String(body.slot_key || '').trim();
    if (!section || !slotKey) {
      return NextResponse.json({ error: 'section and slot_key are required' }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      section,
      slot_key: slotKey,
      audio_url: body.audio_url || null,
      label: body.label || null,
      subtitle: body.subtitle || null,
      description: body.description || null,
      image_url: body.image_url || null,
      tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t)).filter(Boolean) : [],
      updated_at: new Date().toISOString(),
    };
    // sort_order:只有明確帶數字才寫(music_library 清單需要排序;
    // 固定 slot 區塊不傳,交給 DB 預設/既有值)。
    if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
      payload.sort_order = body.sort_order;
    }

    const { data, error } = await db
      .from('audio_showcases')
      .upsert(payload, { onConflict: 'section,slot_key' })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ showcase: data });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/showcases');
  }
}
