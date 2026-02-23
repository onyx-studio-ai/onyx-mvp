import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function generateOrderNumber(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORK-${ymd}${rand}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');
    const all = searchParams.get('all');

    const db = getSupabaseClient();

    if (all) {
      const { data, error } = await db
        .from('orchestra_orders')
        .select('*')
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data || []);
    }

    if (id) {
      const { data, error } = await db
        .from('orchestra_orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json(data);
    }

    if (email) {
      const { data, error } = await db
        .from('orchestra_orders')
        .select('*')
        .eq('email', email)
        .not('status', 'in', '("pending_payment","draft")')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data || []);
    }

    return NextResponse.json({ error: 'Missing id or email parameter' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
    }

    const db = getSupabaseClient();
    const { data, error } = await db
      .from('orchestra_orders')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
      user_id,
      project_name,
      tier,
      tier_name,
      duration_minutes,
      price,
      genre,
      description,
      reference_url,
      usage_type,
    } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const db = getSupabaseClient();
    const orderNumber = generateOrderNumber();

    const { data, error } = await db.from('orchestra_orders').insert({
      order_number: orderNumber,
      email,
      user_id: user_id || null,
      project_name: project_name || '',
      tier: tier || 'tier1',
      tier_name: tier_name || '',
      duration_minutes: duration_minutes || 1,
      price: price || 0,
      genre: genre || '',
      description: description || '',
      reference_url: reference_url || '',
      usage_type: usage_type || '',
      status: 'pending_payment',
      payment_status: 'unpaid',
    }).select('id').single();

    if (error) {
      console.error('Orchestra order insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id, order_number: orderNumber });
  } catch (err) {
    console.error('Orchestra order API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
