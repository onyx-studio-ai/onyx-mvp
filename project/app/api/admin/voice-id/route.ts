import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/mail';
import { voiceIdRequestEmail } from '@/lib/mail-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { talentId } = await request.json();
    if (!talentId) {
      return NextResponse.json({ error: 'talentId is required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: talent, error: fetchErr } = await supabase
      .from('talents')
      .select('*')
      .eq('id', talentId)
      .single();

    if (fetchErr || !talent) {
      console.error('[Voice ID] Fetch error:', fetchErr, 'talentId:', talentId);
      return NextResponse.json({ error: `Talent not found (${fetchErr?.message || 'no data'})` }, { status: 404 });
    }

    if (!talent.email) {
      return NextResponse.json({ error: 'Talent has no email address. Please add an email first.' }, { status: 400 });
    }

    if (talent.voice_id_status === 'submitted' || talent.voice_id_status === 'verified') {
      return NextResponse.json({ error: 'Voice ID already submitted or verified' }, { status: 400 });
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const vidCount = await supabase
      .from('talents')
      .select('id', { count: 'exact', head: true })
      .neq('voice_id_number', '')
      .not('voice_id_number', 'is', null);

    const seq = (vidCount.count ?? 0) + 1;
    const vidNumber = `VID-${String(seq).padStart(4, '0')}`;

    const { error: updateErr } = await supabase
      .from('talents')
      .update({
        voice_id_status: 'requested',
        voice_id_token: token,
        voice_id_token_expires: expires.toISOString(),
        voice_id_number: vidNumber,
      })
      .eq('id', talentId);

    if (updateErr) {
      console.error('[Voice ID] Update error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const uploadLink = `${SITE_URL}/voice-id/${token}`;
    const { subject, html } = voiceIdRequestEmail({
      talentName: talent.name || 'Talent',
      uploadLink,
      expiresIn: '7 days',
    });

    const emailResult = await sendEmail({
      category: 'HELLO',
      to: talent.email,
      subject,
      html,
    });

    return NextResponse.json({
      success: true,
      vidNumber,
      emailSent: emailResult.success,
    });
  } catch (err) {
    console.error('[Voice ID] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('talents')
      .select('*')
      .neq('voice_id_status', 'none')
      .order('voice_id_submitted_at', { ascending: false, nullsFirst: false });

    if (status && status !== 'all') {
      query = query.eq('voice_id_status', status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[Voice ID] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
