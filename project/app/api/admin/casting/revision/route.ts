import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { sendEmail } from '@/lib/mail';
import { plainNoticeEmail } from '@/lib/mail-templates';
import { notifyTalentLine } from '@/lib/line';
import { notifyTalentTelegram } from '@/lib/telegram';

/*
  客戶修改需求(女王百貨場景,2026-07-20 Wing):客戶對已交付的單提修改——
  評語+參考檔(音檔/文件,客戶給的修改指示)掛在單上,單退回 in_production,
  配音員在單卡看到「客戶修改需求」區+檔案下載,重新上傳交付(versions 天然支援多版)。
  POST { order_id, note, files: [{name,url}] }
*/
export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const db = getSupabaseServiceClient();
  let b: { order_id?: string; note?: string; files?: { name?: string; url?: string }[] };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const orderId = String(b.order_id || '');
  const note = String(b.note || '').trim().slice(0, 2000);
  const files = (Array.isArray(b.files) ? b.files : []).slice(0, 10)
    .map((f) => ({ name: String(f?.name || '檔案').slice(0, 120), url: String(f?.url || '') }))
    .filter((f) => f.url);
  if (!orderId || (!note && !files.length)) return NextResponse.json({ error: 'order_id 與(評語或檔案)必填' }, { status: 400 });

  const { data: order, error } = await db.from('voice_orders')
    .update({
      revision_note: note || null,
      revision_files: files,
      status: 'in_production',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('id, order_number, role_name, project_name, talent_id, revision_count')
    .single();
  if (error || !order) return NextResponse.json({ error: error?.message || 'not found' }, { status: 500 });
  await db.from('voice_orders').update({ revision_count: (order.revision_count || 0) + 1 }).eq('id', orderId);

  // 通知配音員(三路,best-effort)
  try {
    const { data: t } = await db.from('talents').select('name, email').eq('id', order.talent_id).maybeSingle();
    const title = `${order.project_name || '配音案'}${order.role_name ? ' · ' + order.role_name : ''}`;
    const msg = `【${title}】客戶提出修改需求:${note ? note.slice(0, 150) : '請見單卡修改說明'}${files.length ? `(附 ${files.length} 個參考檔)` : ''}。請至後台查看並重新上傳。`;
    const email = String(t?.email || '');
    if (email && !email.endsWith('@invite.onyxstudios.ai')) {
      const mail = plainNoticeEmail({
        subject: `修改需求 — ${title}`, headline: '客戶提出修改', sub: title, cardTitle: '修改說明',
        paragraphs: [`${t?.name ? t.name + ' ' : ''}您好,客戶對您交付的內容提出修改需求:`],
        quote: note || '(請至後台單卡查看參考檔)',
        ctaText: '前往查看與重新上傳', ctaUrl: 'https://www.onyxstudios.ai/zh-TW/talent/opportunities',
        footnote: files.length ? `客戶附了 ${files.length} 個參考檔(修改指示音檔/文件),請於單卡下載。` : undefined,
      });
      sendEmail({ category: 'PRODUCTION', to: email, subject: mail.subject, html: mail.html }).catch(() => {});
    }
    notifyTalentLine(db, String(order.talent_id), msg);
    notifyTalentTelegram(db, String(order.talent_id), msg);
  } catch { /* best-effort */ }
  return NextResponse.json({ ok: true });
}
