import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SESSION_SECRET = process.env.ADMIN_CODE || process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback-secret';

function verifyAdminSession(request: NextRequest): boolean {
  const cookie = request.cookies.get('onyx_admin_session')?.value;
  if (!cookie) return false;
  const parts = cookie.split('.');
  if (parts.length !== 2) return false;
  const [timestamp, signature] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(timestamp).digest('hex');
  if (signature !== expected) return false;
  const age = Date.now() - parseInt(timestamp, 10);
  return age < 24 * 60 * 60 * 1000;
}

export async function GET(request: NextRequest) {
  if (!verifyAdminSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
