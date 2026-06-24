# Onyx 生產 TTS 架構(定案 2026-06-23)

> 配套:[VOICE_AI_MASTER_GUIDE.md](../VOICE_AI_MASTER_GUIDE.md) · [shootout 實驗](experiments/2026-06-23_eric-wing_zeroshot-engine-shootout.md)
> 一句話:**服務客人「絕不」開常駐 pod。全部 pay-per-use / serverless,零空轉、別人扛穩定。**

## 為什麼不自架常駐 pod(Wing 的命門洞察)

- 常駐 A40 ≈ **$330/月**,沒人用也照燒;流量不可預測 → 大量空轉。
- 半夜壞了沒人救(3am 問題)→ 不穩 → 客戶流失。**「便宜但不穩」= 沒用。**
- 穩定才能累積客戶黏著度 → 要把穩定外包給有 SLA 的 managed 服務。

## 架構

```
平台後端(Vercel,已穩)
   ├─ 國語 + 8 國語言 → fal.ai Qwen3-TTS API(managed,pay-per-use)
   │      前處理:OpenCC 繁→簡(修 G2P 發音)+ 多音字清單擋一對多
   └─ 粵語(Wing)→ wing-e8 GPT-SoVITS @ RunPod Serverless(scale-to-zero)
```

- **國語/多語言 = fal.ai**:`$0.09 / 1000 字`(Qwen3-TTS 1.7B)。9 語言:中/英/日/韓/法/德/西/葡/俄。zero-shot,台灣腔靠 ref 帶。
- **粵語 = 自架 serverless**:Qwen3/fal 不做粵語;CV3 zero-shot 粵語念錯(九聲+口語字)。用 **wing-e8**(學過真實粵語,發音準),部署成 **RunPod Serverless**(scale-to-zero,沒人用 $0,用了才秒計費)—— 一樣不常駐、不用半夜顧。
- **教訓**:高資源語(國語)走 zero-shot;低資源(粵語)走訓練模型。

## fal.ai Qwen3-TTS 串接流程(已查 API)

1. **一次性(每個配音員)**:呼叫 `fal-ai/qwen-3-tts/clone-voice`(帶該配音員 ref 音檔 + ref 逐字稿)→ 得到 **speaker embedding(safetensors)** → 存 URL 到 talents 表。
   - Eric ref=`eric_ref.wav`(台灣腔自然)/ FAAM0114(廣告腔)等,挑一個當預設。
2. **每個案子**:`fal-ai/qwen-3-tts/text-to-speech/1.7b`,帶 `speaker_voice_embedding_file_url` + `reference_text` + `text`(= 客稿先過 OpenCC 繁→簡)→ 回 **mp3 url**。
3. 認證:`FAL_KEY` 環境變數。輸出:mp3(url/duration/sample_rate)。

## 單位成本(算清楚)

1 分鐘中文 ≈ 250 字 → 一次生成 ≈ **$0.022**。

| 項目 | 成本 |
|---|---|
| 一個付費客人(試聽 2 輪×3 風格截斷 + 完整成品) | ~**$0.05** |
| 只試聽走人(白嫖) | ~**$0.03** |
| **$39 收入毛利** | **~99.8%** |
| $39 算力可撐 | ~1,700–2,000 次 1 分鐘生成 |

- 50 案/月 + 200 試聽:fal ≈ **$8/月**(常駐 pod 要 $330)。算力**不是瓶頸**。
- 白做工可忽略(要 1,000 個只看不買才燒掉一個 $39)。

## 試聽 / 轉換設計

- **先聽再付**:設定稿→生試聽→滿意付 $39→出完整。
- **試聽截斷**:只生「前一兩句」→ 同時防白嫖 + 防靠試聽白拿完整稿。
- **3 風格**:每輪給 活潑 / 平穩 / 商業(Qwen3 `voice_description` / instruct 控制)讓客人選。
- **限次**:試聽限 2–3 輪(防濫用,非為成本——成本可忽略)。

## 待辦(上線)

- [ ] Wing 開 **fal.ai 帳號 + 拿 FAL_KEY**(一次性;pay-per-use,測試一次 ~$0.02)。品質已驗(同模型 HF demo 過),fal 測只為確認 API 串接 + 計費。
- [ ] 後端串接:OpenCC → fal clone(一次/配音員)→ fal TTS(每案)。OpenCC 平台已裝。
- [ ] 多音字/一對多清單:擴充書面字(蒞/摯/踴…)擋 OpenCC 誤轉。
- [ ] 試聽截斷 + 3 風格 + 限次 的前端/後端。
- [ ] 粵語:wing-e8 部署 RunPod Serverless(較後)。
- [ ] 隱私註記:稿送 fal(美國)運算;一般廣告稿可接受,保密客走粵語自架那條。
