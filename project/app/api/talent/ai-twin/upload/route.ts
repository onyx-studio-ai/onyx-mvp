import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { aiTwinVisible } from '@/lib/ai-twin';

/* 語料上傳:回 signed upload URL(bucket: ai-twin-samples;只收 .wav)。 */
export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, email');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!aiTwinVisible(String(r.talent.email || ''))) return NextResponse.json({ error: 'not_available' }, { status: 404 });
  let b: { file_name?: string; tone?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const name = String(b.file_name || 'sample.wav');
  if (!/\.wav$/i.test(name)) return NextResponse.json({ error: '只接受 WAV 檔(48kHz/24bit)。請以 WAV 重新匯出。' }, { status: 400 });
  const tone = String(b.tone || 'default').replace(/[^A-Za-z0-9_-]/g, '');
  const path = `${r.talent.id}/${tone}_${Date.now()}.wav`;
  const { data, error } = await r.db.storage.from('ai-twin-samples').createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pub = r.db.storage.from('ai-twin-samples').getPublicUrl(path);
  return NextResponse.json({ upload_url: data.signedUrl, token: data.token, path, public_url: pub.data.publicUrl });
}
