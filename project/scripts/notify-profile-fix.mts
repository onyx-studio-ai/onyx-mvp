/*
  通知配音員:檔案漏搬 bug 已修復 + 個人化缺件清單(2026-08-17)。
  --preview  只寄樣張給 Wing(不動配音員)
  --send     正式寄給全部未上架者
*/
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../lib/mail';
import { plainNoticeEmail } from '../lib/mail-templates';

const SEND = process.argv.includes('--send');
const PREVIEW = process.argv.includes('--preview');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SITE = 'https://www.onyxstudios.ai';

type T = { id: string; name: string; email: string; headshot_url: string | null; demos: unknown[] | null; demo_urls: unknown[] | null; bio: string | null; is_active: boolean; application_id: string | null; languages: string[] | null };

// 語言判定:預設中文(台港配音員為主);只有明確全外語的才寄英文(2026-08-17 Wing:阿藍要中文)
const EN_ONLY = new Set(['claire@clairelindsay.com', 'margaret@margaretashley.com', 'joshgsan@gmail.com',
  'piorambo@gmail.com', 'wissuta.suksawat@gmail.com', 'chandel.aymar@gmail.com', 'elizabeth@elvo.online']);
const isZh = (t: T) => !EN_ONLY.has(String(t.email || '').toLowerCase());

function buildMail(t: T) {
  const zh = isZh(t);
  const nDemo = (t.demo_urls || []).length;
  const lacks: string[] = [];
  if (!t.headshot_url) lacks.push(zh ? '大頭照' : 'A profile photo');
  if (!(t.demos || []).length) {
    lacks.push(zh
      ? (nDemo ? `demo 分類 —— 您已上傳的 ${nDemo} 個 demo 只要標上類別即可,不用重傳` : 'demo 音檔')
      : (nDemo ? `Demo categories — your ${nDemo} uploaded demo${nDemo > 1 ? 's' : ''} only need tagging, no re-upload` : 'Demo audio'));
  }
  if (!String(t.bio || '').trim()) lacks.push(zh ? '自我介紹' : 'A short bio');

  // 一個元素 = 信裡一段(模板會逐段渲染;內文純文字,不要 markdown 星號)
  const paragraphs = zh ? [
    `${t.name} 您好,`,
    '先跟您說聲抱歉 —— 我們發現平台有個問題:您申請時填的聲線特質、專長類別、年齡感與錄音設備,在建立配音員檔案時沒有正確帶過去,所以您登入後看到的檔案是不完整的。這是我們系統的疏漏,不是您沒填。',
    '這個問題已經修復,您當初填過的資料都補回檔案了,不需要重填。',
    ...(lacks.length
      ? ['如果您希望個人頁在平台「公開上架」(客戶可以直接搜尋、試聽找到您),您的檔案還差以下項目:']
      : ['您的資料已經齊全,我們會盡快完成上架審核,不需要您再做任何事。']),
  ] : [
    `Hi ${t.name},`,
    'First, an apology — we found a bug on our side: the voice traits, specialties, voice age and equipment you filled in on your application were not carried over to your talent profile, so it looked empty when you logged in. That was our system, not you.',
    'It is fixed now, and everything you originally submitted has been restored to your profile. Nothing needs to be re-entered.',
    ...(lacks.length
      ? ['If you would like your profile listed publicly (so clients can search, listen and find you directly), these items are still missing:']
      : ['Your profile is complete — we will finish the listing review shortly, nothing further is needed from you.']),
  ];

  return plainNoticeEmail({
    subject: zh ? '您的 Onyx 個人檔案已修復(附待補清單)' : 'Your Onyx profile has been restored',
    headline: zh ? '個人檔案已修復' : 'Profile restored',
    sub: zh ? 'Onyx Studios 配音員後台' : 'Onyx Studios talent portal',
    cardTitle: zh ? '說明' : 'Details',
    paragraphs,
    // 待補清單放引用區塊(有邊框、獨立一塊,不會跟內文混在一起)
    quote: lacks.length ? lacks.map((l) => `・${l}`).join('\n') : undefined,
    ctaText: zh ? '前往我的檔案' : 'Go to my profile',
    ctaUrl: `${SITE}${zh ? '/zh-TW' : ''}/talent`,
    footnote: zh
      ? '提醒:上架與否不影響接案 —— 就算不上架,您一樣收得到案件邀請、可以試音接單、在後台請款。上架只是讓您的個人頁出現在公開名冊,客戶能主動找到您,屬於選配。造成困擾很不好意思,有問題直接回信告訴我們。— Onyx Studios 配音團隊'
      : 'Note: listing is optional and does not affect getting work — you still receive invitations, audition, take jobs and invoice through the platform either way. Sorry for the confusion — just reply if anything is unclear. — Onyx Studios',
  });
}

const { data: all } = await db.from('talents').select('id, name, email, headshot_url, demos, demo_urls, bio, is_active, application_id, languages');
const targets = ((all || []) as T[]).filter((t) => t.application_id && !t.is_active && t.email && !String(t.email).endsWith('@invite.onyxstudios.ai'));

if (PREVIEW) {
  // 各挑一個代表情況寄給 Wing 自己看
  const zhFull = targets.find((t) => isZh(t) && !t.headshot_url && !(t.demos || []).length && (t.demo_urls || []).length);
  const enOne = targets.find((t) => !isZh(t));
  const ready = targets.find((t) => t.headshot_url && (t.demos || []).length);
  for (const [label, t] of [['中文-缺頭像+demo分類+介紹', zhFull], ['英文版', enOne], ['資料齊', ready]] as [string, T | undefined][]) {
    if (!t) { console.log(`(${label} 無樣本)`); continue; }
    const m = buildMail(t);
    await sendEmail({ category: 'HELLO', to: 'onyxstudios.ai@gmail.com', subject: `[樣張:${label} · ${t.name}] ${m.subject}`, html: m.html });
    console.log(`✓ 樣張已寄:${label}(${t.name})`);
  }
  process.exit(0);
}

console.log(`收件人 ${targets.length} 位`);
if (!SEND) { console.log('(乾跑,加 --send 才寄)'); process.exit(0); }
let ok = 0;
for (const t of targets) {
  const m = buildMail(t);
  try { await sendEmail({ category: 'HELLO', to: t.email, subject: m.subject, html: m.html }); ok++; console.log(`  ✓ ${t.name}`); }
  catch (e) { console.log(`  ✗ ${t.name}: ${(e as Error).message}`); }
}
console.log(`完成 ${ok}/${targets.length}`);
