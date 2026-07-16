import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail, emailLocaleForTalent } from '@/lib/mail';
import { talentAccountSetupEmail } from '@/lib/mail-templates';

/*
  POST /api/admin/casting/assign — Onyx DIRECTLY assigns a batch of roles to one
  talent (managed production; no audition, no client, no payment gate). One
  ready-to-record voice_order per role (status in_production, payment_status
  completed) with talent_price = the fixed pay Onyx agreed. If the talent isn't on
  the platform yet, invite them: create a lightweight account + assigned work +
  a set-password link (they can later finish their profile → become a full talent).

  body: { brief_id, role_names: string[], pay_per_role: number,
          talent_id? | invite?: { name, email } }
*/
const SITE = 'https://www.onyxstudios.ai';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: { brief_id?: string; role_names?: string[]; pay_per_role?: number; pay_unit?: string; talent_id?: string; invite?: { name?: string; email?: string } };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const briefId = String(body.brief_id || '');
  const roleNames = Array.isArray(body.role_names) ? body.role_names.map((r) => String(r).trim()).filter(Boolean) : [];
  const pay = Math.max(0, Number(body.pay_per_role) || 0);
  // 計價單位:per_role(每角色一口價,預設)| per_line(每句單價 × 句數 —— 句數在匯入
  // 台詞表時自動數出來並回填 talent_price,指派當下酬勞先掛 0 待計)。
  const payUnit = body.pay_unit === 'per_line' ? 'per_line' : 'per_role';
  if (!briefId || !roleNames.length) return NextResponse.json({ error: 'brief_id 與 role_names 必填' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: brief } = await db.from('marketplace_briefs')
    .select('id, title, content_type, language, budget_currency, client_email, roles')
    .eq('id', briefId).maybeSingle();
  if (!brief) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  // ── Resolve the talent (existing) or invite a new one (lightweight account) ──
  let talentId = String(body.talent_id || '');
  let setupUrl: string | undefined;
  let talentName = '';
  let talentEmail = '';
  if (!talentId) {
    const name = String(body.invite?.name || '').trim();
    const rawEmail = String(body.invite?.email || '').trim().toLowerCase();
    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) return NextResponse.json({ error: 'Email 格式不正確(用 LINE 邀請可留空)' }, { status: 400 });
    if (!name && !rawEmail) return NextResponse.json({ error: '邀請至少要填姓名(email 可留空,用連結邀請)' }, { status: 400 });
    // Email 選填(Wing 用 LINE 邀請,不想追問 email):留空時自動生一個佔位帳號,
    // 純靠設定密碼連結開通;佔位信箱不寄信,對方之後可再補真 email。
    const isPlaceholder = !rawEmail;
    const email = rawEmail || `vo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@invite.onyxstudios.ai`;
    talentName = name; talentEmail = isPlaceholder ? '' : email;   // 佔位不寄任何信

    // Reuse an existing talent row for this email if any; else create a lightweight one.
    const { data: existing } = await db.from('talents').select('id, name, auth_user_id').eq('email', email).maybeSingle();
    let authUserId = (existing as { auth_user_id?: string } | null)?.auth_user_id || null;
    if (existing) {
      talentId = (existing as { id: string }).id;
      talentName = talentName || (existing as { name?: string }).name || '';
    } else if (name) {
      // 同名帳號已存在 → 擋下並提示改用「選現有配音員」指派(2026-07-16 Ashley
      // 被建了兩個帳號、單分家的根因)。真的是不同人再改個名字邀請即可。
      const { data: sameName } = await db.from('talents').select('id, name').ilike('name', name).limit(1);
      if (sameName?.length) {
        return NextResponse.json({ error: `已有同名配音員「${sameName[0].name}」—— 若是同一人,請改用上方「選現有配音員」指派;確定是不同人,請在姓名加註區別(例:${name}2)再邀請。` }, { status: 409 });
      }
    }
    if (!existing) {
      const { data: t, error: tErr } = await db.from('talents')
        .insert({ name: name || email.split('@')[0], email, type: 'VO', category: 'in_house', is_active: false, sort_order: 0 })
        .select('id').single();
      if (tErr || !t) return NextResponse.json({ error: tErr?.message || '建立配音員記錄失敗' }, { status: 500 });
      talentId = t.id as string;
    }
    // Provision a login account (idempotent) + set-password link, so they can log in
    // and see their assigned work — same robust path as approval/onboarding.
    if (!authUserId) {
      const created = await db.auth.admin.createUser({ email, email_confirm: true });
      authUserId = created.data?.user?.id || null;
      if (!authUserId) {
        const { data: list } = await db.auth.admin.listUsers();
        authUserId = list?.users?.find((u) => (u.email || '').toLowerCase() === email)?.id || null;
      }
      if (authUserId) await db.from('talents').update({ auth_user_id: authUserId }).eq('id', talentId);
    }
    const locale = emailLocaleForTalent('zh-TW', undefined);
    const lp = locale && locale !== 'en' ? `/${locale}` : '';
    const { data: link } = await db.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: `${SITE}${lp}/auth/reset-password` } });
    // 不給 action_link(GET 即消耗的一次性連結,貼 LINE 會被預覽爬蟲用掉 → 真人點開
    // 永遠過期)→ 改給自家開通頁,真人按按鈕才兌換 token_hash。
    const th = link?.properties?.hashed_token;
    setupUrl = th ? `${SITE}${lp}/auth/activate?th=${encodeURIComponent(th)}` : (link?.properties?.action_link || `${SITE}${lp}/auth/reset-password`);
    if (!isPlaceholder) {   // 佔位帳號沒有真信箱,不寄;開通全靠 LINE 丟連結
      const mail = talentAccountSetupEmail({ name: talentName, setupUrl, dashboardUrl: `${SITE}/talent`, locale });
      sendEmail({ category: 'HELLO', to: email, subject: mail.subject, html: mail.html }).catch(() => {});
    }
  } else {
    const { data: t } = await db.from('talents').select('name, email').eq('id', talentId).maybeSingle();
    talentName = (t?.name as string) || '';
    talentEmail = (t?.email as string) || '';
  }

  // ── Create one ready-to-record order per role (dup-guarded per (brief, role)) ──
  const roles = Array.isArray(brief.roles) ? (brief.roles as Array<{ name?: string; sample_line?: string }>) : [];
  const roleScript = (rn: string) => (roles.find((r) => (r.name || '').trim() === rn)?.sample_line || '').trim();
  const currency = (brief.budget_currency as string) || 'TWD';
  const orderEmail = (brief.client_email as string) || 'casting@onyxstudios.ai';
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const { count } = await db.from('voice_orders').select('id', { count: 'exact', head: true }).gte('created_at', dayStart);
  let seq = (count || 0);

  let assigned = 0; const skipped: string[] = [];
  for (const rn of roleNames) {
    const { data: dup } = await db.from('voice_orders').select('id').eq('brief_id', briefId).eq('role_name', rn).maybeSingle();
    if (dup) { skipped.push(rn); continue; }
    seq += 1;
    const orderNumber = `VO-${ymd}-${String(seq).padStart(4, '0')}`;
    const { data: ord, error } = await db.from('voice_orders').insert({
      order_number: orderNumber,
      email: orderEmail,
      language: brief.language || '',
      voice_selection: talentName,
      script_text: roleScript(rn),
      tone_style: 'Professional',
      use_case: (brief.content_type as string) || 'Video Game',
      broadcast_rights: true,
      tier: 'tier-3',
      duration: 0,
      price: 0,                     // Onyx invoices the client separately (managed)
      currency,
      project_name: `${(brief.title as string) || '配音案'} · ${rn}`,
      talent_id: talentId,
      // per_role:酬勞=一口價;per_line:先掛 0,匯入台詞表時自動 = pay_rate × 句數。
      talent_price: payUnit === 'per_line' ? 0 : pay,
      pay_unit: payUnit,
      pay_rate: pay,
      status: 'in_production',      // ready to record now
      payment_status: 'completed',  // internal — bypasses the client-payment gate
      revision_count: 0,
      max_revisions: 2,
      rights_level: 'global',
      brief_id: briefId,
      role_name: rn,
    }).select('id').single();
    if (error || !ord) { skipped.push(`${rn}(${error?.message || 'insert failed'})`); seq -= 1; continue; }
    assigned += 1;

    // Open a payout record so this role appears in /admin/payouts and Wing can
    // settle it (tick 已付配音員 → done). Managed production = Onyx pays a FIXED
    // per-role fee; tier 'managed' keeps it OUT of the Profit-First income pockets
    // (client billing is invoiced separately). Best-effort — a payout-record hiccup
    // must never undo a successful assignment (backfillable later).
    // per_line 的酬勞要等匯入台詞數句數才知道 → 分潤紀錄由 import-lines 補建,這裡跳過。
    if (pay > 0 && payUnit !== 'per_line') {
      const { error: eErr } = await db.from('talent_earnings').insert({
        talent_id: talentId, order_id: ord.id, order_type: 'voice', order_number: orderNumber,
        tier: 'managed', order_total: pay, commission_rate: 1, commission_amount: pay, status: 'pending',
      });
      if (eErr) console.error('[casting/assign] payout record insert failed', orderNumber, eErr.message);
    }
  }

  // 指派≠通知(Wing 2026-07-15):這裡「不」寄指派信、不發 Telegram,單子也先不出現在
  // 配音員後台(released_at=null)。等 Wing 在製作管理確認台詞/參考音/價格後按「發出
  // 通知」(/api/admin/casting/release)才通知+可見 —— 避免配音員搶在定稿前就開錄。
  // (新邀請的帳號設定信照發,那只是開帳號,不含稿件。)

  // login_email:給 LINE 邀請訊息用 —— 對方之後登入的帳號(真信箱或佔位帳號)。
  const { data: tFinal } = await db.from('talents').select('email').eq('id', talentId).maybeSingle();
  return NextResponse.json({ ok: true, assigned, skipped, talent_id: talentId, setup_url: setupUrl || null, login_email: (tFinal?.email as string) || null });
}
