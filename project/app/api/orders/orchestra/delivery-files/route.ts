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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const db = getSupabaseClient();
    const folder = `orchestra/${orderId}/delivery`;

    const { data, error } = await db.storage
      .from('deliverables')
      .list(folder, { sortBy: { column: 'created_at', order: 'desc' } });

    if (error) {
      console.error('List delivery files error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const files = (data || [])
      .filter((f) => f.name !== '.emptyFolderPlaceholder')
      .map((f) => {
        const { data: urlData } = db.storage
          .from('deliverables')
          .getPublicUrl(`${folder}/${f.name}`);

        const nameParts = f.name.replace(/^\d+-/, '');

        return {
          name: nameParts || f.name,
          url: urlData.publicUrl,
          created_at: f.created_at,
          size: f.metadata?.size || 0,
        };
      });

    return NextResponse.json(files);
  } catch (err) {
    console.error('Delivery files API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
