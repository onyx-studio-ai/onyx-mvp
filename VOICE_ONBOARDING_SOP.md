---
name: reference-voice-onboarding-sop
description: Onyx Studios 標準作業流程 — 客戶 / 配音員的聲音訓練收料 SOP。從報價到 deploy 全流程。
metadata: 
  node_type: memory
  type: reference
  originSessionId: afe73d40-bcf7-4004-9a56-433e884b705e
---

# Onyx Studios 聲音訓練 SOP

> 用於對接配音員 / 客戶,確保收到的資料可訓練,避免事後重錄 / 大量人工清理。

## 階段 0 — 報價前確認用途(避免錯方向)

問客戶 / 自家評估:**這個 voice 將拿去做什麼?**

| 用途 | 對應錄音規格(下面詳述)|
|---|---|
| 廣告 / 商業 narration | Track A (5-8 hr 念稿) |
| 旁白 / 教育 / 宣傳 | Track A 同 |
| 語音助手 / 客服 agent | Track B (10-15 hr 對話 + 念稿混合) |
| 陪聊 / 對話式 UX | Track B 同 |
| 角色配音 / 情緒戲 | Track C (8-12 hr 多情緒) |

**核心原則:** 訓練資料 tone 跟使用 tone 必須對齊。**廣告錄音訓不出好的陪聊 voice**(Wing v1 案例)。

---

## 階段 1 — 收料規格(配音員交付前必讀)

### 1.1 錄音技術規格

```yaml
必須:
  format: WAV (uncompressed)
  sample_rate: 48 kHz(最低 44.1 kHz)
  bit_depth: 24-bit(最低 16-bit)
  channels: mono(單聲道)
  noise_floor: < -55 dB
  peak: -6 dB to -3 dB
  reverb: 乾錄(無回音)
  background: 無冷氣 / 鍵盤 / 呼吸雜音

絕對拒絕:
  - MP3 / AAC 壓縮過的
  - 立體聲(用戶 + 配音員混在一起)
  - 有 BGM
  - 有後製效果(壓縮 / EQ / reverb)
```

### 1.2 文本資料

```yaml
必須隨音檔交付:
  - 逐字稿(精確到字)— 用 Excel 或 .txt
  - 檔名對照表:wav 檔名 ↔ 文本 ↔ 時長
  - 情緒標記(若有刻意演出)
  
如果配音員「自由發揮不照稿」:
  - 必須事先告知!
  - 我們會跑 SenseVoice ASR 自轉文本
  - 客戶要對 ASR 結果做最終校對(花他們時間)
```

### 1.3 容量規格(看 Track)

#### Track A — 念稿型(廣告 / 旁白)
```
最少 5 hr,建議 7-10 hr
段數: 2000-5000 段(每段 3-15 sec)
文本長度分布:
  3-5 字: 15%
  6-15 字: 35%
  16-40 字: 35%
  40+ 字: 15%
Tone variety:
  - 中性念稿(60%)
  - 親切自然(25%)
  - 情緒(興奮 / 嚴肅)(15%)
```

#### Track B — 對話型(陪聊 / agent)
```
最少 10 hr,建議 15-20 hr
段數: 3000-6000 段(會切片)
組成:
  - 念稿 20%(基礎發音 anchor)
  - 引導對話 50%(問答 question-answer pairs)
  - 即興自由講 30%
注意!對話檔必須:
  - 兩人錄完後配音員那軌單獨匯出
  - 或 user 那邊全程靜音(像數據堂的 _muted 版本)
```

#### Track C — 多情緒戲(角色配音)
```
最少 8 hr,建議 10-15 hr
必須涵蓋情緒:
  - 開心 / 興奮
  - 嚴肅 / 莊重
  - 悲傷 / 失落
  - 憤怒 / 不滿
  - 困惑 / 思考
  - 害羞 / 緊張
每種情緒至少 1 hr
```

### 1.4 法律 / 授權檔(每位配音員必收)

**獨立錄一段 5-10 秒授權聲明:**
```
"我是[本名],我確認本段聲音由我本人於[西元年月日]親自錄製,
 同意 Onyx Studios 用於 AI 語音模型訓練及商業使用。"
```

- 用最自然的講話方式(非念稿 tone)
- 同時當 production reference audio(Eric 用 eric_ref.wav 就是這個)
- 存到 `voice_actor_authorizations/[name]/`
- 這個解決法律 + 技術雙重需求

---

## 階段 2 — 收到資料後 QC(訓練前必做,2 小時)

```bash
# 1. 基本格式檢查
ffprobe each wav → 確認 sample_rate / bit_depth / channels

# 2. 噪聲底測量
sox stats / 計算 noise floor → 拒絕 > -45 dB 的

# 3. 抽樣聽 10%
隨機挑 10% 檔案實際聽,確認:
  - 配音員聲音穩定
  - 沒有奇怪雜音(電話響 / 椅子吱聲)
  - tone 跟用途匹配

# 4. ASR sanity check
SenseVoice 跑 5% → 對照客戶給的逐字稿,
若差異 > 30% 字 → 配音員根本沒照稿,
  改走 Track B+SV ASR pipeline,通知客戶

# 5. Duration 統計
看單檔長度分布 → 太短(<2s)或太長(>30s)的標記,可能要切片
```

**QC 紅旗 → 退回客戶重錄 / 重交:**
- 任何一檔含 BGM
- 噪聲底 > -45 dB
- 立體聲混軌
- 超過 30% 是 MP3 壓過
- 文本對不上音檔(>50%)

---

## 階段 3 — 訓練流程(我們這邊,標準化)

### 3.1 Pre-training smoke test(Day 1 必做!)

```python
# 在還沒 fine-tune 之前,先確認 inference 跑得通!
# 用 base model + 客戶交付的 ref audio + 一句測試文本
# 若 baseline 都跑不出 → 環境問題,先解決
# 教訓:Wing v1 訓完才發現 hifigan 不兼容,白做 5 epoch
```

### 3.2 訓練超參數(看資料量)

| 資料量 | 模型 | lr | max_epoch | early_stop trigger |
|---|---|---|---|---|
| < 5 hr | CV3 LLM | 1e-5 | 5-8 | CV loss 連 3 epoch 升 |
| 5-10 hr | CV3 LLM | **5e-6** | 8-15 | 同上 |
| > 10 hr | CV3 LLM | 5e-6 | 15-25 | 同上 |
| 任何量 | GPT-SoVITS | 預設 | 30-100 | 直接聽 sample |

### 3.3 Checkpoint 管理 SOP

```bash
# 啟動訓練前一定先跑:
- auto_prune_wing.sh daemon(只留最新 2 + 最佳 1)
- early_stop_watcher.sh daemon(CV loss 監看)
- 確認 model_dir 是 /workspace/...(NOT /dev/shm)

# 訓練中:
- 每個 epoch 完,hardlink 成 anchor_epoch_N_loss_X.pt
- 留最新 + 最佳 + 最近第 N+1(保險)
- 其他用 auto-prune 清

# 訓練完:
- 留 anchor_best + anchor_last
- rsync 到本機 SSD `/Volumes/WingAI SSD/.../voice_backups/{voice_name}/`
- voices.yaml 用 anchor_best
```

### 3.4 Disk Watch SOP

每訓練前算 disk budget(網路 volume 50 GB 預設):
```
固定占用:
  - venv: 16 GB
  - pretrained CV3 0.5B: 10 GB
  - Misc: 4 GB
固定總: 30 GB

可變:
  - dataset wavs: ~2 GB / hour
  - dataset parquets: ~500 MB / 1k samples
  - Checkpoints: 2 GB / ckpt × 3 留=6 GB
```

**若預估超過 45 GB → 預先升級 volume 或裁減 model**

---

## 階段 4 — Inference 部署(訓練完)

### 4.1 部署 checklist

```yaml
✓ Backup 訓練 checkpoint 到本機 SSD
✓ 寫入 voices.yaml:
  - refer_wav_path:配音員授權聲明(不是訓練資料!)
  - prompt_text:跟 ref audio 一字不差
  - prompt_lang:zh / yue / 對應方言
  - 推理參數:top_k=20, top_p=0.6, temp=0.6
✓ 跑 5 個 test phrase 覆蓋:
  - 短句(2-3 字)
  - 中句(常用文案)
  - 長句(完整旁白)
  - 中英混
  - 情緒(若 Track C)
✓ 客戶 listening sign-off
```

### 4.2 為何 ref 必須用授權聲明,不能用訓練資料

```
訓練資料用做 ref → output prosody 跟訓練資料同 tone(廣告腔)
授權聲明用做 ref → 自然講話,output 也自然
```

**Eric 案例:用 FAAM ad 當 ref → 大陸廣告腔。改用授權聲明 → 自然台灣腔。**

---

## 階段 5 — 客戶接收 + 後續

### 5.1 交付 deliverables

```
1. 配音員試聽 5 個 sample(免費,客戶決定)
2. 簽收後上 production:voices.yaml + 公開 API
3. 提供使用文檔:
   - voice_id
   - 推薦使用情境
   - 不適用情境(超出訓練 tone)
   - API 範例
4. 訓練資料 + checkpoint 備份位置
```

### 5.2 客戶要求改 → 何時值得重訓?

| 客戶反饋 | 對應動作 |
|---|---|
| 「tone 太正式,要更親切」 | 換 ref audio 嘗試(免費)。仍不行 → 收新錄音重訓(收費)|
| 「中英混不自然」 | 引擎限制,告知 + 提供 SSML 方案 |
| 「想要對話 tone」但原始是廣告錄音 | **要重收料 Track B**,告知必須 |
| 「想加新情緒」 | 收 1-2 hr 補錄,fine-tune 既有模型 5-10 epoch |

---

## 收費結構(內部參考)

| 項目 | 工時估算 | 建議報價 |
|---|---|---|
| 資料 QC + 預處理 | 4-8 hr | $XXX |
| 訓練 + GPU | A40 $0.45/hr × 5-10 hr | $XXX |
| 部署 + 5 sample 測試 | 2-4 hr | $XXX |
| 客戶反饋微調(1 輪) | 2-4 hr | $XXX |
| 第 2+ 輪反饋 | hourly | $XXX/hr |

---

Related: [[project-voice-training-lessons]], [[reference-voice-deployments]], [[reference-runpod]]
