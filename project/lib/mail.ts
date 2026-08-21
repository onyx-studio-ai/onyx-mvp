import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export type SenderCategory =
  | 'SUPPORT'
  | 'PRODUCTION'
  | 'HELLO'
  | 'BILLING'
  | 'ADMIN';

const SENDER_MAP: Record<SenderCategory, string> = {
  SUPPORT: '"Onyx Support" <support@onyxstudios.ai>',
  PRODUCTION: '"Onyx Production" <produce@onyxstudios.ai>',
  HELLO: '"Onyx Hello" <hello@onyxstudios.ai>',
  BILLING: '"Onyx Billing" <billing@onyxstudios.ai>',
  ADMIN: '"Onyx System" <admin@onyxstudios.ai>',
};

export interface SendEmailOptions {
  category?: SenderCategory;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Blind copy recipient(s). Used by inquiry-reply flow to mirror
   *  outbound to Wing's personal inbox while fine-biz.com is
   *  bouncing. Empty / undefined = no BCC (default). */
  bcc?: string | string[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const category = options.category && SENDER_MAP[options.category]
    ? options.category
    : 'HELLO';

  const from = SENDER_MAP[category];
  const timestamp = new Date().toISOString();

  try {
    const bccList = options.bcc
      ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]).filter(Boolean)
      : undefined;

    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
      ...(bccList && bccList.length > 0 ? { bcc: bccList } : {}),
    });

    if (error) {
      console.error(
        `[Mail:${category}] FAILED | to=${options.to} | subject="${options.subject}" | error=${error.message} | ${timestamp}`
      );
      return { success: false, error: error.message };
    }

    console.log(
      `[Mail:${category}] SENT | to=${options.to} | subject="${options.subject}" | id=${data?.id} | ${timestamp}`
    );
    // LINE 鏡像:收件人有綁 LINE(客戶端綁定)就同步推「有新通知」提醒。
    // fire-and-forget,絕不影響寄信結果;動態 import 避免 lib 相依環。
    try {
      const tos = (Array.isArray(options.to) ? options.to : [options.to]).filter(Boolean);
      const [{ notifyEmailLine }, { getSupabaseServiceClient }] = await Promise.all([
        import('./line'), import('./supabase-server'),
      ]);
      const db = getSupabaseServiceClient();
      for (const to of tos) notifyEmailLine(db, to, options.subject).catch(() => {});
    } catch { /* 鏡像失敗不影響寄信 */ }
    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(
      `[Mail:${category}] EXCEPTION | to=${options.to} | subject="${options.subject}" | error=${message} | ${timestamp}`
    );
    return { success: false, error: message };
  }
}

export async function sendInternalError(context: string, errorDetail: string): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@onyxstudios.ai';
  const { internalErrorEmail } = await import('./mail-templates');
  const { subject, html } = internalErrorEmail({ context, error: errorDetail });
  await sendEmail({ category: 'ADMIN', to: adminEmail, subject, html });
}

export { SENDER_MAP };

// Chinese-family languages (matches the apply form's English option values like
// "Chinese · Taiwan" / "Mandarin · Mainland" / "Cantonese · Hong Kong", plus
// Hokkien/Hakka who read 中文, and CJK-typed values just in case).
const CHINESE_LANG_RE =
  /chinese|cantonese|mandarin|hokkien|hakka|taiwanese|中文|國語|国语|普通話|普通话|粵|粤|廣東|广东|台語|台语|客家|閩|闽/i;

function readsChinese(languages: unknown): boolean {
  const arr = Array.isArray(languages) ? languages : languages ? [languages] : [];
  return arr.some((l) => typeof l === 'string' && CHINESE_LANG_RE.test(l));
}

/**
 * Which locale a talent's SYSTEM emails should use. The stored `locale` only reflects
 * which language version of the apply page they submitted from — wrong when someone
 * followed a cross-locale link (e.g. a Spanish/English VO who used the /zh-TW/ apply
 * link got locale=zh-TW and would otherwise receive Chinese mail). So: if the stored
 * locale is Chinese but the talent lists no Chinese-family language, fall back to
 * English. Otherwise trust the stored locale.
 */
export function emailLocaleForTalent(
  storedLocale: string | null | undefined,
  languages: unknown,
): string {
  if (storedLocale) {
    if (storedLocale.startsWith('zh') && !readsChinese(languages)) return 'en';
    return storedLocale;
  }
  // 沒有 stored locale → 由 languages 推(2026-08-07 修:原本直接回 'en',台灣配音員全收英文信)
  if (!readsChinese(languages)) return 'en';
  const list = Array.isArray(languages) ? languages.map(String) : [];
  const hasTW = list.some((l) => /taiwan|cantonese|hokkien|hakka|客家|台/i.test(l));
  const hasCN = list.some((l) => /mainland|大陆|普通话/i.test(l));
  return hasCN && !hasTW ? 'zh-CN' : 'zh-TW';
}

/**
 * 大量寄信:Resend 的速率上限是 10 requests/秒(ratelimit-policy: 10;w=1)。
 * 以前各處用 `Promise.all(list.map(sendEmail))` 一次全送,超出的直接被 429 擋掉,
 * 而呼叫端 `.catch(() => {})` 把錯誤吞了,結果回報「已通知 56 位」實際只寄出 10 封
 * (2026-08-21 遊戲案踩到)。這裡分批送並回報真實成功數,呼叫端必須用這個數字回報。
 *
 * 注意:API route 的 maxDuration 若是 60 秒,以 5 封/秒計約可送 250 封;更大的量要另外排程。
 */
export async function sendBulk(
  items: SendEmailOptions[],
  opts: { perSecond?: number } = {},
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const rate = Math.max(1, Math.min(opts.perSecond ?? 5, 8)); // 上限 10,留餘裕給同時段的其他信
  let sent = 0;
  const errors: string[] = [];
  for (let i = 0; i < items.length; i += rate) {
    if (i) await new Promise((r) => setTimeout(r, 1100));
    const rs = await Promise.all(items.slice(i, i + rate).map((o) =>
      sendEmail(o).catch((e) => ({ success: false, error: e instanceof Error ? e.message : String(e) }))));
    for (const r of rs) { if (r.success) sent++; else if (r.error) errors.push(r.error); }
  }
  return { sent, failed: items.length - sent, errors: [...new Set(errors)].slice(0, 5) };
}
