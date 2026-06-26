import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { caseCode } from '@/lib/casting';

/*
  GET /api/admin/casting/[id]/download — one zip of every audition on this casting
  call, each file renamed 「角色_配音員.ext」. Fetched server-side (no CORS issues),
  so the admin gets correctly-named files in a single download.
*/
export const maxDuration = 60;

const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60) || '_';
const extOf = (url: string) => { const m = url.split('?')[0].match(/\.([a-z0-9]{1,5})$/i); return m ? m[1].toLowerCase() : 'mp3'; };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const db = getSupabaseServiceClient();

  const { data: brief } = await db.from('marketplace_briefs').select('title, content_type, created_at, brief_number, kind').eq('id', id).maybeSingle();
  if (!brief || brief.kind !== 'casting') return NextResponse.json({ error: 'not a casting call' }, { status: 404 });

  const { data: quotes } = await db.from('marketplace_quotes')
    .select('role_name, sample_url, status, talents(name)')
    .eq('brief_id', id)
    .in('status', ['submitted', 'shortlisted', 'accepted'])
    .order('created_at', { ascending: true });

  const withAudio = (quotes || []).filter((q) => q.sample_url);
  if (!withAudio.length) return NextResponse.json({ error: '這個案件還沒有試音音檔' }, { status: 404 });

  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;
  for (const q of withAudio) {
    const url = String(q.sample_url);
    const role = clean(String(q.role_name || '一般'));
    const talent = clean(String((q.talents as { name?: string } | null)?.name || '配音員'));
    let name = `${role}_${talent}.${extOf(url)}`;
    for (let n = 2; used.has(name); n++) name = `${role}_${talent}_${n}.${extOf(url)}`;
    used.add(name);
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      zip.file(name, await res.arrayBuffer());
      added++;
    } catch { /* skip a file that fails to fetch */ }
  }
  if (!added) return NextResponse.json({ error: '音檔下載失敗,請稍後再試' }, { status: 502 });

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const zipName = `${caseCode(brief) || brief.brief_number || '試音'}_試音.zip`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
    },
  });
}
