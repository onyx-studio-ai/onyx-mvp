import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  POST /api/admin/casting/clone — duplicate a casting brief as a fresh REVIEWING copy
  (lands back in 客戶請求, re-editable, re-publishable). Use when the client changes
  the script/roles and needs fresh auditions: the original case + its auditions stay
  untouched as a record; the clone starts clean (no quotes, no award).
*/
export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let b: { briefId?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const briefId = String(b.briefId || '').trim();
  if (!briefId) return NextResponse.json({ error: 'missing briefId' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: orig } = await db.from('marketplace_briefs').select('*').eq('id', briefId).maybeSingle();
  if (!orig) return NextResponse.json({ error: '找不到原案件' }, { status: 404 });

  // Strip identity / lifecycle columns so the DB mints a fresh row; copy everything
  // else. New copy is a reviewing draft with no award (auditions are NOT copied).
  const o = orig as Record<string, unknown>;
  delete o.id; delete o.brief_number; delete o.created_at; delete o.updated_at; delete o.awarded_quote_id;
  o.status = 'reviewing';
  o.title = `${String(orig.title || orig.content_type || '配音案')}（複製）`.slice(0, 200);

  const { data: created, error } = await db.from('marketplace_briefs').insert(o).select('id, brief_number, client_email').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Where it shows: client cases → 客戶請求; platform (casting@) → 案件·發案 (reviewing).
  const toInbox = created.client_email && created.client_email !== 'casting@onyxstudios.ai';
  return NextResponse.json({ ok: true, id: created.id, brief_number: created.brief_number, toInbox });
}
