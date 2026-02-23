import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Promo code is required' }, { status: 400 });
    }

    const normalized = code.trim().toUpperCase();

    const { data, error } = await supabase
      .from('promos')
      .select('id, code, discount_type, value, usage_count, max_uses, status, expires_at')
      .eq('code', normalized)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid promo code' }, { status: 404 });
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This promo code has expired' }, { status: 410 });
    }

    if (data.max_uses !== null && data.usage_count >= data.max_uses) {
      return NextResponse.json({ error: 'This promo code has reached its usage limit' }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      code: data.code,
      discount_type: data.discount_type,
      discount: data.value,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to validate promo code' }, { status: 500 });
  }
}
