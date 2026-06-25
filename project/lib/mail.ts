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
  const loc = storedLocale || 'en';
  if (loc.startsWith('zh') && !readsChinese(languages)) return 'en';
  return loc;
}
