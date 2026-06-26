const SITE_URL = 'https://www.onyxstudios.ai';
const BRAND_GREEN = '#4ade80';
const BRAND_AMBER = '#f59e0b';

type SupportedLocale = 'en' | 'zh-TW' | 'zh-CN';

const EMAIL_I18N: Record<SupportedLocale, Record<string, string>> = {
  en: {
    website: 'Website',
    music: 'Music',
    voice: 'Voice',
    contact: 'Contact',
    questions: 'Questions? Reach us at',
    copyright: `© ${new Date().getFullYear()} Onyx Studios. All rights reserved.`,
    terms: 'Terms',
    privacy: 'Privacy',
    aup: 'AUP',
    paymentSuccessful: 'Payment Successful',
    orderConfirmed: 'Your {type} order has been confirmed.',
    orderDetails: 'Order Details',
    accessDashboard: 'Access Your Dashboard',
    accessDashboardDesc: 'Click the button below to access your personal dashboard.',
    goToDashboard: 'Go to My Dashboard',
    linkExpiry: 'This link is valid for 24 hours.',
    whatHappensNext: 'What Happens Next',
    paymentReceipt: 'Payment Receipt',
    thankYouPurchase: 'Thank you for your purchase.',
    transactionDetails: 'Transaction Details',
  },
  'zh-TW': {
    website: '官方網站',
    music: '音樂',
    voice: '配音',
    contact: '聯絡我們',
    questions: '有任何問題？請聯繫',
    copyright: `© ${new Date().getFullYear()} Onyx Studios. 版權所有。`,
    terms: '服務條款',
    privacy: '隱私政策',
    aup: '使用政策',
    paymentSuccessful: '付款成功',
    orderConfirmed: '您的{type}訂單已確認。',
    orderDetails: '訂單詳情',
    accessDashboard: '前往您的控制台',
    accessDashboardDesc: '點擊下方按鈕進入個人控制台。',
    goToDashboard: '前往控制台',
    linkExpiry: '此連結 24 小時內有效。',
    whatHappensNext: '接下來會發生什麼',
    paymentReceipt: '付款收據',
    thankYouPurchase: '感謝您的購買。',
    transactionDetails: '交易詳情',
  },
  'zh-CN': {
    website: '官方网站',
    music: '音乐',
    voice: '配音',
    contact: '联系我们',
    questions: '有任何问题？请联系',
    copyright: `© ${new Date().getFullYear()} Onyx Studios. 版权所有。`,
    terms: '服务条款',
    privacy: '隐私政策',
    aup: '使用政策',
    paymentSuccessful: '付款成功',
    orderConfirmed: '您的{type}订单已确认。',
    orderDetails: '订单详情',
    accessDashboard: '前往您的控制台',
    accessDashboardDesc: '点击下方按钮进入个人控制台。',
    goToDashboard: '前往控制台',
    linkExpiry: '此链接 24 小时内有效。',
    whatHappensNext: '接下来会发生什么',
    paymentReceipt: '付款收据',
    thankYouPurchase: '感谢您的购买。',
    transactionDetails: '交易详情',
  },
};

function emailT(locale: SupportedLocale, key: string, replacements?: Record<string, string>): string {
  let str = EMAIL_I18N[locale]?.[key] || EMAIL_I18N.en[key] || key;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

function brandHeader(_brandLabel = 'Studios', _accentColor = BRAND_GREEN): string {
  return `
    <tr>
      <td align="center" style="padding-bottom:32px;">
        <img src="${SITE_URL}/logo-email.png" alt="Onyx Studios" width="200" style="display:block;width:200px;max-width:62%;height:auto;border:0;" />
      </td>
    </tr>`;
}

function brandFooter(locale: SupportedLocale = 'en'): string {
  const t = (key: string) => emailT(locale, key);
  return `
    <tr><td style="height:32px;"></td></tr>
    <tr>
      <td align="center" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:28px;">
        <table cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td align="center" style="padding-bottom:12px;">
              <a href="${SITE_URL}" style="color:#6b7280;text-decoration:none;font-size:12px;margin:0 8px;">${t('website')}</a>
              <span style="color:#374151;">|</span>
              <a href="${SITE_URL}/music" style="color:#6b7280;text-decoration:none;font-size:12px;margin:0 8px;">${t('music')}</a>
              <span style="color:#374151;">|</span>
              <a href="${SITE_URL}/voice/create" style="color:#6b7280;text-decoration:none;font-size:12px;margin:0 8px;">${t('voice')}</a>
              <span style="color:#374151;">|</span>
              <a href="${SITE_URL}/contact" style="color:#6b7280;text-decoration:none;font-size:12px;margin:0 8px;">${t('contact')}</a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px;color:#4b5563;font-size:13px;">${t('questions')} <a href="mailto:support@onyxstudios.ai" style="color:${BRAND_GREEN};text-decoration:none;">support@onyxstudios.ai</a></p>
        <p style="margin:0 0 4px;color:#374151;font-size:11px;">${t('copyright')}</p>
        <p style="margin:0;color:#374151;font-size:10px;">
          <a href="${SITE_URL}/legal/terms" style="color:#4b5563;text-decoration:none;">${t('terms')}</a>
          &nbsp;&middot;&nbsp;
          <a href="${SITE_URL}/legal/privacy" style="color:#4b5563;text-decoration:none;">${t('privacy')}</a>
          &nbsp;&middot;&nbsp;
          <a href="${SITE_URL}/legal/aup" style="color:#4b5563;text-decoration:none;">${t('aup')}</a>
        </p>
      </td>
    </tr>`;
}

function baseLayout(content: string, brandLabel = 'Studios', accentColor = BRAND_GREEN, locale: SupportedLocale = 'en'): string {
  return `<!DOCTYPE html>
<html lang="${locale}"
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
          ${brandHeader(brandLabel, accentColor)}
          ${content}
          ${brandFooter(locale)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, href: string, color: string): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="border-radius:10px;background:${color};">
          <a href="${href}" target="_blank" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
            ${text} &rarr;
          </a>
        </td>
      </tr>
    </table>`;
}

function infoCard(headerLabel: string, rows: { label: string; value: string }[]): string {
  const rowsHtml = rows.map((r, i) => `
    <tr style="border-bottom:${i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'};">
      <td style="padding:14px 20px;color:#9ca3af;font-size:14px;white-space:nowrap;">${r.label}</td>
      <td style="padding:14px 20px;color:#f3f4f6;font-size:14px;text-align:right;font-weight:500;">${r.value}</td>
    </tr>`).join('');

  return `
    <tr>
      <td style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#6b7280;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${headerLabel}</span>
            </td>
          </tr>
          ${rowsHtml}
        </table>
      </td>
    </tr>
    <tr><td style="height:24px;"></td></tr>`;
}

function headlineBlock(headline: string, sub: string, accentColor: string): string {
  return `
    <tr>
      <td align="center" style="padding-bottom:36px;">
        <h1 style="margin:0 0 8px;color:${accentColor};font-size:28px;font-weight:700;letter-spacing:-0.5px;">${headline}</h1>
        <p style="margin:0;color:#9ca3af;font-size:15px;">${sub}</p>
      </td>
    </tr>`;
}

function bodyCard(orderLabel: string, bodyHtml: string): string {
  return `
    <tr>
      <td style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#6b7280;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${orderLabel}</span>
            </td>
          </tr>
          <tr><td style="padding:24px 28px;">${bodyHtml}</td></tr>
        </table>
      </td>
    </tr>
    <tr><td style="height:24px;"></td></tr>`;
}

function ctaRow(text: string, href: string, color: string): string {
  return `
    <tr><td align="center">${ctaButton(text, href, color)}</td></tr>`;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, currency = 'TWD'): string {
  if (currency === 'TWD') return `NT$${amount.toLocaleString()}`;
  return `${currency} ${amount.toLocaleString()}`;
}

function tierLabel(tier?: string): string {
  const map: Record<string, string> = {
    'tier-1': 'AI Instant Voice',
    'tier-2': "Director's Cut",
    'tier-3': '100% Live Studio',
    'ai-curator': 'AI Curator',
    'pro-arrangement': 'Pro Arrangement',
    'masterpiece': 'Masterpiece',
  };
  return map[tier || ''] || tier || '—';
}

// ---------------------------------------------------------------------------
// 1. Order Confirmation Email (voice / music / orchestra)
// ---------------------------------------------------------------------------

export interface OrderConfirmationPayload {
  email: string;
  orderNumber: string;
  amount: number;
  currency?: string;
  orderType: 'voice' | 'music' | 'orchestra';
  transactionId: string;
  dashboardLink: string;
  orderDetails?: Record<string, string | number | boolean | undefined>;
  locale?: SupportedLocale;
}

export function orderConfirmationEmail(p: OrderConfirmationPayload): { subject: string; html: string } {
  const locale = p.locale || 'en';
  const t = (key: string, replacements?: Record<string, string>) => emailT(locale, key, replacements);
  const typeLabel = p.orderType === 'music' ? 'Music Production' : p.orderType === 'orchestra' ? 'Live Strings' : 'Voiceover';
  const currency = p.currency || 'TWD';

  const rows: { label: string; value: string }[] = [
    { label: 'Order Number', value: `#${p.orderNumber}` },
    { label: 'Email', value: p.email },
  ];

  const d = p.orderDetails || {};
  if (d.projectName) rows.push({ label: 'Project', value: String(d.projectName) });
  if (d.tier) rows.push({ label: 'Service Tier', value: tierLabel(String(d.tier)) });
  if (d.language) rows.push({ label: 'Language', value: String(d.language) });
  if (d.voiceSelection) rows.push({ label: 'Voice', value: String(d.voiceSelection) });
  if (d.toneStyle) rows.push({ label: 'Tone Style', value: String(d.toneStyle) });
  if (d.useCase) rows.push({ label: 'Use Case', value: String(d.useCase) });
  if (d.genre) rows.push({ label: 'Genre', value: String(d.genre) });
  if (d.vibe) rows.push({ label: 'Vibe', value: String(d.vibe) });
  if (d.mood) rows.push({ label: 'Mood', value: String(d.mood) });
  if (d.tempo) rows.push({ label: 'Tempo', value: String(d.tempo) });
  if (d.instruments) rows.push({ label: 'Instruments', value: String(d.instruments) });
  if (d.tierName) rows.push({ label: 'Package', value: String(d.tierName) });
  if (d.duration) rows.push({ label: 'Duration', value: `~${d.duration} min` });
  if (d.duration_minutes) rows.push({ label: 'Duration', value: `${d.duration_minutes} min` });
  if (d.usageType) rows.push({ label: 'Usage', value: String(d.usageType) });
  if (d.broadcastRights) rows.push({ label: 'Broadcast Rights', value: 'Included' });

  rows.push({ label: 'Amount Paid', value: formatCurrency(p.amount, currency) });
  rows.push({ label: 'Transaction ID', value: p.transactionId });

  const stepsVoice = [
    'Our team reviews your script and voice specifications',
    'Voiceover is produced and quality-checked by our engineers',
    'Download link delivered to your personal dashboard',
  ];
  const stepsMusic = [
    'Music production begins immediately with our in-house team',
    'Estimated delivery within 7–14 business days',
    'High-quality audio files ready for download in your dashboard',
  ];
  const stepsOrchestra = [
    'Upload your MIDI mockup or score file to get started',
    'Our conservatory musicians record your piece',
    'Final stems and masters delivered to your dashboard',
  ];
  const steps = p.orderType === 'voice' ? stepsVoice : p.orderType === 'orchestra' ? stepsOrchestra : stepsMusic;

  const stepsHtml = steps.map((s, i) => `
    <tr>
      <td style="padding-bottom:${i < steps.length - 1 ? '16' : '0'}px;">
        <table cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="width:32px;height:32px;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.2);border-radius:50%;text-align:center;vertical-align:middle;color:${BRAND_GREEN};font-size:13px;font-weight:700;">${i + 1}</td>
          <td style="padding-left:14px;color:#d1d5db;font-size:14px;line-height:1.5;">${s}</td>
        </tr></table>
      </td>
    </tr>`).join('');

  const content = `
    ${headlineBlock('Payment Successful', `Your ${typeLabel} order has been confirmed.`, BRAND_GREEN)}
    ${infoCard('Order Details', rows)}
    <tr>
      <td style="background:linear-gradient(135deg,rgba(74,222,128,0.05) 0%,rgba(34,197,94,0.1) 100%);border:1px solid rgba(74,222,128,0.2);border-radius:16px;padding:28px 32px;">
        <p style="margin:0 0 4px;color:${BRAND_GREEN};font-size:16px;font-weight:700;">Access Your Dashboard</p>
        <p style="margin:0 0 20px;color:#9ca3af;font-size:14px;line-height:1.6;">
          Click the button below to access your personal dashboard. Track your order progress, download deliverables, and manage your account — all in one place.
        </p>
        ${ctaButton('Go to My Dashboard', p.dashboardLink, 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)')}
        <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">This link is valid for 24 hours. You can set your own password from your dashboard settings.</p>
      </td>
    </tr>
    <tr><td style="height:24px;"></td></tr>
    <tr>
      <td style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px 32px;">
        <p style="margin:0 0 20px;color:#6b7280;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">What Happens Next</p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${stepsHtml}</table>
      </td>
    </tr>`;

  const brandName = p.orderType === 'orchestra' ? 'Strings' : 'Studios';
  const accent = p.orderType === 'orchestra' ? BRAND_AMBER : BRAND_GREEN;

  return {
    subject: `Your Onyx Studios ${typeLabel} Order Is Confirmed — #${p.orderNumber}`,
    html: baseLayout(content, brandName, accent, locale),
  };
}

// ---------------------------------------------------------------------------
// 2. Payment Receipt Email
// ---------------------------------------------------------------------------

export interface PaymentReceiptPayload {
  email: string;
  orderNumber: string;
  amount: number;
  currency?: string;
  transactionId: string;
  orderType: 'voice' | 'music' | 'orchestra';
  paidAt: string;
  billingDetails?: {
    name?: string;
    company?: string;
    address?: string;
    taxId?: string;
  };
}

export function paymentReceiptEmail(p: PaymentReceiptPayload): { subject: string; html: string } {
  const currency = p.currency || 'TWD';
  const typeLabel = p.orderType === 'music' ? 'Music Production' : p.orderType === 'orchestra' ? 'Live Strings' : 'Voiceover';

  const rows: { label: string; value: string }[] = [
    { label: 'Receipt Number', value: `#${p.orderNumber}` },
    { label: 'Service', value: typeLabel },
    { label: 'Amount', value: formatCurrency(p.amount, currency) },
    { label: 'Payment Method', value: 'Credit Card (Paddle)' },
    { label: 'Transaction ID', value: p.transactionId },
    { label: 'Date', value: new Date(p.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
  ];

  if (p.billingDetails?.name) rows.push({ label: 'Billed To', value: p.billingDetails.name });
  if (p.billingDetails?.company) rows.push({ label: 'Company', value: p.billingDetails.company });
  if (p.billingDetails?.taxId) rows.push({ label: 'Tax ID', value: p.billingDetails.taxId });

  const content = `
    ${headlineBlock('Payment Receipt', `Thank you for your purchase.`, '#22c55e')}
    ${infoCard('Transaction Details', rows)}
    ${bodyCard('Important', `
      <p style="color:#d1d5db;font-size:14px;line-height:1.7;margin:0;">
        This receipt serves as confirmation of your payment. A formal invoice can be downloaded from your
        <a href="${SITE_URL}/dashboard/invoices" style="color:${BRAND_GREEN};text-decoration:none;font-weight:600;">dashboard</a>
        at any time. If you require a modified invoice for accounting purposes, please contact our billing department.
      </p>
    `)}`;

  return {
    subject: `Onyx Studios — Payment Receipt #${p.orderNumber}`,
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 3. Music Workflow Emails (5 types)
// ---------------------------------------------------------------------------

export type MusicNotificationType = 'production_started' | 'demos_ready' | 'client_feedback_received' | 'direction_confirmed' | 'version_confirmed' | 'changes_requested' | 'revision_ready' | 'final_ready' | 'order_complete';

export interface MusicWorkflowPayload {
  type: MusicNotificationType;
  email: string;
  orderNumber: string;
  orderId: string;
  dashboardLink: string;
  revisionsUsed?: number;
  maxRevisions?: number;
  extraMessage?: string;
  estimatedDate?: string;
}

export function musicWorkflowEmail(p: MusicWorkflowPayload): { subject: string; html: string } {
  const { type, orderNumber, revisionsUsed = 0, maxRevisions = 1, extraMessage, estimatedDate } = p;

  function revBadge(): string {
    if (maxRevisions >= 5) return `<span style="color:${BRAND_GREEN};">${maxRevisions} complimentary revision rounds</span> included in your plan.`;
    const rem = maxRevisions - revisionsUsed;
    if (rem <= 0) return `<span style="color:#ef4444;">No revisions remaining</span> in your plan.`;
    const c = rem === 1 ? '#f59e0b' : BRAND_GREEN;
    return `<span style="color:${c};">${rem} revision${rem !== 1 ? 's' : ''} remaining</span> (${revisionsUsed} of ${maxRevisions} used).`;
  }

  const configs: Record<MusicNotificationType, { subject: string; headline: string; sub: string; accent: string; body: string; cta: string }> = {
    production_started: {
      subject: `Production Has Begun — #${orderNumber}`,
      headline: 'Your Track Is In Production',
      sub: 'Our team has started working on your music.',
      accent: '#f97316',
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Great news — our producers have begun work on your music order #${orderNumber}. We will prepare several creative direction demos for your review.</p>
        ${estimatedDate ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin:0 0 16px;">
          <p style="margin:0;font-size:13px;color:#9ca3af;">Estimated Delivery</p>
          <p style="margin:4px 0 0;font-size:16px;color:${BRAND_AMBER};font-weight:700;">${estimatedDate}</p>
        </div>` : ''}
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">You will receive an email notification when your demo sketches are ready to preview.</p>`,
      cta: 'Track Progress',
    },
    demos_ready: {
      subject: `Your Demo Sketches Are Ready — #${orderNumber}`,
      headline: 'Your Demos Are Ready to Review',
      sub: 'We have prepared multiple creative directions for your project.',
      accent: '#3b82f6',
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Our producers have crafted several demo sketches for your consideration. Head to your dashboard to listen to each option and select the creative direction you would like us to develop further.</p>
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">For each demo, you can leave time-stamped feedback — highlight sections you love, flag areas for adjustment, and ask questions. This ensures our producers deliver exactly what you envision.</p>
        ${extraMessage ? `<p style="color:#9ca3af;font-size:14px;font-style:italic;margin:0;">${extraMessage}</p>` : ''}`,
      cta: 'Review My Demos',
    },
    client_feedback_received: {
      subject: `Client Feedback Received — Order #${orderNumber}`,
      headline: 'Client Has Submitted Feedback',
      sub: 'Review their annotations and begin production.',
      accent: '#f59e0b',
      body: `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">The client has selected their preferred demo direction and submitted detailed feedback with time-stamped annotations. Log in to the admin dashboard to review their notes and begin full production.</p>`,
      cta: 'View Order in Admin',
    },
    direction_confirmed: {
      subject: `Client Confirmed Direction — Music Order #${orderNumber}`,
      headline: 'Direction Confirmed',
      sub: 'The client has locked in their creative direction.',
      accent: BRAND_GREEN,
      body: `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">The client has reviewed the demo sketches and confirmed their preferred creative direction for Music order #${orderNumber}. Please begin full production based on the selected demo. Check the admin dashboard for any time-stamped feedback the client may have left.</p>`,
      cta: 'Begin Full Production',
    },
    version_confirmed: {
      subject: `Client Confirmed Version — Music Order #${orderNumber}`,
      headline: 'Version Confirmed by Client',
      sub: 'The client has approved this version for final delivery.',
      accent: BRAND_GREEN,
      body: `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">The client has confirmed a version for Music order #${orderNumber} and is ready for final delivery. Please prepare and upload the final deliverable files (mastered WAV, MP3, stems, etc.) in the admin dashboard.</p>`,
      cta: 'Prepare Final Files',
    },
    changes_requested: {
      subject: `Revision Requested — Music Order #${orderNumber}`,
      headline: 'Client Requested Changes',
      sub: 'The client has submitted a revision request.',
      accent: BRAND_AMBER,
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">The client has requested changes to the current version for Music order #${orderNumber}.</p>
        ${extraMessage ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin:0 0 16px;">
          <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">Client Revision Notes</p>
          <p style="margin:0;font-size:14px;color:#d1d5db;font-style:italic;">“${extraMessage.substring(0, 500)}${extraMessage.length >= 500 ? '…' : ''}”</p>
        </div>` : ''}
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">Please review the feedback and upload a revised version at your earliest convenience.</p>`,
      cta: 'View in Admin Panel',
    },
    revision_ready: {
      subject: `Revision Update Ready — #${orderNumber}`,
      headline: 'Your Revision Is Ready',
      sub: 'We have incorporated the changes you requested.',
      accent: '#06b6d4',
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Our team has completed the requested revisions. Head to your dashboard to listen to the updated track and provide your assessment.</p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin:0 0 16px;">
          <p style="margin:0;font-size:13px;color:#9ca3af;">Revision Status</p>
          <p style="margin:4px 0 0;font-size:14px;">${revBadge()}</p>
        </div>
        ${extraMessage ? `<p style="color:#9ca3af;font-size:14px;font-style:italic;margin:0;">${extraMessage}</p>` : ''}`,
      cta: 'Listen to Updated Track',
    },
    final_ready: {
      subject: `Your Final Track Is Ready — #${orderNumber}`,
      headline: 'Your Music Is Complete',
      sub: 'Download your final high-quality files now.',
      accent: BRAND_GREEN,
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Excellent news — your music production is complete. Your final high-quality audio files are ready for download in your dashboard.</p>
        ${extraMessage ? `<p style="color:#9ca3af;font-size:14px;font-style:italic;margin:0;">${extraMessage}</p>` : ''}`,
      cta: 'Download My Files',
    },
    order_complete: {
      subject: `Order Complete — #${orderNumber}`,
      headline: 'Order Complete',
      sub: 'Thank you for choosing Onyx Studios.',
      accent: BRAND_GREEN,
      body: `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">Your order #${orderNumber} has been marked as complete. We appreciate your trust in Onyx Studios and look forward to collaborating with you again.</p>`,
      cta: 'View Dashboard',
    },
  };

  const c = configs[type];
  const content = `
    ${headlineBlock(c.headline, c.sub, c.accent)}
    ${bodyCard(`Order #${orderNumber}`, c.body)}
    ${ctaRow(c.cta, p.dashboardLink, c.accent)}`;

  return { subject: c.subject, html: baseLayout(content) };
}

// ---------------------------------------------------------------------------
// 4. Strings (Orchestra) Workflow Emails (7 types)
// ---------------------------------------------------------------------------

export type StringsNotificationType = 'order_confirmed' | 'files_uploaded' | 'new_message' | 'production_started' | 'delivery_ready' | 'delivery_accepted' | 'auto_complete_warning';

export interface StringsWorkflowPayload {
  type: StringsNotificationType;
  email: string;
  orderNumber: string;
  orderId: string;
  dashboardLink: string;
  senderRole?: string;
  messagePreview?: string;
  estimatedDate?: string;
}

export function stringsWorkflowEmail(p: StringsWorkflowPayload): { subject: string; html: string } {
  const { type, orderNumber, messagePreview, estimatedDate, senderRole } = p;

  const configs: Record<StringsNotificationType, { subject: string; headline: string; sub: string; accent: string; body: string; cta: string }> = {
    order_confirmed: {
      subject: `Your Live Strings Order Is Confirmed — #${orderNumber}`,
      headline: 'Order Confirmed',
      sub: 'Please upload your MIDI or score file to get started.',
      accent: BRAND_AMBER,
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Thank you for your order. Your live string recording session has been confirmed and payment received.</p>
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">Please head to your dashboard to upload your MIDI mockup or score file. Our team will review it and reach out if we have any questions before recording begins.</p>`,
      cta: 'Upload Your Files',
    },
    files_uploaded: {
      subject: `Client Uploaded Files — Strings Order #${orderNumber}`,
      headline: 'Client Files Received',
      sub: 'A client has uploaded their MIDI/score for review.',
      accent: '#3b82f6',
      body: `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">The client has uploaded their MIDI or score file for Strings order #${orderNumber}. Please review the files and communicate any questions or clarifications needed before starting production.</p>`,
      cta: 'Review in Admin Panel',
    },
    new_message: {
      subject: `New Message — Strings Order #${orderNumber}`,
      headline: 'New Message Received',
      sub: `${senderRole === 'admin' ? 'The ONYX team' : 'Your client'} sent a message.`,
      accent: '#8b5cf6',
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">You have a new message regarding Strings order #${orderNumber}:</p>
        ${messagePreview ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin:0 0 16px;">
          <p style="margin:0;font-size:14px;color:#d1d5db;font-style:italic;">“${messagePreview.substring(0, 200)}${messagePreview.length >= 200 ? '…' : ''}”</p>
        </div>` : ''}
        <p style="color:#9ca3af;font-size:14px;margin:0;">Head to your dashboard to view the full message and reply.</p>`,
      cta: 'View Message',
    },
    production_started: {
      subject: `Recording Has Begun — #${orderNumber}`,
      headline: 'Production Started',
      sub: 'Your live string recording is now in production.',
      accent: '#f97316',
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Great news — our conservatory musicians have begun recording your piece for order #${orderNumber}.</p>
        ${estimatedDate ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin:0 0 16px;">
          <p style="margin:0;font-size:13px;color:#9ca3af;">Estimated Delivery</p>
          <p style="margin:4px 0 0;font-size:16px;color:${BRAND_AMBER};font-weight:700;">${estimatedDate}</p>
        </div>` : ''}
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">You will receive a notification when your stems and final files are ready for download.</p>`,
      cta: 'Track Progress',
    },
    delivery_ready: {
      subject: `Your Stems Are Ready — #${orderNumber}`,
      headline: 'Delivery Ready',
      sub: 'Your recorded stems and files are ready for download.',
      accent: BRAND_GREEN,
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Your live string recording for order #${orderNumber} is complete. All files are ready for you to download in your dashboard.</p>
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">Please review the delivered files and confirm acceptance. If you have any questions or need adjustments, you can send a message directly through the dashboard.</p>`,
      cta: 'Download Files',
    },
    delivery_accepted: {
      subject: `Delivery Accepted — Strings Order #${orderNumber}`,
      headline: 'Client Accepted Delivery',
      sub: 'The order has been marked as complete.',
      accent: BRAND_GREEN,
      body: `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">The client has confirmed acceptance of all delivered files for Strings order #${orderNumber}. This order is now marked as complete.</p>`,
      cta: 'View in Admin Panel',
    },
    auto_complete_warning: {
      subject: `Action Required — Strings Order #${orderNumber}`,
      headline: 'Please Review Your Delivery',
      sub: 'Your order will auto-close soon if no action is taken.',
      accent: BRAND_AMBER,
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Your live string recording files for order #${orderNumber} have been delivered and are waiting for your review. If no response is received, the order will be automatically marked as complete.</p>
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">Please download and review your files, then confirm acceptance in your dashboard.</p>`,
      cta: 'Review Delivery',
    },
  };

  const c = configs[type];
  const content = `
    ${headlineBlock(c.headline, c.sub, c.accent)}
    ${bodyCard(`Order #${orderNumber}`, c.body)}
    ${ctaRow(c.cta, p.dashboardLink, c.accent)}`;

  return { subject: c.subject, html: baseLayout(content, 'Strings', BRAND_AMBER) };
}

// ---------------------------------------------------------------------------
// 5. Voice Workflow Emails (5 types — NEW)
// ---------------------------------------------------------------------------

export type VoiceNotificationType = 'version_delivered' | 'version_approved' | 'revision_requested' | 'final_ready' | 'order_complete';

export interface VoiceWorkflowPayload {
  type: VoiceNotificationType;
  email: string;
  orderNumber: string;
  orderId: string;
  dashboardLink: string;
  versionNumber?: number;
  revisionsUsed?: number;
  maxRevisions?: number;
  clientFeedback?: string;
}

export function voiceWorkflowEmail(p: VoiceWorkflowPayload): { subject: string; html: string } {
  const { type, orderNumber, versionNumber = 1, clientFeedback } = p;

  const configs: Record<VoiceNotificationType, { subject: string; headline: string; sub: string; accent: string; body: string; cta: string }> = {
    version_delivered: {
      subject: `Your Voiceover Is Ready for Review — #${orderNumber}`,
      headline: `Version ${versionNumber} Ready`,
      sub: 'Your voiceover has been delivered for your review.',
      accent: '#06b6d4',
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Version ${versionNumber} of your voiceover for order #${orderNumber} is ready. Head to your dashboard to listen, then either approve or request changes.</p>
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">If the recording meets your expectations, click Approve to proceed to final delivery. Otherwise, you can submit detailed revision notes and our team will incorporate your feedback.</p>`,
      cta: 'Review Voiceover',
    },
    version_approved: {
      subject: `Client Approved Version — Voice Order #${orderNumber}`,
      headline: 'Client Approved',
      sub: `Version ${versionNumber} has been approved by the client.`,
      accent: BRAND_GREEN,
      body: `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">The client has approved version ${versionNumber} for Voice order #${orderNumber}. Please prepare and upload the final deliverable files.</p>`,
      cta: 'Prepare Final Files',
    },
    revision_requested: {
      subject: `Revision Requested — Voice Order #${orderNumber}`,
      headline: 'Revision Requested',
      sub: 'The client has requested changes to the current version.',
      accent: BRAND_AMBER,
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">The client has requested a revision for Voice order #${orderNumber}.</p>
        ${clientFeedback ? `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin:0 0 16px;">
          <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">Client Feedback</p>
          <p style="margin:0;font-size:14px;color:#d1d5db;font-style:italic;">“${clientFeedback.substring(0, 500)}${clientFeedback.length >= 500 ? '…' : ''}”</p>
        </div>` : ''}
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">Please review the feedback and upload a revised version at your earliest convenience.</p>`,
      cta: 'View in Admin Panel',
    },
    final_ready: {
      subject: `Your Final Voiceover Is Ready — #${orderNumber}`,
      headline: 'Your Voiceover Is Complete',
      sub: 'Download your final high-quality audio files.',
      accent: BRAND_GREEN,
      body: `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">Your voiceover for order #${orderNumber} is finalized. All deliverable files are ready for download in your dashboard. Thank you for choosing Onyx Studios.</p>`,
      cta: 'Download Files',
    },
    order_complete: {
      subject: `Order Complete — #${orderNumber}`,
      headline: 'Order Complete',
      sub: 'Thank you for choosing Onyx Studios.',
      accent: BRAND_GREEN,
      body: `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">Your voice order #${orderNumber} has been marked as complete. We appreciate your trust in Onyx Studios and look forward to working with you again.</p>`,
      cta: 'View Dashboard',
    },
  };

  const c = configs[type];
  const content = `
    ${headlineBlock(c.headline, c.sub, c.accent)}
    ${bodyCard(`Order #${orderNumber}`, c.body)}
    ${ctaRow(c.cta, p.dashboardLink, c.accent)}`;

  return { subject: c.subject, html: baseLayout(content) };
}

// ---------------------------------------------------------------------------
// 6. Talent Application Emails (NEW)
// ---------------------------------------------------------------------------

export function applicationReceivedEmail(p: { applicantName: string; applicationNumber: string; email: string; locale?: string }): { subject: string; html: string } {
  // Localized applicant-facing confirmation. Defaults to English so existing
  // callers (e.g. /apply/voice) stay unchanged. Copy registers researched per
  // region: US measured/formal, TW warm/relational, CN concise.
  const L = p.locale === 'zh-CN' ? 'cn' : p.locale?.startsWith('zh') ? 'tw' : 'en';
  const n = p.applicationNumber;
  const name = (p.applicantName || '').trim();
  const t = {
    tw: {
      subject: `我們已收到您的報名 — Onyx Studios #${n}`,
      headline: `報名已收到`,
      sub: `謝謝您願意加入 Onyx Studios。`,
      card: `報名編號 #${n}`,
      greeting: `${name ? name + ' ' : ''}您好:`,
      paras: [
        `謝謝您撥空填寫報名資料,也很高興您有興趣加入 Onyx 的配音陣容。`,
        `您的報名我們已經收到,將進行審核。若有需要補充的地方,我們會再與您聯繫;審核通過後,會主動通知您並說明後續的合作方式。`,
        `您的報名編號是 <strong style="color:#ffffff;">#${n}</strong>,再麻煩您留存。`,
        `再次謝謝您撥冗,期待有機會與您合作。`,
      ],
    },
    cn: {
      subject: `已收到您的报名 — Onyx Studios #${n}`,
      headline: `报名已收到`,
      sub: `感谢您申请加入 Onyx Studios。`,
      card: `报名编号 #${n}`,
      greeting: `${name ? name + ' ' : ''}您好:`,
      paras: [
        `您的配音员报名我们已收到,感谢您抽空填写。`,
        `我们会认真审核。如需补充资料,会再与您联系;审核通过后,会主动通知您并说明后续的合作方式。`,
        `报名编号:<strong style="color:#ffffff;">#${n}</strong>,请留存。`,
        `再次感谢,期待与您合作。`,
      ],
    },
    en: {
      subject: `We've received your application — Onyx Studios #${n}`,
      headline: `Application Received`,
      sub: `Thank you for your interest in joining Onyx Studios.`,
      card: `Application #${n}`,
      greeting: `Dear ${name || 'Applicant'},`,
      paras: [
        `Thank you for submitting your application to join the Onyx Studios voice roster. We appreciate your interest and the time you've taken to share your details.`,
        `We have received your submission and will review it carefully. If we need any further information, we will be in touch; once your application is approved, we will contact you and explain how to proceed.`,
        `Your reference number is <strong style="color:#ffffff;">#${n}</strong> — please keep it for your records.`,
        `Thank you again for your time and interest.`,
      ],
    },
  }[L];

  const content = `
    ${headlineBlock(t.headline, t.sub, BRAND_GREEN)}
    ${bodyCard(t.card, `
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${t.greeting}</p>
      ${t.paras.map((para) => `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${para}</p>`).join('')}
    `)}`;

  return { subject: t.subject, html: baseLayout(content) };
}

export function applicationTeamNotifyEmail(p: { applicantName: string; applicationNumber: string; email: string; category: string }): { subject: string; html: string } {
  const content = `
    ${headlineBlock('New Talent Application', `${p.applicantName} has submitted an application.`, '#3b82f6')}
    ${infoCard('Application Details', [
      { label: 'Applicant', value: p.applicantName || 'N/A' },
      { label: 'Email', value: p.email },
      { label: 'Reference', value: `#${p.applicationNumber}` },
      { label: 'Category', value: p.category || 'General' },
    ])}
    ${ctaRow('Review Application', `${SITE_URL}/admin/applications`, '#3b82f6')}`;

  return {
    subject: `New Talent Application — ${p.applicantName} (#${p.applicationNumber})`,
    html: baseLayout(content),
  };
}

export function applicationStatusEmail(p: { applicantName: string; applicationNumber: string; status: 'approved' | 'rejected'; locale?: string; onboardUrl?: string }): { subject: string; html: string } {
  // Localized approve/reject email. Approved = warm welcome (we accept most);
  // rejected = gracious. Defaults to English when no locale stored.
  const L = p.locale === 'zh-CN' ? 'cn' : p.locale?.startsWith('zh') ? 'tw' : 'en';
  const approved = p.status === 'approved';
  const n = p.applicationNumber;
  const name = (p.applicantName || '').trim();
  const accent = approved ? BRAND_GREEN : '#6b7280';

  const C = {
    tw: {
      card: `報名編號 #${n}`,
      greet: `${name ? name + ' ' : ''}您好:`,
      ap: {
        subject: `歡迎加入 Onyx Studios — 報名 #${n} 已通過`,
        headline: `歡迎加入 Onyx Studios`,
        sub: `很高興邀請您加入我們的配音陣容。`,
        intro: `很高興通知您,您的報名(#${n})已經通過 —— 歡迎加入 Onyx 的配音陣容!`,
        next: `接下來只要兩個步驟:`,
        s1t: `步驟一 — 確認合作條款`,
        s1d: `您在報名時已同意平台合作條款,真人配音案件無需另簽合約。我們會寄上帳號開通連結,確認後即正式加入人才庫。`,
        s2t: `步驟二 — 聲音身分驗證`,
        s2d: `您可能會收到一個聲音驗證連結,錄一段約 10 秒、唸出指定文字的音檔以確認身分;若您的聲音將製作為 AI 語音,該連結同時包含 AI 聲音的授權同意書。`,
        outro: `確認後,您的個人檔案就會在平台上線。期待很快與您一起完成精彩的作品。`,
      },
      rj: {
        subject: `Onyx Studios 報名結果通知 — #${n}`,
        headline: `報名結果通知`,
        sub: `謝謝您對 Onyx Studios 的興趣。`,
        l1: `謝謝您撥空報名。經過仔細評估,這次我們暫時無法與您進一步合作(報名編號 #${n})。`,
        l2: `這並不代表對您能力的否定,我們的需求也經常變動,非常歡迎您日後再次報名。祝您一切順利。`,
      },
    },
    cn: {
      card: `报名编号 #${n}`,
      greet: `${name ? name + ' ' : ''}您好:`,
      ap: {
        subject: `欢迎加入 Onyx Studios — 报名 #${n} 已通过`,
        headline: `欢迎加入 Onyx Studios`,
        sub: `欢迎您加入我们的配音阵容。`,
        intro: `很高兴通知您,您的报名(#${n})已通过,欢迎加入 Onyx 配音阵容。`,
        next: `接下来只需两步:`,
        s1t: `第一步 — 确认合作条款`,
        s1d: `您在报名时已同意平台合作条款,真人配音案件无需另签合约。我们会发送账号开通链接,确认后即正式加入人才库。`,
        s2t: `第二步 — 声音身份验证`,
        s2d: `您可能会收到声音验证链接,录制一段约 10 秒、朗读指定文稿的音频以确认身份;若您的声音将制作为 AI 语音,该链接同时包含 AI 声音的授权同意书。`,
        outro: `确认后,您的资料即在平台上线。期待与您合作。`,
      },
      rj: {
        subject: `Onyx Studios 报名结果通知 — #${n}`,
        headline: `报名结果通知`,
        sub: `感谢您对 Onyx Studios 的关注。`,
        l1: `感谢您抽空报名。经认真评估,本次暂未能与您进一步合作(报名编号 #${n})。`,
        l2: `这并非对您能力的否定,我们的需求也时常变化,欢迎日后再次报名。祝您顺利。`,
      },
    },
    en: {
      card: `Application #${n}`,
      greet: `Dear ${name || 'Applicant'},`,
      ap: {
        subject: `Welcome to Onyx Studios — Application #${n} Approved`,
        headline: `Welcome to Onyx Studios`,
        sub: `We're glad to have you on the roster.`,
        intro: `We're pleased to let you know that your application (#${n}) has been approved — welcome to the Onyx Studios voice roster.`,
        next: `Here's what happens next:`,
        s1t: `Step 1 — Cooperation terms`,
        s1d: `You already agreed to our cooperation terms when you applied — no separate contract is needed for human voice work. We'll send an account activation link; once confirmed, you're on the roster.`,
        s2t: `Step 2 — Voice ID Verification`,
        s2d: `You may receive a Voice ID link to record a 10-second sample reading a provided script, confirming your identity. If your voice is to be made into an AI voice, that same link includes the AI voice licensing agreement.`,
        outro: `Once confirmed, your profile will go live on the ONYX platform. We look forward to creating great work together.`,
      },
      rj: {
        subject: `Onyx Studios Application Update — #${n}`,
        headline: `Application Update`,
        sub: `Thank you for your interest in Onyx Studios.`,
        l1: `Thank you for taking the time to apply. After careful review, we won't be moving forward with your application (#${n}) at this time.`,
        l2: `This isn't a reflection of your ability, and our needs change often — you're welcome to apply again in the future. We wish you all the best.`,
      },
    },
  }[L];

  const P = (txt: string) => `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${txt}</p>`;
  const stepCard = (color: string, title: string, desc: string) => `<tr><td style="padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.06);">
    <p style="color:${color};font-size:14px;font-weight:600;margin:0 0 8px;">${title}</p>
    <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">${desc}</p></td></tr>`;

  const a = C.ap, r = C.rj;
  const ctaLabel = { tw: '完成報名 · 開通帳號', cn: '完成报名 · 开通账号', en: 'Complete onboarding' }[L];
  const ctaIntro = { tw: '請點下方完成報名,確認合作條款後即開通帳號、正式進入人才庫:', cn: '请点下方完成报名,确认合作条款后即开通账号、正式进入人才库:', en: 'Click below to complete onboarding — confirm the cooperation terms and your profile goes live on the roster:' }[L];
  const approvedBody = p.onboardUrl
    ? `${P(C.greet)}${P(a.intro)}<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 4px;">${ctaIntro}</p>${ctaRow(ctaLabel, p.onboardUrl, BRAND_GREEN)}<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">${a.outro}</p>`
    : `${P(C.greet)}${P(a.intro)}<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 20px;">${a.next}</p>
       <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
         ${stepCard('#10b981', a.s1t, a.s1d)}
         <tr><td style="height:8px;"></td></tr>
         ${stepCard('#3b82f6', a.s2t, a.s2d)}
       </table>
       <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">${a.outro}</p>`;
  const body = approved
    ? approvedBody
    : `${P(C.greet)}${P(r.l1)}<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">${r.l2}</p>`;

  const meta = approved ? a : r;
  const content = `
    ${headlineBlock(meta.headline, meta.sub, accent)}
    ${bodyCard(C.card, body)}`;

  return { subject: meta.subject, html: baseLayout(content) };
}

// ---------------------------------------------------------------------------
// 7. Auth Emails (NEW)
// ---------------------------------------------------------------------------

export function signupConfirmationEmail(p: { confirmLink: string; locale?: string }): { subject: string; html: string } {
  const L = p.locale === 'zh-CN' ? 'cn' : p.locale?.startsWith('zh') ? 'tw' : 'en';
  const C = {
    tw: { subject: '確認您的 Onyx Studios 帳號', headline: '確認您的帳號', sub: '再一步就能開始使用 Onyx Studios。', card: '帳號驗證', l1: '歡迎使用 Onyx Studios。請點下方按鈕確認您的 Email,即可啟用帳號、進入您的個人控制台。', note: '此連結將於 24 小時後失效。若您並未註冊帳號,請忽略此信。', cta: '確認我的帳號' },
    cn: { subject: '确认您的 Onyx Studios 账号', headline: '确认您的账号', sub: '再一步就能开始使用 Onyx Studios。', card: '账号验证', l1: '欢迎使用 Onyx Studios。请点击下方按钮确认您的邮箱,即可启用账号、进入您的个人控制台。', note: '此链接将在 24 小时后失效。若您并未注册账号,请忽略此邮件。', cta: '确认我的账号' },
    en: { subject: 'Confirm Your Onyx Studios Account', headline: 'Confirm Your Account', sub: 'One more step to get started with Onyx Studios.', card: 'Account Verification', l1: 'Welcome to Onyx Studios. Please confirm your email address by clicking the button below to activate your account and access your personal dashboard.', note: 'This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.', cta: 'Confirm My Account' },
  }[L];
  const content = `
    ${headlineBlock(C.headline, C.sub, BRAND_GREEN)}
    ${bodyCard(C.card, `
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${C.l1}</p>
      <p style="color:#9ca3af;font-size:13px;margin:0;">${C.note}</p>
    `)}
    ${ctaRow(C.cta, p.confirmLink, 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)')}`;

  return { subject: C.subject, html: baseLayout(content) };
}

export function talentAccountSetupEmail(p: { name?: string; setupUrl: string; dashboardUrl: string; locale?: string }): { subject: string; html: string } {
  // Sent after onboarding: the talent's account is created and they set a
  // password to log in at /talent and self-manage their profile. Tri-lingual.
  const L = p.locale === 'zh-CN' ? 'cn' : p.locale?.startsWith('zh') ? 'tw' : 'en';
  const name = (p.name || '').trim();
  const C = {
    tw: {
      subject: '設定密碼 · 開通您的 Onyx 配音員後台',
      headline: '開通您的配音員後台',
      sub: '設定密碼,隨時自行管理檔案。',
      card: '帳號設定',
      greet: `${name ? name + ' ' : ''}您好:`,
      l1: '您的配音員檔案已在 Onyx Studios 平台上線。我們為您開設了專屬後台,您可隨時登入、自行更新個人簡介、語言、口音等資料。',
      l2: '請點下方按鈕設定您的登入密碼:',
      cta: '設定密碼',
      l3: `設定完成後,日後可隨時於 <a href="${p.dashboardUrl}" style="color:${BRAND_GREEN};text-decoration:none;">配音員後台</a> 登入管理。`,
      note: '此連結 24 小時內有效;若已過期,請至登入頁點「忘記密碼」、輸入此 Email 即可重新索取。若您並未報名 Onyx Studios,請忽略此信。',
    },
    cn: {
      subject: '设置密码 · 开通您的 Onyx 配音员后台',
      headline: '开通您的配音员后台',
      sub: '设置密码,随时自行管理资料。',
      card: '账号设置',
      greet: `${name ? name + ' ' : ''}您好:`,
      l1: '您的配音员资料已在 Onyx Studios 平台上线。我们为您开设了专属后台,您可随时登录、自行更新个人简介、语言、口音等资料。',
      l2: '请点下方按钮设置您的登录密码:',
      cta: '设置密码',
      l3: `设置完成后,日后可随时在 <a href="${p.dashboardUrl}" style="color:${BRAND_GREEN};text-decoration:none;">配音员后台</a> 登录管理。`,
      note: '此链接 24 小时内有效;若已过期,请至登录页点「忘记密码」、输入此 Email 即可重新索取。若您并未报名 Onyx Studios,请忽略此邮件。',
    },
    en: {
      subject: 'Set Your Password · Activate Your Onyx Talent Dashboard',
      headline: 'Activate Your Talent Dashboard',
      sub: 'Set a password and manage your profile anytime.',
      card: 'Account Setup',
      greet: `Dear ${name || 'Talent'},`,
      l1: 'Your talent profile is now live on the Onyx Studios platform. We have created a personal dashboard where you can log in anytime to update your bio, languages, accent and other details.',
      l2: 'Click the button below to set your login password:',
      cta: 'Set Password',
      l3: `Once set, you can log in anytime at your <a href="${p.dashboardUrl}" style="color:${BRAND_GREEN};text-decoration:none;">Talent Dashboard</a>.`,
      note: 'This link is valid for 24 hours; if it expires, go to the sign-in page, click “Forgot password” and enter this email to get a new one. If you did not apply to Onyx Studios, please ignore this email.',
    },
  }[L];
  const P = (t: string) => `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${t}</p>`;
  const content = `
    ${headlineBlock(C.headline, C.sub, BRAND_GREEN)}
    ${bodyCard(C.card, `${P(C.greet)}${P(C.l1)}${P(C.l2)}`)}
    ${ctaRow(C.cta, p.setupUrl, BRAND_GREEN)}
    ${bodyCard('', `${P(C.l3)}<p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">${C.note}</p>`)}`;
  return { subject: C.subject, html: baseLayout(content) };
}

// ---------------------------------------------------------------------------
// Marketplace emails (briefs / quotes / messages) — branded + tri-lingual
// ---------------------------------------------------------------------------

const mp = (t: string) => `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${t}</p>`;
const mpLocale = (locale?: string) => (locale === 'zh-CN' ? 'cn' : locale?.startsWith('zh') ? 'tw' : 'en');
const mpEsc = (s: unknown) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

/** Client confirmation after posting a brief via /hire. */
export function briefReceivedEmail(p: { clientName?: string; briefNumber?: string; locale?: string }): { subject: string; html: string } {
  const L = mpLocale(p.locale);
  const name = mpEsc((p.clientName || '').trim());
  const n = (p.briefNumber || '').trim();
  const C = {
    tw: { subject: `Onyx Studios 已收到您的配音需求${n ? `(${n})` : ''}`, headline: '已收到您的配音需求', sub: '我們將盡快為您安排合適的配音人選。', card: n ? `案件編號 ${n}` : '配音需求',
      greet: `${name ? name + ' ' : ''}您好,`, l1: '感謝您的委託與信任。您的配音需求我們已收到,專案團隊將盡快為您篩選合適的配音員,並備妥報價與試聽供您參考。', l2: '若有任何補充說明,或希望優先指定的聲音風格,歡迎直接回覆本信,我們將儘速為您處理。', sign: 'Onyx Studios 團隊 敬上' },
    cn: { subject: `Onyx Studios 已收到您的配音需求${n ? `(${n})` : ''}`, headline: '已收到您的配音需求', sub: '我们将尽快为您安排合适的配音人选。', card: n ? `案件编号 ${n}` : '配音需求',
      greet: `${name ? name + ' ' : ''}您好,`, l1: '感谢您的委托与信任。您的配音需求我们已收到,项目团队将尽快为您筛选合适的配音员,并备妥报价与试听供您参考。', l2: '若有任何补充说明,或希望优先指定的声音风格,欢迎直接回复本邮件,我们将尽快为您处理。', sign: 'Onyx Studios 团队 敬上' },
    en: { subject: `Onyx Studios — your voiceover brief has been received${n ? ` (${n})` : ''}`, headline: 'Your brief has been received', sub: 'We will arrange the right voices for you shortly.', card: n ? `Brief ${n}` : 'Voiceover brief',
      greet: `Dear ${name || 'there'},`, l1: 'Thank you for your enquiry. We have received your voiceover brief, and our team will shortlist suitable voice talent and prepare quotes and samples for your review shortly.', l2: 'If there is anything you would like to add, or a particular voice style you have in mind, simply reply to this email and we will be glad to assist.', sign: 'Kind regards,<br/>The Onyx Studios Team' },
  }[L];
  const content = `
    ${headlineBlock(C.headline, C.sub, BRAND_GREEN)}
    ${bodyCard(C.card, `${mp(C.greet)}${mp(C.l1)}${mp(C.l2)}<p style="color:#9ca3af;font-size:13px;margin:0;">${C.sign}</p>`)}`;
  return { subject: C.subject, html: baseLayout(content) };
}

/** New-message notification to the counterpart in a marketplace thread. */
export function newMessageEmail(p: { briefNumber?: string; locale?: string; url: string }): { subject: string; html: string } {
  const L = mpLocale(p.locale);
  const n = (p.briefNumber || '').trim();
  const C = {
    tw: { subject: `Onyx Studios — 您有一則新訊息${n ? `(${n})` : ''}`, headline: '您有一則新訊息', sub: '對方已於平台回覆您的案件。', card: n ? `案件 ${n}` : '案件訊息', l1: '您在 Onyx Studios 平台的案件收到一則新訊息,敬請點選下方按鈕查看並回覆。', cta: '查看訊息', note: '為保障雙方權益並利我們從旁協助,煩請於平台內回覆。' },
    cn: { subject: `Onyx Studios — 您有一条新消息${n ? `(${n})` : ''}`, headline: '您有一条新消息', sub: '对方已在平台回复您的案件。', card: n ? `案件 ${n}` : '案件消息', l1: '您在 Onyx Studios 平台的案件收到一条新消息,请点击下方按钮查看并回复。', cta: '查看消息', note: '为保障双方权益并便于我们从旁协助,烦请在平台内回复。' },
    en: { subject: `Onyx Studios — you have a new message${n ? ` (${n})` : ''}`, headline: 'You have a new message', sub: 'The other party has replied on your project.', card: n ? `Project ${n}` : 'Project message', l1: 'There is a new message on your Onyx Studios project. Please click below to view and reply.', cta: 'View message', note: 'To protect both parties and allow us to assist, kindly keep your correspondence on the platform.' },
  }[L];
  const content = `
    ${headlineBlock(C.headline, C.sub, BRAND_GREEN)}
    ${bodyCard(C.card, mp(C.l1))}
    ${ctaRow(C.cta, p.url, BRAND_GREEN)}
    ${bodyCard('', `<p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">${C.note}</p>`)}`;
  return { subject: C.subject, html: baseLayout(content) };
}

/** Internal (Onyx) notification that a talent submitted a quote. */
export function quoteReceivedEmail(p: { talentName: string; briefNumber?: string; currency: string; gross: number; net: number; message?: string }): { subject: string; html: string } {
  const n = (p.briefNumber || '').trim();
  const rows = [
    { label: '配音員 Talent', value: mpEsc(p.talentName) },
    { label: '案件 Brief', value: mpEsc(n) || '—' },
    { label: '客戶支付 Client pays', value: `${mpEsc(p.currency)} ${p.gross}` },
    { label: '配音員淨得 Talent net', value: `${mpEsc(p.currency)} ${p.net}` },
  ];
  const content = `
    ${headlineBlock('新報價 New quote', '配音員對案件提出報價,請至後台審閱。', BRAND_GREEN)}
    ${infoCard('QUOTE', rows)}
    ${p.message ? bodyCard('附註 Note', `<p style="color:#d1d5db;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${mpEsc(p.message)}</p>`) : ''}
    ${ctaRow('後台審閱 Review', `${SITE_URL}/admin/marketplace`, BRAND_GREEN)}`;
  return { subject: `新報價 ${n} — ${p.talentName}`, html: baseLayout(content) };
}

/** Invite a matching-language talent (an approved applicant) to audition for a
 *  casting call — branded, professional, and consistent with our other emails. */
export function castingNotifyEmail(p: { title: string; caseCode?: string; language?: string; rateNote?: string; url: string; locale?: string }): { subject: string; html: string } {
  const L = mpLocale(p.locale);
  const title = mpEsc(p.title);
  const strong = `<strong style="color:#f3f4f6;">${title}</strong>`;
  const C = {
    tw: {
      subject: `Onyx Studios · 新試音案邀請 —— ${title}`,
      headline: '新試音案邀請', sub: '有一個符合您語言的配音試音案', card: p.caseCode || '試音案',
      l1: `Onyx Studios 目前有一個新的配音試音案 ——「${strong}」,與您登記的語言相符,誠摯邀請您參與試音。`,
      l2: '登入配音員後台,即可查看角色設定與試音樣詞、上傳您的試音並提出報價。本案為 Onyx 平台發案,您所提的報價即為實際酬勞,平台不另外收取費用。',
      l3: '若您的個人資料尚未填寫完整,也歡迎一併補齊,有助於我們為您媒合更多合適的案件。',
      cta: '前往試音', sign: 'Onyx Studios 配音團隊 敬上', rate: '報酬', lang: '語言', info: '案件資訊',
    },
    cn: {
      subject: `Onyx Studios · 新试音案邀请 —— ${title}`,
      headline: '新试音案邀请', sub: '有一个符合您语言的配音试音案', card: p.caseCode || '试音案',
      l1: `Onyx Studios 目前有一个新的配音试音案 ——「${strong}」,与您登记的语言相符,诚挚邀请您参与试音。`,
      l2: '登录配音员后台,即可查看角色设定与试音样词、上传您的试音并提出报价。本案为 Onyx 平台发案,您所报价格即为实际酬劳,平台不另外收取费用。',
      l3: '若您的个人资料尚未填写完整,也欢迎一并补齐,有助于我们为您匹配更多合适的案件。',
      cta: '前往试音', sign: 'Onyx Studios 配音团队 敬上', rate: '报酬', lang: '语言', info: '案件信息',
    },
    en: {
      subject: `Onyx Studios · New audition invitation — ${title}`,
      headline: 'New audition invitation', sub: 'A casting call matching your language', card: p.caseCode || 'Casting',
      l1: `Onyx Studios has a new voiceover casting call — “${strong}” — that matches your registered language, and we would be glad to have you audition.`,
      l2: 'Sign in to your talent dashboard to view the roles and audition lines, upload your audition and submit your quote. This is an Onyx platform casting — the quote you submit is your actual fee, with no platform commission.',
      l3: 'If your profile is not yet complete, you are welcome to finish it — it helps us match you to more suitable projects.',
      cta: 'Go to auditions', sign: 'The Onyx Studios Talent Team', rate: 'Rate', lang: 'Language', info: 'CASTING',
    },
  }[L];
  const rows = [
    ...(p.rateNote ? [{ label: C.rate, value: mpEsc(p.rateNote) }] : []),
    ...(p.language ? [{ label: C.lang, value: mpEsc(p.language) }] : []),
  ];
  const content = `
    ${headlineBlock(C.headline, C.sub, BRAND_GREEN)}
    ${bodyCard(C.card, `${mp(C.l1)}${mp(C.l2)}${mp(C.l3)}<p style="color:#9ca3af;font-size:13px;margin:0;">${C.sign}</p>`)}
    ${rows.length ? infoCard(C.info, rows) : ''}
    ${ctaRow(C.cta, p.url, BRAND_GREEN)}`;
  const layoutLocale: SupportedLocale = L === 'cn' ? 'zh-CN' : L === 'tw' ? 'zh-TW' : 'en';
  return { subject: C.subject, html: baseLayout(content, 'Studios', BRAND_GREEN, layoutLocale) };
}

export function passwordResetEmail(p: { resetLink: string; locale?: string }): { subject: string; html: string } {
  const L = p.locale === 'zh-CN' ? 'cn' : p.locale?.startsWith('zh') ? 'tw' : 'en';
  const C = {
    tw: { subject: '重設您的 Onyx Studios 密碼', headline: '重設密碼', sub: '我們收到了重設密碼的請求。', card: '密碼重設', l1: '請點下方按鈕,為您的 Onyx Studios 帳號設定新密碼。此連結將於 24 小時後失效;逾期請再按一次「忘記密碼」重新索取。', note: '若您並未要求重設密碼,請忽略此信,您的密碼不會被變更。', cta: '重設密碼' },
    cn: { subject: '重置您的 Onyx Studios 密码', headline: '重置密码', sub: '我们收到了重置密码的请求。', card: '密码重置', l1: '请点击下方按钮,为您的 Onyx Studios 账号设置新密码。此链接将在 24 小时后失效;逾期请再按一次「忘记密码」重新索取。', note: '若您并未要求重置密码,请忽略此邮件,您的密码不会被更改。', cta: '重置密码' },
    en: { subject: 'Reset Your Onyx Studios Password', headline: 'Reset Your Password', sub: 'We received a request to reset your password.', card: 'Password Reset', l1: 'Click the button below to set a new password for your Onyx Studios account. This link expires in 24 hours; if it expires, just click “Forgot password” again to get a new one.', note: 'If you did not request a password reset, you can safely ignore this email. Your password will not be changed.', cta: 'Reset Password' },
  }[L];
  const content = `
    ${headlineBlock(C.headline, C.sub, '#3b82f6')}
    ${bodyCard(C.card, `
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${C.l1}</p>
      <p style="color:#9ca3af;font-size:13px;margin:0;">${C.note}</p>
    `)}
    ${ctaRow(C.cta, p.resetLink, '#3b82f6')}`;

  return { subject: C.subject, html: baseLayout(content) };
}

export function passwordChangedEmail(): { subject: string; html: string } {
  const content = `
    ${headlineBlock('Password Changed', 'Your account password has been updated.', '#22c55e')}
    ${bodyCard('Security Notice', `
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Your Onyx Studios account password was successfully changed on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.</p>
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">If you did not make this change, please reset your password immediately and contact our support team at <a href="mailto:support@onyxstudios.ai" style="color:${BRAND_GREEN};text-decoration:none;font-weight:600;">support@onyxstudios.ai</a>.</p>
    `)}`;

  return {
    subject: 'Your Onyx Studios Password Was Changed',
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 8. New Order Notification (Admin / Production Team)
// ---------------------------------------------------------------------------

export interface NewOrderNotificationPayload {
  orderNumber: string;
  orderType: 'voice' | 'music' | 'orchestra';
  email: string;
  amount: number;
  currency?: string;
  transactionId: string;
  orderDetails?: Record<string, string | number | boolean | undefined>;
}

export function newOrderNotificationEmail(p: NewOrderNotificationPayload): { subject: string; html: string } {
  const currency = p.currency || 'TWD';
  const typeLabel = p.orderType === 'music' ? 'Music Production' : p.orderType === 'orchestra' ? 'Live Strings' : 'Voiceover';
  const accent = p.orderType === 'orchestra' ? BRAND_AMBER : p.orderType === 'music' ? '#3b82f6' : '#06b6d4';

  const rows: { label: string; value: string }[] = [
    { label: 'Order Number', value: `#${p.orderNumber}` },
    { label: 'Service', value: typeLabel },
    { label: 'Client Email', value: p.email },
    { label: 'Amount', value: formatCurrency(p.amount, currency) },
    { label: 'Transaction ID', value: p.transactionId },
    { label: 'Time', value: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' }) + ' (TPE)' },
  ];

  const d = p.orderDetails || {};
  if (d.projectName) rows.push({ label: 'Project', value: String(d.projectName) });
  if (d.tier) rows.push({ label: 'Tier', value: tierLabel(String(d.tier)) });
  if (d.language) rows.push({ label: 'Language', value: String(d.language) });
  if (d.voiceSelection) rows.push({ label: 'Voice', value: String(d.voiceSelection) });
  if (d.genre) rows.push({ label: 'Genre', value: String(d.genre) });
  if (d.tierName) rows.push({ label: 'Package', value: String(d.tierName) });
  if (d.duration) rows.push({ label: 'Duration', value: `~${d.duration} min` });
  if (d.duration_minutes) rows.push({ label: 'Duration', value: `${d.duration_minutes} min` });

  const content = `
    ${headlineBlock('New Order Received', `A ${typeLabel.toLowerCase()} order has been placed and paid.`, accent)}
    ${infoCard('Order Summary', rows)}
    ${ctaRow('View in Admin Panel', `${SITE_URL}/admin/dashboard`, accent)}`;

  return {
    subject: `[NEW ORDER] ${typeLabel} #${p.orderNumber} — ${formatCurrency(p.amount, currency)}`,
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 9. Contact Inquiry — Confirmation to Client
// ---------------------------------------------------------------------------

export function contactInquiryConfirmationEmail(p: {
  inquiryNumber: string;
  name: string;
  message: string;
  department: string;
}): { subject: string; html: string } {
  const deptLabels: Record<string, string> = {
    HELLO: 'General Inquiries',
    PRODUCTION: 'Production Team',
    SUPPORT: 'Support Team',
    BILLING: 'Billing Department',
    ADMIN: 'Administration',
  };
  const deptLabel = deptLabels[p.department] || 'Our Team';

  const content = `
    ${headlineBlock('Inquiry Received', `Thank you for reaching out, ${p.name}.`, BRAND_GREEN)}
    ${bodyCard('Your Inquiry', `
      <p style="color:#9ca3af;font-size:13px;margin:0 0 4px;">Reference Number</p>
      <p style="color:${BRAND_GREEN};font-size:18px;font-weight:700;margin:0 0 20px;letter-spacing:1px;font-family:monospace;">${p.inquiryNumber}</p>
      <p style="color:#9ca3af;font-size:13px;margin:0 0 4px;">Routed To</p>
      <p style="color:#f3f4f6;font-size:14px;font-weight:600;margin:0 0 20px;">${deptLabel}</p>
      <p style="color:#9ca3af;font-size:13px;margin:0 0 4px;">Your Message</p>
      <p style="color:#d1d5db;font-size:14px;margin:0;line-height:1.6;white-space:pre-wrap;">${p.message}</p>
    `)}
    <tr><td align="center" style="padding-top:8px;">
      <p style="color:#9ca3af;font-size:14px;margin:0;">Our team typically responds within <strong style="color:#f3f4f6;">24 business hours</strong>.</p>
      <p style="color:#6b7280;font-size:13px;margin:8px 0 0;">Please keep this reference number for your records.</p>
    </td></tr>`;

  return {
    subject: `[${p.inquiryNumber}] We've received your inquiry — Onyx Studios`,
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 10. Contact Inquiry — Internal Notification to Department
// ---------------------------------------------------------------------------

export function contactInquiryInternalEmail(p: {
  inquiryNumber: string;
  name: string;
  email: string;
  message: string;
  department: string;
  source: string;
}): { subject: string; html: string } {
  const content = `
    ${headlineBlock('New Inquiry', `${p.inquiryNumber} — Action required.`, BRAND_AMBER)}
    ${infoCard('Inquiry Details', [
      { label: 'Reference', value: p.inquiryNumber },
      { label: 'Name', value: p.name },
      { label: 'Email', value: p.email },
      { label: 'Source', value: p.source },
      { label: 'Time', value: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' }) + ' (TPE)' },
    ])}
    ${bodyCard('Message', `
      <p style="color:#f3f4f6;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;">${p.message}</p>
    `)}
    ${ctaRow('View in Admin Panel', `${SITE_URL}/admin/inquiries`, BRAND_AMBER)}
    <tr><td align="center" style="padding-top:4px;">
      <p style="color:#6b7280;font-size:12px;margin:0;">Reply directly from the admin panel or respond to <a href="mailto:${p.email}" style="color:${BRAND_GREEN};text-decoration:none;">${p.email}</a></p>
    </td></tr>`;

  return {
    subject: `[INQUIRY] ${p.inquiryNumber} — ${p.name} via ${p.source}`,
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 11. Contact Inquiry — Admin Reply to Client
// ---------------------------------------------------------------------------

export function contactInquiryReplyEmail(p: {
  inquiryNumber: string;
  clientName: string;
  replyMessage: string;
  department: string;
}): { subject: string; html: string } {
  const deptLabels: Record<string, string> = {
    HELLO: 'Onyx Studios',
    PRODUCTION: 'Onyx Production',
    SUPPORT: 'Onyx Support',
    BILLING: 'Onyx Billing',
    ADMIN: 'Onyx System',
  };
  const deptLabel = deptLabels[p.department] || 'Onyx Studios';

  const content = `
    ${headlineBlock('Response from ' + deptLabel, `Regarding your inquiry ${p.inquiryNumber}`, BRAND_GREEN)}
    ${bodyCard('Message', `
      <p style="color:#f3f4f6;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap;">${p.replyMessage}</p>
    `)}
    <tr><td align="center" style="padding-top:8px;">
      <p style="color:#9ca3af;font-size:13px;margin:0;">Reference: <span style="color:#f3f4f6;font-family:monospace;">${p.inquiryNumber}</span></p>
      <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">If you have further questions, simply reply to this email or submit a new inquiry at <a href="${SITE_URL}/contact" style="color:${BRAND_GREEN};text-decoration:none;">onyxstudios.ai/contact</a></p>
    </td></tr>`;

  return {
    subject: `[${p.inquiryNumber}] Response from ${deptLabel}`,
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 12. Voice ID Request Email (Talent)
// ---------------------------------------------------------------------------

export function voiceIdRequestEmail(p: {
  talentName: string;
  uploadLink: string;
  expiresIn: string;
  locale?: string;
}): { subject: string; html: string } {
  const slocale: SupportedLocale = p.locale === 'zh-CN' ? 'zh-CN' : p.locale?.startsWith('zh') ? 'zh-TW' : 'en';
  const L = slocale === 'zh-CN' ? 'cn' : slocale === 'zh-TW' ? 'tw' : 'en';
  const name = (p.talentName || '').trim();
  const T = {
    tw: {
      subject: 'Onyx Studios — 聲音 ID 驗證(需要您處理)', headline: '聲音 ID 驗證',
      sub: `${name} 您好,請上傳您的聲音 ID 錄音。`, card: '聲音 ID 聲明',
      p1: '恭喜您通過 Onyx Studios 審核。驗證流程的一環,需要您提交一段 <strong style="color:#fff;">10 秒的聲音 ID 錄音</strong>。',
      p2: '這段錄音作為您的「聲音生物簽章」,確認您的身分,以及您在報名同意中授權的權利轉移。',
      instr: '錄音說明',
      i1: '1. 找一個安靜、無背景雜音的空間', i2: '2. 用您自然的聲音清楚唸出',
      i3: '3. 唸出:<em style="color:#fff;">「我,[您的全名],確認這是我本人的真實聲音。我在此授權 Onyx Studios 依雙方簽署之協議,製作並商業管理我的 AI 聲音分身,日期為 [今日日期]。」</em>',
      i4: '4. 以 WAV 或 MP3 上傳(最大 10MB)',
      exp: `此連結將於 <strong style="color:#f3f4f6;">${p.expiresIn}</strong> 後失效,且僅能使用一次。`, cta: '上傳我的聲音 ID',
    },
    cn: {
      subject: 'Onyx Studios — 声音 ID 验证(需要您处理)', headline: '声音 ID 验证',
      sub: `${name} 您好,请上传您的声音 ID 录音。`, card: '声音 ID 声明',
      p1: '恭喜您通过 Onyx Studios 审核。验证流程的一环,需要您提交一段 <strong style="color:#fff;">10 秒的声音 ID 录音</strong>。',
      p2: '这段录音作为您的「声音生物签章」,确认您的身分,以及您在报名同意中授权的权利转移。',
      instr: '录音说明',
      i1: '1. 找一个安静、无背景杂音的空间', i2: '2. 用您自然的声音清楚念出',
      i3: '3. 念出:<em style="color:#fff;">「我,[您的全名],确认这是我本人的真实声音。我在此授权 Onyx Studios 依双方签署之协议,制作并商业管理我的 AI 声音分身,日期为 [今日日期]。」</em>',
      i4: '4. 以 WAV 或 MP3 上传(最大 10MB)',
      exp: `此链接将于 <strong style="color:#f3f4f6;">${p.expiresIn}</strong> 后失效,且仅能使用一次。`, cta: '上传我的声音 ID',
    },
    en: {
      subject: 'Action Required — Voice ID Verification for Onyx Studios', headline: 'Voice ID Verification',
      sub: `${name}, please submit your Voice ID recording.`, card: 'Voice ID Affidavit',
      p1: 'Congratulations on your approved status with Onyx Studios. As part of our verification process, we need you to submit a <strong style="color:#ffffff;">10-second Voice ID recording</strong>.',
      p2: 'This recording serves as a biological digital signature, confirming your identity and the lawful transfer of rights as agreed in your application consent.',
      instr: 'Recording Instructions',
      i1: '1. Find a quiet room with no background noise', i2: '2. Speak clearly in your natural voice',
      i3: '3. Say: <em style="color:#ffffff;">"I, [Your Full Name], confirm this is my own biological voice. I hereby authorize Onyx Studios to create and commercially manage an AI digital twin of my voice under our signed agreement, on this date, [Today\'s Date]."</em>',
      i4: '4. Upload as WAV or MP3 (max 10MB)',
      exp: `This link expires in <strong style="color:#f3f4f6;">${p.expiresIn}</strong>. It can only be used once.`, cta: 'Upload My Voice ID',
    },
  }[L];
  const content = `
    ${headlineBlock(T.headline, T.sub, BRAND_GREEN)}
    ${bodyCard(T.card, `
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${T.p1}</p>
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${T.p2}</p>
      <div style="background:rgba(74,222,128,0.05);border:1px solid rgba(74,222,128,0.2);border-radius:10px;padding:18px 20px;margin:0 0 16px;">
        <p style="margin:0 0 8px;color:${BRAND_GREEN};font-size:14px;font-weight:700;">${T.instr}</p>
        <p style="margin:0 0 4px;color:#d1d5db;font-size:14px;">${T.i1}</p>
        <p style="margin:0 0 4px;color:#d1d5db;font-size:14px;">${T.i2}</p>
        <p style="margin:0 0 4px;color:#d1d5db;font-size:14px;">${T.i3}</p>
        <p style="margin:0;color:#d1d5db;font-size:14px;">${T.i4}</p>
      </div>
      <p style="color:#9ca3af;font-size:13px;margin:0;">${T.exp}</p>
    `)}
    ${ctaRow(T.cta, p.uploadLink, 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)')}`;

  return { subject: T.subject, html: baseLayout(content, 'Studios', BRAND_GREEN, slocale) };
}

// ---------------------------------------------------------------------------
// 12b. Human Liveness Verification (lightweight — live in-browser recording)
// ---------------------------------------------------------------------------

export function livenessRequestEmail(p: {
  talentName: string;
  recordLink: string;
  locale?: string;
}): { subject: string; html: string } {
  const L = p.locale === 'zh-CN' ? 'cn' : p.locale?.startsWith('zh') ? 'tw' : 'en';
  const name = (p.talentName || '').trim();
  const T = {
    tw: {
      subject: 'Onyx Studios — 真人聲音快速驗證',
      headline: '真人聲音驗證',
      sub: '一分鐘的快速驗證,確認您的聲音。',
      card: '聲音驗證',
      intro: `${name ? name + ' 您好,' : ''}為確保 Onyx 真人配音陣容的真實性,想請您做一個快速的聲音驗證。`,
      how: '點下方連結,在瀏覽器裡「現場唸出畫面顯示的一句話」即可 —— 手機或電腦都行,約一分鐘,不需要上傳任何檔案。',
      steps: ['找一個安靜的地方', '允許瀏覽器使用麥克風', '看著畫面那句話,用您自然的聲音唸出來', '確認後送出即可'],
      cta: '開始聲音驗證',
      note: '此連結 14 天內有效。',
    },
    cn: {
      subject: 'Onyx Studios — 真人声音快速验证',
      headline: '真人声音验证',
      sub: '一分钟的快速验证,确认您的声音。',
      card: '声音验证',
      intro: `${name ? name + ' 您好,' : ''}为确保 Onyx 真人配音阵容的真实性,想请您做一个快速的声音验证。`,
      how: '点下方链接,在浏览器里「现场朗读屏幕显示的一句话」即可 —— 手机或电脑都行,约一分钟,无需上传任何文件。',
      steps: ['找一个安静的地方', '允许浏览器使用麦克风', '看着屏幕那句话,用您自然的声音读出来', '确认后提交即可'],
      cta: '开始声音验证',
      note: '此链接 14 天内有效。',
    },
    en: {
      subject: 'Onyx Studios — Quick Voice Verification',
      headline: 'Voice Verification',
      sub: 'A quick, one-minute check to confirm your voice.',
      card: 'Voice Verification',
      intro: `${name ? 'Hi ' + name + ', ' : ''}to keep the Onyx human voice roster genuine, we'd like you to do a quick voice check.`,
      how: 'Click the link below and simply read aloud — live, in your browser — the sentence shown on screen. Phone or computer is fine, it takes about a minute, and no file upload is needed.',
      steps: ['Find a quiet spot', 'Allow the browser to use your microphone', 'Read the on-screen sentence in your natural voice', 'Confirm and submit'],
      cta: 'Start Voice Verification',
      note: 'This link is valid for 14 days.',
    },
  }[L];

  const stepsHtml = T.steps
    .map((s, i) => `<p style="margin:0 0 4px;color:#d1d5db;font-size:14px;">${i + 1}. ${s}</p>`)
    .join('');

  const content = `
    ${headlineBlock(T.headline, T.sub, BRAND_GREEN)}
    ${bodyCard(T.card, `
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${T.intro}</p>
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">${T.how}</p>
      <div style="background:rgba(74,222,128,0.05);border:1px solid rgba(74,222,128,0.2);border-radius:10px;padding:18px 20px;margin:0 0 16px;">
        ${stepsHtml}
      </div>
      <p style="color:#9ca3af;font-size:13px;margin:0;">${T.note}</p>
    `)}
    ${ctaRow(T.cta, p.recordLink, 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)')}`;

  return { subject: T.subject, html: baseLayout(content) };
}

// ---------------------------------------------------------------------------
// Talent profile review result (approved / changes requested)
// ---------------------------------------------------------------------------

export function talentReviewEmail(p: {
  talentName: string;
  approved: boolean;
  reason?: string;
  profileLink?: string;
  locale?: string;
}): { subject: string; html: string } {
  const slocale: SupportedLocale = p.locale === 'zh-CN' ? 'zh-CN' : p.locale?.startsWith('zh') ? 'zh-TW' : 'en';
  const L = slocale === 'zh-CN' ? 'cn' : slocale === 'zh-TW' ? 'tw' : 'en';
  const name = (p.talentName || '').trim();
  const link = p.profileLink || `${SITE_URL}/talent`;
  const reason = (p.reason || '').trim();
  const T = {
    tw: {
      subjOk: 'Onyx Studios — 您的配音員檔案已上線', subjNo: 'Onyx Studios — 您的檔案需要稍作調整',
      headOk: '檔案已通過審核', headNo: '檔案需要調整',
      subOk: '您的個人檔案已公開在 Onyx 人才庫。', subNo: '差一點點就完成了。',
      card: '審核結果',
      okBody: `${name ? name + ' 您好,' : ''}您的配音員檔案已通過審核,現在已公開在 Onyx 人才庫,客戶可以瀏覽並洽詢。日後若有修改,一樣會再走一次快速審核。`,
      noBody: `${name ? name + ' 您好,' : ''}感謝您更新檔案。在正式公開前,有幾個地方想請您調整:`,
      ctaOk: '查看我的檔案', ctaNo: '回到後台調整',
    },
    cn: {
      subjOk: 'Onyx Studios — 您的配音员档案已上线', subjNo: 'Onyx Studios — 您的档案需要稍作调整',
      headOk: '档案已通过审核', headNo: '档案需要调整',
      subOk: '您的个人档案已公开在 Onyx 人才库。', subNo: '差一点点就完成了。',
      card: '审核结果',
      okBody: `${name ? name + ' 您好,' : ''}您的配音员档案已通过审核,现在已公开在 Onyx 人才库,客户可以浏览并洽询。日后若有修改,同样会再走一次快速审核。`,
      noBody: `${name ? name + ' 您好,' : ''}感谢您更新档案。在正式公开前,有几个地方想请您调整:`,
      ctaOk: '查看我的档案', ctaNo: '回到后台调整',
    },
    en: {
      subjOk: 'Onyx Studios — Your talent profile is live', subjNo: 'Onyx Studios — A small tweak needed on your profile',
      headOk: 'Profile Approved', headNo: 'Profile Needs a Tweak',
      subOk: 'Your profile is now public on the Onyx roster.', subNo: 'Almost there.',
      card: 'Review Result',
      okBody: `${name ? 'Hi ' + name + ', ' : ''}your talent profile has been approved and is now public on the Onyx roster, where clients can browse and enquire. Any future edits go through the same quick review.`,
      noBody: `${name ? 'Hi ' + name + ', ' : ''}thanks for updating your profile. Before it goes public, could you adjust the following:`,
      ctaOk: 'View my profile', ctaNo: 'Open my dashboard',
    },
  }[L];
  const ok = p.approved;
  const reasonHtml = !ok && reason
    ? `<div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:14px 18px;margin:8px 0 0;"><p style="color:#fcd34d;font-size:14px;line-height:1.7;margin:0;white-space:pre-line;">${reason}</p></div>`
    : '';
  const accent = ok ? BRAND_GREEN : '#f59e0b';
  const content = `
    ${headlineBlock(ok ? T.headOk : T.headNo, ok ? T.subOk : T.subNo, accent)}
    ${bodyCard(T.card, `
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 12px;">${ok ? T.okBody : T.noBody}</p>
      ${reasonHtml}
    `)}
    ${ctaRow(ok ? T.ctaOk : T.ctaNo, link, ok ? 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)' : accent)}`;
  return { subject: ok ? T.subjOk : T.subjNo, html: baseLayout(content, 'Studios', accent, slocale) };
}

// ---------------------------------------------------------------------------
// 13. Internal Error Email
// ---------------------------------------------------------------------------

export function internalErrorEmail(p: { context: string; error: string }): { subject: string; html: string } {
  const content = `
    ${headlineBlock('System Alert', 'A critical error requires your attention.', '#ef4444')}
    ${bodyCard('Error Details', `
      <p style="color:#9ca3af;font-size:13px;margin:0 0 4px;">Context</p>
      <p style="color:#f3f4f6;font-size:14px;font-weight:600;margin:0 0 16px;">${p.context}</p>
      <p style="color:#9ca3af;font-size:13px;margin:0 0 4px;">Error</p>
      <pre style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:12px 16px;margin:0;color:#fca5a5;font-size:13px;white-space:pre-wrap;word-break:break-all;font-family:monospace;">${p.error}</pre>
    `)}
    <tr><td align="center">
      <p style="color:#6b7280;font-size:13px;margin:0;">Timestamp: ${new Date().toISOString()}</p>
    </td></tr>`;

  return {
    subject: `[ONYX ALERT] ${p.context}`,
    html: baseLayout(content),
  };
}
