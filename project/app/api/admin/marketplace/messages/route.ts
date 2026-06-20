import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

/*
  Admin view into any marketplace thread (Onyx sees every conversation).
  GET  ?brief_id=&talent_id=  → all messages in that thread.
  POST { brief_id, talent_id, body } → post into the thread as 'admin' (Onyx).
*/

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  const briefId = searchParams.get('brief_id') || '';
  const talentId = searchParams.get('talent_id') || '';
  if (!briefId || !talentId) return NextResponse.json({ error: 'brief_id and talent_id are required' }, { status: 400 });
  try {
    const db = getSupabaseServiceClient();
    const { data } = await db
      .from('marketplace_messages')
      .select('id, sender_type, sender_name, body, created_at')
      .eq('brief_id', briefId)
      .eq('talent_id', talentId)
      .order('created_at', { ascending: true })
      .limit(500);
    return NextResponse.json({ messages: data || [] });
  } catch {
    return NextResponse.json({ messages: [], unavailable: true });
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = getSupabaseServiceClient();
    const { brief_id: briefId, talent_id: talentId, body: rawBody } = await request.json();
    const body = String(rawBody || '').trim().slice(0, 4000);
    if (!briefId || !talentId || !body) return NextResponse.json({ error: 'brief_id, talent_id and body are required' }, { status: 400 });
    const { data, error } = await db
      .from('marketplace_messages')
      .insert({ brief_id: briefId, talent_id: talentId, sender_type: 'admin', sender_name: 'Onyx', body })
      .select('id, sender_type, sender_name, body, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: data });
  } catch {
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  }
}
