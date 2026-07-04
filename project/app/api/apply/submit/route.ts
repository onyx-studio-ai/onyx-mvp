import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, emailLocaleForTalent } from '@/lib/mail';
import { applicationReceivedEmail, applicationTeamNotifyEmail } from '@/lib/mail-templates';
import { verifyOtpProof } from '@/lib/otp-code';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Same email shape the email-code route enforces — keep them in lockstep.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[Apply API] Missing Supabase config:', {
      hasUrl: Boolean(SUPABASE_URL),
      hasServiceRoleKey: Boolean(SERVICE_ROLE_KEY),
    });
    return NextResponse.json({ error: 'Apply service is not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    // `locale` is pulled out (like the file fields) so it drives the email
    // language but never reaches the insert — talent_applications has no such column.
    // otpCode/otpToken/otpExp are the OTP proof — verified here, then dropped
    // (they're not columns on talent_applications either).
    const { fileUrl, fileName, fileSize, locale, otpCode, otpToken, otpExp, ...formData } = body;

    const zh = typeof locale === 'string' && locale.startsWith('zh');
    const bad = (zhMsg: string, enMsg: string) =>
      NextResponse.json({ error: zh ? zhMsg : enMsg }, { status: 400 });

    // ── 後端驗證(前端 stepError 只在瀏覽器,可被繞過,所以這裡再擋一次)──
    // 1) email 格式(與 email-code route 同一個正則)
    const email = typeof formData.email === 'string' ? formData.email.trim() : '';
    if (!EMAIL_RE.test(email)) {
      return bad('請提供有效的 Email。', 'A valid email is required.');
    }
    // 2) 必填欄位非空 —— 對照前端 stepError:顯示名稱、真實姓名、性別、語言、案件類型、錄音環境、麥克風、demo 檔
    const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
    const nonEmptyArr = (v: unknown) => Array.isArray(v) && v.length > 0;
    if (!nonEmpty(formData.display_name) || !nonEmpty(formData.full_name)) {
      return bad('請填寫顯示名稱與真實姓名。', 'Display name and legal name are required.');
    }
    if (!nonEmpty(formData.gender)) {
      return bad('請選擇性別。', 'Gender is required.');
    }
    if (!nonEmptyArr(formData.languages)) {
      return bad('「可配語言與口音」請至少選 1 項。', 'At least one language / accent is required.');
    }
    if (!nonEmptyArr(formData.specialties)) {
      return bad('「能接的案件類型」請至少選 1 項。', 'At least one job type is required.');
    }
    if (!nonEmpty(formData.microphone_model)) {
      return bad('請填寫您的麥克風 / 錄音設備。', 'Microphone / recording gear is required.');
    }
    if (!nonEmpty(fileUrl)) {
      return bad('請上傳一段 demo 音檔。', 'A demo file is required.');
    }
    // 3) OTP 重驗 —— 不信前端布林,用 email-code 同一套 sign() 重算確認這個 email 真的驗過
    const otpCodeStr = typeof otpCode === 'string' ? otpCode.trim() : '';
    const otpTokenStr = typeof otpToken === 'string' ? otpToken : '';
    const otpExpNum = typeof otpExp === 'number' ? otpExp : 0;
    if (!verifyOtpProof(email, otpCodeStr, otpTokenStr, otpExpNum)) {
      return NextResponse.json(
        { error: zh ? 'Email 尚未通過驗證,請重新完成 Email 驗證後再送出。' : 'Email verification failed — please verify your email and try again.' },
        { status: 401 },
      );
    }

    const payload = {
      ...formData,
      email, // 用驗證過的 trimmed email(而非原始未整理值)
      locale: locale || '',
      demo_file_url: fileUrl || '',
      demo_file_name: fileName || '',
      demo_file_size: fileSize || 0,
      status: 'pending',
      application_number: '',
    };

    const db = getServiceClient();
    const { data, error } = await db
      .from('talent_applications')
      .insert(payload)
      .select('application_number')
      .single();

    if (error) {
      console.error('[Apply API] Insert error:', error);
      // A repeat application (same email / voice id) trips a unique constraint — that's
      // not a server fault. Don't leak the raw "duplicate key value" SQL to the applicant
      // (a real applicant, Ted, hit this and was blocked); tell them we already have them.
      if ((error as { code?: string }).code === '23505' || /duplicate key/i.test(error.message || '')) {
        const dup = locale?.startsWith('zh')
          ? '這個 email 似乎已經報名過了 —— 我們已收到您的申請,會盡快與您聯絡。若要更新資料,請來信 hello@onyxstudios.ai。'
          : "This email has already applied — we've got your application and will be in touch. To update your details, email hello@onyxstudios.ai.";
        return NextResponse.json({ error: dup, duplicate: true }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Send confirmation to applicant
    const applicantName = formData.full_name || formData.name || 'Applicant';
    const appNumber = data.application_number;
    const applicantEmail = email; // 已驗證的 trimmed email

    if (applicantEmail) {
      // Use the language the applicant actually reads, not just the page they applied
      // from — a foreign VO who used a /zh-TW/ link shouldn't get a Chinese confirmation.
      const emailLocale = emailLocaleForTalent(locale, formData.languages);
      const { subject: confirmSubject, html: confirmHtml } = applicationReceivedEmail({
        applicantName,
        applicationNumber: appNumber,
        email: applicantEmail,
        locale: emailLocale,
      });
      await sendEmail({ category: 'HELLO', to: applicantEmail, subject: confirmSubject, html: confirmHtml });

      const { subject: teamSubject, html: teamHtml } = applicationTeamNotifyEmail({
        applicantName,
        applicationNumber: appNumber,
        email: applicantEmail,
        category: formData.category || formData.talent_type || 'General',
      });
      await sendEmail({ category: 'HELLO', to: 'hello@onyxstudios.ai', subject: teamSubject, html: teamHtml });
    }

    return NextResponse.json({
      success: true,
      application_number: data.application_number,
    });
  } catch (err) {
    console.error('[Apply API] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
