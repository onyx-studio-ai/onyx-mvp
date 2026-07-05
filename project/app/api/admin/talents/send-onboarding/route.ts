import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail, emailLocaleForTalent } from '@/lib/mail';
import { signOnboardToken } from '@/lib/onboard-token';
import { onboardingInviteEmail } from '@/lib/mail-templates';

/*
  POST /api/admin/talents/send-onboarding { id } — 針對「已核准但從沒點連結建帳號」
  的配音員(is_active=false 且 onboarded_at IS NULL),由 admin 手動一鍵補寄 onboarding
  邀請信。信裡帶的是核准時同一套 /onboard?t=<token> 連結,對方點進去確認合作條款、同意
  合作後才建帳號、進入 Draft。

  刻意只對「Inactive」寄:已建帳號(有 onboarded_at)或已上線(is_active)的擋掉,避免
  誤寄;無 email 的直接回錯不亂寄。授權沿用 nudge-complete 的 requireAdmin。

  🔑 onboard token 帶的是 application_id(不是 talent id)—— /api/talents/onboard 是用
  .eq('application_id', appId) 查的,核准信也是簽 application id(見 admin/applications)。
  所以這裡要簽該 talent 的 application_id,沒有 application_id 就無法產生有效連結。
*/
const SITE = 'https://www.onyxstudios.ai';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: { id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: t } = await db
    .from('talents')
    .select('id, name, email, is_active, onboarded_at, application_id')
    .eq('id', id)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: 'Talent not found' }, { status: 404 });

  // 只對「Inactive(未建帳號)」寄:已上線 / 已建帳號的擋掉,避免誤寄。
  if (t.is_active) return NextResponse.json({ error: '這位配音員已上線,無需寄開通連結。' }, { status: 400 });
  if (t.onboarded_at) return NextResponse.json({ error: '這位配音員已建立帳號(Draft),請改用「催填資料」。' }, { status: 400 });

  const email = (t.email as string || '').trim();
  if (!email) return NextResponse.json({ error: '這位配音員沒有 email,無法寄開通連結。' }, { status: 400 });

  const appId = (t.application_id as string || '').trim();
  if (!appId) return NextResponse.json({ error: '這位配音員沒有對應的報名紀錄(application_id),無法產生開通連結。請改用「後台編輯」或聯繫他。' }, { status: 400 });

  // 讀取寄信語系(依配音員實際能讀的語言,而非申請頁語系)。
  const { data: appRow } = await db
    .from('talent_applications')
    .select('locale, languages')
    .eq('id', appId)
    .maybeSingle();
  const locale = emailLocaleForTalent(appRow?.locale, appRow?.languages);
  const lp = locale && locale !== 'en' ? `/${locale}` : '';

  // 與核准時同一套 token + 連結產生方式(token 帶 application_id)。
  const onboardUrl = `${SITE}${lp}/onboard?t=${signOnboardToken(appId)}`;

  const mail = onboardingInviteEmail({ talentName: (t.name as string) || '', onboardUrl, locale });

  // 寄信包 try/catch;失敗回明確錯誤,不當成功。
  try {
    const res = await sendEmail({ category: 'HELLO', to: email, subject: mail.subject, html: mail.html });
    if (!res?.success) return NextResponse.json({ error: res?.error || '寄送失敗' }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '寄送失敗' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, to: email });
}
