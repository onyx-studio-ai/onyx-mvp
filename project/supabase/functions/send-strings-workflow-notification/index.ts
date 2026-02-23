/**
 * @deprecated This Edge Function has been replaced by the centralized mail system.
 * Email sending is now handled by lib/mail.ts + lib/mail-templates.ts in the Next.js app.
 * Triggered from: components/admin/OrchestraOrderWorkflow.tsx, orchestra/deliver, orchestra/messages via /api/mail/send
 * This file is kept for reference only and should NOT be deployed.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type NotificationType =
  | "order_confirmed"
  | "files_uploaded"
  | "new_message"
  | "production_started"
  | "delivery_ready"
  | "delivery_accepted"
  | "auto_complete_warning";

interface NotificationPayload {
  type: NotificationType;
  email: string;
  orderNumber: string;
  orderId: string;
  senderRole?: string;
  messagePreview?: string;
  estimatedDate?: string;
}

const SITE_URL = "https://www.onyxstudios.ai";

async function getMagicLink(email: string, supabaseUrl: string, serviceKey: string): Promise<string> {
  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${SITE_URL}/dashboard` },
    });
    return data?.properties?.action_link || `${SITE_URL}/dashboard`;
  } catch {
    return `${SITE_URL}/dashboard`;
  }
}

function buildEmail(payload: NotificationPayload, dashboardLink: string): { subject: string; html: string } {
  const { type, orderNumber, messagePreview, estimatedDate, senderRole } = payload;

  const configs: Record<NotificationType, { subject: string; headline: string; sub: string; accentColor: string; body: string; cta: string }> = {
    order_confirmed: {
      subject: `Your Live Strings Order Is Confirmed — #${orderNumber}`,
      headline: "Order Confirmed",
      sub: "Please upload your MIDI or score file to get started.",
      accentColor: "#f59e0b",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Thank you for your order! Your live string recording session has been confirmed and payment received.
        </p>
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">
          Please head to your dashboard to upload your MIDI mockup or score file. Our team will review it and reach out if we have any questions before recording begins.
        </p>
      `,
      cta: "Upload Your Files",
    },
    files_uploaded: {
      subject: `Client Uploaded Files — Strings Order #${orderNumber}`,
      headline: "Client Files Received",
      sub: "A client has uploaded their MIDI/score for review.",
      accentColor: "#3b82f6",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">
          The client has uploaded their MIDI or score file for Strings order #${orderNumber}. Please review the files and communicate any questions or clarifications needed before starting production.
        </p>
      `,
      cta: "Review in Admin Panel",
    },
    new_message: {
      subject: `New Message — Strings Order #${orderNumber}`,
      headline: "New Message Received",
      sub: `${senderRole === 'admin' ? 'The Onyx Studios team' : 'Your client'} sent a message.`,
      accentColor: "#8b5cf6",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">
          You have a new message regarding Strings order #${orderNumber}:
        </p>
        ${messagePreview ? `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin:0 0 16px;">
          <p style="margin:0;font-size:14px;color:#d1d5db;font-style:italic;">"${messagePreview}${messagePreview.length >= 200 ? '...' : ''}"</p>
        </div>` : ''}
        <p style="color:#9ca3af;font-size:14px;margin:0;">
          Head to your dashboard to view the full message and reply.
        </p>
      `,
      cta: "View Message",
    },
    production_started: {
      subject: `Recording Has Begun — #${orderNumber}`,
      headline: "Production Started",
      sub: "Your live string recording is now in production.",
      accentColor: "#f97316",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Great news! Our conservatory musicians have begun recording your piece for order #${orderNumber}.
        </p>
        ${estimatedDate ? `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin:0 0 16px;">
          <p style="margin:0;font-size:13px;color:#9ca3af;">Estimated Delivery</p>
          <p style="margin:4px 0 0;font-size:16px;color:#f59e0b;font-weight:700;">${estimatedDate}</p>
        </div>` : ''}
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">
          You will receive a notification when your stems and final files are ready for download.
        </p>
      `,
      cta: "Track Progress",
    },
    delivery_ready: {
      subject: `Your Stems Are Ready — #${orderNumber}`,
      headline: "Delivery Ready",
      sub: "Your recorded stems and files are ready for download.",
      accentColor: "#4ade80",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Your live string recording for order #${orderNumber} is complete! All files are ready for you to download in your dashboard.
        </p>
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">
          Please review the delivered files and confirm acceptance. If you have any questions or need adjustments, you can send a message directly through the dashboard.
        </p>
      `,
      cta: "Download Files",
    },
    delivery_accepted: {
      subject: `Delivery Accepted — Strings Order #${orderNumber}`,
      headline: "Client Accepted Delivery",
      sub: "The order has been marked as complete.",
      accentColor: "#4ade80",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">
          The client has confirmed acceptance of all delivered files for Strings order #${orderNumber}. This order is now marked as complete.
        </p>
      `,
      cta: "View in Admin Panel",
    },
    auto_complete_warning: {
      subject: `Action Required — Strings Order #${orderNumber}`,
      headline: "Please Review Your Delivery",
      sub: "Your order will auto-close soon if no action is taken.",
      accentColor: "#f59e0b",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Your live string recording files for order #${orderNumber} have been delivered and are waiting for your review. If no response is received, the order will be automatically marked as complete.
        </p>
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">
          Please download and review your files, then confirm acceptance in your dashboard.
        </p>
      `,
      cta: "Review Delivery",
    },
  };

  const c = configs[type];

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#111,#1a1a1a);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 24px;">
            <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:2px;">ONYX</span>
            <span style="color:#f59e0b;font-size:20px;font-weight:300;letter-spacing:2px;"> Strings</span>
          </div>
        </td></tr>
        <tr><td align="center" style="padding-bottom:36px;">
          <h1 style="margin:0 0 8px;color:${c.accentColor};font-size:28px;font-weight:700;letter-spacing:-0.5px;">${c.headline}</h1>
          <p style="margin:0;color:#9ca3af;font-size:15px;">${c.sub}</p>
        </td></tr>
        <tr><td style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="color:#6b7280;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Order #${orderNumber}</span>
            </td></tr>
            <tr><td style="padding:24px 28px;">
              ${c.body}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td align="center">
          <table cellpadding="0" cellspacing="0">
            <tr><td style="border-radius:10px;background:${c.accentColor};">
              <a href="${dashboardLink}" target="_blank" style="display:inline-block;padding:14px 36px;color:#000;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
                ${c.cta} &rarr;
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="height:32px;"></td></tr>
        <tr><td align="center" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
          <p style="margin:0 0 6px;color:#4b5563;font-size:13px;">Questions? <a href="mailto:support@onyxstudios.ai" style="color:#f59e0b;text-decoration:none;">support@onyxstudios.ai</a></p>
          <p style="margin:0;color:#374151;font-size:12px;">&copy; ${new Date().getFullYear()} Onyx Studios.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: c.subject, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { type, email, orderNumber, orderId } = payload;

    if (!type || !email || !orderNumber || !orderId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const dashboardLink = await getMagicLink(email, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { subject, html } = buildEmail(payload, dashboardLink);

    if (!RESEND_API_KEY) {
      console.warn("[Email] RESEND_API_KEY not set");
      return new Response(
        JSON.stringify({ success: false, message: "Email not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toAddress = ['files_uploaded', 'delivery_accepted'].includes(type)
      ? (Deno.env.get("ADMIN_EMAIL") || "admin@onyxstudios.ai")
      : email;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Onyx Studios <noreply@onyxstudios.ai>",
        to: toAddress,
        subject,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("[Resend] Failed:", result);
      return new Response(
        JSON.stringify({ success: false, error: result }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Strings Notification] Error:", err);
    return new Response(
      JSON.stringify({ error: "Failed", message: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
