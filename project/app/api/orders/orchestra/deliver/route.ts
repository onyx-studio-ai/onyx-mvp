import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { stringsWorkflowEmail } from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const AUTO_COMPLETE_DAYS = 14;

function getSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function sanitizePath(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._\-/]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const orderId = formData.get('orderId') as string | null;

    if (!file || !orderId) {
      return NextResponse.json({ error: 'Missing file or orderId' }, { status: 400 });
    }

    const db = getSupabaseClient();

    const safeName = sanitizePath(file.name);
    const filePath = `orchestra/${orderId}/delivery/${Date.now()}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await db.storage
      .from('deliverables')
      .upload(filePath, buffer, {
        contentType: 'application/octet-stream',
        upsert: true,
      });

    if (storageError) {
      console.error('Delivery upload error:', storageError);
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    const { data: urlData } = db.storage.from('deliverables').getPublicUrl(filePath);
    const fileUrl = urlData.publicUrl;

    const now = new Date();
    const autoCompleteAt = new Date(now.getTime() + AUTO_COMPLETE_DAYS * 24 * 60 * 60 * 1000);

    const { error: updateError } = await db
      .from('orchestra_orders')
      .update({
        delivery_file_url: fileUrl,
        status: 'delivered',
        delivered_at: now.toISOString(),
        auto_complete_at: autoCompleteAt.toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Delivery update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Send email notification
    const { data: order } = await db
      .from('orchestra_orders')
      .select('email, order_number')
      .eq('id', orderId)
      .single();

    if (order) {
      let dashboardLink = 'https://www.onyxstudios.ai/dashboard';
      try {
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        if (SERVICE_KEY) {
          const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
          const { data: linkData } = await adminClient.auth.admin.generateLink({
            type: 'magiclink', email: order.email, options: { redirectTo: 'https://www.onyxstudios.ai/dashboard' },
          });
          if (linkData?.properties?.action_link) dashboardLink = linkData.properties.action_link;
        }
      } catch { /* silent */ }

      const { subject, html } = stringsWorkflowEmail({
        type: 'delivery_ready',
        email: order.email,
        orderNumber: order.order_number,
        orderId: orderId!,
        dashboardLink,
      });
      await sendEmail({ category: 'PRODUCTION', to: order.email, subject, html });
    }

    return NextResponse.json({ url: fileUrl });
  } catch (err) {
    console.error('Delivery API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
