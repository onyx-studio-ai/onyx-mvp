import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { talentReviewEmail } from '@/lib/mail-templates';

/*
  Admin "changes requested": email the talent what to fix, then clear
  pending_review so they LEAVE the review queue (they re-enter only when they fix
  things and submit again). Does NOT touch the public snapshot — a previously
  approved talent stays live (their pending edit is simply set aside, profile back
  to Active); a never-published talent drops back to 草稿中 (off the roster).
  Fired by the admin's own click, so the notification is transactional.
*/

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { talentId, reason } = await request.json();
    if (!talentId) return NextResponse.json({ error: 'talentId is required' }, { status: 400 });

    const db = getSupabaseServiceClient();
    const { data, error } = await db.from('talents').select('id, name, email').eq('id', talentId).single();
    if (error || !data) return NextResponse.json({ error: 'Talent not found' }, { status: 404 });
    const t = data as unknown as { id: string; name: string | null; email: string | null };
    if (!t.email) return NextResponse.json({ error: 'This talent has no email on file' }, { status: 400 });

    let locale = 'zh-TW';
    try {
      const { data: appRow } = await db.from('talent_applications').select('locale').eq('email', t.email).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (appRow?.locale) locale = appRow.locale as string;
    } catch { /* non-fatal */ }

    const { subject, html } = talentReviewEmail({
      talentName: t.name || '', approved: false, reason: reason || '', locale,
      profileLink: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai'}/talent`,
    });
    const r = await sendEmail({ category: 'HELLO', to: t.email, subject, html });
    if (!r?.success) return NextResponse.json({ error: 'Could not send the email' }, { status: 502 });

    // Drop them out of the review queue — they re-enter only by submitting again.
    // (Email sent first, so a send failure never silently removes them.)
    await db.from('talents').update({ pending_review: false, updated_at: new Date().toISOString() }).eq('id', talentId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/talents/reject');
  }
}
