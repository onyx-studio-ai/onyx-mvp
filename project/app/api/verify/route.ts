import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const licenseId = searchParams.get('id');
    const orderIdLookup = searchParams.get('license_id_by_order');
    const orderType = searchParams.get('order_type');

    const supabase = getClient();

    if (orderIdLookup) {
      let query = supabase
        .from('certificates')
        .select('license_id, pdf_url, rights_level, issued_at')
        .eq('order_id', orderIdLookup);
      if (orderType) query = query.eq('order_type', orderType);
      const { data } = await query.order('issued_at', { ascending: false }).limit(1).maybeSingle();
      if (!data) return NextResponse.json(null, { status: 404 });
      return NextResponse.json(data);
    }

    if (!licenseId) {
      return NextResponse.json({ error: 'License ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('certificates')
      .select('license_id, order_type, order_number, product_category, asset_type, rights_level, rights_details, voice_id_ref, talent_name, audio_specs, pdf_url, issued_at')
      .eq('license_id', licenseId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    return NextResponse.json({ certificate: data });
  } catch (err) {
    console.error('[Verify] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
