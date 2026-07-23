import { NextRequest, NextResponse } from 'next/server';
import { resolveCaller, threadRole } from '@/lib/marketplace-auth';
import { sendEmail } from '@/lib/mail';
import { newMessageEmail } from '@/lib/mail-templates';
import { sanitizeMessage } from '@/lib/message-filter';
import { notifyTalentTelegram } from '@/lib/telegram';
import { isPlatformCase } from '@/lib/casting';

/*
  Thread messages for a (brief, talent) pairing.
  GET  ?brief_id=&talent_id=  → messages, if the caller is a party.
  POST { brief_id, talent_id, body } → send as the caller's role; notify the
       counterpart by email (best-effort). Onyx can read every thread via the
       admin view (separate route).
*/

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';

export async function GET(request: NextRequest) {
  const c = await resolveCaller(request);
  if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const briefId = searchParams.get('brief_id') || '';
  const talentId = searchParams.get('talent_id') || '';
  if (!briefId || !talentId) return NextResponse.json({ error: 'brief_id and talent_id are required' }, { status: 400 });

  try {
    // 'direct' = 平台直訊(Onyx ↔ 配音員,不掛案件;brief_id=null)。權限=本人。
    const isDirect = briefId === 'direct';
    const role = isDirect
      ? (c.talentId === talentId ? ('talent' as const) : null)
      : await threadRole(c, briefId, talentId);
    if (!role) return NextResponse.json({ error: 'Not a participant in this thread' }, { status: 403 });

    let qy = c.db
      .from('marketplace_messages')
      .select('id, sender_type, sender_name, body, attachments, created_at')
      .eq('talent_id', talentId);
    qy = isDirect ? qy.is('brief_id', null) : qy.eq('brief_id', briefId);
    const { data: messages } = await qy
      .order('created_at', { ascending: true })
      .limit(500);

    // 附件只開放 talent 端看(後台上傳給配音員的圖/文件);客戶端還沒開放 → 剝掉。
    const out = (messages || []).map((m) => role === 'client' ? { ...m, attachments: null } : m);
    return NextResponse.json({ role, messages: out });
  } catch {
    return NextResponse.json({ role: null, messages: [], unavailable: true });
  }
}

export async function POST(request: NextRequest) {
  const c = await resolveCaller(request);
  if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const { brief_id: briefId, talent_id: talentId, body: rawBody } = await request.json();
    const raw = String(rawBody || '').trim().slice(0, 4000);
    if (!briefId || !talentId) return NextResponse.json({ error: 'brief_id and talent_id are required' }, { status: 400 });
    if (!raw) return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });

    const isDirect = briefId === 'direct';
    const role = isDirect
      ? (c.talentId === talentId ? ('talent' as const) : null)
      : await threadRole(c, briefId, talentId);
    if (!role) return NextResponse.json({ error: 'Not a participant in this thread' }, { status: 403 });

    // Sender display name + the counterpart to notify.
    const { data: brief } = isDirect
      ? { data: null }
      : await c.db
          .from('marketplace_briefs')
          .select('brief_number, client_name, client_email, locale')
          .eq('id', briefId)
          .maybeSingle();
    const { data: talent } = await c.db.from('talents').select('name, email').eq('id', talentId).maybeSingle();
    // 平台自發案(對話對象是 Onyx 自己,如女王百貨的指派/補錄溝通);直訊對象也是 Onyx
    const isPlatformBrief = isDirect || isPlatformCase(brief?.client_email as string | null | undefined);

    // Block off-platform contact details outright (Wing: 即時擋下不送出 — no routing
    // around Onyx). The client + talent may only message once the job is awarded.
    // 平台案不擋 —— 對象是 Onyx,配音員留電話/LINE 給我們是正常溝通(謝千惠案)。
    if (!isPlatformBrief && sanitizeMessage(raw).redacted) {
      return NextResponse.json({ error: '訊息含聯絡方式(電話 / email / LINE / 微信 / 網址 等),平台不允許交換私下聯絡資料。請移除後再送出。' }, { status: 400 });
    }
    const body = raw;

    const senderName = role === 'talent' ? talent?.name || 'Talent' : brief?.client_name || 'Client';

    const { data: msg, error } = await c.db
      .from('marketplace_messages')
      .insert({ brief_id: isDirect ? null : briefId, talent_id: talentId, sender_type: role, sender_user_id: c.userId, sender_name: senderName, body })
      .select('id, sender_type, sender_name, body, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify the counterpart (best-effort, non-blocking, branded + localized).
    // 平台案的「客戶」= casting@onyxstudios.ai(識別值,沒人收)→ 改通知 ADMIN_EMAIL,
    // 不然配音員的回覆(交期調整等)Wing 永遠不知道。
    const to = role === 'talent'
      ? (isPlatformBrief ? (process.env.ADMIN_EMAIL || 'admin@onyxstudios.ai') : brief?.client_email)
      : talent?.email;
    if (to) {
      // 信裡直接放訊息全文(Wing 2026-07-20:收信人不用登入平台就知道內容)
      const note = newMessageEmail({ briefNumber: brief?.brief_number, url: `${SITE}/messages`, locale: brief?.locale, body, senderName });
      sendEmail({ category: 'PRODUCTION', to, subject: note.subject, html: note.html }).catch(() => {});
    }
    // The talent gets a Telegram ping too (client→talent messages only).
    if (role !== 'talent') notifyTalentTelegram(c.db, talentId, `💬 客戶在案件 ${brief?.brief_number || ''} 給您留言。${SITE}/talent/messages`);

    return NextResponse.json({ message: msg });
  } catch (err) {
    console.error('[marketplace/messages] POST error:', err);
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 });
  }
}
