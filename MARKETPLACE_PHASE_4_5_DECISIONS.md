# Onyx Marketplace — Phase 3c built · Phase 4 & 5 need your decisions

_Written overnight 2026-06-20 → 06-21. Backed by multi-source web research (3 agents, 25+ sources, cited below). Where something is unconfirmed, it says so — nothing here is guessed._

---

## 0. UPDATE — decisions received, Phase 4 built

Wing answered all 3 decisions; acting on them:

1. **Commission** → 一般線上案 **20%**(marketplace,已正確)· AI 案 **25%**(獨立系統,保留)。可統一但分開是設計;**marketplace 維持 20%,不動 AI earnings**。
2. **Messaging** → 封閉型站內、客戶↔配音員直聊、**Onyx 全程可見**、登入制;不介意少量跑單,故**不做激進遮罩**。→ **Phase 4 已建並上線**(migration `20260620140000`)。
3. **Payments** → **線下手動**:台灣本地直接轉帳 + 國外 PayPal,人數不多可負荷,**不需自動 escrow / 不需新 provider**。→ **Phase 5 = 你現有的 `talent_earnings` 手動撥款流程,無新程式**。marketplace 成交後在現有 earnings 後台記一筆即可。

**所以現在要跑的 migration 有 2 條**(見 §E):`20260620120000`(案源/報價)+ `20260620140000`(訊息)。跑完跟我說,我做完整 e2e。

---

## A. What I built tonight — Phase 3c (briefs + quotes)

**Status: code-complete · tsc-clean · deployed · degrades gracefully until you run one migration · runtime e2e pending that migration.**

The flow (managed model — Onyx mediates, like Bunny Studio / Voices.com Managed):

1. Client posts a brief at `/hire` → now **persisted** to `marketplace_briefs` (still emails you too; the DB write is non-fatal, so /hire works whether or not the table exists yet).
2. Active talents see open briefs at **`/talent/opportunities`** and submit a quote. They **always see their NET take-home** (gross × (1 − 20%)) — gross is what the client pays. (Industry norm: Fiverr shows net only; Voices.com makes net first-class. 20% = same as both.)
3. **You** mediate at **`/admin/marketplace`**: shortlist / accept / reject quotes. Accepting awards the brief and auto-rejects the rest.
4. **Anti-leakage:** the client's identity (email/name/company) is **hidden from talents** — only the brief content is shown. Onyx makes the introduction.

**To activate:** run migration `project/supabase/migrations/20260620120000_marketplace_briefs_quotes.sql` (creates `marketplace_briefs` + `marketplace_quotes`). Then tell me — I'll run the full e2e (post brief → talent quote → admin award) on prod, all three languages, exactly like I did for the talent accounts.

---

## B. 🚩 Decisions only you can make (these are why 4 & 5 aren't "just built")

Your "research first, don't 腦補" rule paid off — the research surfaced that 4 and 5 hinge on **business/money/legal decisions**, not code. Building them blind would have been wrong:

| # | Decision | Why it's blocking | My recommendation |
|---|---|---|---|
| 1 | **Commission: 20% or 25%?** | Onboarding terms (what talents agreed to) say **20%**. But `talent_earnings` code comments **25%** for platform orders. Quotes show net-of-this. | Use **20%** (it's what talents signed). I coded it configurable per-row (default 0.20) so it's not hardcoded. **Reconcile the canonical number.** |
| 2 | **Phase 4 messaging model** | Direct client↔talent chat is the #1 cause of marketplace **revenue leakage** (parties go off-platform) — and you hit exactly this with AVOICE. | **Masked direct chat, opened only after you shortlist** (option B below). Not fully open. |
| 3 | **Phase 5 payment rail** | 🚨 **Paddle's terms BAN marketplaces + human services (voice-over)** — you cannot use it to pay talents. TapPay's `代收代付` *might* do escrow-split but specs are unconfirmed. | Keep the **"Onyx collects → pays talent out-of-band"** model you already have; investigate TapPay 代收代付; get accountant + lawyer. Details in §D. |

---

## C. Phase 4 — in-platform messaging (design ready, needs decision #2)

**Research consensus** (Sendbird, CometChat, Sharetribe, Cobbleweb, Supabase docs, + messaging-schema sources):

- **Schema** is simple and ready: `conversations` (tied to a brief/quote, denormalized `last_message_at`), `messages` (with `body` shown + `body_raw` admin-only for audit), `conversation_participants` (with `last_read_at` — unread = `message.created_at > last_read_at`). Email-notify via a debounced "only if still unread after ~3 min, max 1/hour" job.
- **Realtime not needed for v1** — at our volume (tens of conversations, async replies) plain polling + email notification is sufficient. Supabase Postgres-Changes can be added later as polish, not a dependency.
- **Leakage is the real issue.** Every source agrees: (a) regex-mask phone/email/Line/WeChat in messages (leaky but useful friction — note obfuscation like "oh-nine-one-two", "加我Line"), (b) **gate contact reveal behind payment/shortlist**, (c) ToS penalties, and most importantly (d) **reduce the incentive** to leave (escrow, standardized pricing, dispute resolution). "Leakage is a symptom of insufficient platform value." — Sharetribe.

**The decision (option B recommended):**
- **A. Fully mediated** — no direct chat; talent↔Onyx and client↔Onyx only. Safest, zero leakage, but slow and manual for you.
- **B. Masked direct chat, opened after you shortlist** ✅ — client and talent message directly once you've shortlisted them; messages run through contact-info masking; you (admin) can read all threads. Balances speed and leakage protection. Matches the managed model.
- **C. Open direct chat** — fastest, highest leakage risk. Not recommended given your AVOICE history.

I did **not** build this blind because B vs A is a real revenue-policy call. Say "B" (or your pick) and I'll build it — schema's designed, it slots onto Phase 3c's briefs/quotes.

---

## D. Phase 5 — payments / escrow (the honest picture, needs decision #3)

**The hard findings (cite-checked against provider docs):**

1. **Paddle cannot be used to pay talents.** Its Acceptable Use Policy explicitly forbids "digital marketplaces… that enable non-Paddle sellers to sell" and "human services… not related to a software offering." Voice-over is exactly that. An attempt risks account suspension. (paddle.com AUP)
2. **TapPay has two products.** The **Gateway** is gateway-only (money settles to *your* account — no payouts to talents). But **TapPay 代收代付 (Payment Facilitator)** *advertises* collect-and-disburse with a 分帳/split function — i.e. it *might* do "hold client payment → pay talent 80% on delivery, keep 20%." **UNCONFIRMED** — the spec page is JS-rendered; you'd need to **call TapPay** to confirm (a) whether each talent must be KYC-onboarded as a payee, (b) whether you control the release trigger via API, (c) payout timing, (d) that it legally covers "marketplace paying talents" (vs needing an e-payment 電子支付 licence).
3. **The standard small-marketplace pattern — which you already have.** Platform collects the full client payment, books the **talent's share as a liability** (only your 20% is revenue), holds "escrow" as a **state in your own DB** (not a regulated account), and pays talent **out-of-band** (bank/Wise/Payoneer), manually at first. Your existing `talent_earnings` + manual-payout migration (`20260607080000`) **already implements this.** So Phase 5 v1 = formalize that + add an in-app "held → released" status on the awarded brief, not a new money rail.
4. **Accounting/legal (get sign-off before real money):** recognize **only the 20% as revenue** (agent/net treatment, not gross); TW talents may trigger **扣繳 withholding + 各類所得 reporting**; foreign talents may need W-8/W-9. One TW accountant + one lawyer (代收代付 scope + contractor terms).
5. **True automated escrow** (split + payouts + KYC handled for you) means **Stripe Connect** (lowest effort) or **Mangopay** (escrow-focused) — a provider you'd add later if/when manual payouts hurt. Not tonight, not blindly.

**My recommendation:** don't build a fake "escrow" on a prohibited/unconfirmed rail. v1 = keep collecting via your existing checkout, track the talent's share + "held/released" state on the brief (building on `talent_earnings`), pay out manually. In parallel: (1) call TapPay re 代收代付 split, (2) book the accountant + lawyer. If you later want one-click automated escrow, Stripe Connect is the upgrade. **Tell me which path** and I'll build the in-app payment-status layer (no real money moves until you've wired a confirmed rail + had legal sign-off).

---

## E. Activation checklist (your morning, in order)

1. **Run these 2 migrations** in the Supabase SQL editor (order matters — quotes/messages reference briefs):
   - `20260620120000_marketplace_briefs_quotes.sql` → Phase 3c (案源/報價)
   - `20260620140000_marketplace_messages.sql` → Phase 4 (訊息)
   - _(earlier, not urgent: `20260620093000_fix_order_number_race.sql`)_
2. **Tell me "migration done"** → I run the full e2e on prod: post brief → talent quote → admin award → client↔talent message → Onyx reads/replies. Tri-lingual. Report green/red.
3. **Phase 5 = no build** — marketplace deals close into your existing manual payout (`talent_earnings`): TW transfer / 國外 PayPal. (Optional later: auto-create an earnings row on award — say the word.)
4. **Out-of-band, only if/when you want automated escrow:** call TapPay (代收代付 split feasibility); book accountant + lawyer. Not needed for the manual model you chose.

---

## F. Honest status

| Item | State |
|---|---|
| Phase 3c code (briefs/quotes/admin/UI) | ✅ built, tsc-clean, deployed, reviewed |
| Phase 3c runtime e2e | ⏳ blocked on your migration (I can't run DDL) — will verify the moment it's applied |
| Phase 4 messaging | 📐 researched + schema designed; build gated on decision #2 |
| Phase 5 payments | 📐 researched + recommended; **Paddle ruled out**; build gated on decision #3 + legal |
| Tri-lingual (tw/cn/en) | ✅ for everything built (Phase 3c) |

I did not fake "done." Everything buildable-without-your-input is built and deployed; everything needing a business/money/legal call is researched, recommended, and waiting on you — exactly as you asked.

---

### Sources (selected)
Paddle AUP (marketplace/human-services ban) · TapPay 代收代付 + GOGOSHOP gateway-vs-facilitator comparison · a16z marketplace take-rate glossary · Fiverr/Voices.com/Upwork fee & status docs · Vertabelo freelance-platform schema · Crunchy Data enums-vs-CHECK · Sharetribe & Cobbleweb (platform leakage) · Sendbird/CometChat marketplace messaging · Supabase Realtime/Postgres-Changes docs · Nicolás Parada messenger schema. (Full URLs in the session research reports.)
