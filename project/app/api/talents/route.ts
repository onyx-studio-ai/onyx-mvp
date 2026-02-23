import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hnblwckpnapsdladcjql.supabase.co';

function getSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type') || 'singer';

    const db = getSupabaseClient();

    let query = db
      .from('talents')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (typeParam.toLowerCase() === 'all') {
      // no type filter
    } else if (typeParam.toLowerCase() === 'vo' || typeParam.toLowerCase() === 'voice_actor') {
      query = query.in('type', ['VO', 'voice_actor']);
    } else {
      const type = typeParam.charAt(0).toUpperCase() + typeParam.slice(1).toLowerCase();
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching talents:', error);
      return NextResponse.json({ error: 'Failed to fetch talents' }, { status: 500 });
    }

    const talents = (data || []).map((t: any) => {
      const { internal_cost, ...rest } = t;
      return {
        ...rest,
        frontend_price: t.frontend_price || internal_cost * 1.6,
      };
    });

    return NextResponse.json(talents);
  } catch (error) {
    console.error('Talents API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
