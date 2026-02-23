/**
 * @deprecated This Edge Function has been replaced by the centralized mail system.
 * Email sending is now handled by lib/mail.ts + lib/mail-templates.ts in the Next.js app.
 * Triggered from: app/api/payment/pay/route.ts
 * This file is kept for reference only and should NOT be deployed.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderConfirmationPayload {
  email: string;
  orderNumber: string;
  amount: number;
  currency?: string;
  orderType: "voice" | "music";
  transactionId: string;
  orderId?: string;
  orderDetails?: {
    projectName?: string;
    language?: string;
    voiceSelection?: string;
    scriptText?: string;
    toneStyle?: string;
    useCase?: string;
    broadcastRights?: boolean;
    tier?: string;
    duration?: number;
    genre?: string;
    vibe?: string;
    mood?: string;
    tempo?: string;
    instruments?: string;
  };
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "TWD") return `NT$${amount.toLocaleString()}`;
  return `${currency} ${amount.toLocaleString()}`;
}

function tierLabel(tier?: string): string {
  if (tier === "tier-1") return "AI Instant Voice";
  if (tier === "tier-2") return "Director's Cut";
  if (tier === "tier-3") return "100% Live Studio";
  if (tier === "ai-curator") return "AI Curator";
  if (tier === "pro-arrangement") return "Pro Arrangement";
  if (tier === "masterpiece") return "Masterpiece";
  return tier || "—";
}

function buildOrderRows(payload: OrderConfirmationPayload): string {
  const d = payload.orderDetails || {};
  const currency = payload.currency || "TWD";
  const rows: { label: string; value: string }[] = [];

  rows.push({ label: "Order Number", value: `#${payload.orderNumber}` });
  rows.push({ label: "Email", value: payload.email });

  if (payload.orderType === "voice") {
    if (d.projectName) rows.push({ label: "Project Name", value: d.projectName });
    if (d.tier) rows.push({ label: "Service Tier", value: tierLabel(d.tier) });
    if (d.language) rows.push({ label: "Language", value: d.language });
    if (d.voiceSelection) rows.push({ label: "Voice", value: d.voiceSelection });
    if (d.toneStyle) rows.push({ label: "Tone Style", value: d.toneStyle });
    if (d.useCase) rows.push({ label: "Use Case", value: d.useCase });
    if (d.duration) rows.push({ label: "Estimated Duration", value: `~${d.duration} min` });
    if (d.broadcastRights) rows.push({ label: "Broadcast Rights", value: "Included" });
  } else {
    if (d.projectName) rows.push({ label: "Project Name", value: d.projectName });
    if (d.genre) rows.push({ label: "Genre", value: d.genre });
    if (d.vibe) rows.push({ label: "Vibe", value: d.vibe });
    if (d.mood) rows.push({ label: "Mood", value: d.mood });
    if (d.tempo) rows.push({ label: "Tempo", value: d.tempo });
    if (d.instruments) rows.push({ label: "Instruments", value: d.instruments });
  }

  rows.push({ label: "Amount Paid", value: formatCurrency(payload.amount, currency) });
  rows.push({ label: "Payment Status", value: "Paid" });
  rows.push({ label: "Transaction ID", value: payload.transactionId });

  return rows.map((r, i) => `
    <tr style="border-bottom: ${i < rows.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none"};">
      <td style="padding: 14px 20px; color: #9ca3af; font-size: 14px; white-space: nowrap;">${r.label}</td>
      <td style="padding: 14px 20px; color: #f3f4f6; font-size: 14px; text-align: right; font-weight: 500;">${r.value}</td>
    </tr>
  `).join("");
}

function buildEmailHTML(payload: OrderConfirmationPayload, magicLink: string): string {
  const orderTypeLabel = payload.orderType === "music" ? "Music Production" : "Voice Over";
  const currency = payload.currency || "TWD";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Order Confirmed — Onyx Studios</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background: linear-gradient(135deg, #111 0%, #1a1a1a 100%); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 24px;">
                    <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">ONYX</span>
                    <span style="color: #4ade80; font-size: 20px; font-weight: 300; letter-spacing: 2px; text-transform: uppercase;"> Studios</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Success icon + headline -->
          <tr>
            <td align="center" style="padding-bottom: 36px;">
              <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(74,222,128,0.12); border: 1px solid rgba(74,222,128,0.3); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px;">
                <img src="https://em-content.zobj.net/source/apple/391/check-mark-button_2705.png" width="36" height="36" alt="✅" style="display:block;" />
              </div>
              <h1 style="margin: 0 0 8px; color: #4ade80; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Payment Successful!</h1>
              <p style="margin: 0; color: #9ca3af; font-size: 16px;">Your ${orderTypeLabel} order has been confirmed.</p>
            </td>
          </tr>

          <!-- Order details card -->
          <tr>
            <td style="background: #111; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; margin-bottom: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <span style="color: #6b7280; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Order Details</span>
                  </td>
                </tr>
                ${buildOrderRows(payload)}
              </table>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>

          <!-- Magic link card -->
          <tr>
            <td style="background: linear-gradient(135deg, rgba(74,222,128,0.05) 0%, rgba(34,197,94,0.1) 100%); border: 1px solid rgba(74,222,128,0.2); border-radius: 16px; padding: 28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px; color: #4ade80; font-size: 16px; font-weight: 700;">Access Your Dashboard</p>
                    <p style="margin: 0 0 20px; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                      Click the button below to access your personal dashboard. You can track your order progress, download deliverables, and set your account password — all in one place.
                    </p>
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="border-radius: 10px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
                          <a href="${magicLink}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                            Go to My Dashboard →
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px;">
                      This link is valid for 24 hours. After clicking, you can set your own password from your dashboard settings.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height: 24px;"></td></tr>

          <!-- What happens next -->
          <tr>
            <td style="background: #111; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px 32px;">
              <p style="margin: 0 0 20px; color: #6b7280; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">What Happens Next</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${payload.orderType === "voice" ? `
                <tr>
                  <td style="padding-bottom: 16px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="width: 32px; height: 32px; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.2); border-radius: 50%; text-align: center; vertical-align: middle; color: #4ade80; font-size: 13px; font-weight: 700;">1</td>
                        <td style="padding-left: 14px; color: #d1d5db; font-size: 14px; line-height: 1.5;">Our team reviews your script and voice settings</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="width: 32px; height: 32px; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.2); border-radius: 50%; text-align: center; vertical-align: middle; color: #4ade80; font-size: 13px; font-weight: 700;">2</td>
                        <td style="padding-left: 14px; color: #d1d5db; font-size: 14px; line-height: 1.5;">Voice-over is produced and quality-checked</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="width: 32px; height: 32px; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.2); border-radius: 50%; text-align: center; vertical-align: middle; color: #4ade80; font-size: 13px; font-weight: 700;">3</td>
                        <td style="padding-left: 14px; color: #d1d5db; font-size: 14px; line-height: 1.5;">Download link delivered to your dashboard</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : `
                <tr>
                  <td style="padding-bottom: 16px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="width: 32px; height: 32px; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.2); border-radius: 50%; text-align: center; vertical-align: middle; color: #4ade80; font-size: 13px; font-weight: 700;">1</td>
                        <td style="padding-left: 14px; color: #d1d5db; font-size: 14px; line-height: 1.5;">Music production begins immediately</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="width: 32px; height: 32px; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.2); border-radius: 50%; text-align: center; vertical-align: middle; color: #4ade80; font-size: 13px; font-weight: 700;">2</td>
                        <td style="padding-left: 14px; color: #d1d5db; font-size: 14px; line-height: 1.5;">Estimated delivery within 7–14 days</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="width: 32px; height: 32px; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.2); border-radius: 50%; text-align: center; vertical-align: middle; color: #4ade80; font-size: 13px; font-weight: 700;">3</td>
                        <td style="padding-left: 14px; color: #d1d5db; font-size: 14px; line-height: 1.5;">High-quality audio download ready in your dashboard</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                `}
              </table>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height: 32px;"></td></tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 28px;">
              <p style="margin: 0 0 8px; color: #4b5563; font-size: 13px;">Questions? Reach us at <a href="mailto:support@onyxstudios.ai" style="color: #4ade80; text-decoration: none;">support@onyxstudios.ai</a></p>
              <p style="margin: 0; color: #374151; font-size: 12px;">© ${new Date().getFullYear()} Onyx Studios. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: OrderConfirmationPayload = await req.json();
    console.log("📧 [Email Service] Sending confirmation:", { email: payload.email, order: payload.orderNumber });

    const { email, orderNumber, amount } = payload;

    if (!email || !orderNumber || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", required: ["email", "orderNumber", "amount"] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const SITE_URL = "https://www.onyxstudios.ai";
    let magicLink = `${SITE_URL}/dashboard`;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: {
            redirectTo: `${SITE_URL}/dashboard`,
          },
        });

        if (!linkError && linkData?.properties?.action_link) {
          magicLink = linkData.properties.action_link;
          console.log("✅ [Auth] Magic link generated");
        } else {
          console.warn("⚠️ [Auth] Could not generate magic link:", linkError);
        }
      } catch (e) {
        console.warn("⚠️ [Auth] Error generating magic link:", e);
      }
    }

    const html = buildEmailHTML(payload, magicLink);
    const orderTypeLabel = payload.orderType === "music" ? "Music Production" : "Voice Over";
    const subject = `Your Onyx Studios ${orderTypeLabel} Order is Confirmed — #${orderNumber}`;

    if (!RESEND_API_KEY) {
      console.warn("⚠️ [Email] RESEND_API_KEY not set — email not sent");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Onyx Studios <noreply@onyxstudios.ai>",
        to: email,
        subject,
        html,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("❌ [Resend] Failed:", resendResult);
      return new Response(
        JSON.stringify({ success: false, error: resendResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ [Email] Sent successfully via Resend:", resendResult.id);

    return new Response(
      JSON.stringify({ success: true, messageId: resendResult.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ [Email Service] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email", message: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
