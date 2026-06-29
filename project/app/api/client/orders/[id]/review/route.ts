import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { castingRevisionTalentEmail, castingApprovedTalentEmail } from '@/lib/mail-templates';
import { notifyTalentTelegram } from '@/lib/telegram';

/*
  POST /api/client/orders/[id]/review { action: 'approve' | 'revise', feedback? }

  The CLIENT approves the delivered recording or asks for changes. Runs server-side
  (service role) because:
    - browser/anon writes to voice_orders are RLS-blocked → the UI did nothing.
    - for a casting order the revision must reach the TALENT (talent_id), not the
      order email (which is the client). Talent identity stays server-side.

  Owner-gated to the order's email. Only meaningful while the order is 'delivered'.
*/
const SITE = 'https://www.onyxstudios.ai';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const db = getSupabaseServiceClient();
  const { data: userData, error: uErr } = await db.auth.getUser(token);
  const email = userData?.user?.email;
  if (uErr || !email) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  let body: { action?: string; feedback?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const action = body.action === 'approve' ? 'approve' : body.action === 'revise' ? 'revise' : null;
  if (!action) return NextResponse.json({ error: 'action must be approve or revise' }, { status: 400 });
  const feedback = String(body.feedback || '').slice(0, 2000).trim();
  if (action === 'revise' && !feedback) return NextResponse.json({ error: '請說明要修改的地方。' }, { status: 400 });

  const { data: order } = await db.from('voice_orders')
    .select('id, order_number, email, status, talent_id, project_name, use_case, download_url, revision_count, max_revisions')
    .eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (String(order.email || '').toLowerCase() !== email.toLowerCase()) return NextResponse.json({ error: 'Not your order' }, { status: 403 });
  if (order.status !== 'delivered') return NextResponse.json({ error: '此訂單目前不在審核階段。' }, { status: 400 });

  // Enforce the agreed revision cap server-side (UI hides the button, but a crafted
  // POST could bypass it). max_revisions >= 99 = unlimited.
  if (action === 'revise') {
    const maxRev = Number(order.max_revisions) || 0;
    const usedRev = Number(order.revision_count) || 0;
    if (maxRev > 0 && maxRev < 99 && usedRev >= maxRev) {
      return NextResponse.json({ error: '已達修改次數上限。' }, { status: 400 });
    }
  }

  // Ensure a version row exists so approve/revise have something to mark (legacy/
  // casting deliveries only set download_url). Create one from download_url if needed.
  const { data: versions } = await db.from('voice_order_versions')
    .select('id, version_number, status').eq('voice_order_id', id).order('version_number', { ascending: true });
  let latest = versions && versions.length ? versions[versions.length - 1] : null;
  if (!latest && order.download_url) {
    const { data: created } = await db.from('voice_order_versions').insert({
      voice_order_id: id, file_url: order.download_url, file_name: (order.download_url as string).split('/').pop()?.split('?')[0] || 'delivery',
      notes: '配音員交付', version_number: 1, status: 'pending_review',
    }).select('id, version_number, status').single();
    latest = created || null;
  }

  const title = (order.project_name as string) || (order.use_case as string) || (order.order_number as string) || '配音案件';

  if (action === 'approve') {
    if (latest) await db.from('voice_order_versions').update({ status: 'approved' }).eq('id', latest.id);
    // For a casting/real-person order the talent's delivered file IS the final file —
    // approving completes + closes it (the client downloads right away). Onyx-produced
    // orders (no talent) still go to awaiting_final for the team to prep deliverables.
    const isCasting = !!order.talent_id;
    const newStatus = isCasting ? 'completed' : 'awaiting_final';
    const upd: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
    if (isCasting && order.download_url) upd.download_url = order.download_url; // keep final file downloadable
    const { error } = await db.from('voice_orders').update(upd).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (order.talent_id) {
      const { data: talent } = await db.from('talents').select('name, email').eq('id', order.talent_id).maybeSingle();
      if (talent?.email) {
        const m = castingApprovedTalentEmail({ talentName: talent.name as string, title, url: `${SITE}/talent/opportunities`, locale: 'zh-TW' });
        sendEmail({ category: 'PRODUCTION', to: talent.email as string, subject: m.subject, html: m.html }).catch(() => {});
      }
      notifyTalentTelegram(db, order.talent_id, `✅ 客戶已驗收結案:${title}。感謝您的配音!`);
    }
    sendEmail({ category: 'PRODUCTION', to: 'produce@onyxstudios.ai', subject: `客戶已驗收 · ${order.order_number}`, html: `<p>Order ${order.order_number} approved by client → ${newStatus}.</p>` }).catch(() => {});
    return NextResponse.json({ ok: true, status: newStatus });
  }

  // revise
  if (latest) await db.from('voice_order_versions').update({ status: 'revision_requested', client_feedback: feedback }).eq('id', latest.id);
  const { error } = await db.from('voice_orders').update({
    status: 'in_production',
    revision_count: (Number(order.revision_count) || 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (order.talent_id) {
    const { data: talent } = await db.from('talents').select('name, email').eq('id', order.talent_id).maybeSingle();
    if (talent?.email) {
      const m = castingRevisionTalentEmail({ talentName: talent.name as string, title, feedback, url: `${SITE}/talent/opportunities`, locale: 'zh-TW' });
      sendEmail({ category: 'PRODUCTION', to: talent.email as string, subject: m.subject, html: m.html }).catch(() => {});
    }
    notifyTalentTelegram(db, order.talent_id, `🔧 客戶要求修改:${title}\n請到後台查看意見並重新交付。${SITE}/talent/opportunities`);
  }
  sendEmail({ category: 'PRODUCTION', to: 'produce@onyxstudios.ai', subject: `客戶要求修改 · ${order.order_number}`, html: `<p>Order ${order.order_number}: client requested changes.</p><p>${feedback.replace(/</g, '&lt;')}</p>` }).catch(() => {});

  return NextResponse.json({ ok: true, status: 'in_production' });
}
