import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { lineConfigured, lineOaUrl } from '@/lib/line';

/*
  配音員端 LINE 綁定(與 /api/talent/telegram 同款)。
    GET    → { linked, configured, oaUrl, code } — code 是 6 碼綁定碼,
             配音員加官方帳號好友後把碼傳進聊天室,webhook 完成配對。
    DELETE → 解除綁定。
  (需 migration:talents.line_user_id / line_link_token)
*/

// 6 碼大寫英數,避開易混字(0/O、1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function mintCode(): string {
  const buf = randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, line_user_id, line_link_token');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { id: string; line_user_id?: string | null; line_link_token?: string | null };
  let code = t.line_link_token || '';
  if (!code && !t.line_user_id) {
    code = mintCode();
    await r.db.from('talents').update({ line_link_token: code }).eq('id', t.id);
  }
  return NextResponse.json({
    linked: !!t.line_user_id,
    configured: lineConfigured(),
    oaUrl: lineOaUrl(),
    code: t.line_user_id ? null : code,
  });
}

export async function DELETE(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { id: string };
  await r.db.from('talents').update({ line_user_id: null, line_link_token: null }).eq('id', t.id);
  return NextResponse.json({ ok: true });
}
