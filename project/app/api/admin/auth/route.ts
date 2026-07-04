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
 * 等長、常數時間比較 admin code。
 * crypto.timingSafeEqual 對長度不同的 buffer 會直接拋錯,所以先比長度
 * (長度不同 = 一定不相等,直接 false;長度本身不是機密)。空字串一律 false,
 * 避免未設定的 code 意外通過。
 */
function safeCodeEqual(input: string, secret: string): boolean {
  if (!secret || !input) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// IP 級失敗限流:同 IP 近 RATE_WINDOW_MS 內失敗 ≥ RATE_MAX_FAILS 次就擋。
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 分鐘
const RATE_MAX_FAILS = 10;

function clientIp(request: NextRequest): string {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}

// 回 true = 已超限、應擋。任何 DB 錯誤都「放行」(fail-open),不因限流表故障把正常登入鎖死。
async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const db = getAdminClient();
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count } = await db
      .from('admin_auth_attempts')
      .select('id', { head: true, count: 'exact' })
      .eq('ip', ip)
      .gte('created_at', since);
    return (count || 0) >= RATE_MAX_FAILS;
  } catch {
    return false;
  }
}

async function recordFailedAttempt(ip: string): Promise<void> {
  try {
    await getAdminClient().from('admin_auth_attempts').insert({ ip });
  } catch {
    /* 記錄失敗不影響回應 */
  }
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

  // Role-aware tokens only (`<role>.<timestamp>.<signature>`); legacy 2-part
  // tokens are no longer accepted — stale sessions must re-login.
  if (parts.length !== 3) return null;
  const parsedRole = parts[0];
  if (parsedRole !== 'admin' && parsedRole !== 'production') return null;
  const role: AdminRole = parsedRole;
  const timestamp = parts[1];
  const signature = parts[2];
  const payload = `${role}.${timestamp}`;

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

      // 暴力破解防護:同 IP 近 15 分鐘失敗過多就擋(在比對 code 之前先擋)。
      const ip = clientIp(request);
      if (await isRateLimited(ip)) {
        return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
      }

      // Admin code → admin role (full access)。用常數時間比較,避免時序側信道洩漏 code。
      if (safeCodeEqual(String(code), ADMIN_CODE)) {
        const sessionToken = createSessionToken('admin');
        const response = NextResponse.json({ success: true, method: 'code', role: 'admin' });
        return setSessionCookie(response, sessionToken);
      }

      // Production code → production role (restricted access, only
      // orders / inquiries / applications / talents)
      if (safeCodeEqual(String(code), PRODUCTION_CODE)) {
        const sessionToken = createSessionToken('production');
        const response = NextResponse.json({ success: true, method: 'code', role: 'production' });
        return setSessionCookie(response, sessionToken);
      }

      // 失敗才計入限流(成功不佔額度)。
      await recordFailedAttempt(ip);
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
