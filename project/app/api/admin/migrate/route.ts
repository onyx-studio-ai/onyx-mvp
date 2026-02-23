import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const seeds = [
      { section: 'featured_voices', slot_key: 'slot_1', label: 'Onyx Alpha', subtitle: 'The Authority', description: 'Deep, commanding presence for high-stakes narration', tags: ['News', 'Corporate', 'Deep'], sort_order: 0 },
      { section: 'featured_voices', slot_key: 'slot_2', label: 'Onyx Nova', subtitle: 'The Visionary', description: 'Crystalline clarity with sophisticated warmth', tags: ['Tech', 'Premium', 'Elegant'], sort_order: 1 },
      { section: 'featured_voices', slot_key: 'slot_3', label: 'Onyx Titan', subtitle: 'The Catalyst', description: 'Bold, dynamic energy for impactful storytelling', tags: ['Trailer', 'Action', 'Power'], sort_order: 2 },
      { section: 'voice_tier', slot_key: 'standard', label: null, subtitle: null, description: null, tags: [], sort_order: 0 },
      { section: 'voice_tier', slot_key: 'onyx', label: null, subtitle: null, description: null, tags: [], sort_order: 1 },
      { section: 'voice_tier', slot_key: 'human', label: null, subtitle: null, description: null, tags: [], sort_order: 2 },
      { section: 'music_comparison', slot_key: 'raw', label: null, subtitle: null, description: null, tags: [], sort_order: 0 },
      { section: 'music_comparison', slot_key: 'onyx', label: null, subtitle: null, description: null, tags: [], sort_order: 1 },
      { section: 'orchestra_comparison', slot_key: 'raw', label: null, subtitle: null, description: null, tags: [], sort_order: 0 },
      { section: 'orchestra_comparison', slot_key: 'live', label: null, subtitle: null, description: null, tags: [], sort_order: 1 },
    ];

    // Check if table exists by trying to query it
    const { error: checkError } = await supabase.from('audio_showcases').select('id').limit(1);
    
    if (checkError && checkError.code === 'PGRST205') {
      return NextResponse.json({ 
        error: 'Table does not exist. Please run the migration SQL in Supabase Dashboard SQL Editor.',
        sql_file: 'supabase/migrations/20260222000000_create_audio_showcases_table.sql'
      }, { status: 400 });
    }

    // Table exists, seed data
    const { error: seedError } = await supabase
      .from('audio_showcases')
      .upsert(seeds, { onConflict: 'section,slot_key', ignoreDuplicates: true });

    if (seedError) {
      return NextResponse.json({ error: seedError.message }, { status: 500 });
    }

    // Also ensure showcases storage bucket exists
    const { error: bucketError } = await supabase.storage.createBucket('showcases', { public: true });
    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('Bucket creation error:', bucketError.message);
    }

    const { data: rows } = await supabase.from('audio_showcases').select('section, slot_key');
    return NextResponse.json({ success: true, message: 'Migration and seed complete', rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
