---
name: reference-male-voice-recording-sow
description: Onyx Studios 男聲語料 1 小時錄音與交付計畫 SOW(2026-05-30 用戶定版)— GPT-SoVITS/RVC 通用聲線標準
metadata: 
  node_type: memory
  type: reference
  originSessionId: afe73d40-bcf7-4004-9a56-433e884b705e
---

# 男聲語料 1 小時錄音與交付計畫

> 用戶 2026-05-30 定版。適用於 GPT-SoVITS / RVC 路徑(不是 CV3)。
> 定位:廣告 + 旁白 + 簡介 通用聲線。

## 目標
- 產出可用於 GPT-SoVITS / RVC 的男聲基礎語料
- **淨語音 60 分鐘**(錄音時長抓 2.5-3 小時含重錄休息)
- 候選 ID 池:FAAM0001-FAAM0300

## 比例原則(首版)
- 廣告類 (ad): 45%
- 旁白類 (narration): 40%
- 簡介/說明類: 15%
- 情緒:neutral + warm ~75%,excited/confident ~25%
- 能量:energy 1-2 = 60%,energy 3 = 30%,energy 4 = 10%

## 句數估算
- 單句成品平均 6-9 秒
- 60 分鐘淨音 = ~380-520 可用句
- ⚠️ 100-200 句通常不夠 60 min;300 句約 35-50 min

## 錄音室執行標準
- 一句一檔(one sentence per file)
- 檔名 = id 完整對應(`FAAM0123.wav`)
- 格式:**WAV / mono / 48 kHz / 24-bit**
- 每句前後留白 0.3-0.5 秒
- 不可:爆音 / 削波 / 過度降噪 / 重混響
- 錯字 / 漏字 / 吞字 / 氣音過重 → 當場重錄

## 交付清單
```
maleA_wav/             全部語音檔
metadata.csv           訓練主索引: id,text,emotion,energy,speed,target_voice,file
qc_report.csv          (建議)瑕疵/重錄紀錄
README.txt             錄音日期 / 設備 / 環境 / 版本
```

## 驗收三關
1. **檔案一致性**:句子數 = 音檔數 = metadata 行數
2. **文字對齊**:抽查 10%,逐字一致率 ≥ 98%
3. **音質一致性**:背景噪訊穩定 + 音量一致 + 無爆音削波

## How to apply
- 收到男聲語料時,**先按驗收三關檢查**才開訓練
- 我之前在 [[reference-voice-onboarding-sop]] 寫的「Track A 5-8 hr」太貪心,**60 min 高品質就夠 GPT-SoVITS / RVC**
- 若要做 CV3 fine-tune(LLM 重新學 prosody)→ 60 min 不夠,要 5+ hr 才行
- 若客戶錄少於 60 min → 仍可訓但可能 overfit / tone 範圍窄

## 跟我舊 SOP 的差異
| 項 | 我舊 SOP | 用戶新 SOW |
|---|---|---|
| Track A 時長 | 5-8 hr 「最少」 | **60 min 淨音** ⭐ 實際 |
| 句數 | 2000-5000 | 380-520 |
| 重點 | 量大 | **品質一致** + 比例分配 |

→ **我之前 SOP 假設要做 CV3,所以要求大量。用戶實際要的是 GPT-SoVITS,60 min 高品質就夠。我的 SOP 該按引擎分,不是一刀切。**

Related: [[reference-voice-onboarding-sop]], [[reference-voice-deployments]]
