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

### Reference 音檔 — 語料庫驅動,ref 選擇也是變因(不要只用一個)
> **心法**:ref 決定輸出風格與腔。use-case 是「廣告」就該用廣告 ref(要那股廣告能量),不是平鋪直敘的聲明。
> 舊「廣告 ref → 大陸腔」是**我們弱訓練模型**過度依賴 ref 造成的;強 zero-shot base(Qwen3/CV3,百萬小時)能在台灣腔廣告 ref 下守住台灣腔 —— **這要實測,不能假設**。所以 Eric 兩個 ref 都跑、比較。

| 用途 | 檔案 | 格式 | prompt_text / 逐字稿來源 |
|---|---|---|---|
| **Eric ref-A(專業口播,對應 treechildyt 正式邀請稿)** | `…/onyx-platform/eric_train_data/FAAM0114.wav` | 48k/mono/16bit/~8s | `高效防曬噴霧買一送一。提供全方位防護,讓您在烈日下依然自信從容。`(emotion=**confident**, speed=medium) |
| **Eric ref-B(自然講話,對照)** | `…/onyx-platform/eric_ref.wav` | 48k/mono/24bit/8.7s | `我是楊日漢,我確認本段聲音由我本人於2026年3月18號親自錄製。` |

> 📋 **Eric ref 從 CSV 挑的**:`…/訓練資料/eric/TTS 1小時 Eric音檔/eric_training_dataset.csv`(417 句,含 emotion/speed 標)。treechildyt 是正式 B2B 邀請 → 選 **confident/medium**(非 FAAM0113 的 excited/fast)。warm 版備案 FAAM0117。原始長錄音在同夾 `原檔/`(FAAM001-128.wav 等,48k/24bit),要別的語氣可再切。
| **Wing 粵語 ref(升級版)** | `…/訓練資料/Wing/Wing/1.zh-hk_audio_08-lc-education_mobile-desk.wav` | **48k/mono/24bit/11.8s** ✅ | 逐字稿在 `…/訓練資料/Wing/wing_edits_chunks_2026-05-29-18-32.json`(跑前撈出對齊文字) |
| **阿宏 / Bravo 普通話 ref** | `~/Desktop/voice-shootout-refs/Ahong_阿宏_候選A_水果_10.5s.wav`(原檔 `…/數據堂 冠彥 TTS 5小時/交檔/0513/文本_水果.wav` 的 7.0–17.5s,silencedetect 切的乾淨整句) | **48k/mono/24bit/10.5s** ✅ | 逐字稿待補(whisper/聽打);另有候選B |

> 🆕 **阿宏(Onyx Bravo)訓練模型已遺失**,但有 5hr 原始自然人聲 → 純走 zero-shot,**正好示範「沒有訓練模型也能做」**。他自然音高約 154Hz(舊 A/B 結論)。

> ✅ **Wing ref 已換掉 3.4s 廣告切片** → 改用 `Wing/Wing/` 的 `zh-hk_audio` 系列(48k/24bit、11.8–23s、分好類:upsell/proposition/education)。
> education 那段語氣較自然(非硬銷),11.8s 正好。若要更有廣告能量可改 upsell 系列。**pod 上帶 3 個 ref + 對應逐字稿。**
> Eric 418 檔(`eric_train_data/`,48k/16bit/~8s,全廣告稿、`eric_filelist.txt` 有逐字稿)= 現成 ref 庫,要哪種語氣就挑哪句。

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

## 4. 結果

### Round 0 — Qwen3-TTS 免費官方 demo(HF Space `Qwen/Qwen3-TTS`,gradio_client / 網頁,2026-06-23)
> 用免費 demo 先驗第一關,沒花 pod 的錢。(注:官方 ZeroGPU API 需 HF token;最後用 Chrome 擴充驅動網頁 UI / Wing 手動貼。)

- **Eric / Alpha,ref=FAAM0114(confident),target=treechildyt 正式廣告稿**
- **Wing 評價:自然度成立 ✅**(沒有訓練模型的「機器人感」)——**策略方向確定:走 zero-shot,訓練模型那條退役。**
- **唯一問題 = G2P 對冷僻書面字讀錯**(非聲調沒抓好,是直接讀錯字):
  - **蒞**(蒞臨,lì)讀錯、**摯**(誠摯,zhì)讀錯、**重**(重組,chóng)讀錯。
  - 根因:正式公文體(誠摯/蒞臨/踴躍)書面字多 → Qwen3 G2P 踩雷。
- **致命限制:Qwen3 沒有拼音/音素強制覆寫**(只靠語意上下文猜)→ 自助平台改不了客人的字 = **沒法保證讀對**。
- **CosyVoice 有 pinyin/phoneme inpainting**(可強制發音)→ 對「任意客稿都要讀對」這需求,**CV3 在可控性上贏 Qwen3**。

### 結論(Round 0)→ 修正後續方向
1. **自然度問題已解**(zero-shot ✅),剩「發音可控性」才是上線關鍵。
2. **下一步重點不是比誰更自然,是驗 CV3 pinyin override 能不能把 蒞/摯/重 鎖對** + 建**自動注音校正層**(查表注拼音→CV3),客稿全自動修。
3. 字典 = 擴充現有多音字清單,加**書面字**(蒞、摯、踴、躍、蒞…)。
4. Qwen3 仍是「最自然」備案,適合**口語/casual**稿;**正式書面稿走 CV3+注音**。可做雙引擎分流。

### Round 0b — 🎯 突破:繁體稿 → OpenCC 轉簡體餵 Qwen3,讀錯全消(2026-06-23)
- 根因確認:Qwen3(阿里,吃簡體)對**繁體冷僻變體** G2P 讀錯 —— 蒞(簡 莅)、摯(簡 挚)。**重 是同字多音**(chóng/zhòng),非繁簡問題。
- **測試**:同稿轉簡體(`诚挚/莅临/参观/转型/重组…`)貼回 Qwen3 → **Wing 評:全對,聲音完全沒問題。** 連 重组 也對了(簡體上下文 G2P 對)。
- **結論(改寫生產 stack)**:
  > **客稿(繁/簡)→ OpenCC 繁→簡 → Qwen3-TTS zero-shot(台灣 ref)→ 配音**
  > = 最自然(Qwen3)+ 讀對(簡體 G2P)+ 台灣腔(ref 帶,與字形無關)+ 零訓練 + 即時。
- **CV3 + pinyin override 降為備胎**(只補簡體也救不了的真多音字);**不需要先建大本注音字典**。OpenCC 我們平台已裝。
- ⚠️ 待辦/盯:① OpenCC 繁→簡**一對多**字(乾→干/乾、著→着/著…)可能轉錯 → 跑前抽查 + 用我們多音字清單擋;② 多測幾種稿(數字/英文/口語)確認穩。

### Round 0c — 粵語:Qwen3 不支援(2026-06-23)
- demo 語言下拉**無粵語**(只 Auto/Chinese/英日韓法德西葡俄);選 Auto 餵粵語字(唔該晒/我哋/嘅/慳錢)→ **Wing:整段用國語讀掉**,非粵語。
- **Qwen3 無粵語**(Auto 餵粵語字→整段國語讀掉)。

### Round 0d — CV3 粵語(口語稿,Wing ref,2026-06-23)
- **Wing 評**:**聲音是 Wing 沒錯(克隆 ✓)**,但**有些粵語字念錯 + 有些聲調不對 → 整體不像粵語。**
- **規律**:zero-shot 國語強、**粵語(低資源,九聲+口語字 嘅哋嚟睇)G2P/聲調會錯**。Qwen3 更慘(完全不會)。**這正是「訓練模型」贏的場合。**
- **🔑 定案(引擎分流,修正前面)**:
  | 語言 | 解法 | 為什麼 |
  |---|---|---|
  | **國語**(Eric/阿宏)| **Qwen3 zero-shot + OpenCC + 台灣 ref** ✅ | 大模型國語 G2P 強,零訓練最自然 |
  | **粵語**(Wing)| **`wing-e8` 訓練模型**(從真實粵語錄音學的,發音/聲調準) | zero-shot 粵語會念錯;訓練模型從資料學到正確粵音 |
- 粵語備選:CV3 餵**書面語稿**(少口語字)或 CV3 jyutping 強制發音 —— 都不如已會粵語的 wing-e8 穩。
- **粵語兩路都要 pod**(GPT-SoVITS 推論)→ 進 pod 階段;**國語線可先進生產**。
- ⚠️ 教訓:**zero-shot ≠ 萬靈丹**。高資源語(國語)走 zero-shot;低資源(粵語/方言)反而要 few-shot/訓練模型。

- **輸出檔**:`~/Desktop/voice-shootout-refs/qwen3_demo/`(Eric 版)
- **贏家**:______ → 接進平台哪條 lane:______

## 5. 結論(最重要,一定要填)

- ✅ 成功:對的引擎+設定是什麼?→ 寫進 `VOICE_AI_MASTER_GUIDE.md` 決策矩陣 + 標準 stack。
- ❌ 失敗:死在哪個具體操作點?→ 加進 MASTER_GUIDE「絕不再踩」清單。
- **下一步**:______
