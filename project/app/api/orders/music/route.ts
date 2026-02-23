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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
    }

    const db = getSupabaseClient();
    const { data, error } = await db
      .from('music_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      project_name,
      vibe,
      reference_link,
      usage_type,
      description,
      tier,
      talent_id,
      talent_price,
      string_addon,
      price,
      status,
      payment_status,
      order_number,
    } = body;

    if (!email || !description || !tier) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getSupabaseClient();

    const maxVersions = tier === 'masterpiece' ? 5 : tier === 'pro-arrangement' ? 3 : 2;

    const orderData: Record<string, any> = {
      email: email.trim().toLowerCase(),
      project_name: project_name?.trim() || null,
      vibe,
      reference_link: reference_link?.trim() || '',
      usage_type: usage_type || null,
      description: description.trim(),
      tier,
      talent_id: talent_id || null,
      talent_price: talent_price || 0,
      string_addon: string_addon || null,
      price: price || 0,
      status: status || 'pending_payment',
      payment_status: payment_status || 'pending',
      order_number: order_number || null,
      max_versions: maxVersions,
      version_count: 0,
    };

    let { data, error } = await db
      .from('music_orders')
      .insert([orderData])
      .select('id, order_number')
      .single();

    if (error && error.code === 'PGRST204' && error.message?.includes('project_name')) {
      delete orderData.project_name;
      const retry = await db
        .from('music_orders')
        .insert([orderData])
        .select('id, order_number')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error creating music order:', error);
      return NextResponse.json(
        { error: 'Failed to create order', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data.id, order_number: data.order_number });
  } catch (error) {
    console.error('Music order API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
