/**
 * @deprecated This Edge Function has been replaced by the centralized mail system.
 * Email sending is now handled by lib/mail.ts + lib/mail-templates.ts in the Next.js app.
 * Triggered from: components/admin/MusicOrderWorkflow.tsx via /api/mail/send
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
  | "demos_ready"
  | "client_feedback_received"
  | "revision_ready"
  | "final_ready"
  | "order_complete";

interface NotificationPayload {
  type: NotificationType;
  email: string;
  orderNumber: string;
  orderId: string;
  recipientName?: string;
  maxRevisions?: number;
  revisionsUsed?: number;
  extraMessage?: string;
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

function revisionBadge(used: number, max: number): string {
  if (max >= 5) return `<span style="color:#4ade80;">${max} complimentary revision rounds</span> included in your plan. Additional revisions quoted separately.`;
  const remaining = max - used;
  if (remaining <= 0) return `<span style="color:#ef4444;">No revisions remaining</span> in your plan.`;
  const color = remaining === 1 ? "#f59e0b" : "#4ade80";
  return `<span style="color:${color};">${remaining} revision${remaining !== 1 ? "s" : ""} remaining</span> (${used} of ${max} used).`;
}

function buildEmail(payload: NotificationPayload, dashboardLink: string): { subject: string; html: string } {
  const { type, orderNumber, revisionsUsed = 0, maxRevisions = 1, extraMessage } = payload;

  const configs: Record<NotificationType, { subject: string; headline: string; sub: string; accentColor: string; body: string; cta: string }> = {
    demos_ready: {
      subject: `Your Demo Sketches Are Ready — #${orderNumber}`,
      headline: "Your Demos Are Ready to Review",
      sub: "We've prepared multiple creative directions for your music.",
      accentColor: "#3b82f6",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Our producers have created several demo sketches for your project. Head to your dashboard to listen to each option and select the direction you want us to develop.
        </p>
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">
          For each demo you can leave time-stamped feedback — mark sections you love, things to change, and any questions. This helps our producers understand exactly what you're looking for.
        </p>
        ${extraMessage ? `<p style="color:#9ca3af;font-size:14px;font-style:italic;margin:0;">${extraMessage}</p>` : ""}
      `,
      cta: "Review My Demos",
    },
    client_feedback_received: {
      subject: `Client Feedback Received — Order #${orderNumber}`,
      headline: "Client Has Submitted Feedback",
      sub: "Review their annotations and begin production.",
      accentColor: "#f59e0b",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">
          The client has selected their preferred demo direction and submitted detailed feedback with time-stamped annotations. Log in to the admin dashboard to review their notes and begin full production.
        </p>
      `,
      cta: "View Order in Admin",
    },
    revision_ready: {
      subject: `Revision Update Ready — #${orderNumber}`,
      headline: "Your Revision Is Ready",
      sub: "We've made the changes you requested.",
      accentColor: "#06b6d4",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Our team has completed the requested changes. Head to your dashboard to listen to the updated track.
        </p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;margin:0 0 16px;">
          <p style="margin:0;font-size:13px;color:#9ca3af;">Revision Status</p>
          <p style="margin:4px 0 0;font-size:14px;">${revisionBadge(revisionsUsed, maxRevisions)}</p>
        </div>
        ${extraMessage ? `<p style="color:#9ca3af;font-size:14px;font-style:italic;margin:0;">${extraMessage}</p>` : ""}
      `,
      cta: "Listen to Updated Track",
    },
    final_ready: {
      subject: `Your Final Track Is Ready — #${orderNumber}`,
      headline: "Your Music Is Complete",
      sub: "Download your final high-quality files now.",
      accentColor: "#4ade80",
      body: `
        <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Great news — your music production is complete! Your final high-quality audio files are ready for download in your dashboard.
        </p>
        ${extraMessage ? `<p style="color:#9ca3af;font-size:14px;font-style:italic;margin:0;">${extraMessage}</p>` : ""}
      `,
      cta: "Download My Files",
    },
    order_complete: {
      subject: `Order Complete — #${orderNumber}`,
      headline: "Order Complete",
      sub: "Everything is wrapped up.",
      accentColor: "#4ade80",
      body: `<p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0;">Your order #${orderNumber} has been marked as complete. Thank you for working with Onyx Studios.</p>`,
      cta: "View Dashboard",
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
            <span style="color:#4ade80;font-size:20px;font-weight:300;letter-spacing:2px;"> Studios</span>
          </div>
        </td></tr>

        <tr><td align="center" style="padding-bottom:36px;">
          <div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.04);border:1px solid ${c.accentColor}33;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;"></div>
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
                ${c.cta} →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="height:32px;"></td></tr>

        <tr><td align="center" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
          <p style="margin:0 0 6px;color:#4b5563;font-size:13px;">Questions? <a href="mailto:support@onyxstudios.ai" style="color:#4ade80;text-decoration:none;">support@onyxstudios.ai</a></p>
          <p style="margin:0;color:#374151;font-size:12px;">© ${new Date().getFullYear()} Onyx Studios.</p>
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
        JSON.stringify({ error: "Missing required fields: type, email, orderNumber, orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const dashboardLink = await getMagicLink(email, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { subject, html } = buildEmail(payload, dashboardLink);

    if (!RESEND_API_KEY) {
      console.warn("[Email] RESEND_API_KEY not set — skipping send");
      return new Response(
        JSON.stringify({ success: false, message: "Email not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toAddress = type === "client_feedback_received"
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
    console.error("[Notification] Error:", err);
    return new Response(
      JSON.stringify({ error: "Failed", message: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
