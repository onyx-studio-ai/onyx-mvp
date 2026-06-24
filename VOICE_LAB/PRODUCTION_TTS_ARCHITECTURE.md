# Onyx 生產 TTS 架構(定案 2026-06-23)

> 配套:[VOICE_AI_MASTER_GUIDE.md](../VOICE_AI_MASTER_GUIDE.md) · [shootout 實驗](experiments/2026-06-23_eric-wing_zeroshot-engine-shootout.md)
> 核心鐵則:**服務客人「絕不」開常駐 pod。全部 pay-per-use / serverless,零空轉,穩定外包給有 SLA 的服務。**

## 為什麼不自架常駐 pod(命門)
- 常駐 A40 ≈ $330/月,沒人用照燒;流量不可預測 → 大量空轉。
- 半夜壞了沒人救(3am 問題)→ 不穩 → 客戶流失。「便宜但不穩」= 沒用。
- 穩定才累積客戶黏著度 → 穩定外包給 fal / RunPod Serverless。

---

## 兩層產品模型

| 層 | 語言 | 流程 | 速度/價 | 狀態 |
|---|---|---|---|---|
| **Tier 1 即時自助** | 12 種高價值 | 引擎自動生成,**付款前試聽**(截斷+3風格)→ 付 $39 → 完整 | 即時 | **新建(這次做)** |
| **Tier 2 AI + 真人監督** | 其餘 17 種 + 12 種可加購 | AI 生成 → 真人 QC → 錯處補錄 RVC 接回 | 數小時/天、價較高 | **formalize Wing 現有流程** |

---

## Tier 1:即時自助(12 種,按語言分引擎)

| 語言 | 引擎 | 托管 |
|---|---|---|
| 台灣國語 zh-TW(+中英混) | **BreezyVoice**(MediaTek,Apache 2.0,注音控發音/破音字) | 自架 RunPod Serverless |
| 普通話 zh-CN | Qwen3-TTS | **fal.ai**(managed) |
| 英 en·日 ja·韓 ko·西 es·葡 pt·法 fr·德 de·義 it·俄 ru | Qwen3-TTS | **fal.ai** |
| 粵語 yue | **wing-e8** GPT-SoVITS(學過真實粵語) | 自架 RunPod Serverless |

- 國語前處理:**OpenCC 繁→簡**修 G2P(Qwen3);BreezyVoice 用注音控,台灣讀音才對。
- 長稿:**分句生成再串接**(單次太長會裂,已驗證分句可解)。
- **教訓**:高資源語(國語/歐語)走 zero-shot;低資源(粵語)走訓練模型;台灣國語走專用 BreezyVoice。Qwen3 沒發音覆寫→大陸腔修不了,故台國不用 Qwen3。

## Tier 2:AI + 真人監督(17 種 + 加購)

Wing 現有實戰流程,formalize 成產品:
1. **基底來源**:① AI 生成(ElevenLabs,32 語,首選最省)或 ② 找**便宜配音員只錄音**(不買聲音授權 —— RVC 會換掉音色、身份消失,故不需授權;但簽一張簡單「錄音使用/work-for-hire」紙)。
2. **換音色**:RVC / ElevenLabs voice changer → Onyx talent 音色。**或更省**:把 Eric/阿宏/Wing 複製進 ElevenLabs(已有授權)→ 其多語 TTS 直接用我們 talent 聲音講該語言,免單獨 RVC。
3. **真人 QC = 核心價值**:校對 → 錯處**只補錄該短語 → 換音色 → 接回**(不整段重錄,效率高)。
- ⚠️ 跨語言 RVC 會怪(talent 沒發過的音)→ 真人 QC 擋;過不了就退用原生 TTS 聲音。
- ⚠️ QC 要有「該語言的人」:泰/印尼/印度你有 ✅;北歐/阿拉伯/坦米爾/孟加拉無 → 先標「洽詢」按需求接。
- ⚠️ 基底 TTS 要可商用(Azure/Google 付費版可;免費 Edge TTS 商用灰色,別用)。ElevenLabs 付費版商用可。
- **Tier 1 不用 ElevenLabs**(貴 + 不會台灣腔/粵語);ElevenLabs 是 Tier 2 主場。

---

## 語言涵蓋(平台現掛 29 種 → AI 即時實際 12 種)

- **✅ Tier 1 即時(12)**:en, zh-CN, **zh-TW**, **yue**, ja, ko, es, pt, fr, de, it, ru
- **➡️ Tier 2 真人監督(17)**:th, vi, id, ms, tl, hi, ta, bn, ar, fa, nl, pl, tr, sv, no, da, fi
- 待辦(前端):AI 下拉只留 12 種;其餘標「真人配音 · 洽詢報價」導去聯絡(誠實原則,同當初拿掉假聲音)。Wing 決:17 種用 **(B) 保留標真人/報價**(非直接移除)。

---

## fal.ai Qwen3-TTS 串接(已查 API)
1. 一次/配音員:`fal-ai/qwen-3-tts/clone-voice`(ref 音檔+ref 稿)→ speaker embedding(safetensors)→ 存 talents 表。
2. 每案:`fal-ai/qwen-3-tts/text-to-speech/1.7b`,帶 `speaker_voice_embedding_file_url`+`reference_text`+`text`(OpenCC 簡體)→ mp3 url。認證 `FAL_KEY`。
- 待辦:Wing 開 **fal.ai 帳號 + FAL_KEY**(品質已驗,fal 測只確認串接+計費)。

## 單位成本(算清楚)
1 分鐘中文 ≈ 250 字 → 一次生成 ≈ **$0.022**。一個付費客 COGS ~$0.05 → **毛利 ~99.8%**。$39 撐 ~1,700–2,000 次。白嫖走人 ~$0.03 可忽略。50 案/月:fal ≈ $8(常駐 pod 要 $330)。

## 試聽 / 轉換設計
- 先聽再付;**試聽截斷前一兩句**(防白嫖 + 防免費拿完整稿);每輪 **3 風格**(活潑/平穩/商業);限 2–3 輪。

---

## 🔬 待跑:開 pod 驗 Tier 1 自架引擎(BreezyVoice + wing-e8)

> 一次驗完台國 + 粵語(Tier 1 最關鍵、唯二自架的)。**動前查 RunPod 餘額**(目前 ~$4.43,偏低,建議先儲值)。

1. 開一台 GPU pod(A40/4090)。
2. **BreezyVoice**:`git clone mtkresearch/BreezyVoice` + 下載模型 → `single_inference.py`,Eric ref + 測:
   - treechildyt 稿(蒞/摯/重)+ 含台/陸異讀字(和 hàn、企 qì、法 fǎ…)→ **聽台灣讀音對不對**;
   - 試**手動注音**修一個破音字;長稿分句。
3. **wing-e8**:載進 GPT-SoVITS → 跑粵語口語稿(嘅哋嚟睇)→ **聽粵語發音/聲調對不對**(CV3 在這失敗)。
4. 輸出拉回 `~/Desktop/` 盲聽。過了 → Tier 1 引擎全部底定 → 進串接平台。

## Build 待辦(只 Tier 1 是新工)
- [ ] Wing 開 fal 帳號 + FAL_KEY
- [ ] pod 驗 BreezyVoice + wing-e8(↑)
- [ ] BreezyVoice + wing-e8 部署 RunPod Serverless(scale-to-zero)
- [ ] 後端:OpenCC → 引擎路由(按語言)→ 生成;試聽截斷+3風格+限次
- [ ] 前端:AI 下拉留 12 種;17 種標「真人/報價」
- [ ] 多音字/書面字清單擴充(蒞/摯/踴…)擋 OpenCC 誤轉
- [ ] Tier 2:把 ElevenLabs+QC 流程做成「下單→製作→QC→交付」工單
