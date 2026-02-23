import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { email, action } = await request.json();

    if (!email || !action || !['ban', 'unban'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid email and action (ban/unban) required' },
        { status: 400 }
      );
    }

    const db = getAdminClient();

    const { data: usersData } = await db.auth.admin.listUsers();
    const targetUser = usersData?.users?.find(
      (u: { email?: string }) => u.email === email
    );

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (action === 'ban') {
      const { error } = await db.auth.admin.updateUserById(targetUser.id, {
        ban_duration: '876000h', // ~100 years
      });
      if (error) {
        console.error('[Admin Ban] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await db.auth.admin.updateUserById(targetUser.id, {
        ban_duration: 'none',
      });
      if (error) {
        console.error('[Admin Unban] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, action, email });
  } catch (err) {
    console.error('[Admin Users] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
