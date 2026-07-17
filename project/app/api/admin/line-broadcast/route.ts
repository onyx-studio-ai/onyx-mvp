import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { multicastLine, lineConfigured } from '@/lib/line';
import { sendTelegram } from '@/lib/telegram';

/*
  後台訊息群發(Wing:推廣文案直接在後台貼上,一鍵發給全部,分客戶/配音員)。
  對象=綁定過 LINE 或 Telegram 的人;每人只發一次:有 LINE 推 LINE,
  只綁 Telegram 的推 Telegram。不寄 email(群發是即時訊息,不是信)。
  GET  → { talents, clients } 可觸及人數(LINE+Telegram 聯集)
  POST { audience, text } → 發送,回 { targeted, sentLine, sentTelegram }。
  ⚠ LINE 每個收到的人算 1 則推播額度(輕用量 200 則/月);Telegram 免費。
*/

export const runtime = 'nodejs';
export const maxDuration = 60;

type Target = { line?: string | null; tg?: string | null };
async function gatherTargets(audience: string): Promise<{ lineIds: string[]; tgIds: string[] }> {
  const db = getSupabaseServiceClient();
  const rows: Target[] = [];
  if (audience === 'talents' || audience === 'both') {
    const { data } = await db.from('talents').select('line_user_id, telegram_chat_id')
      .or('line_user_id.not.is.null,telegram_chat_id.not.is.null');
    for (const r of data || []) rows.push({ line: r.line_user_id as string | null, tg: r.telegram_chat_id as string | null });
  }
  if (audience === 'clients' || audience === 'both') {
    const { data } = await db.from('line_email_bindings').select('line_user_id, telegram_chat_id')
      .or('line_user_id.not.is.null,telegram_chat_id.not.is.null');
    for (const r of data || []) rows.push({ line: r.line_user_id as string | null, tg: r.telegram_chat_id as string | null });
  }
  // 每人一則:有 LINE 用 LINE,否則 Telegram
  const lineIds = [...new Set(rows.filter((r) => r.line).map((r) => r.line as string))];
  const tgIds = [...new Set(rows.filter((r) => !r.line && r.tg).map((r) => r.tg as string))];
  return { lineIds, tgIds };
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const [t, c] = await Promise.all([gatherTargets('talents'), gatherTargets('clients')]);
  return NextResponse.json({
    configured: lineConfigured() || !!process.env.TELEGRAM_BOT_TOKEN,
    talents: t.lineIds.length + t.tgIds.length,
    clients: c.lineIds.length + c.tgIds.length,
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let b: { audience?: string; text?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const audience = ['talents', 'clients', 'both'].includes(String(b.audience)) ? String(b.audience) : '';
  const text = String(b.text || '').trim();
  if (!audience || !text) return NextResponse.json({ error: '請選對象並輸入文案' }, { status: 400 });
  if (text.length > 4900) return NextResponse.json({ error: '文案太長(上限 4900 字)' }, { status: 400 });
  const { lineIds, tgIds } = await gatherTargets(audience);
  if (!lineIds.length && !tgIds.length) return NextResponse.json({ error: '這個對象目前沒有任何人綁定 LINE / Telegram' }, { status: 404 });
  const sentLine = await multicastLine(lineIds, text);
  let sentTelegram = 0;
  for (const id of tgIds) { await sendTelegram(id, text); sentTelegram++; }
  return NextResponse.json({ ok: true, targeted: lineIds.length + tgIds.length, sent: sentLine + sentTelegram, sentLine, sentTelegram });
}
