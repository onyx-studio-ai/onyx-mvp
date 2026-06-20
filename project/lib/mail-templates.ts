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

export function applicationStatusEmail(p: { applicantName: string; applicationNumber: string; status: 'approved' | 'rejected'; locale?: string }): { subject: string; html: string } {
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
        s1t: `步驟一 — 合作同意書`,
        s1d: `我們會另外寄一封合作同意書給您,請線上閱讀並簽署,完成正式的合作關係。`,
        s2t: `步驟二 — 聲音身分驗證`,
        s2d: `您會收到一個聲音驗證連結,請錄一段約 10 秒、唸出指定文字的音檔,用來確認身分並保障您的聲音權利。`,
        outro: `兩個步驟完成後,您的個人檔案就會在平台上線。期待很快與您一起完成精彩的作品。`,
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
        s1t: `第一步 — 合作协议`,
        s1d: `我们会另外发送合作协议邮件,请在线阅读并签署,以正式建立合作关系。`,
        s2t: `第二步 — 声音身份验证`,
        s2d: `您会收到声音验证链接,请录制一段约 10 秒、朗读指定文稿的音频,用于确认身份并保障您的声音权利。`,
        outro: `两步完成后,您的资料即在平台上线。期待与您合作。`,
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
        s1t: `Step 1 — Talent Engagement Agreement`,
        s1d: `You'll receive a separate email with your Talent Engagement Agreement. Please review and sign it electronically to formalize your partnership with Onyx Studios.`,
        s2t: `Step 2 — Voice ID Verification`,
        s2d: `You'll receive a Voice ID link by email. Please record a 10-second sample reading the provided script — this verifies your identity and secures your voice rights.`,
        outro: `Once both steps are complete, your profile will go live on the ONYX platform. We look forward to creating great work together.`,
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
  const body = approved
    ? `${P(C.greet)}${P(a.intro)}<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 20px;">${a.next}</p>
       <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
         ${stepCard('#10b981', a.s1t, a.s1d)}
         <tr><td style="height:8px;"></td></tr>
         ${stepCard('#3b82f6', a.s2t, a.s2d)}
       </table>
       <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">${a.outro}</p>`
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

export function signupConfirmationEmail(p: { confirmLink: string }): { subject: string; html: string } {
  const content = `
    ${headlineBlock('Confirm Your Account', 'One more step to get started with Onyx Studios.', BRAND_GREEN)}
    ${bodyCard('Account Verification', `
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Welcome to Onyx Studios. Please confirm your email address by clicking the button below to activate your account and access your personal dashboard.</p>
      <p style="color:#9ca3af;font-size:13px;margin:0;">This link will expire in 24 hours. If you did not create an account, you can safely ignore this email.</p>
    `)}
    ${ctaRow('Confirm My Account', p.confirmLink, 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)')}`;

  return {
    subject: 'Confirm Your Onyx Studios Account',
    html: baseLayout(content),
  };
}

export function passwordResetEmail(p: { resetLink: string }): { subject: string; html: string } {
  const content = `
    ${headlineBlock('Reset Your Password', 'We received a request to reset your password.', '#3b82f6')}
    ${bodyCard('Password Reset', `
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Click the button below to set a new password for your Onyx Studios account. This link will expire in 1 hour.</p>
      <p style="color:#9ca3af;font-size:13px;margin:0;">If you did not request a password reset, you can safely ignore this email. Your password will not be changed.</p>
    `)}
    ${ctaRow('Reset Password', p.resetLink, '#3b82f6')}`;

  return {
    subject: 'Reset Your Onyx Studios Password',
    html: baseLayout(content),
  };
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
}): { subject: string; html: string } {
  const content = `
    ${headlineBlock('Voice ID Verification', `${p.talentName}, please submit your Voice ID recording.`, BRAND_GREEN)}
    ${bodyCard('Voice ID Affidavit', `
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Congratulations on your approved status with Onyx Studios. As part of our verification process, we need you to submit a <strong style="color:#ffffff;">10-second Voice ID recording</strong>.</p>
      <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">This recording serves as a biological digital signature, confirming your identity and the lawful transfer of rights as agreed in your application consent.</p>
      <div style="background:rgba(74,222,128,0.05);border:1px solid rgba(74,222,128,0.2);border-radius:10px;padding:18px 20px;margin:0 0 16px;">
        <p style="margin:0 0 8px;color:${BRAND_GREEN};font-size:14px;font-weight:700;">Recording Instructions</p>
        <p style="margin:0 0 4px;color:#d1d5db;font-size:14px;">1. Find a quiet room with no background noise</p>
        <p style="margin:0 0 4px;color:#d1d5db;font-size:14px;">2. Speak clearly in your natural voice</p>
        <p style="margin:0 0 4px;color:#d1d5db;font-size:14px;">3. Say: <em style="color:#ffffff;">"I, [Your Full Name], confirm this is my own biological voice. I hereby authorize Onyx Studios to create and commercially manage an AI digital twin of my voice under our signed agreement, on this date, [Today's Date]."</em></p>
        <p style="margin:0;color:#d1d5db;font-size:14px;">4. Upload as WAV or MP3 (max 10MB)</p>
      </div>
      <p style="color:#9ca3af;font-size:13px;margin:0;">This link expires in <strong style="color:#f3f4f6;">${p.expiresIn}</strong>. It can only be used once.</p>
    `)}
    ${ctaRow('Upload My Voice ID', p.uploadLink, 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)')}`;

  return {
    subject: 'Action Required — Voice ID Verification for Onyx Studios',
    html: baseLayout(content),
  };
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
