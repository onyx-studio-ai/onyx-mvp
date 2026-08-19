import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { sendEmail } from '@/lib/mail';
import { sendTelegram } from '@/lib/telegram';
import { LANGUAGES } from '@/lib/languages';
import { auditionDeadlinePassed } from '@/lib/casting';

/*
  每日資料健檢(唯讀)— 抓「不報錯、build 綠燈、但商業結果是錯的」那類靜默不一致。
  起因:2026-07 一週內連續踩到 page_views 缺欄位靜默斷一週、真人配音員被 application_id
  條件誤藏、語言值三套格式對不上 —— 全是沒人看見就爛掉的。這支每天掃一次,有異常主動
  通知,把「壞掉 → 被發現」從幾天縮到一天。

  觸發:
   - Vercel Cron(vercel.json,每天 UTC 23:00 = 台北 07:00)。
   - 手動:admin 登入後 GET /api/admin/health-check(永遠回 JSON 全文)。
  授權:admin cookie;或 Bearer CRON_SECRET(若有設);CRON_SECRET 未設時接受
  x-vercel-cron 標頭(Vercel cron 自帶;內容非高敏感,但建議之後補 CRON_SECRET)。

  通知:有「⚠ 異常級」項目才寄 ADMIN_EMAIL;若設了 TELEGRAM_ADMIN_CHAT_ID 也推 Telegram。
  資訊級(性別缺漏等)只進報告不觸發通知,避免每天吵。
*/

export const runtime = 'nodejs';

const STD = new Set(LANGUAGES.map((o) => o.v));
const isVO = (t: { type?: string | null }) => ['VO', 'voice_actor'].includes(t.type || '');
const isAI = (t: { voice_id_status?: string | null }) => t.voice_id_status === 'verified';

export async function GET(request: NextRequest) {
  // ── 授權(三選一)──
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  const viaCronSecret = !!cronSecret && auth === `Bearer ${cronSecret}`;
  const viaVercelCron = !cronSecret && !!request.headers.get('x-vercel-cron');
  if (!viaCronSecret && !viaVercelCron) {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;
  }

  try {
    const db = getSupabaseServiceClient();
    const warn: string[] = [];   // ⚠ 異常級 → 觸發通知
    const info: string[] = [];   // ℹ 資訊級 → 只進報告

    // 需要的資料一次撈
    const [{ data: talents }, pv48, { data: openCasting }] = await Promise.all([
      db.from('talents').select('id, name, email, type, gender, is_active, voice_id_status, application_id, published_snapshot, languages, native_languages, demos, demo_urls, sample_url, phone, line_user_id, telegram_chat_id'),
      db.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 48 * 3600_000).toISOString()),
      db.from('marketplace_briefs').select('brief_number, audition_deadline, audition_deadline_time, deadline, timezone, created_at').eq('kind', 'casting').eq('status', 'open'),
    ]);
    const ts = talents || [];
    const cap = (arr: string[], n = 10) => arr.slice(0, n).join('、') + (arr.length > n ? ` …共${arr.length}` : '');

    // A. 隱形上線者:上線的真人 VO,卻因缺發布快照而前台看不到(客戶找不到人=白上線)
    const hiddenActive = ts.filter((t) => t.is_active && isVO(t) && !isAI(t) && !t.published_snapshot).map((t) => t.name);
    if (hiddenActive.length) warn.push(`上線但前台看不到(缺發布快照):${cap(hiddenActive)}`);

    // B. 即時語言欄含非標準值(配對會失準;正常應全為 lib/languages 標準值)
    const badLive = ts.filter((t) => [...(t.languages || []), ...(t.native_languages || [])].some((v: string) => v && !STD.has(v)));
    if (badLive.length) warn.push(`語言含非標準值(即時欄):${cap(badLive.map((t) => t.name))}`);

    // C. 發布快照語言含非標準值(公開頁顯示的是快照 → 客戶會看到舊格式)
    const badSnap = ts.filter((t) => {
      const s = t.published_snapshot as { languages?: string[] } | null;
      return Array.isArray(s?.languages) && s.languages.some((v) => v && !STD.has(v));
    });
    if (badSnap.length) info.push(`發布快照語言為舊格式(重新發布或遷移可清):${cap(badSnap.map((t) => t.name))}`);

    // C2. 同名帳號(2026-07-16 Ashley:指派+邀請各建一次 → 單分家、開通連結打不開)。
    // 2026-08-18 修正判準:同名不代表重複 —— 真的有兩位不同的 Amy(不同 email、不同語言、
    // 各自有作品)。所以:同名同 email = 真重複(異常級);同名不同 email = 只提示並附
    // email 供辨識(資訊級),不再每天當異常吵。
    const normN = (s2: string) => String(s2 || '').toLowerCase().replace(/\s+/g, '');
    const byName = new Map<string, { name: string; email: string }[]>();
    for (const t of ts) {
      const n = normN(t.name);
      if (!n || /已併|勿用/.test(String(t.name))) continue;
      const rec = { name: String(t.name), email: String((t as { email?: string | null }).email || '').toLowerCase() };
      const arr = byName.get(n); if (arr) arr.push(rec); else byName.set(n, [rec]);
    }
    const trueDup: string[] = [];    // 同名同 email = 同一人被建兩次
    const sameName: string[] = [];   // 同名不同 email = 可能是不同人
    for (const group of byName.values()) {
      if (group.length < 2) continue;
      const emails = new Set(group.map((g) => g.email).filter(Boolean));
      if (emails.size <= 1) trueDup.push(`${group[0].name}×${group.length}`);
      else sameName.push(`${group[0].name}×${group.length}(${[...emails].join(' / ')})`);
    }
    if (trueDup.length) warn.push(`同一人重複帳號(email 相同,單子會分家需合併):${cap(trueDup)}`);
    if (sameName.length) info.push(`同名但 email 不同(可能是不同人,發案選人請看 email 別選錯):${cap(sameName)}`);

    // D. 訪客埋點心跳:48 小時完全零筆 = 幾乎必然是斷了(page_views 曾因缺欄位靜默斷一週)
    if ((pv48.count || 0) === 0) warn.push('訪客埋點 page_views 過去 48 小時 0 筆 —— 埋點很可能又斷了(上次是缺欄位靜默失敗)');

    // D2. 開錄了但付款仍 pending → 配音員端上傳被「等待客戶付款」閘卡死。
    // 線上刷卡案 = 真的在等客戶;平台自營線下收款案 = 忘了標「已付款(線下)」
    // (2026-08-16 茹芸案例:開錄兩天後要交件才發現傳不了)。兩種都該人工看一眼。
    const { data: stuck } = await db.from('voice_orders')
      .select('order_number, project_name, voice_selection')
      .not('released_at', 'is', null).not('talent_id', 'is', null)
      .not('status', 'in', '("completed","cancelled")')
      .eq('payment_status', 'pending');
    if (stuck?.length) warn.push(`已開錄但付款仍 pending(配音員無法上傳交付;線下收款案請標「已付款」):${cap(stuck.map((o) => `${o.order_number} ${o.voice_selection || o.project_name || ''}`))}`);

    // D2b(2026-08-19 上線). 已通知配音員開錄、卻沒填交期欄位(2026-08-19 A422 台語講解:交期只打在製作
    // 說明的文字裡,deadline 欄位空 → 配音員卡片不顯示交期、交件提醒也不會排)。
    const { data: noDue } = await db.from('voice_orders')
      .select('order_number, project_name, role_name')
      .not('released_at', 'is', null).not('talent_id', 'is', null)
      .not('status', 'in', '("completed","cancelled")')
      .is('deadline', null);
    if (noDue?.length) warn.push(`已通知開錄但沒填交期欄位(配音員看不到期限、系統不會排提醒;寫在製作說明的文字不算):${cap(noDue.map((o) => `${o.order_number} ${o.role_name || o.project_name || ''}`))}`);

    // D3. 申請核准 >7 天仍未上架:公開名冊長不出來的隱形庫存(2026-08-17 小琴案例
    // 挖出 51 位卡關)。附缺件原因,才知道是等對方補件還是等我們審。
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: stale } = await db.from('talents')
      .select('name, headshot_url, demos, created_at')
      .not('application_id', 'is', null).eq('is_active', false).lt('created_at', weekAgo);
    if (stale?.length) {
      const withReason = stale.map((t) => {
        const lacks: string[] = [];
        if (!t.headshot_url) lacks.push('頭像');
        if (!((t.demos as unknown[] | null)?.length)) lacks.push('分類demo');
        return `${t.name}${lacks.length ? `(缺${lacks.join('、')})` : '(資料齊,待審上架)'}`;
      });
      info.push(`核准逾 7 天仍未上架 ${stale.length} 位:${cap(withReason)}`);
    }

    // E. 上線但性別空白(男/女篩選、發案配對都算不到他)
    // C5. 聯絡黑洞:上線真人配音員,無電話且無 LINE/Telegram —— 只有 email 一條線,
    // 催件/急件找不到人(2026-07-17 Erica Chang 案例)。目標是這名單歸零。
    const unreachable = ts.filter((t) => t.is_active && isVO(t) && !isAI(t)
      && !String((t as { phone?: string | null }).phone || '').trim()
      && !(t as { line_user_id?: string | null }).line_user_id
      && !(t as { telegram_chat_id?: string | null }).telegram_chat_id).map((t) => t.name);
    if (unreachable.length) info.push(`聯絡黑洞(無電話且未綁 LINE/Telegram,只剩 email):${cap(unreachable)}`);

    // C6. C2PA 合規:金鑰 + 原生模組 + 簽章器,三層實測(AI 標示,EU 死線 2026-08-02)
    if (!process.env.C2PA_CERT_PEM || !process.env.C2PA_KEY_PEM) warn.push('C2PA 簽署金鑰未載入 —— AI 交付物只剩 fal 原生標記,無 Onyx 簽章');
    else {
      try {
        const { LocalSigner } = await import('@contentauth/c2pa-node');
        const { normalizePem } = await import('@/lib/c2pa');
        LocalSigner.newSigner(Buffer.from(normalizePem(process.env.C2PA_CERT_PEM)!), Buffer.from(normalizePem(process.env.C2PA_KEY_PEM)!), 'es256');
        info.push('C2PA 金鑰+模組+簽章器全通 ✓');
      } catch (e) {
        warn.push(`C2PA 簽署在此環境不可用:${e instanceof Error ? e.message.slice(0, 200) : e}`);
      }
    }

    const noGender = ts.filter((t) => t.is_active && isVO(t) && !isAI(t) && !String(t.gender || '').trim()).map((t) => t.name);
    if (noGender.length) info.push(`上線但沒填性別:${cap(noGender)}`);

    // F. 上線但一支 demo 都沒有(前台無從試聽)
    const noDemo = ts.filter((t) => t.is_active && isVO(t) && !isAI(t)
      && !(Array.isArray(t.demos) && t.demos.length) && !(Array.isArray(t.demo_urls) && t.demo_urls.length) && !t.sample_url).map((t) => t.name);
    if (noDemo.length) info.push(`上線但零 demo:${cap(noDemo)}`);

    // G. 試音已截止但仍 open 的案(設計上不自動關 —— 純提醒數字)。
    // 用共用 auditionDeadlinePassed(吃 ISO / 舊「6/30」短格式 / 精確時間+時區),
    // 與 join/quotes/briefs 各處同一口徑 —— 不再自寫只認 ISO 的判定(2026-07-23 整理)。
    const expired = (openCasting || []).filter((b) => auditionDeadlinePassed(b));
    if (expired.length) info.push(`open 但試音已截止的案:${expired.map((b) => b.brief_number).join('、')}(設計上不自動關,若已分完案可手動關)`);

    // H. 金額一致性(2026-08-18 羅郁晴事件後加):訂單金額必須等於報價單的金額 ——
    // 配音員報價填「實拿」,平台費 20% 外加,所以 price=gross_amount、talent_price=net_amount。
    // 任何不符都代表某條路徑算錯錢(例如指派時把 gross 當實拿帶入 → 平台多付 25%)。
    try {
      const { data: paidOrders } = await db.from('voice_orders')
        .select('order_number, voice_selection, price, talent_price, quote_id').not('quote_id', 'is', null);
      const qIds = [...new Set((paidOrders || []).map((o) => String(o.quote_id)))];
      const qMap = new Map<string, { gross_amount: number | null; net_amount: number | null }>();
      for (let i = 0; i < qIds.length; i += 100) {
        const { data: qs } = await db.from('marketplace_quotes').select('id, gross_amount, net_amount').in('id', qIds.slice(i, i + 100));
        for (const q of qs || []) qMap.set(String(q.id), { gross_amount: q.gross_amount as number | null, net_amount: q.net_amount as number | null });
      }
      const mismatched: string[] = [];
      for (const o of paidOrders || []) {
        const q = qMap.get(String(o.quote_id));
        if (!q) continue;
        const talentOff = q.net_amount != null && Math.abs(Number(o.talent_price) - Number(q.net_amount)) > 1;
        const clientOff = q.gross_amount != null && Math.abs(Number(o.price) - Number(q.gross_amount)) > 1;
        if (talentOff || clientOff) mismatched.push(`${o.order_number} ${o.voice_selection || ''}(單:配音員 ${o.talent_price}/客戶 ${o.price} vs 報價:${q.net_amount}/${q.gross_amount})`);
      }
      if (mismatched.length) warn.push(`訂單金額與報價不符(可能多付/少付):${cap(mismatched)}`);
      else info.push(`金額一致性 ✓(${paidOrders?.length || 0} 張有報價的單全部相符)`);
    } catch (e) {
      info.push(`金額一致性檢查未完成:${e instanceof Error ? e.message.slice(0, 80) : e}`);
    }

    // I. 狀態落差:付款已完成但訂單階段還停在「待付款」(後台列表會看不到、配音員上傳被鎖)
    try {
      const { data: lag } = await db.from('voice_orders')
        .select('order_number, voice_selection').eq('status', 'pending_payment').in('payment_status', ['paid', 'completed']);
      if (lag?.length) warn.push(`付款已完成但單子仍停在「待付款」(列表看不到、配音員無法上傳):${cap(lag.map((o) => `${o.order_number} ${o.voice_selection || ''}`))}`);
    } catch { /* 欄位缺就跳過 */ }

    const report = { ok: warn.length === 0, warn, info, checkedAt: new Date().toISOString() };

    // 有異常級才通知(email 必發;Telegram 設了 TELEGRAM_ADMIN_CHAT_ID 才發)
    if (warn.length) {
      const lines = [...warn.map((w) => `⚠ ${w}`), ...info.map((i) => `ℹ ${i}`)];
      sendEmail({
        category: 'ADMIN',
        to: process.env.ADMIN_EMAIL || 'admin@onyxstudios.ai',
        subject: `⚠ Onyx 資料健檢:${warn.length} 項異常`,
        html: `<p>每日健檢發現異常,請檢查:</p><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul><p style="color:#888;font-size:12px">此信由每日資料健檢自動寄出(異常才通知)。</p>`,
      }).catch(() => {});
      const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (adminChat) sendTelegram(adminChat, `⚠ Onyx 資料健檢異常\n${lines.join('\n')}`).catch(() => {});
    }

    return NextResponse.json(report);
  } catch (err) {
    // 健檢自己壞掉也要看得見 —— 回 500 讓 Vercel cron 記錄失敗,不靜默。
    console.error('[health-check] failed:', err);
    return NextResponse.json({ error: 'health check failed' }, { status: 500 });
  }
}
