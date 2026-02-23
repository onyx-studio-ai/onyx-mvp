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

const USE_CASE_CODES: Record<string, string> = {
  'Social Media': 'SM',
  'Advertisement': 'AD',
  'Corporate': 'CO',
  'Broadcast': 'BR',
  'E-Learning': 'EL',
  'Podcast': 'PD',
  'Audiobook': 'AB',
  'IVR': 'IV',
};

async function generateVoiceOrderNumber(
  db: ReturnType<typeof getSupabaseClient>,
  tier: string,
  useCase: string,
  broadcastRights: boolean,
  billingType: string,
  now: Date
): Promise<string> {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;

  const tierCode = tier === 'tier-1' ? 'T1' : tier === 'tier-2' ? 'T2' : tier === 'tier-3' ? 'T3' : 'T1';
  const ucCode = USE_CASE_CODES[useCase] || useCase.substring(0, 2).toUpperCase();
  const brCode = broadcastRights ? 'Y' : 'N';
  const typeCode = billingType === 'company' ? 'C' : 'I';

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const { count } = await db
    .from('voice_orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString());

  const seq = String((count ?? 0) + 1).padStart(3, '0');
  return `VO-${dateStr}${tierCode}${ucCode}${brCode}${typeCode}${seq}`;
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
      .from('voice_orders')
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
      language,
      voice_selection,
      script_text,
      tone_style,
      use_case,
      broadcast_rights,
      rights_level,
      tier,
      duration,
      price,
      project_name,
      talent_id,
      talent_price,
      billing_details,
      status,
      payment_status,
    } = body;

    if (!email || !script_text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = getSupabaseClient();

    const resolvedTier = tier || 'tier-1';
    const resolvedUseCase = use_case || 'Advertisement';
    const resolvedBroadcast = broadcast_rights || false;
    const resolvedBillingType = billing_details?.billing_type || 'individual';
    const now = new Date();

    const order_number = await generateVoiceOrderNumber(
      db, resolvedTier, resolvedUseCase, resolvedBroadcast, resolvedBillingType, now
    );

    const maxRevisions = resolvedTier === 'tier-3' ? 1 : 2;

    const resolvedRightsLevel = rights_level || (resolvedBroadcast ? 'broadcast' : 'standard');

    const orderData: Record<string, unknown> = {
      order_number,
      email: email.trim().toLowerCase(),
      language: language || 'English',
      voice_selection: voice_selection || '',
      script_text: script_text.trim(),
      tone_style: tone_style || 'Professional',
      use_case: resolvedUseCase,
      broadcast_rights: resolvedBroadcast,
      tier: resolvedTier,
      duration: duration || 0,
      price: price || 0,
      project_name: project_name || '',
      talent_id: talent_id || null,
      talent_price: talent_price || 0,
      billing_details: billing_details || null,
      status: status || 'draft',
      payment_status: payment_status || 'pending',
      revision_count: 0,
      max_revisions: maxRevisions,
    };

    // Try with rights_level first; if column doesn't exist yet, retry without it
    orderData.rights_level = resolvedRightsLevel;

    let result = await db
      .from('voice_orders')
      .insert(orderData)
      .select('id, order_number')
      .maybeSingle();

    if (result.error?.code === 'PGRST204' && result.error?.message?.includes('rights_level')) {
      delete orderData.rights_level;
      result = await db
        .from('voice_orders')
        .insert(orderData)
        .select('id, order_number')
        .maybeSingle();
    }

    const { data, error } = result;

    if (error) {
      console.error('Error creating voice order:', error);
      return NextResponse.json({ error: 'Failed to create order', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data?.id, order_number: data?.order_number });
  } catch (error) {
    console.error('Voice order API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, ...updateData } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const db = getSupabaseClient();

    const { error } = await db
      .from('voice_orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      console.error('Error updating voice order:', error);
      return NextResponse.json({ error: 'Failed to update order', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Voice order update API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
