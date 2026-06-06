import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { AdminRole } from '../_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_CODE = process.env.ADMIN_CODE || '';
const PRODUCTION_CODE = process.env.PRODUCTION_CODE || '';
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

/**
 * Create a role-aware session token.
 *
 * Format: `<role>.<timestamp>.<hmac(role.timestamp)>`
 *
 * Including the role in the signed payload prevents tampering — a
 * production-role user can't promote themselves to admin by editing
 * the cookie because the signature would no longer match.
 */
function createSessionToken(role: AdminRole): string {
  if (!SESSION_SECRET) {
    throw new Error('Admin session secret is not configured');
  }
  const timestamp = Date.now().toString();
  const payload = `${role}.${timestamp}`;
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${role}.${timestamp}.${signature}`;
}

/**
 * Verify a session token (supports both new role-aware and legacy
 * formats) and return the embedded role.
 */
function verifyAndParseSession(token: string): AdminRole | null {
  const parts = token.split('.');

  let role: AdminRole;
  let timestamp: string;
  let signature: string;
  let payload: string;

  if (parts.length === 3) {
    const parsedRole = parts[0];
    if (parsedRole !== 'admin' && parsedRole !== 'production') return null;
    role = parsedRole;
    timestamp = parts[1];
    signature = parts[2];
    payload = `${role}.${timestamp}`;
  } else if (parts.length === 2) {
    role = 'admin';
    timestamp = parts[0];
    signature = parts[1];
    payload = timestamp;
  } else {
    return null;
  }

  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  if (signature !== expected) return null;

  const age = Date.now() - parseInt(timestamp, 10);
  if (!Number.isFinite(age) || age < 0 || age >= SESSION_MAX_AGE * 1000) return null;

  return role;
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
  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const role = verifyAndParseSession(sessionCookie);
  if (!role) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, role });
}

export async function POST(request: NextRequest) {
  try {
    const { code, token } = await request.json();

    // Supabase token login (admin@onyxstudios.ai allowlist) — always
    // gets 'admin' role.
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
      const sessionToken = createSessionToken('admin');
      const response = NextResponse.json({ success: true, method: 'supabase', role: 'admin' });
      return setSessionCookie(response, sessionToken);
    }

    // Code-based login — determine role from which code matches.
    if (code) {
      if (!ADMIN_CODE && !PRODUCTION_CODE) {
        return NextResponse.json({ error: 'Admin code not configured' }, { status: 500 });
      }

      // Admin code → admin role (full access)
      if (ADMIN_CODE && code === ADMIN_CODE) {
        const sessionToken = createSessionToken('admin');
        const response = NextResponse.json({ success: true, method: 'code', role: 'admin' });
        return setSessionCookie(response, sessionToken);
      }

      // Production code → production role (restricted access, only
      // orders / inquiries / applications / talents)
      if (PRODUCTION_CODE && code === PRODUCTION_CODE) {
        const sessionToken = createSessionToken('production');
        const response = NextResponse.json({ success: true, method: 'code', role: 'production' });
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
