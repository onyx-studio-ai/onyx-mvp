import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';
import { verifyOnboardToken } from '@/lib/onboard-token';

/*
  Post-approval onboarding (token-gated, no login). GET validates the token
  and returns the talent's public name + whether they've already completed it.
  POST records agreement to the cooperation terms and activates the talent
  (is_active=true) so they appear in the public roster.
*/

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('t') || '';
    const appId = verifyOnboardToken(token);
    if (!appId) return NextResponse.json({ valid: false }, { status: 400 });

    const db = getSupabaseServiceClient();
    const { data } = await db.from('talents').select('name, is_active').eq('application_id', appId).single();
    if (!data) return NextResponse.json({ valid: false }, { status: 404 });

    return NextResponse.json({ valid: true, name: data.name, done: data.is_active });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talents/onboard:GET');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const appId = verifyOnboardToken(body.token || '');
    if (!appId) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });
    if (!body.agree) return NextResponse.json({ error: 'Please agree to the terms' }, { status: 400 });

    const db = getSupabaseServiceClient();
    const { error } = await db
      .from('talents')
      .update({ is_active: true })
      .eq('application_id', appId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talents/onboard:POST');
  }
}
