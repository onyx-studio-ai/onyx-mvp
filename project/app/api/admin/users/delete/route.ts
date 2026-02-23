import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const db = getAdminClient();

    const { data: usersData } = await db.auth.admin.listUsers();
    const targetUser = usersData?.users?.find(
      (u: { email?: string }) => u.email === email
    );

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found in auth' }, { status: 404 });
    }

    const { error } = await db.auth.admin.deleteUser(targetUser.id);
    if (error) {
      console.error('[Admin Delete User] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, email });
  } catch (err) {
    console.error('[Admin Delete User] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
