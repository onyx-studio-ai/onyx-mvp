# Paddle 上線設定 Checklist（Onyx Studios）

> 程式端已就緒:結帳依「訂單實際幣別」收款(TWD 單收 TWD)、計價設為**外加稅(tax_mode: external)**、webhook 驗簽 + 自動標記收款都已接好。
> 以下是 **Paddle 後台 + Vercel 環境變數** 你要點/填的部分。先在 **Sandbox** 跑通,再切 Production。

---

## 🟢 現況(2026-06-28 對照你的後台截圖)
- ✅ **A. 公司審核已過** — Verification passed,帳號名 FINE ENTERTAINMENT CO., LTD.。
- ✅ **網域已核准** — Website approval:`onyxstudios.ai` = **Approved**(真實刷卡不會被擋了)。
- ✅ **Default payment link** = `https://www.onyxstudios.ai`(綠勾)。
- ✅ **Statement descriptor** = `FINEENTERT`(卡單上顯示的名稱,已設)。
- ✅ **H(部分)實刷已通** — Production 已成功收一筆 US$1.00(Apple Pay,已退款),代表 production API key + client token + 卡片/Apple Pay 流程是通的。
- ✅ **D. Payout Settings 已填完(2026-06-28)** — 走 **Wire/Bank transfer** 進公司戶頭:Cathay United Bank, Daan Branch、SWIFT `UWCBTWTP`、A/C `020080017287`、Legal Name `FINE ENTERTAINMENT CO., LTD.`。Account Type = Company。已 Save。
  - 💡 Paddle 表單只吃半形英數 + `. , -` 空格;行名/行址要去撇號去括號(`Daan` 非 `Da'an`、拿掉 `(R.O.C.)`)。
- ✅ **B. 稅金 = Price excludes tax(外加稅)** — 已改 + Save(2026-06-28)。客戶外加當地稅、你實拿不變,跟程式 `tax_mode: external` 對齊。
- ⬜ **C. TWD 單還沒測** — 那筆是 USD;先前的 bug(TWD 變 USD)已修,但要實測一張 TWD 才算數。
- ✅ **F. Webhook 已接好(2026-06-28)** — destination `…/api/payment/paddle/webhook` = Active、log 全 Delivered(200)。因為簽章錯會回 401→Failed,全 Delivered 證明 **Vercel `PADDLE_WEBHOOK_SECRET` 填對、簽章有過**。handler 收到 `transaction.completed`/`transaction.updated(status=completed)` → `finalizeOrderPayment` 寫 `status=paid, payment_status=completed, paid_at`。其餘狀態回 200 略過(log 那些 transaction.updated 就是被正確略過的)。
  - 🧹 另有 3 個 Inactive 的 `diffident-jane-…` webhook = 舊的本機/tunnel 測試用,inactive 無害,可刪可不刪。
  - ⬜ **唯一剩的:跑一筆真的完成付款,確認訂單自動翻「已收款」**(順便當 TWD 實測)。
- 💳 **付款方式**:目前開了 PayPal / Apple Pay / Bancontact。建議**補開 Google Pay**(Android 對應 Apple Pay);中國客戶要的話再開 **WeChat Pay**。卡片預設就是開的(不在這份開關清單裡)。「Saving payment methods」關著、「Display discount field」開著、Marketing consent 開著 —— 都 OK,不用動。
- 🧾 **稅務類別**:Standard Digital Goods = Default,對配音數位交付正確,不用動;SaaS 也已 Approved(日後做訂閱可用)。

### 🚨 已查證的兩件事(影響金流設計,務必知道)
1. **TWD 是「presentment-only」** — 客戶結帳可顯示/支付 TWD,但 Paddle 只用 USD/EUR/GBP/AUD/CAD **結算撥款給你**(我們收 USD)。= 客戶看 TWD 沒問題,你拿到的是換匯後的 USD。
2. **Paddle 不做 marketplace 撥款給第三方(配音員)** — Paddle 只把錢(每月、門檻 US$100、電匯/Payoneer)撥給**你 Onyx 一個收款主體**。**「Onyx → 配音員」這條腿 Paddle 不處理**,要另走人工電匯 / Payoneer / Wise。Paddle 只負責「客戶 → Onyx」這條腿(順便全球代收代繳稅)。

---

## A. 帳號審核(上線前 Paddle 會審)
- [ ] **Verify business** — Seller settings → Business verification:公司名 **FINE ENTERTAINMENT CO., LTD.**、地址、統編、負責人證件。
- [ ] **Add website / domain** — 加 `onyxstudios.ai`,並等 Paddle 核准(未核准前真實刷卡會被擋)。
- [ ] **Default payment currency** 設定(見 C)。
- 💡 審核通常 1–3 工作天;期間可先用 Sandbox 測。

## B. 稅金(已選:外加稅)
- [ ] Paddle 是 **Merchant of Record** —— 全球 VAT / sales tax 由它自動算、收、報繳,你**不用**到各國登記稅籍。
- [ ] **Catalog → Settings → Tax → 預設設成 "Prices exclude tax"(外加稅)**。
  - 程式已在每筆價格設 `tax_mode: external`,所以即使後台沒改也是外加稅;但把後台預設也設成一致,避免日後手動建價時不一致。
  - 效果:你設 base 價,客戶依所在國家**外加**當地稅(英國 +20% VAT…),**你不吃那 2 成**,實拿一致。
- [ ] 你最後實拿 = base 價 − Paddle 手續費(約 **5% + US$0.50 / 筆**);稅不經過你的帳。

## C. 幣別(確認 TWD + USD)
- [ ] Catalog / Checkout settings → **Supported currencies** 勾選 **TWD** 與 **USD**(Paddle 有支援 TWD)。
- [ ] 確認 TWD 沒有「presentment-only」限制(若有,結帳能顯示 TWD 但結算轉 USD —— 跟 Paddle support 確認)。
- [ ] 注意各幣別**最低交易額**(TWD 太小額會被擋;我們最低 NT$1,000 應該 OK)。

## D. 撥款(Payout)
- [ ] Seller settings → **Payouts → Add payout method**:
  - 電匯(Wire):**Cathay United Bank 大安分行**,SWIFT **UWCBTWTP**,帳號 **020080017287**(凡音外幣帳戶);或
  - **Payoneer**(部分地區手續費較低)。
- [ ] 確認 **payout threshold**(預設約 **US$100**,未達不撥)。
- [ ] 確認 **撥款排程**:Paddle 每月 1 號結上月餘額 → 2–15 號之間匯出 → +最多 3 工作日到帳。
- [ ] 部分國家電匯收 **US$15 SWIFT 手續費**(台幣電匯常見),記到成本。

## E. Reserve（新帳戶保留金，要主動問）
- [ ] 開 support ticket 問:**新帳戶是否有 rolling reserve?百分比與保留天數?**(常見 5–10%、滾動 30–60 天)。
- [ ] 這會影響「Paddle 收款 → 你拿到錢」的時間差 → 影響「**配音員月結**」是否需要墊款(見金流 memo)。

## F. Webhook（收款成功 → 自動標記訂單已付）
- [ ] Developer tools → **Notifications → New destination**:
  - URL:`https://www.onyxstudios.ai/api/payment/paddle/webhook`
  - 訂閱事件:**`transaction.completed`**(及 `transaction.paid`)。
- [ ] 複製該 destination 的 **signing secret** → 填到 Vercel 的 `PADDLE_WEBHOOK_SECRET`。
- [ ] 程式已驗簽(`Paddle-Signature`)+ 收到事件會把對應訂單標記收款,進製作佇列。

## G. Vercel 環境變數（Sandbox → Production 各一組）
- [ ] `PADDLE_ENV` = `sandbox`(測)→ 上線改 `production`
- [ ] `PADDLE_API_KEY` = 對應環境的 **server API key**
- [ ] `PADDLE_WEBHOOK_SECRET` = 對應環境的 **webhook signing secret**(見 F)
- [ ] `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` = 對應環境的 **client-side token**
- 🚨 sandbox 與 production 是**不同 key**,別混;改完要 redeploy。

## H. 上線前實測（先 Sandbox）
- [ ] 用 Paddle **測試卡**(sandbox)對一張 **USD 單**結帳 → 確認金額、外加稅顯示正確 → webhook 進來 → 後台訂單自動變「已收款」。
- [ ] 再測一張 **TWD 單** → 確認收的是 **TWD** 不是 USD(這就是先前那個 bug)。
- [ ] 都 OK → 切 `PADDLE_ENV=production` + 換 production keys → 用小額真卡再驗一次。

---

### 摘要(你只要做這些「決定/填資料」)
1. 後台驗證公司 + 加 onyxstudios.ai 網域(等審核)。
2. 稅:後台預設設「外加稅」(程式已設,後台對齊即可)。
3. 幣別:勾 TWD + USD。
4. 撥款:綁國泰外幣帳戶 / Payoneer,記下門檻與排程。
5. 問 Paddle reserve(影響配音員月結墊款)。
6. 加 webhook URL + 把 signing secret 填進 Vercel。
7. 四個環境變數填好(sandbox 先,production 後)。
8. Sandbox 測 USD + TWD 各一張 → 再上 production。
