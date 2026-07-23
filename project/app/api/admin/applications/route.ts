import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';
import { applicationStatusEmail } from '@/lib/mail-templates';
import { signOnboardToken } from '@/lib/onboard-token';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import {
  getSupabaseServiceClient,
  supabaseErrorResponse,
  storagePathFromRef,
} from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const db = getSupabaseServiceClient();
    const { data, error } = await db
      .from('talent_applications')
      .select('*, talents:talent_id(id, name, is_active, voice_id_status)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sign demo URLs on read so the bucket can be private. Handles both a
    // bare storage path and a legacy full public URL; leaves anything that
    // isn't a talent-submissions reference untouched. Works on public buckets
    // too, so this is safe to ship before the bucket is switched to private.
    const SUBMISSIONS_BUCKET = 'talent-submissions';
    const marker = `/${SUBMISSIONS_BUCKET}/`;
    const signed = await Promise.all(
      (data || []).map(async (app) => {
        const ref: string | null = app?.demo_file_url || null;
        if (!ref) return app;
        // Leave external (non-storage) URLs untouched.
        if (ref.startsWith('http') && !ref.includes(marker)) return app;
        const path = storagePathFromRef(ref, SUBMISSIONS_BUCKET);
        if (!path) return app;
        try {
          const { data: s } = await db.storage
            .from(SUBMISSIONS_BUCKET)
            .createSignedUrl(path, 3600);
          if (s?.signedUrl) return { ...app, demo_file_url: s.signedUrl };
        } catch {
          /* fall back to original on any error */
        }
        return app;
      })
    );
    return NextResponse.json(signed);
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/applications GET');
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { id, reasons, ...updateData } = body;   // reasons 只用於拒絕信,不寫進 DB

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const db = getSupabaseServiceClient();
    const { error } = await db
      .from('talent_applications')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (updateData.status === 'approved' || updateData.status === 'rejected') {
      const { data: application } = await db
        .from('talent_applications')
        .select('*')
        .eq('id', id)
        .single();

      if (application?.email) {
        // Approval email carries a token onboarding link (keyed on the
        // application id; the talent row created below carries application_id).
        const locPrefix = application.locale && application.locale !== 'en' ? `/${application.locale}` : '';
        const onboardUrl = updateData.status === 'approved'
          ? `https://www.onyxstudios.ai${locPrefix}/onboard?t=${signOnboardToken(id)}`
          : undefined;
        const { subject, html } = applicationStatusEmail({
          applicantName: application.full_name || 'Applicant',
          applicationNumber: application.application_number || id,
          status: updateData.status as 'approved' | 'rejected',
          locale: application.locale,
          onboardUrl,
          reasons: Array.isArray(reasons) ? reasons : undefined,
        });
        await sendEmail({ category: 'HELLO', to: application.email, subject, html });
      }

      if (updateData.status === 'approved' && application) {
        // ilike:歷史 email 大小寫混雜,eq miss 就再建一個帳號(比照 casting/join 2026-07-22)
        const { data: existingRows } = application.email
          ? await db.from('talents').select('id').ilike('email', application.email).limit(1)
          : { data: null };
        const existing = existingRows?.[0] || null;

        if (existing) {
          await db.from('talent_applications').update({ talent_id: existing.id }).eq('id', id);
          // Also set the REVERSE link (talent → this application). Without it,
          // /api/talents/onboard's token lookup (.eq('application_id', appId))
          // never matches, so the approval email's "設定密碼" link always shows
          // "連結無效或已過期" for anyone who already had a talents row (e.g. a
          // re-submitted application) — a real, reproducible bug (2026-07-01,
          // 徐小飛 case), not link expiry.
          await db.from('talents').update({ application_id: id }).eq('id', existing.id);
        } else {
          const roleMap: Record<string, string> = { VO: 'VO', Singer: 'Singer', voice_actor: 'VO', singer: 'Singer' };
          const talentType = roleMap[application.role_type] || 'VO';

          const demoUrls: Array<{ name: string; url: string }> = [];
          if (application.demo_file_url) {
            // The submission lives in the (soon-to-be-private) talent-submissions
            // bucket. Copy it into the PUBLIC talent-demos bucket so /voices can
            // still play it once talent-submissions is locked down.
            let publicUrl = '';
            try {
              const SUB = 'talent-submissions';
              const srcPath = storagePathFromRef(String(application.demo_file_url), SUB);

              if (!srcPath || srcPath.startsWith('http')) {
                publicUrl = String(application.demo_file_url);
              } else {
                const { data: blob, error: dlErr } = await db.storage.from(SUB).download(srcPath);
                if (!dlErr && blob) {
                  const namePart = srcPath.split('/').pop() || 'demo.wav';
                  const destPath = `approved/${id}/${namePart}`;
                  const buf = Buffer.from(await blob.arrayBuffer());
                  const { error: upErr } = await db.storage
                    .from('talent-demos')
                    .upload(destPath, buf, { contentType: blob.type || 'audio/wav', upsert: true });
                  if (!upErr) {
                    publicUrl = db.storage.from('talent-demos').getPublicUrl(destPath).data.publicUrl;
                  }
                }
              }
            } catch (e) {
              console.error('[Applications] demo copy to public bucket failed:', e);
            }
            demoUrls.push({
              name: application.demo_file_name || 'Application Demo',
              url: publicUrl || String(application.demo_file_url),
            });
          }

          // Service classification (from collaboration choices) — prepended so
          // it shows first in the roster. Lets clients see who does AI/TTS and
          // lets us target broadcasts by service type. Canonical English; the
          // gallery localizes the display.
          const serviceTags: string[] = [];
          if (application.coop_ai_clone) serviceTags.push('AI Voice');
          if (application.coop_ai_training) serviceTags.push('TTS Data');
          if (application.coop_proofread) serviceTags.push('Proofreading');
          if (application.coop_voice_director) serviceTags.push('Voice Director');
          const tags: string[] = [
            ...serviceTags,
            ...(application.voice_types || []),
            ...(application.specialties || []),
          ];

          const expectedRates: Record<string, number | null> = {
            expected_rate_voice: application.expected_rate_voice ?? null,
            expected_rate_music: application.expected_rate_music ?? null,
            rate_lead_vocal: application.rate_lead_vocal ?? null,
            rate_hook_chorus: application.rate_hook_chorus ?? null,
          };

          const lowestRate = Math.min(
            ...[application.expected_rate_voice, application.expected_rate_music, application.rate_lead_vocal, application.rate_hook_chorus]
              .filter((r): r is number => r != null && r > 0)
          );

          const { data: newTalent, error: talentError } = await db.from('talents').insert([{
            type: talentType,
            // Public roster shows this name → prefer the public display name,
            // never the legal full_name.
            name: application.display_name || application.full_name,
            english_name: application.english_name || null,
            turnaround: application.turnaround || null,
            years_experience: application.years_experience ?? null,
            native_languages: application.native_languages || [],
            email: application.email || null,
            gender: application.gender || null,
            accent: application.accent || null,
            languages: application.languages || [],
            category: 'in_house',
            tags,
            bio: application.bio || '',
            demo_urls: demoUrls,
            internal_cost: isFinite(lowestRate) ? lowestRate : 0,
            is_active: false,
            sort_order: 0,
            application_id: id,
            phone: application.phone || null,
            country: application.country || null,
            expected_rates: expectedRates,
            // Carry the applicant's cooperation opt-ins onto the live talent row so
            // downstream (casting filters, /talent self-edit) reflect what they agreed
            // to. Previously these weren't copied → talents.coop_* stayed at default.
            coop_accept_jobs: application.coop_accept_jobs ?? true,
            coop_open_buyout: !!application.coop_open_buyout,
            coop_ai_clone: !!application.coop_ai_clone,
            coop_ai_training: !!application.coop_ai_training,
            coop_proofread: !!application.coop_proofread,
            coop_voice_director: !!application.coop_voice_director,
            low_price_data_optin: !!application.low_price_data_optin,
          }]).select('id').single();

          if (talentError) {
            console.error('Failed to auto-create talent record:', talentError);
          } else if (newTalent) {
            await db.from('talent_applications').update({ talent_id: newTalent.id }).eq('id', id);
            // Pre-provision a login account (confirmed, no password) right away, so
            // "forgot password" ALWAYS works for an approved talent — even if their
            // onboarding link later breaks (e.g. the application gets deleted, which
            // nulls talents.application_id). Best-effort: /onboard also provisions it
            // if this fails. The set-password email itself is still sent at /onboard.
            if (application.email) {
              try {
                const created = await db.auth.admin.createUser({ email: application.email, email_confirm: true });
                let uid = created.data?.user?.id || null;
                if (!uid) {
                  const { data: list } = await db.auth.admin.listUsers();
                  uid = list?.users?.find((u) => (u.email || '').toLowerCase() === application.email.toLowerCase())?.id || null;
                }
                if (uid) await db.from('talents').update({ auth_user_id: uid }).eq('id', newTalent.id);
              } catch (e) { console.error('[applications] pre-provision login account failed (non-fatal):', e); }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/applications PATCH');
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const db = getSupabaseServiceClient();
    // Unlink any talent created from / pointing at this application first, so
    // the talents.application_id foreign key doesn't block the delete.
    await db.from('talents').update({ application_id: null }).eq('application_id', id);

    const { error } = await db.from('talent_applications').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/applications DELETE');
  }
}
