import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyLivenessToken } from '@/lib/liveness-token';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Talent-facing: resolves a liveness token to the name + the sentence to read.
// No auth — the signed token IS the credential. Returns minimal data only.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const talentId = verifyLivenessToken(token);
  if (!talentId) {
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 401 });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: talent, error } = await db
      .from('talents')
      .select('name, liveness_status, liveness_sentence, liveness_lang')
      .eq('id', talentId)
      .single();

    if (error || !talent) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({
      name: talent.name || '',
      sentence: talent.liveness_sentence || '',
      lang: talent.liveness_lang || 'en',
      alreadySubmitted: ['submitted', 'verified'].includes(talent.liveness_status || ''),
    });
  } catch (err) {
    console.error('[Liveness] info error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
