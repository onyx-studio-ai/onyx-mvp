import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hnblwckpnapsdladcjql.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

const supabase = getSupabaseClient();

export async function POST(request: NextRequest) {
  try {
    console.log('📥 [Draft API] Received draft save request');
    const body = await request.json();
    const {
      email,
      orderId,
      vibe,
      sonicRefUrl,
      usageType,
      description,
      tier,
      talentId,
      talentPrice
    } = body;

    console.log('📋 [Draft API] Request data:', {
      email,
      orderId: orderId || 'NEW',
      vibe,
      sonicRefUrl: sonicRefUrl?.substring(0, 50) + '...',
      usageType,
      tier,
      descriptionLength: description?.length
    });

    if (!email || !vibe || !sonicRefUrl || !description) {
      console.error('❌ [Draft API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use dedicated music_orders table
    const orderData = {
      email: email.trim().toLowerCase(),
      vibe: vibe,
      reference_link: sonicRefUrl.trim(),
      usage_type: usageType || null,
      description: description,
      tier: tier || null,
      talent_id: talentId || null,
      talent_price: talentPrice || 0,
      price: 0,
      status: 'draft',
    };

    if (orderId) {
      console.log('🔄 [Draft API] Updating existing music draft:', orderId);
      const { data, error } = await supabase
        .from('music_orders')
        .update(orderData)
        .eq('id', orderId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('❌ [Draft API] Error updating music draft order:', error);
        console.error('❌ [Draft API] Error details:', JSON.stringify(error, null, 2));
        return NextResponse.json(
          { error: 'Failed to update draft order', details: error.message },
          { status: 500 }
        );
      }

      console.log('✅ [Draft API] Music draft updated successfully:', data?.id);
      return NextResponse.json({ orderId: data?.id, updated: true });
    } else {
      console.log('➕ [Draft API] Creating new music draft order');
      const { data, error } = await supabase
        .from('music_orders')
        .insert([orderData])
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('❌ [Draft API] Error creating music draft order:', error);
        console.error('❌ [Draft API] Error details:', JSON.stringify(error, null, 2));
        return NextResponse.json(
          { error: 'Failed to create draft order', details: error.message },
          { status: 500 }
        );
      }

      console.log('✅ [Draft API] Music draft created successfully:', data?.id);
      return NextResponse.json({ orderId: data?.id, created: true });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
