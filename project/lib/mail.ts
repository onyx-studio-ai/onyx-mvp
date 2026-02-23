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
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
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
