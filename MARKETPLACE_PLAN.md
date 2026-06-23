# Onyx Marketplace — 執行計畫（MVP-first）

> 版本 2026-06-20。供 Wing 審閱拍板用。原則:供給先行 · Managed（Onyx 居中抽 20%）· 防跳單（聯絡不外露）· 真正難關是「需求量」不是技術。

---

## 0. 現況資產（沿用,別重蓋）

| 已有 | 用途 |
|---|---|
| **Supabase Auth + 客戶 dashboard** | 客戶帳號(登入/註冊/Email 確認/重設密碼)+ 看自己訂單。`app/[locale]/auth/*`、`dashboard/*` |
| 訂單綁帳號 | 訂單表 `user_id → auth.users`,有 RLS 資料隔離 |
| **Stripe** | 付款(voice/music orders 已在用) |
| **Resend + Email 驗證** | 交易信、通知信、OTP;`mail-templates.ts`(已 logo 化) |
| **talents / talent_applications** | 人才資料;887 人正在透過 `/apply/talent` 進來 |
| messaging_contacts | 報名已收 Line/WhatsApp/Telegram → 之後推播用 |
| 錄音室(台/港) | TW/HK 配音員可代安排 |

**缺口（要新建）**:配音員登入/後台、jobs/proposals/messages 資料模型、通知推播（Telegram/Line）。

---

## 1. MVP 範圍（先上、先能賺、先驗證需求）

**MVP = 配音員帳號地基 + 人才櫥窗 + 找配音需求表（人工媒合）**

- **不做**(MVP 後再說):配音員自助報價 UI、平台內即時訊息、自動託管金流。
- **為什麼**:① 平台馬上看起來「活的」② 你**馬上能接案、收 20%**(人工媒合)③ 用人工驗證「到底有沒有客戶需求」,有了再投工自動化。蓋全自動 marketplace 要好幾個月——先驗證再投工最 lean。

---

## 2. 分階段

### Phase 0 — 地基：配音員帳號 + 核准流程（底層,先做）
- Supabase Auth 加 **role（talent / client）**;`talents` 表綁 `auth_user_id`。
- 核准申請 → 寄「設定密碼」邀請連結(沿用現有 reset-password 流程),配音員設密碼即開通。
- 配音員後台殼(先空,之後放案子/報價)。
- 順手補:核准信承諾過、但還沒做的「**合作同意書自動寄送**」。
- **交付**:配音員能登入、有個後台。｜規模:中

### Phase 1 — 人才櫥窗（公開頁,最快有感）
- `/talents` 列表:聽 demo、看顯示名/語言/口音/類型/性別/特質,可篩選。
- `/talents/[id]` 個人檔案頁(SEO 友善 → 自然流量)。
- 只顯示 approved 人才;真名/聯絡方式不露。
- **交付**:對外能瀏覽、聽聲音 → 平台「活了」。｜規模:中｜**不需 auth/金流,可最先做**

### Phase 2 — 找配音需求表（MVP 媒合入口）
- 公開「找配音 / Post a brief」表單:類型 / 語言 / 長度 / 預算 / 截止 / 稿件。
- 客戶可登入填(綁帳號)或訪客填(留 Email)。
- 案子進 `jobs` 表 → 通知 Onyx(team email)→ **你/團隊人工挑人媒合**。
- 客戶 dashboard 看自己發的案子狀態。
- **交付**:能收案、能開始接生意。｜規模:中

> **★ 到這裡就是可上線的 MVP**:櫥窗 + 收案 + 你居中人工媒合 = 已能跑、能賺、能驗證需求。

### Phase 3 — 報價 / 提案（開始自動化交易）
- 配音員後台看到媒合給他的案子 → 提報價(**顯示「扣 20% 後你實拿 X」**)+ 附客製 demo + 可低於客戶預算。
- 客戶看提案、比較、選人。
- **交付**:配音員自己報價,減少你人工。｜規模:中

### Phase 4 — 平台內訊息 + 通知推播
- 客戶 ↔ 配音員 平台內對話 thread。
- 通知推到 **Telegram（免費先做）/ Line（為台灣）**;回覆要回平台;聯絡方式不外露(防跳單)。
- **交付**:溝通閉環 + 黏著度。｜規模:高

### Phase 5 — 金流 / 託管 + 交付
- Stripe 收款 → 款項暫扣 → 配音員交付檔案 → 客戶驗收放款 → 平台抽 20% → 撥款(初期人工撥,沿用 `talent_earnings`)。
- **交付**:全自動閉環。｜規模:中高

---

## 3. 新增資料模型（草案）

- `talents`：加 `auth_user_id`、`status`、`tier`。
- `jobs`：`client_user_id`、`type`、`language`、`length`、`budget`、`deadline`、`script`、`status`、`source_country`。
- `proposals`：`job_id`、`talent_id`、`quote`、`net_to_talent`、`demo_url`、`status`。
- `messages`：`job_id`、`from_user`、`to_user`、`body`、`created_at`（平台內）。
- 撥款沿用現有 `talent_earnings`。

---

## 4. Wing 要拍板的事

1. **MVP 範圍（Phase 0–2）先上,對嗎?**
2. 配音員核准後 → **寄「設定密碼」邀請連結**(建議,禮貌可控)還是自動開帳號?
3. 客戶發案 → 可**訪客填但留 Email**、鼓勵註冊看進度(建議),還是強制登入?
4. 需求從哪灌:**172 個 warm 客戶** + 你的 LINE / 微信通路是第一批。

---

## 5. 建議的第一個 sprint

**Phase 1 人才櫥窗先做** —— 最快有感、不依賴 auth/金流、純讀 talents 表;而且你正在進人,先讓他們「被看見」。  
同時 **Phase 0 配音員帳號地基並行準備**(底層、沒畫面,可背景進行)。

> 之後每個 Phase 都單獨上線、看反應,再決定下一步投不投工。
