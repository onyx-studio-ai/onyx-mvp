import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const [{ data: voiceOrders }, { data: musicOrders }] = await Promise.all([
      supabase.from('voice_orders').select('id, email, price, status, payment_status, created_at, paid_at, voice_selection, tier'),
      supabase.from('music_orders').select('id, email, price, status, payment_status, created_at, paid_at, vibe, tier'),
    ]);

    return NextResponse.json({
      voiceOrders: voiceOrders || [],
      musicOrders: musicOrders || [],
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
