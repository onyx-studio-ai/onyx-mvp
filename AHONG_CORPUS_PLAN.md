# 冠彥 (阿宏) Corpus 處理計畫

> 數據堂台灣國語 TTS 語料 — 17.04 hr 男聲 / 對話型陪聊 AI persona「阿宏」(20歲台灣男大生)
>
> 用途:Onyx Studios 第 3 號 voice (Eric Mandarin / Wing Cantonese / **阿宏 Mandarin chat-persona**)。可給 voice agent / 陪聊 / Chat 用。Wing 也可以拿來做 RVC source。
>
> 寫於 2026-05-29(Wing CV3 訓練中)

---

## 1. 資料盤點

> **2026-05-29 更新:** 用戶把所有有 user 聲音的對話檔都移除,**現在 folder 只剩純阿宏單講**。
> Stage A diarization 不用做。

| 類別 | 檔案數 | 時長 | 內容 |
|---|---:|---:|---|
| 阿宏單人朗讀(文案演繹) | **112** | **7.48 hr** | 純單一 speaker,**無對話干擾** |
| **合計** | **112** | **7.48 hr** | 全部 48kHz / mono / 16-bit |

(原始有 259 files / 17 hr,含 146 對話檔。用戶已移除對話部分,只保留純阿宏。)

**腳本(Excel,5 個):**
- M43台湾话_文案演绎_新增0506.xlsx — 64 topics × 7-10 句 = 451 assistant utterances
- 台湾话_文案演绎(单句).xlsx — 美食 topic / 1064 segments(`topic_NNN_turn_NN_SpeakerN_NNN`)
- 台湾话_文案演绎_新增(单句).xlsx — 手帳 topic / 2037 segments
- 台湾话_长尾语料(单句).xlsx — 14 segments(數字/字母發音測試)
- 台灣在地口語引導對話清單.xlsx — 46 topics × 情緒分類(開心/憤怒/悲傷/驚訝...)

**重要限制:** 阿宏「**沒照稿唸**,自由發揮」→ Excel 文本是**主題參考**,不能當訓練 GT。必須 SV ASR 自己轉寫(像 Wing 一樣)。

---

## 2. 為什麼這比 Wing 簡單

| 比較 | Wing | 冠彥 |
|---|---|---|
| 錄音場域 | 用戶自錄 + 直播片段 | **數據堂錄音棚 prof studio** |
| 底噪 | 中(直播為主)| 極低 |
| 音檔長度 | 短(平均 7s) | 長(平均 4 min,需切片)|
| 文本 ground truth | 無,全靠 SV ASR | **無**(阿宏不照稿)→ 一樣靠 SV |
| 文本 audit 樣本數 | 281 / 8757 | 預計 200-500 / ~4000 |
| 對話干擾 | 無(全單講)| **78 個雙人陪聊要 diarize** |
| Excel topic 提示 | 沒有 | 有(可給 SV 當 prior)|

---

## 3. 處理 Pipeline (3 階段 + 訓練 + 部署)

```
~~STAGE A~~: 對話分離 ← SKIPPED(用戶已移除對話檔)
STAGE B: VAD 切片 + SV ASR (112 個純阿宏音檔)
  ↓
STAGE C: 拼湊 metadata + 你 review HTML
  ↓
STAGE D: CV3 fine-tune (Wing 跑完後接著)
  ↓
STAGE E: 部署 ahong voice
```

### ~~Stage A~~ — Skipped

用戶移除了所有 `_陪聊` / `_muted` 對話檔,folder 只剩 112 個純阿宏單講。
不需要 diarization。Stage A 腳本 `scripts/ahong/stage_a_diarize.py` 保留作備案。

### Stage B — VAD 切片 + SenseVoice ASR

**做什麼:** 把 112 個純阿宏 wav (7.48 hr) 切成 ~3-15 sec 的 sub-clips,SV ASR 取得文本。

**做法:**

1. 用 [funasr](https://github.com/modelscope/FunASR) SileroVAD(已裝在 Wing pod)切片
2. 每片導入 SenseVoiceSmall(已下載)
3. **加 topic context hint:** 每個 wav 檔名告訴 SV 主題(`文本_創業.wav` → `topic="創業"`),提升專有名詞識別率
4. 後處理:
   - opencc s2twp 統一繁體
   - HK terms 不需要(這個是國語,不是粵語)
   - 但有專屬 brand/term 修正:`HP` `Mac` `Windows` `Spotify` 等(同 Wing)
   - 數字標準化:阿宏會講「零九一二」這種 → 保留口語形式
   - 標點:SV 不會打標點 → 用 punct model 補(`pkuseg` 或簡單 rule)

**預期產出:** ~2500-3500 個 sub-segments,每段帶:
```json
{
  "id": "ahong_NNNNNN",
  "src_file": "文本_創業.wav",
  "topic": "創業",
  "start": 12.5, "end": 18.3, "dur": 5.8,
  "text": "我那時候真的覺得...",
  "spk_sim": 0.78  // 阿宏 confidence (from Stage A if dialog)
}
```

**估算:** SV ASR 7.48hr 音檔 @ A40 大概 **15-25 min**

### Stage C — Audit HTML

**做什麼:** 跟 Wing 一樣,讓你掃過去抓 SV 錯字。

**做法:** 
- 分 4-6 chunks (~1 MB each)
- 顯示 SV 文本 + audio 播放 + Excel reference(若 topic match)
- 「⬅️ 用稿」按鈕(若 sim ≥ 90% Excel 句),但默認 SV 為準(阿宏沒照稿)
- localStorage 累積 + 匯出 JSON

**估算:** ~2500-3500 segments → 看完約 **1-1.5 小時**(比 Wing 8757 短 60%)

### Stage D — CV3 Fine-tune

**做什麼:** 跑 LLM module fine-tune,跟 Wing 同 pipeline。

**Prep:**
1. extract_embedding(每 utt + 每 spk)
2. extract_speech_token(speech_tokenizer_v3.onnx)
3. make_parquet → train/dev split
4. 啟動 train.py(用 ahong tag 在 utt2spk)

**估算:** Wing 實測 ~7 min/epoch × 30 epoch = **~3.5 hr**;阿宏 ~3000 sample → **~2-3 hr**(同一台 A40,比 Wing 少 60%)

### Stage E — 部署

1. backup `llm/exp/cosyvoice3/llm/torch_ddp/*.pt` 到本機 SSD
2. update voices.yaml on omgpizzatnt pod 加入 `ahong` voice
3. 8 個 ref audio(每個 5-10s,選最自然的)放 `/workspace/CosyVoice/refs/ahong/`
4. 測試 4 個 prompt(short / long / 情緒中性 / 情緒激動)
5. update VOICE_AI_MASTER_GUIDE.md

---

## 4. 時間預估 (Wing 跑完後)

| Stage | 時間 | 何時做 |
|---|---:|---|
| ~~A. Diarize~~ | ~~30-60 min~~ | ❌ skip |
| B. VAD + SV ASR all | 15-25 min | Wing 跑完 (~3.5 hr 後) |
| C. Audit HTML build + 你 review | 1-1.5 hr | B 完 |
| D. CV3 fine-tune | 2-3 hr | C 完(你 review 不阻塞訓練)|
| E. 部署 + 測試 | 1 hr | D 完 |

**全程從 Wing 啟動到阿宏部署完 ~8-10 hr(原本估 2-3 天 → 縮短至 1 天)**

---

## 5. 風險 / 決策點

1. **Diarization 準確度** — 若 anchor 法 sim < 0.6,改用 pyannote/embedding(無 token)
2. **稿子 vs 阿宏自由發揮** — 你說過「以為他會照稿」,實際抽聽幾個就知道差異有多大。如果差太大可以選擇:
   - (A) 全 SV(我推薦)— 文本忠於發聲
   - (B) 對 SV 跟 Excel 做 fuzzy match,匹配高的用 Excel(更純淨)
   - (C) 混合:topic context 讓 SV 偏 Excel 用詞
3. **Topic context hint** 對 SV 提升效果尚未驗證,可能要 A/B 比較
4. **78 dialog 若 diarize 太爛** → 直接 throw away,只用 113 文案 + 34 muted = ~12 hr 資料(夠了)

---

## 6. 與 Wing / Eric 的差異化

- **Wing**(Cantonese)→ 廣告 / 粵語旁白 / 香港本土用戶
- **Eric**(Mandarin reading)→ 旁白 / 教育 / 正式文宣
- **阿宏**(Mandarin chat)→ **語音助手 / 陪聊 agent / 對話式 UX** ← 17hr 對話語料就是為這設計

3 voices 角色分工清楚,不重疊。
