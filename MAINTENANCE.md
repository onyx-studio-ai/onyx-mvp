# Onyx Platform — 維運手冊

> 平台日常維運的清單與 SOP。配套 `onyx-maintenance.ics`（行事曆檔）使用：
> 把 `.ics` import 到 Mac Calendar / Google Calendar 一次，每日/每週/每月/每季/每年
> 該做的事會自動跳通知。
>
> 本文件留作離線參考 + 各任務的詳細步驟。

---

## 📅 行事曆檔安裝（一次性）

```bash
# 雙擊或拖進 Mac Calendar
open "/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/onyx-platform/onyx-maintenance.ics"
```

或 import 到 Google Calendar：
1. https://calendar.google.com → 左欄 ⚙ Settings → Import & export
2. 選 `onyx-maintenance.ics`
3. 選一個專屬日曆（例如新建「Onyx 維運」）

匯入後 15 個 recurring event 會自動出現在對應的日期，**每個都有提前提醒**。

---

## 🔴 緊急優先（一次性，盡快做）

- [ ] **升 Supabase Pro $25/mo** — 避免再被 free tier auto-pause + 拿到每日備份
- [ ] **確認 domain auto-renew** 是 ON（onyxstudios.ai）
- [ ] **手動跑一次 db dump 存到 SSD** — 升 Pro 之前的保險

---

## 📧 每日（總計 7 分鐘）

### 09:00 收信巡視（5 min）
看 3 個信箱有無新詢價：
- `hello@onyxstudios.ai` — 一般諮詢
- `produce@onyxstudios.ai` — 製作部
- `support@onyxstudios.ai` — 技術支援

**SLA**：超過 2 小時未回需在系統內標記。

### 18:00 Paddle 失敗付款（2 min）
[vendors.paddle.com](https://vendors.paddle.com/) → 看：
- Failed payments
- Refund requests
- Disputes / chargebacks（這個很急）

---

## 📅 每週日（總計 30-40 分鐘）

### 10:00 Supabase 資料備份（15 min）
```bash
cd "/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/onyx-platform/project"
mkdir -p backups
DATE=$(date +%Y%m%d)
supabase db dump --data-only > "backups/${DATE}-data.sql"
supabase db dump --schema-only > "backups/${DATE}-schema.sql"
```
> 升 Supabase Pro 後可改成每月一次。

### 11:00 Vercel 部署 log 檢查（10 min）
[vercel.com/dashboard](https://vercel.com/dashboard) → 看：
1. 過去 7 天有無 failed 部署
2. 流量 trend（接近 free tier 100GB/月 要注意）
3. Function execution 有無頻繁 5xx

### 11:30 主流程 smoke test（15 min）
瀏覽器手動跑完整旅程：
1. https://www.onyxstudios.ai/ → 點服務卡進服務頁
2. /pricing → 看 3 個 tier 卡有正常顯示
3. /contact → 送一個 dummy 詢價（用自己 email）→ 確認有收到 confirmation
4. /apply → 開頭幾頁不要 submit 看流程順
5. 切語系（zh-TW → en → zh-CN）各看一輪

---

## 🗓 每月 1 號（總計 60-90 分鐘）

### 10:00 npm audit + outdated（30 min）
```bash
cd "/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/onyx-platform/project"
npm audit
# 看 high/critical 怎麼處理 → 必要時 npm audit fix
npm outdated
# 列出有新版的，計畫哪些要升
```
> 不要 `npm audit fix --force` —— 可能 breaking change。逐個 review。

### 11:00 Resend bounce rate（5 min）
[resend.com/emails](https://resend.com/emails) → 看 bounce rate：
- `< 2%` → 健康
- `2–5%` → 注意，可能 DNS / SPF / DKIM 有問題
- `> 5%` → 危險，email reputation 受損

同時看是否接近 free tier 上限（3000 信/月）。

### 14:00 Paddle ↔ 銀行對帳（30 min）
把當月 Paddle 入帳跟 Fine Entertainment 銀行帳戶對：
- 有無漏入帳
- 退款是否處理完畢
- 手續費比例（5% + $0.5/筆）有無異常

### 16:00 整體快照（15 min）
即使升了 Supabase Pro 也別只信雲端：
```bash
cd "/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform"
DATE=$(date +%Y-%m)
zip -r "onyx-snapshot-${DATE}.zip" onyx-platform/ \
    -x "onyx-platform/node_modules/*" "onyx-platform/.next/*" \
       "onyx-platform/project/node_modules/*" "onyx-platform/project/.next/*"
mv "onyx-snapshot-${DATE}.zip" /Volumes/WingAI\ SSD/backups/
```
萬一 GitHub / Supabase / Vercel 任一掛，你還有完整副本可重建。

---

## 🗓 每季（1, 4, 7, 10 月 1 號，1-2 小時）

### 死碼 / 未用套件清理
跟 2026-05 那輪類似的程序：
1. Orphan pages / components audit（找 0 incoming refs 的檔）
2. Unused npm packages（手動 grep 或用 depcheck）
3. TS error 歸零
4. console.log / commented code 清掉
5. 圖片 / 音檔資產 audit（public/ 下找沒人用的）

### 定價 / 客戶詢問統計
看當季數據：
- 哪些語系詢問最多？
- 哪個檔位（AI 即時 / 聲音導演 / 真人）成交率最高？
- 平均報價金額
- 流失點：客戶在哪個步驟離開

→ 根據數據調整定價策略 / 文案。

### 法律文件審查
看 /legal/{terms,privacy,aup,refund}：
- 跟現在實際服務內容對得上嗎？
- 定價有無跟 ToS §3 同步？
- Paddle 法律實體有變嗎？
- 個資處理範圍有變嗎？

---

## 🗓 每年

### 1/15 Domain 續費確認
- onyxstudios.ai auto-renew 是 ON
- 信用卡未過期
- 對應的 email 還能收信（續費通知不錯過）

### 2/1 大版本升級（半天）
評估升：
- Next.js（現在 16）
- React（現在 19）
- next-intl
- Tailwind / Radix
- 主要 deps

做 1-2 天的測試 + 升級。

### 3/1 整年 ROI 檢討（半天）
- **收入**：Paddle 總入帳、TTS 大案、配音傳統案
- **支出**：Supabase / Vercel / Resend 訂閱、Paddle 手續費、配音員分潤、錄音室成本
- **ROI by service tier**：哪個檔最賺？
- **方向決策**：明年要 push 哪一塊？

---

## 🚨 緊急狀況 SOP

### Supabase 整個掛了
1. 看 https://status.supabase.com/
2. 看 dashboard project 是不是 paused（free tier 7 天無流量自動）
3. 如果 paused → 點 Restore → 等 2-5 分鐘
4. 如果 deleted → 用 git 裡的 migrations 在新 project 重建：
   ```bash
   supabase link --project-ref <new-ref>
   supabase db push
   ```

### Vercel 部署一直 fail
1. 看 build log 找實錯誤
2. 90% 是 TS error 或 missing env var
3. 本機跑 `cd project && npm run build` 復現
4. 修了之後再 push

### 信件寄不出去（Resend issue）
1. https://status.resend.com/
2. 看 DNS SPF/DKIM 還對嗎（`dig TXT onyxstudios.ai`）
3. domain 有沒有被列為 spam → 看 [Google Postmaster](https://postmaster.google.com/)

### 客戶投訴付款扣了沒收到貨
1. Paddle dashboard 看訂單狀態
2. Supabase 看 orders 表
3. Resend dashboard 看 confirmation email 有沒有寄出/被 bounce
4. 必要時手動補寄 + 退款

---

## 📊 一目了然儀表板（自己加進 bookmarks）

| 服務 | URL |
|---|---|
| Vercel deploys | https://vercel.com/dashboard |
| Supabase dashboard | https://supabase.com/dashboard |
| Resend emails | https://resend.com/emails |
| Paddle vendors | https://vendors.paddle.com/ |
| GitHub repo | https://github.com/onyx-studio-ai/onyx-mvp |
| Production site | https://www.onyxstudios.ai |
| Status pages | https://status.vercel.com · https://status.supabase.com · https://status.resend.com |

---

最後更新：2026-05-20
