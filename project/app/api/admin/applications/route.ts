import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/mail';
import { applicationStatusEmail } from '@/lib/mail-templates';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Admin database config missing' }, { status: 500 });
  }

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from('talent_applications')
      .select('*, talents:talent_id(id, name, is_active, voice_id_status)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Admin database config missing' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const db = getAdminClient();
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
            demoUrls.push({
              name: application.demo_file_name || 'Application Demo',
              url: application.demo_file_url,
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
