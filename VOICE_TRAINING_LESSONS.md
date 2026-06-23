---
name: project-voice-training-lessons
description: All hard-learned lessons from Eric + Wing + 阿宏 voice training (2026-04 to 2026-05). Use BEFORE starting any new voice training to avoid repeating mistakes.
metadata: 
  node_type: memory
  type: project
  originSessionId: afe73d40-bcf7-4004-9a56-433e884b705e
---

## 一、聲音資料品質決定一切(80% 重點)

### 1.1 同質性 = 死亡

**痛點:Wing CV3 失敗根因** — 9000 條全是「念稿/廣告 tone」,單一風格,模型 4 epoch 就 overfit。

**SOP 規則:**
- ❌ 不要只給單一場景錄音(只有廣告 / 只有教育)
- ✅ 必須**多 tone 多情境混合**:正式 + 親切 + 對話 + 安靜 + 興奮
- ✅ 至少 3-5 種講話節奏

### 1.2 念稿 vs 自然對話

| 用途 | 該錄什麼 |
|---|---|
| **廣告 / 旁白 voice** | 念稿 60-70% + 改述 30%(讓 prosody 不死板) |
| **語音助手 / 陪聊** | 念稿 20% + **引導對話 50%** + 即興 30%(阿宏範本) |
| **通用混合** | 念稿 30% + 對話 40% + 朗讀文章 30% |

**痛點:阿宏 case** — 給的稿子上面寫好對白,但他「用自己的話講」,Excel 文本對不上實際發聲 → 必須 SV ASR 重轉。
→ **教訓:錄音前要明確要求念稿 OR 即興。不要混。**

### 1.3 對話必須單軌交付(零容忍)

**痛點:阿宏 case** — 112 個陪聊檔最初是用戶 + 阿宏雙人混音,需做 speaker diarization。用戶後來提供純阿宏版才解決。

**SOP 規則:**
- 對話錄音 **必須** 兩人分軌或一人靜音版交付
- 不接受 stereo 同軌混音
- 如果發音人也回應 user → 要求他們 mute user 那段或提供獨立檔案

## 二、錄音技術規格(發音人 / 客戶必須遵守)

```yaml
基本格式:
  sample_rate: 48 kHz (最低 44.1)
  bit_depth: 24-bit (最低 16-bit)
  channels: mono
  format: WAV uncompressed (NOT MP3 / NOT AAC)
  
品質指標:
  noise_floor: < -55 dB(數據堂級別)
  peak_level: -6 dB ~ -3 dB
  reverb: 無回音(乾錄)
  silence_padding: 開頭結尾各留 0.3-0.5 sec
  
單段長度:
  ad/narration use case: 2-15 sec per file
  dialogue use case: 30 sec - 5 min per file(整段對話)
  總時長: 至少 5 hr(廣告 voice),10 hr+(陪聊 voice)
```

## 三、Tone Variety Checklist(錄音時要涵蓋這些)

| 情緒 / 風格 | 為什麼必須 |
|---|---|
| 中性念稿 | 基礎 prosody |
| 開心 / 興奮 | 情緒上限 |
| 嚴肅 / 正式 | 商業旁白 |
| 親切 / 隨意 | 對話自然度 |
| 嘆氣 / 思考 | 真實感 |
| 加快語速 | 廣告 punchline |
| 放慢語速 | 教學 / PSA |
| 笑聲 / 感嘆詞 | 自然 marker(笑/嗯/誒/呃)|

至少**覆蓋 6 個** → 模型才有足夠變化空間。

## 四、文本搭配(若念稿)

文本長度分布要均勻:
```
3-5 字短句:   15%    e.g. "好啦","等等"
6-15 字中句:  35%    主力
16-40 字長句: 35%    旁白主體
40 字以上:    15%    複雜句法練習
```

涵蓋詞類:
- 數字 / 日期 / 時間
- 英文混排(品牌名)
- 專有名詞(品牌、地名)
- 各種句型(肯定 / 否定 / 疑問 / 命令)
- 標點停頓(逗號 / 句號 / 問號 / 驚嘆號)

## 五、訓練 pipeline 教訓(別再踩雷)

### 5.1 Checkpoint 管理(2026-05-23 教訓)

❌ **絕不**把 model_dir 設成 `/dev/shm` 或 tmpfs(pod 一關就消)
✅ 永遠存到 network volume `/workspace/...`
✅ 用 auto-prune daemon 自動清舊 ckpt 避免 disk 爆(本次教訓)
✅ Hardlink 最佳 epoch 當 `anchor_*.pt`(永不誤刪)

### 5.2 Disk Quota 預防(2026-05-29 教訓)

RunPod network volume 預設 50 GB,**每個 CV3 ckpt = 2 GB**:
- 訓練前算好:Pretrained models 10 GB + venv 16 GB + dataset 5 GB + ckpts ~6 GB(留 3 個)= 37 GB,剩 13 GB buffer
- 每 epoch save 期間需 4 GB 暫存(舊+新並存) → 必須提前清
- 永遠跑 auto-prune daemon,**第一次失敗就裝**,別等到第三次

### 5.3 Inference 先測 baseline(2026-05-30 教訓)

訓練前先確認 `inference_zero_shot()` 跑得通 baseline(用 example.py 的 prompt)。本次踩雷:CV3 訓完才發現 `f0_predictor` 跟 `Fun-CosyVoice3-0.5B-2512` 版本不兼容 — 整 LLM 都白訓。
→ 規則:**Day 1 就跑 inference smoke test**。

### 5.4 超參數(Hyperparameters)

| 模型 | lr | accum_grad | max_epoch | early_stop |
|---|---|---|---|---|
| CV3 LLM(>5 hr 資料)| 5e-6 (NOT 1e-5)| 2 | 10-15 | CV loss 連 3 epoch 不降就停 |
| CV3 LLM(<5 hr 資料)| 1e-5,警惕 overfit | 4 | 5-8 | 同上 |
| GPT-SoVITS | 預設 | 預設 | 50-100 | 看 generated 樣本 |

## 六、客戶 onboarding 流程(SOP)

詳見 [[reference-voice-onboarding-sop]]

## 七、本次三個 voice 的最終定位 + 教訓

| Voice | 訓練資料 | 教訓 | 用途 |
|---|---|---|---|
| Eric (GPT-SoVITS 15ep)| 7 hr FAAM 廣告 | GPT 訓太少 + ref 用訓練資料 → 大陸腔 | 廣告 / 旁白 |
| Wing v1 CV3 (5ep)| 9 hr 全念稿 ad-tone | 同質性高 → overfit 早 + tone 死板 | 廣告 / 旁白 |
| Wing v2 CV3 (lr 5e-6, 訓中)| 同 v1 但 lr 減半 | 看是否 epoch 8-10 突破 loss 2.3 | TBD |
| 阿宏 CV3 (未訓)| 7.5 hr 純單講 + 數據堂品質 | 期待最好結果(品質 + 中等變化)| 對話陪聊 |
