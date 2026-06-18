import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';
import { applicationStatusEmail } from '@/lib/mail-templates';
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
    const { id, ...updateData } = body;

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
        const { subject, html } = applicationStatusEmail({
          applicantName: application.full_name || 'Applicant',
          applicationNumber: application.application_number || id,
          status: updateData.status as 'approved' | 'rejected',
        });
        await sendEmail({ category: 'HELLO', to: application.email, subject, html });
      }

      if (updateData.status === 'approved' && application) {
        const { data: existing } = await db
          .from('talents')
          .select('id')
          .eq('email', application.email)
          .maybeSingle();

        if (existing) {
          await db.from('talent_applications').update({ talent_id: existing.id }).eq('id', id);
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

          const tags: string[] = [
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
            name: application.full_name,
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
          }]).select('id').single();

          if (talentError) {
            console.error('Failed to auto-create talent record:', talentError);
          } else if (newTalent) {
            await db.from('talent_applications').update({ talent_id: newTalent.id }).eq('id', id);
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
