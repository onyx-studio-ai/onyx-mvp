import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { auditionDeadlinePassed, isPlatformCase } from '@/lib/casting';
import { langKeys, primaryLangKey } from '@/lib/languages';

/*
  GET /api/talent/briefs — open voice-over briefs the talent can quote on, plus
  the talent's own existing quotes (to show status / prevent double-quoting).

  Anti-leakage: client identity (email / name / company) is NOT exposed to
  talents here — only the brief content. Onyx mediates the introduction.

  Degrades gracefully: if the marketplace tables haven't been migrated yet,
  returns empty lists + unavailable:true rather than erroring, so the talent
  dashboard keeps working.
*/
export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name, email, languages, visible_languages, demos, quote_templates, coop_ai_clone, coop_ai_training');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  // The talent's own published demos — offered as "pick an existing demo" when
  // responding to a general (single-voice) casting call.
  const rawDemos = (r.talent as { demos?: unknown }).demos;
  const myDemos = Array.isArray(rawDemos)
    ? rawDemos.filter((d): d is { url: string; name?: string; category?: string; language?: string } =>
        !!d && typeof (d as { url?: unknown }).url === 'string').slice(0, 60)
    : [];

  try {
    const { data: briefsRaw, error: bErr } = await r.db
      .from('marketplace_briefs')
      .select('id, brief_number, kind, title, roles, audition_script, reference_links, reference_files, recording_start, recording_methods, rate_note, base_revisions, audition_cap, categories, content_type, media_scope, territory, license_term, accent, voice_style, voice_age, script_status, has_singing, wants_director, wants_live_session, live_session_tool, audition_deadline, audition_deadline_time, timezone, language, length, budget, budget_type, budget_currency, deadline, deadline_time, brief, created_at, status, client_email, ai_type, gender_needs, license_summary')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50);
    if (bErr) throw bErr;
    // AI/TTS cases (voice becomes an AI model) are only visible to talents who
    // opted into the matching consent — 'clone' → coop_ai_clone, 'training' →
    // coop_ai_training. Ordinary cases (ai_type null) stay visible to everyone.
    const aiClone = !!(r.talent as { coop_ai_clone?: boolean }).coop_ai_clone;
    const aiTrain = !!(r.talent as { coop_ai_training?: boolean }).coop_ai_training;
    // ── 語言可見性(Wing 2026-07-22):案源不全攤開 ──
    // 可見語言集 = 自選 visible_languages(最多5)優先,否則檔案 languages。
    // 「主語言」比對(Mandarin · Taiwan 可見所有 Mandarin 案 —— 擋語言不擋口音)。
    // 集合為空(老資料沒填)→ 全可見,前端提示補設定。已投過的案永遠可見。
    const primary = primaryLangKey; // 共用主語言拆分(lib/languages)
    const vl = (r.talent as { visible_languages?: unknown }).visible_languages;
    const fl = (r.talent as { languages?: unknown }).languages;
    const langSrc = (Array.isArray(vl) && vl.length ? vl : Array.isArray(fl) ? fl : []) as unknown[];
    const langSet = new Set(langSrc.map(primary).filter(Boolean));
    // 家族鍵集(langKeys):吃得下中英/新舊/自由文字變體(「中文 · 台灣國語」→ zh)。
    // 可見度語意=擋語言不擋口音 → 只比家族鍵(zh/yue/nan/en/ja/ko),地區鍵(zh-tw…)不參與;
    // langKeys 認不得的語言(German/Malay…)退回下方 primary 字串比對,行為不變。
    // (2026-07-23 旖樂案:案件語言存了手打「中文 · 台灣國語」,primary「中文」對不上
    //  配音員標準值「Mandarin」→ 客戶指定的配音員反而看不到案。)
    const famOf = (s: unknown) => langKeys(String(s ?? '')).filter((k) => !k.includes('-'));
    const famSet = new Set(langSrc.flatMap(famOf));
    let minedIds = new Set<string>();
    // 查詢失敗時 fail-open:minedIds 為空會讓「投過的案/被點名邀請的案」被語言過濾
    // 誤藏(2026-07-22 剛修過的洞在查詢失敗路徑重現)→ 一旦查不到就整段略過語言過濾,寧多勿漏。
    let langFilterUsable = true;
    if (langSet.size) {
      const { data: mine, error: mineErr } = await r.db.from('marketplace_quotes').select('brief_id').eq('talent_id', (r.talent as { id: string }).id);
      if (mineErr) { console.error('[talent/briefs] my-quotes query failed — skipping language filter:', mineErr.message); langFilterUsable = false; }
      minedIds = new Set((mine || []).map((q) => String(q.brief_id)));
      // 被點名邀請的案也永遠可見(2026-07-22 審查:Wing 勾人通知了、對方卻因語言過濾看不到案)
      const myEmail = String((r.talent as { email?: string }).email || '').toLowerCase();
      if (myEmail) {
        const { data: inv, error: invErr } = await r.db.from('casting_invites').select('brief_id').ilike('email', myEmail);
        if (invErr) { console.error('[talent/briefs] invites query failed — skipping language filter:', invErr.message); langFilterUsable = false; }
        for (const i of inv || []) minedIds.add(String(i.brief_id));
      }
    }
    const briefs = (briefsRaw || []).filter((b) => {
      const at = (b as { ai_type?: string | null }).ai_type;
      if (at === 'clone' && !aiClone) return false;
      if (at === 'training' && !aiTrain) return false;
      if (!langSet.size || !langFilterUsable) return true;
      const bl = (b as { language?: string | null }).language;
      if (!bl) return true;                       // 案件沒標語言 → 保守顯示
      if (minedIds.has(String(b.id))) return true; // 投過的永遠可見
      const fam = famOf(bl);
      if (fam.length) return fam.some((k) => famSet.has(k));
      return langSet.has(primary(bl));
    });

    // Per-role audition counts (casting only). The count IS shown to talents, and
    // audition_cap is a soft "popular" threshold (a nudge to try other roles) — NOT
    // a hard cap; talents can still audition a busy role.
    const castingIds = briefs.filter((b) => b.kind === 'casting').map((b) => b.id);
    const roleCounts: Record<string, Record<string, number>> = {};
    if (castingIds.length) {
      const { data: rq } = await r.db
        .from('marketplace_quotes')
        .select('brief_id, role_name, status')
        .in('brief_id', castingIds)
        .in('status', ['submitted', 'shortlisted']);
      for (const q of rq || []) {
        const bid = q.brief_id as string; const rn = (q.role_name as string) || '';
        (roleCounts[bid] ||= {})[rn] = (roleCounts[bid][rn] || 0) + 1;
      }
    }

    const { data: myQuotes } = await r.db
      .from('marketplace_quotes')
      .select('id, brief_id, role_name, gross_amount, net_amount, commission_rate, currency, message, status, sample_url, delivery_url, delivery_uploaded_at, reaudition_note, reaudition_requested_at, more_demos_note, more_demos_requested_at, extra_samples, agreement_accepted_at, included_revisions, created_at')
      .eq('talent_id', (r.talent as { id: string }).id)
      .order('created_at', { ascending: false });

    // 試音是否已截止(統一在後端算,前端各處都吃這個布林)。用共用 auditionDeadlinePassed:
    // 吃正常 ISO 也吃舊「6/30」短字串(以案子建立年份推年);沒設截止 = 不截止。
    const isClosed = (b: { audition_deadline?: string | null; deadline?: string | null; created_at?: string | null }): boolean => auditionDeadlinePassed(b);

    // Derive a non-identifying source flag (platform-posted vs from a client) and
    // STRIP client_email — talents see the source label, never the client identity.
    // 已徵得的角色(只角色名,不露指派給誰)—— 看板角色卡標「已徵得」。
    const briefIds = briefs.map((b) => (b as { id: string }).id);
    const assignedByBrief: Record<string, string[]> = {};
    if (briefIds.length) {
      const { data: aos } = await r.db.from('voice_orders').select('brief_id, role_name').in('brief_id', briefIds).not('role_name', 'is', null);
      for (const o of aos || []) { const k = String(o.brief_id); (assignedByBrief[k] ||= []).push(String(o.role_name)); }
    }
    const safeBriefs = briefs.map((b) => {
      const o = { ...b, source: isPlatformCase((b as { client_email?: string }).client_email) ? 'platform' : 'client', closed: isClosed(b), assigned_roles: [...new Set(assignedByBrief[(b as { id: string }).id] || [])] } as Record<string, unknown>;
      delete o.client_email;
      return o;
    });

    // Jobs the talent WON: accepted quotes whose brief is no longer 'open' (awarded/
    // closed) — the open-only list above drops them, so the talent would lose sight
    // of what they actually got. Surface them separately.
    const acceptedBriefIds = [...new Set((myQuotes || []).filter((q) => q.status === 'accepted').map((q) => q.brief_id as string))];
    // Classify won/ended against ALL open briefs (briefsRaw), NOT the ai_type-filtered
    // display list — else an AI case the talent quoted but can't currently see (no
    // matching consent) is wrongly shown as "已結束" although it's still open.
    const openIds = new Set((briefsRaw || []).map((b) => (b as { id: string }).id));
    const wonIds = acceptedBriefIds.filter((id) => !openIds.has(id));
    let wonBriefs: unknown[] = [];
    if (wonIds.length) {
      const { data: wb } = await r.db.from('marketplace_briefs')
        .select('id, brief_number, kind, title, content_type, language, accent, status, rate_note, media_scope, territory, license_term, deadline')
        .in('id', wonIds);
      // The FINAL script the client locked at selection lives on the production
      // order — surface it so the won talent records from the right script (self-serve).
      const { data: ords } = await r.db.from('voice_orders').select('id, brief_id, script_text, script_file_url, reference_files, deadline, created_at, status, payment_status').in('brief_id', wonIds);
      const orderByBrief: Record<string, { id: string; script_text?: string | null; script_file_url?: string | null; reference_files?: { name?: string; url: string }[] | null; deadline?: string | null; created_at?: string | null; status?: string | null; payment_status?: string | null }> = {};
      const orderIdToBrief: Record<string, string> = {};
      for (const o of ords || []) { if (o.brief_id) { orderByBrief[o.brief_id as string] = { id: o.id as string, script_text: o.script_text as string | null, script_file_url: o.script_file_url as string | null, reference_files: (o.reference_files as { name?: string; url: string }[] | null) || null, deadline: o.deadline as string | null, created_at: o.created_at as string | null, status: o.status as string | null, payment_status: o.payment_status as string | null }; orderIdToBrief[o.id as string] = o.brief_id as string; } }
      // The talent's delivered files (voice_order_versions) per won brief.
      const deliveriesByBrief: Record<string, { id: string; file_name: string; file_url: string; status?: string | null; client_feedback?: string | null }[]> = {};
      const orderIds = (ords || []).map((o) => o.id as string);
      if (orderIds.length) {
        const { data: vers } = await r.db.from('voice_order_versions').select('id, voice_order_id, file_name, file_url, version_number, status, client_feedback').in('voice_order_id', orderIds).order('version_number', { ascending: true });
        for (const v of vers || []) { const bid = orderIdToBrief[v.voice_order_id as string]; if (bid) (deliveriesByBrief[bid] ||= []).push({ id: v.id as string, file_name: v.file_name as string, file_url: v.file_url as string, status: v.status as string | null, client_feedback: v.client_feedback as string | null }); }
      }
      wonBriefs = (wb || []).map((b) => ({ ...b, order_id: orderByBrief[(b as { id: string }).id]?.id || null, order_status: orderByBrief[(b as { id: string }).id]?.status || null, order_payment_status: orderByBrief[(b as { id: string }).id]?.payment_status || null, final_script: orderByBrief[(b as { id: string }).id]?.script_text || null, final_script_url: orderByBrief[(b as { id: string }).id]?.script_file_url || null, order_deadline: orderByBrief[(b as { id: string }).id]?.deadline || null, order_created: orderByBrief[(b as { id: string }).id]?.created_at || null, deliveries: deliveriesByBrief[(b as { id: string }).id] || [] }));
    }

    // Cases the talent APPLIED to that have ended (closed / cancelled / awarded to
    // someone else) — so their audition doesn't just silently vanish; they see the
    // outcome. Excludes the open list (still live) and won cases (shown above).
    const quotedBriefIds = [...new Set((myQuotes || []).map((q) => q.brief_id as string))];
    const endedIds = quotedBriefIds.filter((id) => !openIds.has(id) && !wonIds.includes(id));
    let endedBriefs: unknown[] = [];
    if (endedIds.length) {
      const { data: eb } = await r.db.from('marketplace_briefs')
        .select('id, brief_number, kind, title, content_type, status, close_reason')
        .in('id', endedIds);
      endedBriefs = eb || [];
    }
    // Directly-ASSIGNED production roles (managed casting — no audition/quote): one
    // voice_order per role, talent_id = me, quote_id null. Surface each as its own
    // work item (a talent can have many roles on one project).
    const talentId = (r.talent as { id: string }).id;
    // released_at null = Wing 還在備稿(指派了但沒按「發出通知」)→ 配音員先看不到,
    // 免得搶在定稿匯入前就開錄(2026-07-15 女王百貨實際發生過)。
    const { data: ao } = await r.db.from('voice_orders')
      .select('id, brief_id, role_name, project_name, script_text, script_file_url, production_notes, reference_files, voice_sample_files, role_images, revision_note, revision_files, revision_count, revision_fee, revision_fee_status, revision_fee_total, revision_fee_agreed_at, deadline, deadline_time, status, download_url, talent_price, currency, created_at')
      .eq('talent_id', talentId).is('quote_id', null).neq('status', 'completed')
      .not('released_at', 'is', null)
      .order('created_at', { ascending: true });
    const aoIds = (ao || []).map((o) => o.id as string);
    const aoVers: Record<string, { id: string; file_name: string; file_url: string; status?: string | null }[]> = {};
    if (aoIds.length) {
      const { data: vers } = await r.db.from('voice_order_versions').select('id, voice_order_id, file_name, file_url, status').in('voice_order_id', aoIds);
      for (const v of vers || []) (aoVers[v.voice_order_id as string] ||= []).push({ id: v.id as string, file_name: v.file_name as string, file_url: v.file_url as string, status: v.status as string | null });
    }
    // 案件時區:期限顯示用(配音員端標示案件時區並換算當地時間)。
    const aoBriefIds = [...new Set((ao || []).map((o) => o.brief_id).filter(Boolean))] as string[];
    const tzByBrief = new Map<string, string>();
    if (aoBriefIds.length) {
      const { data: tzb } = await r.db.from('marketplace_briefs').select('id, timezone').in('id', aoBriefIds);
      for (const b of tzb || []) tzByBrief.set(String(b.id), String((b as { timezone?: string }).timezone || 'Asia/Taipei'));
    }
    const assignedOrders = (ao || []).map((o) => ({ ...o, deliveries: aoVers[o.id as string] || [], case_timezone: tzByBrief.get(String(o.brief_id)) || 'Asia/Taipei' }));

    const tt = (r.talent as { name?: string; quote_templates?: { intro?: unknown[]; revision?: unknown[] } });
    return NextResponse.json({ briefs: safeBriefs, myQuotes: myQuotes || [], roleCounts, myDemos, wonBriefs, endedBriefs, assignedOrders, myName: tt.name || '', templates: tt.quote_templates || {}, langFilter: { active: langSet.size > 0, visible: Array.isArray(vl) && vl.length ? vl : (Array.isArray(fl) ? fl : []) } });
  } catch {
    // Tables not migrated yet (or transient) — degrade to empty so the UI is fine.
    return NextResponse.json({ briefs: [], myQuotes: [], unavailable: true });
  }
}
