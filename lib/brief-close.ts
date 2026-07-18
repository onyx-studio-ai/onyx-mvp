import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { plainNoticeEmail } from '@/lib/mail-templates';
import { notifyTalentTelegram } from '@/lib/telegram';
import { notifyTalentLine } from '@/lib/line';

/*
  結案一鍵通知(Wing 2026-07-18 拍板):案子結束時通知所有投遞者。
  對配音員的口徑永遠只有一種 ——「客戶已定案,這次未採用您的試音」。
  不管客戶選了我們的人、別家的人、還是取消,對沒中選的人都一樣;
  真實理由只存後台 close_reason,配音員不需要知道。
  兩條路都要走到這裡:後台手動關案(marketplace PATCH)+ 平台內採用轉單(to-order 全角色選完自動關)。
  通知 = 站內訊息 + 品牌信 + LINE/TG,全部 best-effort,絕不擋結案主流程。
*/
export async function notifyBriefClosed(
  db: SupabaseClient,
  briefId: string,
  opts: { excludeTalentIds?: string[] } = {},
): Promise<void> {
  try {
    const exclude = new Set(opts.excludeTalentIds || []);
    const [{ data: bf }, { data: qs }] = await Promise.all([
      db.from('marketplace_briefs').select('title, content_type').eq('id', briefId).maybeSingle(),
      db.from('marketplace_quotes').select('talent_id').eq('brief_id', briefId).in('status', ['submitted', 'shortlisted']),
    ]);
    const title = (bf?.title as string) || (bf?.content_type as string) || '配音案件';
    const reasonText = '客戶已定案,這次未採用您的試音。';
    const bodyText = `【${title}】結案通知:感謝您提交試音。${reasonText}未來有新案件上架,歡迎您隨時試音。— Onyx Studios 製作部`;
    const tids = [...new Set((qs || []).map((q) => q.talent_id as string).filter((t) => t && !exclude.has(t)))];
    if (!tids.length) return;
    const { data: ts } = await db.from('talents').select('id, name, email').in('id', tids);
    for (const t of ts || []) {
      await db.from('marketplace_messages').insert({ brief_id: briefId, talent_id: t.id, sender_type: 'admin', sender_name: 'Onyx', body: bodyText }).then(() => {}, () => {});
      const email = String(t.email || '');
      if (email && !email.endsWith('@invite.onyxstudios.ai')) {
        const note = plainNoticeEmail({
          subject: `結案通知 — ${title}`, headline: '結案通知', sub: title, cardTitle: '感謝您的試音',
          paragraphs: [`${t.name ? t.name + ' ' : ''}您好,`, `感謝您為「${title}」提交試音。${reasonText}`],
          footnote: '未來有新案件上架,歡迎您隨時試音。— Onyx Studios 製作部',
        });
        sendEmail({ category: 'PRODUCTION', to: email, subject: note.subject, html: note.html }).catch(() => {});
      }
      notifyTalentTelegram(db, t.id as string, `【${title}】結案通知:${reasonText}感謝您的試音,未來有新案件歡迎再來試音。`);
      notifyTalentLine(db, t.id as string, `【${title}】結案通知:${reasonText}感謝您的試音,未來有新案件歡迎再來試音。`);
    }
  } catch { /* 通知 best-effort */ }
}
