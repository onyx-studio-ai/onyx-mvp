import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { sendEmail } from '@/lib/mail';
import { livenessRequestEmail } from '@/lib/mail-templates';
import { signLivenessToken } from '@/lib/liveness-token';
import { pickLivenessSentence } from '@/lib/liveness-sentences';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';

function svc() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Admin sends a real-human liveness verification request to a talent.
export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { talentId } = await request.json();
    if (!talentId) {
      return NextResponse.json({ error: 'talentId is required' }, { status: 400 });
    }

    const db = svc();
    const { data: talent, error } = await db
      .from('talents')
      .select('id, name, email, languages')
      .eq('id', talentId)
      .single();

    if (error || !talent) {
      return NextResponse.json({ error: 'Talent not found' }, { status: 404 });
    }
    if (!talent.email) {
      return NextResponse.json({ error: 'This talent has no email on file' }, { status: 400 });
    }

    const { lang, sentence } = pickLivenessSentence(talent.languages as string[] | null);
    const token = signLivenessToken(talent.id);
    // Localize the email + prefix the link with the talent's locale so the verify
    // page renders in their language. (Token is dotless, so the route resolves.)
    let locale = 'zh-TW';
    try {
      const { data: appRow } = await db.from('talent_applications').select('locale').eq('email', talent.email).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const loc = (appRow as { locale?: string } | null)?.locale;
      if (loc) locale = loc;
    } catch { /* non-fatal */ }
    const recordLink = `${SITE_URL}/${locale}/verify-voice/${token}`;

    const { error: upErr } = await db
      .from('talents')
      .update({
        liveness_status: 'sent',
        liveness_sentence: sentence,
        liveness_lang: lang,
        liveness_sent_at: new Date().toISOString(),
        liveness_recording_path: null,
        liveness_submitted_at: null,
        liveness_reviewed_at: null,
      })
      .eq('id', talent.id);

    if (upErr) {
      console.error('[Liveness] status update failed:', upErr);
      return NextResponse.json({ error: 'Failed to update talent' }, { status: 500 });
    }

    const { subject, html } = livenessRequestEmail({ talentName: talent.name || '', recordLink, locale });
    const result = await sendEmail({ category: 'HELLO', to: talent.email, subject, html });
    if (!result?.success) {
      return NextResponse.json({ error: 'Status set, but the email could not be sent.' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Liveness] send error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
