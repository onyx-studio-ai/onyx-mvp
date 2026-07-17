import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { lineConfigured, lineOaUrl } from '@/lib/line';

/*
  客戶端 LINE 綁定(與 /api/talent/line 同款,但身分=登入客戶的 email,
  存 line_email_bindings)。綁定後,所有寄到這個 email 的平台通知信,
  會同步推一則提醒到 LINE(lib/mail.ts 的鏡像)。
    GET    → { linked, configured, oaUrl, code }
    DELETE → 解除綁定。
  (需 migration:line_email_bindings 表)
*/

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function mintCode(): string {
  const buf = randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

async function callerEmail(request: NextRequest): Promise<string | null> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const db = getSupabaseServiceClient();
  const { data, error } = await db.auth.getUser(token);
  const email = data?.user?.email;
  return error || !email ? null : email.toLowerCase();
}

export async function GET(request: NextRequest) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const db = getSupabaseServiceClient();
  try {
    const { data: row } = await db.from('line_email_bindings').select('line_user_id, link_token').eq('email', email).maybeSingle();
    let code = row?.link_token || '';
    if (!row?.line_user_id && !code) {
      code = mintCode();
      await db.from('line_email_bindings').upsert({ email, link_token: code }, { onConflict: 'email' });
    }
    return NextResponse.json({
      linked: !!row?.line_user_id,
      configured: lineConfigured(),
      oaUrl: lineOaUrl(),
      code: row?.line_user_id ? null : code,
    });
  } catch {
    return NextResponse.json({ linked: false, configured: false, oaUrl: null, code: null, unavailable: true });
  }
}

export async function DELETE(request: NextRequest) {
  const email = await callerEmail(request);
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const db = getSupabaseServiceClient();
  await db.from('line_email_bindings').delete().eq('email', email);
  return NextResponse.json({ ok: true });
}
