import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { sendEmail, type SenderCategory } from '@/lib/mail';
import {
  musicWorkflowEmail,
  stringsWorkflowEmail,
  voiceWorkflowEmail,
  passwordChangedEmail,
  type MusicNotificationType,
  type StringsNotificationType,
  type VoiceNotificationType,
} from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SITE_URL = 'https://www.onyxstudios.ai';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getMagicLink(email: string): Promise<string> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return `${SITE_URL}/dashboard`;
  try {
    const admin = getAdminClient();
    const { data } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${SITE_URL}/dashboard` },
    });
    return data?.properties?.action_link || `${SITE_URL}/dashboard`;
  } catch {
    return `${SITE_URL}/dashboard`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflow, type, email, orderNumber, orderId, category, ...extra } = body;

    if (!workflow || !type || !email) {
      return NextResponse.json({ error: 'Missing required fields: workflow, type, email' }, { status: 400 });
    }

    // 授權雙閘(安全審計 H-1):此端點會以公司名義寄信、並為 email 生成魔法登入連結,不可對外全開。
    // 閘 A:admin session cookie(後台工作流)→ 可為任何 email 觸發通知。
    // 閘 B:Supabase Bearer token(客戶 dashboard)→ 僅限為「登入者本人的 email」觸發。
    const adminRejection = requireAdmin(request);
    if (adminRejection) {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { data: userData, error: userErr } = await getAdminClient().auth.getUser(token);
      const sessionEmail = userData?.user?.email;
      if (userErr || !sessionEmail || sessionEmail.toLowerCase() !== String(email).toLowerCase()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const dashboardLink = await getMagicLink(email);
    const senderCategory: SenderCategory = category || 'PRODUCTION';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@onyxstudios.ai';

    let subject: string;
    let html: string;
    let to: string = email;

    if (workflow === 'music') {
      const notifType = type as MusicNotificationType;
      const result = musicWorkflowEmail({
        type: notifType,
        email,
        orderNumber,
        orderId,
        dashboardLink,
        revisionsUsed: extra.revisionsUsed,
        maxRevisions: extra.maxRevisions,
        extraMessage: extra.extraMessage,
        estimatedDate: extra.estimatedDate,
      });
      subject = result.subject;
      html = result.html;
      if (['client_feedback_received', 'direction_confirmed', 'version_confirmed', 'changes_requested'].includes(notifType)) to = 'produce@onyxstudios.ai';
    } else if (workflow === 'strings') {
      const notifType = type as StringsNotificationType;
      const result = stringsWorkflowEmail({
        type: notifType,
        email,
        orderNumber,
        orderId,
        dashboardLink,
        senderRole: extra.senderRole,
        messagePreview: extra.messagePreview,
        estimatedDate: extra.estimatedDate,
      });
      subject = result.subject;
      html = result.html;
      if (['files_uploaded', 'delivery_accepted'].includes(notifType)) to = 'produce@onyxstudios.ai';
    } else if (workflow === 'voice') {
      const notifType = type as VoiceNotificationType;
      const result = voiceWorkflowEmail({
        type: notifType,
        email,
        orderNumber,
        orderId,
        dashboardLink,
        versionNumber: extra.versionNumber,
        revisionsUsed: extra.revisionsUsed,
        maxRevisions: extra.maxRevisions,
        clientFeedback: extra.clientFeedback,
      });
      subject = result.subject;
      html = result.html;
      if (['version_approved', 'revision_requested'].includes(notifType)) to = 'produce@onyxstudios.ai';
    } else if (workflow === 'password_changed') {
      const result = passwordChangedEmail();
      subject = result.subject;
      html = result.html;
      to = email;
    } else {
      return NextResponse.json({ error: `Unknown workflow: ${workflow}` }, { status: 400 });
    }

    const sendResult = await sendEmail({
      category: senderCategory,
      to,
      subject,
      html,
    });

    return NextResponse.json(sendResult);
  } catch (err) {
    console.error('[Mail API] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
