import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

export type AdminRole = 'admin' | 'production';

/**
 * Verify the session token and return the embedded role.
 *
 * Token format: `<role>.<timestamp>.<signature>`
 *
 * Legacy format (`<timestamp>.<signature>`, no role) is treated as
 * 'admin' for backward compatibility with sessions issued before the
 * production-role split was introduced.
 */
function verifyAndParseSession(token: string, secret: string): AdminRole | null {
  const parts = token.split('.');

  let role: AdminRole;
  let timestamp: string;
  let signature: string;

  if (parts.length === 3) {
    const parsedRole = parts[0];
    if (parsedRole !== 'admin' && parsedRole !== 'production') return null;
    role = parsedRole;
    timestamp = parts[1];
    signature = parts[2];
  } else if (parts.length === 2) {
    // legacy: no role embedded → treat as admin
    role = 'admin';
    timestamp = parts[0];
    signature = parts[1];
  } else {
    return null;
  }

  if (!timestamp || !signature) return null;

  // Signature is computed over the role-prefixed payload (or just the
  // timestamp for legacy tokens) so changing role can't be done by
  // editing the cookie.
  const payload = parts.length === 3 ? `${role}.${timestamp}` : timestamp;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (signature.length !== expected.length) return null;

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  const issuedAt = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(issuedAt)) return null;

  const ageMs = Date.now() - issuedAt;
  if (ageMs < 0 || ageMs >= SESSION_MAX_AGE_SECONDS * 1000) return null;

  return role;
}

/**
 * Allow any authenticated backend user (admin OR production). Use this
 * for endpoints both roles legitimately need (e.g., reading inquiries,
 * applications, talents).
 *
 * Returns NextResponse on rejection, or null on success.
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const sessionSecret = process.env.ADMIN_CODE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sessionSecret) {
    return NextResponse.json({ error: 'Admin session is not configured' }, { status: 500 });
  }

  const session = request.cookies.get('onyx_admin_session')?.value;
  if (!session || !verifyAndParseSession(session, sessionSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

/**
 * Restrict an endpoint to **admin role only** (production-team users
 * are rejected). Use this for sensitive endpoints: revenue stats,
 * payouts/earnings, user management, billing.
 */
export function requireAdminOnly(request: NextRequest): NextResponse | null {
  const sessionSecret = process.env.ADMIN_CODE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sessionSecret) {
    return NextResponse.json({ error: 'Admin session is not configured' }, { status: 500 });
  }

  const session = request.cookies.get('onyx_admin_session')?.value;
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = verifyAndParseSession(session, sessionSecret);
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 });
  }

  return null;
}

/**
 * Return the session role for use in the layout sidebar to filter
 * navigation items. Returns null if no valid session.
 */
export function getSessionRole(request: NextRequest): AdminRole | null {
  const sessionSecret = process.env.ADMIN_CODE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sessionSecret) return null;

  const session = request.cookies.get('onyx_admin_session')?.value;
  if (!session) return null;

  return verifyAndParseSession(session, sessionSecret);
}
