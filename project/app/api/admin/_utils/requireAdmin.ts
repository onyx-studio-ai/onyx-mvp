import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

function verifySessionToken(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  if (!timestamp || !signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');
  if (signature.length !== expected.length) return false;

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return false;

  const issuedAt = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(issuedAt)) return false;

  const ageMs = Date.now() - issuedAt;
  return ageMs >= 0 && ageMs < SESSION_MAX_AGE_SECONDS * 1000;
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  const sessionSecret = process.env.ADMIN_CODE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sessionSecret) {
    return NextResponse.json({ error: 'Admin session is not configured' }, { status: 500 });
  }

  const session = request.cookies.get('onyx_admin_session')?.value;
  if (!session || !verifySessionToken(session, sessionSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
