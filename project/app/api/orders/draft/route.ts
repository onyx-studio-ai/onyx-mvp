import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
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

      return NextResponse.json({ orderId: data?.id, updated: true });
    } else {
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

      return NextResponse.json({ orderId: data?.id, created: true });
    }
  } catch (err) {
    return supabaseErrorResponse(err, 'api/orders/draft');
  }
}
