# 實驗:用 zero-shot 新引擎打敗我們「機器人感」的訓練模型(Eric 普通話 + Wing 粵語)

- **日期**:2026-06-23
- **聲音 / 語言**:Eric(楊日漢)台灣腔普通話 + Wing 粵語
- **想驗證什麼(假設)**:
  > 我們訓練出來的 GPT-SoVITS 不夠自然,不是「訓練得不夠」,是**根本不該訓練**。
  > 一個夠強的 **zero-shot** 引擎(Qwen3-TTS / CosyVoice3),只用一段乾淨參考音,
  > **不訓練**就能比我們訓練的模型更自然,且即時、零邊際成本 → 接進 $39 即時 lane。
- **階層**:L0 克隆(見 [00_DIAGNOSIS](../00_DIAGNOSIS_clone-vs-train.md))。**先證明 L0 不夠,才考慮 L1 微調。**
- **商業動機**:treechildyt(`VO-260622T1ADNI001`)真實棄單 —— 客人要先付 $39 才聽得到自己的稿。
  zero-shot 即時 = 付款前免費試聽,治本。這支聲音 = Onyx Alpha = Eric。

---

## 0. 開跑前硬性檢查(Day-1 紀律,別跳)

- [ ] **RunPod 餘額** ≥ 預估時數 × 1.5 倍(教訓:燒到 $0.07 pod 自動停)。本實驗估 2–3 hr。
- [ ] GPU pod:A40 48GB(`u46xxo7nkayx80`,已有我們訓練的 GPT-SoVITS = arm C)或任一 ≥24GB(4090 足夠,兩個 base 都小)。
- [ ] **ref 檔先 ffprobe 抽檢**:必須 48k(或 24k)/ mono,**沒被偷偷降到 16k**。
      ```bash
      ffprobe -v error -show_entries stream=sample_rate,channels,bits_per_sample \
        -of default=nw=1 eric_ref.wav
      ```
- [ ] 測試稿先掃**多音字**(命中就標讀音/換詞):本實驗稿含 **重**組(chóng)、**參**觀(cān)、**轉**型(zhuǎn)、**論**壇(lùn)、**行**(háng/xíng)。先聽這幾個字有沒有念錯。

---

## 1. 固定變因(三個 arm 都用同一份)

### Reference 音檔(都在本機,別重錄)
| 用途 | 檔案(絕對路徑) | prompt_text(一字不漏對齊) | lang |
|---|---|---|---|
| Eric 普通話 ref | `/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/eric_ref.wav` | `我是楊日漢,我確認本段聲音由我本人於2026年3月18號親自錄製。` | zh |
| Wing 粵語 ref | `/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/wing_sovits_backup_20260529/wing_ads_0004.wav` | `無間斷收聽音樂,全無限制。` | yue |

> ⚠️ Eric 的 ref **一定用 `eric_ref.wav`(自然講話)**,不要用 `eric_ref_high.wav` / `FAAM0113.wav`(廣告腔訓練片段 → 大陸腔,踩過)。

### 測試稿(三 arm 念同一份)
**T1 — 普通話真實廣告(treechildyt 原稿,Eric):**
> 面對全球供應鏈重組與AI轉型浪潮,誠摯邀請各位業界先進踴躍蒞臨參觀「2026亞太智慧商業物流展」,並報名展會期間的專業論壇。

**T2 — 普通話通用測試集(Eric,測數字/英文/停頓):**
> 1. 新一代旗艦手機,即日起下訂現折三千元,數量有限。
> 2. 本產品通過 ISO 9001 認證,提供五年保固。
> 3. 您好,歡迎光臨,請問需要什麼協助嗎?

**T3 — 粵語(Wing):**
> 多謝你一直以嚟嘅支持,今集節目我哋會同大家分享三個慳錢嘅小貼士。

---

## 2. 三個 arm(操縱變因 = 引擎)

### Arm A — CosyVoice 3(zero-shot,我們已部署,當「新基準」)
```python
# CV3 pod;普通話用 inference_zero_shot,粵語用 inference_instruct2(請用广东话表达)
AutoModel(model_dir='Fun-CosyVoice3-0.5B')
inference_zero_shot(
    text_generator(sentences),                      # 逐句 sentence-split
    "You are a helpful assistant.<|endofprompt|>" + ref_transcript,
    ref_wav_path,
    stream=False,
    text_frontend=False,                            # ← 必設 False(忘了會飄日/越腔)
)
# 粵語:inference_instruct2(... "You are a helpful assistant. 请用广东话表达。<|endofprompt|>" ...)
```

### Arm B — Qwen3-TTS(zero-shot,**本次新主角**,Apache 2.0)
```bash
conda create -n qwen3-tts python=3.12 -y && conda activate qwen3-tts
pip install -U qwen-tts
pip install -U flash-attn --no-build-isolation        # 省 VRAM(<96GB RAM 多核:前面加 MAX_JOBS=4)
huggingface-cli download Qwen/Qwen3-TTS-12Hz-1.7B-Base --local-dir ./Qwen3-TTS-12Hz-1.7B-Base
```
```python
import torch, soundfile as sf
from qwen_tts import Qwen3TTSModel
model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    device_map="cuda:0", dtype=torch.bfloat16, attn_implementation="flash_attention_2")

# 同一個 ref 多句重用(效率)
prompt = model.create_voice_clone_prompt(ref_audio="eric_ref.wav",
    ref_text="我是楊日漢,我確認本段聲音由我本人於2026年3月18號親自錄製。")
wavs, sr = model.generate_voice_clone(
    text=[T1, *T2_list], language="Chinese", voice_clone_prompt=prompt)
for i,w in enumerate(wavs): sf.write(f"qwen_eric_{i}.wav", w, sr)
```
> ⚠️ **待 pod 上實測確認**(README 語言清單沒明列「粵語」,行銷頁說支援 9 方言含粵語):
> 粵語 arm 先試 `language="Auto"` 或 `"Chinese"` + Wing 粵語 ref,**聽輸出是不是粵語**。
> zero-shot 的腔調主要跟著 ref 走,但方言要靠模型本身會不會 → 這就是要測的點。
> `x_vector_only_mode=True` 可不給 ref_text(品質較低),先別用,要對照公平。

### Arm C — 我們訓練的 GPT-SoVITS(對照組 = 現況「機器人感」)
- Eric:`eric_gpt_e15.ckpt` + `eric_sovits_v2pro_final.pth`,ref `eric_ref.wav`(同上)。
- Wing:`wing-e8.ckpt` + `wing_e8_s480.pth`,ref `wing_ads_0004.wav`,prompt_lang=`yue`。
- 直接用既有 pod `u46xxo7nkayx80` 的 OpenAI 相容 API 念 T1/T2/T3。

> (選配 Arm D — Higgs Audio **v3**(`bosonai/higgs-audio-v3-tts-4b`,4B,Apache 2.0):自架要跑 `sgl-omni serve`,較重。**A/B/C 若分不出高下再上**,別一開始就裝四個。)

---

## 3. 評分(盲聽,別自己騙自己)

把 A/B/C 同一句的輸出**隨機改名**(arm1/arm2/arm3),Wing 盲聽打分:

| 句 | arm | 音色像(1–5) | 腔對不對(台/粵)(1–5) | 自然度(1–5) | 多音字念對? |
|---|---|---|---|---|---|
| T1 | | | | | 重/參/轉/論 |
| T2-1 | | | | | 數字「三千」|
| T3 | | | | | 粵語是否真粵 |

**決策規則(先寫死,免得事後找理由):**
- ✅ **B 或 A 的「自然度」≥ C 且 ≥ 4 分,腔對** → zero-shot 勝。**選分數最高那個接進 $39 lane**,Arm C(訓練模型)退役。
- ⚠️ zero-shot 音色像/自然但**長稿身份會飄**(句間音色不穩) → 才進 L1 few-shot 微調(GPT-SoVITS v2Pro 或 Qwen3 fine-tune),**不是從零訓**。
- ❌ 全部 < 4 → 死因寫進下方「絕不再踩」,別硬上線。

---

## 4. 結果(跑完填)

- **輸出檔**:`~/Desktop/2026-06-23_engine-shootout/`(pull 回本機)
- **盲聽分數**:(填表)
- **贏家**:______ → 接進平台哪條 lane:______

## 5. 結論(最重要,一定要填)

- ✅ 成功:對的引擎+設定是什麼?→ 寫進 `VOICE_AI_MASTER_GUIDE.md` 決策矩陣 + 標準 stack。
- ❌ 失敗:死在哪個具體操作點?→ 加進 MASTER_GUIDE「絕不再踩」清單。
- **下一步**:______
