import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { lineOaUrl } from '@/lib/line';
import { getCampaign } from '@/lib/opencall-campaigns';

/*
  公開徵集投稿 API(Wing 2026-08-07,活動制):活動內容在 lib/opencall-campaigns.ts。
  GET  → { lineUrl }(活動文案前端直接讀設定檔,不經 API)。
  POST → 驗證活動與案件、每個勾選語系至少一檔 demo;寫 opencall_submissions,
         並 upsert 進 prospects(kind=talent, source=opencall, 語言=案件語言,
         country=現居地,母語/口音/通訊方式進 note)—— 這批資料=長期人才庫。
  防濫用:honeypot、長度上限、demo 僅認本站 storage URL。
*/

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  return NextResponse.json({ lineUrl: lineOaUrl() });
}

export async function POST(request: NextRequest) {
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }); }
  if (String(b.website || '').trim()) return NextResponse.json({ ok: true }); // honeypot

  const campaign = getCampaign(String(b.campaign || ''));
  if (!campaign || !campaign.active) return NextResponse.json({ error: '此徵集不存在或已結束' }, { status: 400 });

  const name = String(b.name || '').trim().slice(0, 80);
  const email = String(b.email || '').trim().toLowerCase();
  const phone = String(b.phone || '').trim().slice(0, 40);
  const messengerApp = ['line', 'wechat', 'whatsapp'].includes(String(b.messenger_app)) ? String(b.messenger_app) : '';
  const messengerId = String(b.messenger_id || '').trim().slice(0, 80);
  const nativeLanguage = String(b.native_language || '').trim().slice(0, 120);
  const accent = String(b.accent || '').trim().slice(0, 120);
  const location = String(b.location || '').trim().slice(0, 120);
  const referrer = String(b.referrer || '').trim().slice(0, 120);
  const expectedFee = String(b.expected_fee || '').trim().slice(0, 80);
  const note = String(b.note || '').trim().slice(0, 1000);
  const validCodes = new Set<string>(campaign.cases.map((c) => c.code));
  const cases = (Array.isArray(b.cases) ? b.cases.map(String) : []).filter((c) => validCodes.has(c));
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const demos = (Array.isArray(b.demos) ? b.demos : [])
    .map((d: unknown) => {
      const o = d as Record<string, unknown>;
      return { case: String(o.case || ''), url: String(o.url || ''), name: String(o.name || '').slice(0, 120) };
    })
    .filter((d) => validCodes.has(d.case) && d.url.startsWith(`${base}/storage/v1/object/public/casting/opencall/`))
    .slice(0, 8);

  if (!name) return NextResponse.json({ error: '請填姓名或藝名' }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Email 格式不正確' }, { status: 400 });
  if (!location) return NextResponse.json({ error: '請填現居地' }, { status: 400 });
  if (!nativeLanguage) return NextResponse.json({ error: '請填母語 / 從小講的語言' }, { status: 400 });
  if (!cases.length) return NextResponse.json({ error: '請至少勾選一個語系案件' }, { status: 400 });
  const missing = cases.filter((c) => !demos.some((d) => d.case === c));
  if (missing.length) return NextResponse.json({ error: '每個勾選的語系都要上傳一段該語系的 demo' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { error } = await db.from('opencall_submissions').insert({
    campaign: campaign.slug, name, email, phone: phone || null,
    messenger_app: messengerId ? messengerApp || 'line' : null, messenger_id: messengerId || null,
    native_language: nativeLanguage, accent: accent || null, location,
    cases, demos, expected_fee: expectedFee || null, referrer: referrer || null, note: note || null,
  });
  if (error) {
    console.error('[opencall] insert failed:', error.message);
    return NextResponse.json({ error: '送出失敗,請稍後再試' }, { status: 500 });
  }

  // 同步進潛在名單(best-effort,不擋投稿):這批人=長期人才庫,語種/口音/所在地都要留住。
  try {
    const langs = [...new Set(cases.map((c) => campaign.cases.find((x) => x.code === c)!.lang))];
    const appLabel = ({ line: 'LINE', wechat: '微信', whatsapp: 'WhatsApp' } as Record<string, string>)[messengerApp] || 'LINE';
    const tag = `[opencall ${campaign.slug}] 母語:${nativeLanguage}${accent ? `|口音:${accent}` : ''}${messengerId ? `|${appLabel}:${messengerId}` : ''}${phone ? `|電話:${phone}` : ''}${referrer ? `|推薦人:${referrer}` : ''}${expectedFee ? `|期望酬勞:${expectedFee}` : ''}`;
    const { data: ex } = await db.from('prospects').select('id, name, country, languages, note, status').eq('email', email).maybeSingle();
    if (ex) {
      const merged = [...new Set([...(ex.languages || []), ...langs])];
      const newNote = (ex.note || '').includes(`[opencall ${campaign.slug}]`) ? ex.note : `${ex.note ? ex.note + ' ｜ ' : ''}${tag}`.slice(0, 2000);
      await db.from('prospects').update({ name: ex.name || name, country: ex.country || location, languages: merged, note: newNote }).eq('id', ex.id);
    } else {
      await db.from('prospects').insert({ email, name, kind: 'talent', country: location, languages: langs, note: tag, source: 'opencall' });
    }
  } catch (e) { console.error('[opencall] prospects sync failed:', e); }

  return NextResponse.json({ ok: true });
}
