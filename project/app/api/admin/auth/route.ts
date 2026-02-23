import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_CODE = process.env.ADMIN_CODE || '';
const SESSION_SECRET = process.env.ADMIN_CODE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SESSION_MAX_AGE = 24 * 60 * 60;

const ADMIN_EMAILS = [
  'admin@onyxstudios.ai',
];

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function createSessionToken(): string {
  if (!SESSION_SECRET) {
    throw new Error('Admin session secret is not configured');
  }
  const timestamp = Date.now().toString();
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(timestamp).digest('hex');
  return `${timestamp}.${signature}`;
}

function verifySessionToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [timestamp, signature] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(timestamp).digest('hex');
  if (signature !== expected) return false;
  const age = Date.now() - parseInt(timestamp, 10);
  return age < SESSION_MAX_AGE * 1000;
}

function setSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set('onyx_admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('onyx_admin_session')?.value;
  if (!sessionCookie || !verifySessionToken(sessionCookie)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true });
}

export async function POST(request: NextRequest) {
  try {
    const { code, token } = await request.json();

    if (token) {
      const supabase = getAdminClient();
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      }
      const email = user.email?.toLowerCase() || '';
      if (!ADMIN_EMAILS.includes(email)) {
        return NextResponse.json({ error: 'Not an admin account' }, { status: 403 });
      }
      const sessionToken = createSessionToken();
      const response = NextResponse.json({ success: true, method: 'supabase' });
      return setSessionCookie(response, sessionToken);
    }

    if (code) {
      if (!ADMIN_CODE) {
        return NextResponse.json({ error: 'Admin code not configured' }, { status: 500 });
      }
      if (code === ADMIN_CODE) {
        const sessionToken = createSessionToken();
        const response = NextResponse.json({ success: true, method: 'code' });
        return setSessionCookie(response, sessionToken);
      }
      return NextResponse.json({ error: 'Invalid admin code' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Provide code or token' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('onyx_admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
