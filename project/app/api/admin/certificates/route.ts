import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { generateCertificatePdf } from '@/lib/certificate-pdf';
import { mapRightsForCertificate, getAssetType, getProductCategory, type RightsLevel } from '@/lib/certificate-rights';
import { sendEmail } from '@/lib/mail';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET: List certificates (optionally filter by order_id)
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');
    const orderNumber = searchParams.get('order_number');

    let query = supabase
      .from('certificates')
      .select('*')
      .order('created_at', { ascending: false });

    if (orderId) query = query.eq('order_id', orderId);
    if (orderNumber) query = query.eq('order_number', orderNumber);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[Certificates] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Generate a certificate
export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const {
      orderId,
      orderNumber,
      orderType,
      tier,
      rightsLevel = 'standard',
      clientEmail,
      clientName,
      projectName,
      talentName: inputTalentName,
      voiceIdRef: inputVoiceIdRef,
      talentId,
      audioSpecs,
      sendToClient = false,
    } = body;

    if (!orderId || !orderNumber || !orderType || !tier || !clientEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Check if certificate already exists for this order
    const { data: existing } = await supabase
      .from('certificates')
      .select('id, license_id')
      .eq('order_id', orderId)
      .single();

    if (existing) {
      return NextResponse.json({
        error: `Certificate already exists: ${existing.license_id}`,
        existingId: existing.id,
      }, { status: 409 });
    }

    // Auto-lookup talent name and Voice ID from talent_id
    let talentName = inputTalentName || '';
    let voiceIdRef = inputVoiceIdRef || '';

    if (talentId && (!talentName || !voiceIdRef)) {
      const { data: talent } = await supabase
        .from('talents')
        .select('name, voice_id_status, voice_id_number')
        .eq('id', talentId)
        .single();

      if (talent) {
        if (!talentName) talentName = talent.name || '';
        if (!voiceIdRef && talent.voice_id_status === 'verified' && talent.voice_id_number) {
          voiceIdRef = talent.voice_id_number;
        }
      }
    }

    const licenseId = `ONYX-${orderNumber}`;
    const verifyUrl = `${SITE_URL}/verify/${licenseId}`;

    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 120,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
    });

    const rights = mapRightsForCertificate({
      orderType,
      tier,
      rightsLevel: rightsLevel as RightsLevel,
      voiceIdRef,
    });

    const issueDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // Resolve licensee details: prioritize licensee_details from order over manually passed values
    let resolvedClientName = clientName || '';
    let resolvedClientEmail = clientEmail || '';
    let clientTaxId = body.clientTaxId || '';
    let clientContactPerson = body.clientContactPerson || '';
    let clientCountry = body.clientCountry || '';

    const orderTables = ['voice_orders', 'music_orders', 'orchestra_orders'];
    for (const table of orderTables) {
      const { data: orderData } = await supabase
        .from(table)
        .select('licensee_details, billing_details, email')
        .eq('id', orderId)
        .maybeSingle();

      if (orderData) {
        const lic = orderData.licensee_details as any;
        if (lic) {
          if (lic.name) resolvedClientName = lic.name;
          if (lic.email) resolvedClientEmail = lic.email;
          if (lic.taxId) clientTaxId = lic.taxId;
          if (lic.contactPerson) clientContactPerson = lic.contactPerson;
          if (lic.country) clientCountry = lic.country;
        }
        if (!resolvedClientEmail) {
          resolvedClientEmail = orderData.email || '';
        }
        break;
      }
    }

    const pdfBuffer = await generateCertificatePdf({
      licenseId,
      issueDate,
      clientName: resolvedClientName,
      clientEmail: resolvedClientEmail,
      clientTaxId,
      clientContactPerson,
      clientCountry,
      projectName: projectName || `Order #${orderNumber}`,
      productCategory: getProductCategory(orderType, tier),
      assetType: getAssetType(orderType),
      rightsLevel: rightsLevel as RightsLevel,
      rights,
      talentName,
      audioSpecs: audioSpecs || '24-bit/48kHz WAV',
      qrCodeDataUrl,
    });

    // Upload PDF to Supabase Storage
    const storagePath = `${licenseId}/${Date.now()}_certificate.pdf`;
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('certificates')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadErr) {
      console.error('[Certificates] Upload error:', uploadErr);
      return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('certificates')
      .getPublicUrl(uploadData.path);

    // Save certificate record
    const certRecord = {
      license_id: licenseId,
      order_id: orderId,
      order_type: orderType,
      order_number: orderNumber,
      client_email: clientEmail,
      client_name: clientName || '',
      project_name: projectName || '',
      product_category: getProductCategory(orderType, tier),
      asset_type: getAssetType(orderType),
      rights_level: rightsLevel,
      rights_details: rights,
      voice_id_ref: voiceIdRef || '',
      talent_name: talentName || '',
      audio_specs: audioSpecs || '24-bit/48kHz WAV',
      qr_code_url: verifyUrl,
      pdf_url: urlData.publicUrl,
    };

    const { data: certData, error: insertErr } = await supabase
      .from('certificates')
      .insert(certRecord)
      .select()
      .single();

    if (insertErr) {
      console.error('[Certificates] Insert error:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Optionally send to client
    if (sendToClient && clientEmail) {
      const emailHtml = certificateEmailTemplate({
        licenseId,
        clientName: clientName || 'Valued Client',
        productCategory: getProductCategory(orderType, tier),
        verifyUrl,
        downloadUrl: urlData.publicUrl,
      });

      await sendEmail({
        category: 'PRODUCTION',
        to: clientEmail,
        subject: `Your License Certificate — #${licenseId}`,
        html: emailHtml,
      });
    }

    return NextResponse.json({
      success: true,
      certificate: certData,
      pdfUrl: urlData.publicUrl,
    });
  } catch (err) {
    console.error('[Certificates] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function certificateEmailTemplate(p: {
  licenseId: string;
  clientName: string;
  productCategory: string;
  verifyUrl: string;
  downloadUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:linear-gradient(135deg,#111 0%,#1a1a1a 100%);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 24px;">
              <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:2px;">ONYX</span>
              <span style="color:#4ade80;font-size:20px;font-weight:300;letter-spacing:2px;"> Studios</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding-bottom:36px;">
          <h1 style="margin:0 0 8px;color:#4ade80;font-size:28px;font-weight:700;">License Certificate Issued</h1>
          <p style="margin:0;color:#9ca3af;font-size:15px;">Your official rights documentation is ready.</p>
        </td></tr>
        <tr><td style="background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px 32px;">
          <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Dear ${p.clientName},</p>
          <p style="color:#d1d5db;font-size:15px;line-height:1.7;margin:0 0 16px;">Your License Certificate for <strong style="color:#fff;">${p.productCategory}</strong> has been generated and is attached below. This document serves as your official proof of rights and licensing terms.</p>
          <div style="background:rgba(74,222,128,0.05);border:1px solid rgba(74,222,128,0.2);border-radius:10px;padding:16px 20px;margin:0 0 16px;">
            <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;">License ID</p>
            <p style="margin:0;color:#4ade80;font-size:18px;font-weight:700;font-family:monospace;letter-spacing:1px;">#${p.licenseId}</p>
          </div>
          <p style="color:#9ca3af;font-size:13px;margin:0;">You can verify this certificate anytime at <a href="${p.verifyUrl}" style="color:#4ade80;text-decoration:none;">${p.verifyUrl}</a></p>
        </td></tr>
        <tr><td style="height:24px;"></td></tr>
        <tr><td align="center">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:10px;background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);">
              <a href="${p.downloadUrl}" target="_blank" style="display:inline-block;padding:14px 36px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Download Certificate PDF &rarr;</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="height:32px;"></td></tr>
        <tr><td align="center" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:28px;">
          <p style="margin:0 0 8px;color:#4b5563;font-size:13px;">Questions? <a href="mailto:support@onyxstudios.ai" style="color:#4ade80;text-decoration:none;">support@onyxstudios.ai</a></p>
          <p style="margin:0;color:#374151;font-size:11px;">&copy; ${new Date().getFullYear()} Onyx Studios. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
