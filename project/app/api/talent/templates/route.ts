import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';

/*
  Talent's saved quote templates (自我介紹 / 修改政策), stored on talents.quote_templates.
    POST   { kind:'intro'|'revision', name, body }  — save/upsert a named template
    DELETE ?kind=&name=                              — remove one
  Returns the updated { intro:[], revision:[] }.
*/
type Tpl = { name: string; body: string };
type Store = { intro?: Tpl[]; revision?: Tpl[] };
const KINDS = ['intro', 'revision'] as const;

function norm(s: Store): { intro: Tpl[]; revision: Tpl[] } {
  const clean = (a?: Tpl[]) => (Array.isArray(a) ? a.filter((t) => t && t.name && t.body).slice(0, 20) : []);
  return { intro: clean(s.intro), revision: clean(s.revision) };
}

export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, quote_templates');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { id: string; quote_templates?: Store };
  let b: { kind?: string; name?: string; body?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const kind = b.kind as 'intro' | 'revision';
  const name = String(b.name || '').trim().slice(0, 40);
  const body = String(b.body || '').trim().slice(0, 3000);
  if (!KINDS.includes(kind) || !name || !body) return NextResponse.json({ error: '請填範本名稱與內容' }, { status: 400 });

  const store = norm(t.quote_templates || {});
  const list = store[kind].filter((x) => x.name !== name); // upsert by name
  list.unshift({ name, body });
  store[kind] = list.slice(0, 20);
  const { error } = await r.db.from('talents').update({ quote_templates: store }).eq('id', t.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: store });
}

export async function DELETE(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, quote_templates');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { id: string; quote_templates?: Store };
  const sp = new URL(request.url).searchParams;
  const kind = sp.get('kind') as 'intro' | 'revision';
  const name = sp.get('name') || '';
  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'bad kind' }, { status: 400 });
  const store = norm(t.quote_templates || {});
  store[kind] = store[kind].filter((x) => x.name !== name);
  const { error } = await r.db.from('talents').update({ quote_templates: store }).eq('id', t.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: store });
}
