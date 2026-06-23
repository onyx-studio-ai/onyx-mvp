# Voice AI 神人手冊 — 2026 年版

> Onyx Studios 自用 — 寫給我自己,不再踩坑。
> 涵蓋:**TTS 模型 / Voice Cloning / Voice Conversion(RVC)/ 多語言 / 中文方言 / Onyx 三 pod 架構 / 商用授權**。

## 📆 版本與更新規則

| 項目 | 值 |
|---|---|
| **本版** | v1.1 |
| **Last Updated** | 2026-06-23 |
| **Next Mandatory Review** | **2026-08-23**(3 個月) |
| **Maintainer** | Wing + Claude(Onyx Studios) |

### 🔄 為什麼要每季更新
- Voice AI 是 2024-2026 最快變化的 AI 領域之一
- 大廠每 2-3 個月會出新版(CV3 2025/12 / GPT-SoVITS v4 2025 / Higgs v2 2025)
- 學術圈每月都有 paper(F5-TTS 衍生、新 vocoder、新 sampler)
- 老設定 / 老踩坑可能因為新版本不再有效,新坑會冒出來

### ✅ 每季 Review Checklist(每 3 個月跑一次)
- [ ] **FunAudioLLM/CosyVoice** GitHub 看是否有 CV4 或新版
- [ ] **RVC-Boss/GPT-SoVITS** 看是否有 v5 或粵語/方言加強
- [ ] **fishaudio/fish-speech** 看是否改授權成可商用
- [ ] **boson-ai/higgs-audio** 看是否出 v3 / 新方言
- [ ] **Resemble AI Chatterbox** 看是否加 Cantonese
- [ ] **Hugging Face TTS Trending** 看當月排名前 5
- [ ] **TTS Arena leaderboard**(https://huggingface.co/spaces/TTS-AGI/TTS-Arena) 看排名變化
- [ ] **新興:Voxtral / VibeVoice / Step-Audio / Qwen3-TTS** 看是否上市
- [ ] **ElevenLabs / Cartesia / Hume** 商業競品有新功能嗎
- [ ] **PyTorch / transformers 版本** 跟 CV3/GPT-SoVITS 是否相容(新版可能破壞 attention)
- [ ] **重跑「絕不再踩」清單** 確認每條還對

### 📌 平日什麼時候要更新(隨時加,不用等季)
- ✅ 踩到**新的坑** → 立刻加進「絕不再踩」清單
- ✅ 學到**新引擎** → 加進「梯隊」表
- ✅ 發現某引擎**改版** → 標註版本變化
- ✅ 某模型**換授權** → 更新商用矩陣
- ✅ 客戶要新功能(例:歌聲合成、即時轉換)→ 加新場景到決策矩陣
- ✅ 跑通**新 setup** → 加到「最佳 stack」

### 🔔 提醒機制
- 每次開新對話,Claude 看到本文件就會檢查 "Next Mandatory Review" 日期
- 過了 review 日期還沒更新 → Claude 會主動提醒做 quarterly review
- Wing 或 Claude 任一方學到新東西 → 直接更新並 git commit,**不要等下次 review**

### 📊 版本歷史
| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-23 | 初版,涵蓋當天踩過所有坑 + 2026 業界全梯隊整理 |
| v1.1 | 2026-06-23 | 新增 **Qwen3-TTS**(第一梯隊,Apache 2.0,3秒克隆,中文 WER 業界最低)+ **Fish Audio S2**(帳面強但 Research License 非商用,跳過)+ Higgs 升 **v3**;授權矩陣同步。配套實驗:`VOICE_LAB/experiments/2026-06-23_eric-wing_zeroshot-engine-shootout.md`(zero-shot 打敗訓練模型) |

---

## 🌐 我們現在的三 Pod 架構(Onyx Studios)

| Pod | 用途 | 引擎 | 狀態 | URL |
|---|---|---|---|---|
| `u46xxo7nkayx80` (eric-wing-sovits) | TTS + RVC + 訓練 | **GPT-SoVITS v2Pro + RVC** (omgpizzatnt voice-ai-platform) | 2026-05-29 上線 | `https://u46xxo7nkayx80-80.proxy.runpod.net` (Bearer `onyx-eric-key-2024`) |
| `7k8u5nzkzs9xpa` (gothic_plum_flea) | TTS - CV3 | **Fun-CosyVoice3-0.5B** + ttsfrd + Eric/Wing refs | Stopped(EU-RO-1 4090 缺貨 stuck)| `7k8u5nzkzs9xpa-8888.proxy.runpod.net` |
| ~~`a52pzfcunv6ov8` (injured_aquamarine_smelt)~~ | ~~TTS+RVC~~ | ~~GPT-SoVITS + RVC~~ | **❌ 2026-05-28 已消失** | 重建為 `u46xxo7nkayx80` |
| ~~`kwvwlvmso06q0z` (live_aquamarine_partridge)~~ | ~~訓練專用~~ | ~~GPT-SoVITS training~~ | **❌ 2026-05-28 已消失** | — |

**GPT-SoVITS pod 機器規格:**
- A40 48 GB VRAM, EU-SE-1, $0.455/hr
- network volume: `0xx2d4ptz2` (implicit_tan_marsupial, 50GB) 掛在 `/workspace`
- 全 voices 的 ckpt/pth/refs 都在 `/workspace/data/models/custom_voices/gptsovits/{voice_id}/`
- voices 設定:`/workspace/data/configs/voices.yaml`(gateway auto-reload 每 5s)
- api keys:`/workspace/data/configs/api_keys.yaml`(SHA256 hash 前 16 字)
- supervisord 不自動跑,要手動 `supervisord -c /app/supervisord.conf` 或 `/app/deploy.sh`

**戰略分工:**
- CV3 Pod = **多語言 + 多方言 + 情緒控制**(粵語 / 普通話 / 英文 / 日文 / 韓文 / 18+ 方言)
- GPT-SoVITS Pod = **聲音轉換(RVC)+ 高度針對性 voice cloning**(任何聲音 → Eric/Wing)

---

## 🗄️ 訓練資產永久位置(別再搞丟!)

> 2026-05-28 教訓:RunPod pod 被砍 Eric GPT-SoVITS server 連帶消失。所幸權重 backup 在本機。**以後新訓練完一定要 rsync 一份到本機這個位置。**

### Eric — 楊日漢 (GPT-SoVITS v2Pro,2026-04 訓的,台灣男聲)
位置:**`/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/`**

| 檔案 | 用途 | 大小 | 內容 / 對應 prompt_text |
|---|---|---|---|
| `eric_gpt_e15.ckpt` | GPT 模組 epoch 15 | 148 MB | — |
| `eric_sovits_e100_s5400.pth` | SoVITS 模組 epoch 100 step 5400(早期 checkpoint) | 81 MB | — |
| `eric_sovits_v2pro_final.pth` | **SoVITS v2Pro 最終權重 → production 用這個** | 908 MB | — |
| `eric_ref.wav` ⭐ | **production ref(楊日漢授權聲明)** | 1.3 MB | `我是楊日漢，我確認本段聲音由我本人於2026年3月18號親自錄製。` |
| `eric_ref_high.wav` | 廣告稿乾淨版(FAAM0113 的處理版) | 1.2 MB | `年度最大電玩展強勢登場。主機與遊戲片整套購買，立即為您省下兩千元。` |
| `eric_train_data/` (419 wav + `eric_filelist.txt`) | 原始訓練資料 | 424 MB | — |

> **⚠️ 2026-05-30 踩坑:** voice-ai-platform `voices.yaml` 一開始用 `FAAM0113.wav` (raw 訓練廣告片段) 當 ref → **大陸腔**。
> GPT 才訓 15 epoch,prosody 高度依賴 ref,**ref 用了廣告腔的訓練資料 = 結果就是廣告腔/大陸腔**。
> 解法:換成 `eric_ref.wav`(楊日漢的授權聲明,自然講話節奏)→ 台灣腔回來。
> Production config 永遠用 `eric_ref.wav` + 對應 prompt_text(見上表)。

### Wing(GPT-SoVITS v2Pro,2026-05-29 訓的,粵語)
位置:**`/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/wing_sovits_backup_20260529/`**

訓練資料來源:`/Volumes/WingAI SSD/Claude/Projects/工程部/訓練資料/Wing/transcripts/wing_ads_sliced/`(324 切片,34.2 分鐘 zh-hk Spotify 廣告)
訓練 pod:`u46xxo7nkayx80` (A40 48GB, EU-SE-1) — 同台跑 Eric

| 檔案 | 用途 | 大小 |
|---|---|---|
| `wing-e1.ckpt` ~ `wing-e8.ckpt` | GPT 模組 8 個 epoch(每個 148 MB) | 1.2 GB |
| `wing_e1_s60.pth` ~ `wing_e8_s480.pth` | SoVITS 模組 8 個 epoch(每個 135 MB) | 1.1 GB |
| `wing_ads_0004.wav` | inference ref audio(~4.7s)| 300 KB |

**production 用 epoch 8**(`wing-e8.ckpt` + `wing_e8_s480.pth`),ref `wing_ads_0004.wav`,prompt_text="無間斷收聽音樂,全無限制。",prompt_lang=`yue`(粵語).

> 📍 **2026-06-23 更正**:`wing_ads_0004.wav` **不在** backup 資料夾,實際在
> `/Volumes/WingAI SSD/Claude/Projects/工程部/訓練資料/Wing/transcripts/wing_ads_sliced/wing_ads_0004.wav`
> (實測 44.1k/mono/16bit/**3.4s**,不是 ~4.7s;偏短,同夾 324 切片可挑 8-12s 更好的)。weights 才在 backup 夾。

⚠️ 已驗證 TTS 跑得起來,粵語腔。後續可以比較 epoch 4/6/8 哪個最好聽。

### Nova(身份待確認)
位置:`/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/nova_train_data/` + `nova_preprocess_final/`

### CV3 Eric / Wing(現役 production)
位置:RunPod pod `7k8u5nzkzs9xpa` 的 `/workspace/CosyVoice/refs/`(reference audio,zero-shot 用)
**沒備份到本機過。每次 pod 重開後檢查 refs/ 是否還在。**

### ⚠️ 訓練資產 rsync SOP(每次新訓練完馬上做)
```bash
# 從 RunPod 拉到本機
rsync -avhP -e "ssh -p <PORT>" \
  root@<POD>-ssh.runpod.io:/workspace/GPT-SoVITS/{GPT_weights,SoVITS_weights}/ \
  "/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/<speaker>_backup_$(date +%Y%m%d)/"
```
- 訓練 Pod = 只在訓練時開,訓練完關

---

## 🎯 主流引擎 2026 全面對比

### 🏆 第一梯隊(可上線等級)

#### 1. **Fun-CosyVoice 3.0** (Alibaba FunAudioLLM)— 我們在用
- **權重**: `Fun-CosyVoice3-0.5B-2512` + RL fine-tuned 版
- **CER**: 中文 0.81(業界最低)
- **語言**: 中文、英文、日文、韓文、德文、西班牙文、法文、義大利文、俄文
- **方言**: 18+ 中文方言(**粵語、四川話、閩南話、上海話、東北話、河南話、湖北話**...)
- **特色**: pronunciation inpainting(可拼音強制)、breath/laughter 標籤、instruction control
- **授權**: Apache 2.0(免費商用)
- **訓練資料**: 1M+ 小時
- **官方**: https://github.com/FunAudioLLM/CosyVoice

#### 2. **GPT-SoVITS v4 / v2Pro / v2ProPlus**(RVC-Boss)— Pod 上的
- **特色**: **1 分鐘音檔即可 fine-tune 出好 TTS model**(few-shot)
- **語言**: 中、英、日、韓、**粵語**(v2 起支援)
- **版本選擇**:
  - **v4**: 48kHz 原生輸出,音質最好,但慢
  - **v2Pro/v2ProPlus**: **v4 等級品質 + v2 速度**(2026 推薦)
  - v3: 24kHz 輸出有金屬感,v4 已修
- **架構**: GPT 模組(語音 token)+ SoVITS 模組(聲學)+ HiFi-GAN vocoder
- **授權**: MIT(免費商用)
- **官方**: https://github.com/RVC-Boss/GPT-SoVITS

#### 3. **Chatterbox / Chatterbox-Turbo**(Resemble AI)— 黑馬
- **盲測**: **65.3% 聽眾偏好 Chatterbox-Turbo > ElevenLabs**(24.5%)
- **授權**: **MIT,可商用,無 royalty**
- **語言**: 英文主力,中文/法文/西班牙文 beta
- **粵語**: ❌ 沒有
- **官方**: https://github.com/resemble-ai/chatterbox

#### 4. **Higgs Audio v3**(Boson AI)— 新銳(2026 升 v3,原 v2 已過)
- **特色**: **10M+ 小時訓練**,zero-shot 表現極強;v3 = `bosonai/higgs-audio-v3-tts-4b`(4B)
- **語言**: 100+ 語言;v2 原生四川話/粵語(v3 方言待 pod 上實測確認)
- **授權**: **Apache 2.0 ✅**
- **缺點**: 自架要跑 `sgl-omni serve`(SGLang),比 pip 安裝重;或直接用 Boson API
- **官方**: https://github.com/boson-ai/higgs-audio

#### 5. 🆕 **Qwen3-TTS**(阿里 QwenLM,2026 新)— **中文新首選**
- **盲測/客觀**: 中文 WER **業界最低**(贏 Higgs v2 / VibeVoice / VoxCPM),speaker sim 0.789,**贏 ElevenLabs + MiniMax**
- **克隆**: **3 秒參考音** zero-shot;另有「文字描述生新聲音」Voice Design + 9 內建聲
- **語言/方言**: 10+ 語言;官稱 **9 種中文方言含粵語**(README 語言清單未明列粵語 → **pod 上實測**)
- **授權**: **Apache 2.0 ✅**(無 royalty)
- **安裝**: `pip install -U qwen-tts`;模型 `Qwen/Qwen3-TTS-12Hz-1.7B-Base`(另有 0.6B)
- **API**: `Qwen3TTSModel.generate_voice_clone(text, language, ref_audio, ref_text)`
- **官方**: https://github.com/QwenLM/Qwen3-TTS

### 🥈 第二梯隊(可用但有限制)

#### 6. **IndexTTS-2**(Bilibili)— 工業級 + 情緒/時長控制
- **特色**: 精準控制每段的「時長」(影視配音用)、emotion 可獨立指定
- **語言**: 中、英、日
- **粵語**: ❌ 未來會加
- **官方**: https://github.com/index-tts/index-tts2

#### 7. **F5-TTS**— 學術 SOTA
- **品質**: 純 voice clone 品質頂尖
- **語言**: 中、英
- **粵語**: ❌
- **缺點**: 長文有 chunking seam,速度慢

#### 8. **XTTS-v2**(Coqui)— 多語老牌
- **語言**: 17 種語言
- **粵語**: ❌(歸類在「中文」)
- **6 秒 reference 就能 clone**

#### 9. **Fish Speech V1.5**(fishaudio)
- **品質**: TTS Arena ELO 1339(top tier)
- **授權**: **CC-BY-NC-SA-4.0(不可商用!)**❌
- **語言**: 中英日

#### 10. **Fish Audio S2 / S2 Pro**(fishaudio,2026 新)— 帳面最強,但授權是坑
- **客觀**: Seed-TTS WER 0.54%(中)、MiniMax 24 語測 11 語 WER 第一、17 語 sim 第一,**含粵語贏 ElevenLabs/MiniMax**
- **授權**: ❌ **Fish Audio Research License** —— 研究/非商用免費,**商用只能走它官方 API**(自架不能商用)。跟 Fish Speech 同一個坑,**自架方案直接跳過**
- **官方**: https://fish.audio/blog/fish-audio-open-sources-s2/

#### 11. **OpenVoice v2**(MyShell)— 情緒/風格轉換強
- **特色**: cross-lingual clone + 風格/情緒轉換
- **粵語**: ❌

### 🥉 第三梯隊(暫不推薦或舊版)

| Model | 為什麼跳過 |
|---|---|
| Voxtral (Mistral) | 主打英文 |
| CosyVoice 2.0 | 已被 CV3 取代 |
| Bark | 慢、不穩 |
| CosyVoice 1 / 300M | 太舊 |
| TTS by Coqui (XTTS-v1) | 已被 v2 取代 |
| VITS / Mozilla TTS | 古早,品質落後 |

---

## 🔄 RVC vs TTS — 別搞混

| 項目 | TTS(text→speech)| RVC(voice→voice)|
|---|---|---|
| 輸入 | **文字** | **音檔**(任何人講的話) |
| 輸出 | 目標 speaker 念那段文字 | 目標 speaker 講同樣內容,但是用 target 聲音 |
| 用途 | 唸稿子、訂閱式廣告、新聞播報 | **配音替換**:外國配音員念稿 → 換成 Eric 聲音 |
| 訓練 | reference 5-15 秒(zero-shot)或 30+ 分鐘(fine-tune)| 訓練 30 分鐘 voice 資料(類似 fine-tune) |
| 代表 | CosyVoice / GPT-SoVITS / Higgs / Chatterbox / F5 | **RVC(Retrieval-based Voice Conversion)/ so-vits-svc** |

### 為什麼我們同時要兩個?
- **TTS**: 給文字直接生成 → 適合「Eric 念新稿」
- **RVC**: 客戶送音檔 → 換成 Eric 聲音 → 適合「夾雜對話 / 戲劇配音 / 已有錄音想換人聲」

**GPT-SoVITS 同時提供 TTS + RVC**,所以我們用一個 pod 涵蓋兩個功能。

---

## 🇭🇰 粵語專用建議(這是 Wing 的主場)

### 粵語支援度排行
1. **CosyVoice 3** ✅ 原生支援(18+ 方言,粵語明確列入)
2. **Qwen3-TTS** 🆕 官稱 9 方言含粵語(**README 未明列 → 6/23 shootout 實測確認**)
3. **Higgs Audio v3** ✅ v2 原生支援(v3 待實測)
4. **GPT-SoVITS v2+** ✅ 2024/08 起支援
5. F5-TTS / XTTS-v2 / Chatterbox ❌ 無原生粵語

### 粵語用 CV3 怎麼下指令
**zero_shot 模式**(用粵語 reference + 粵語白話字 text):
```
voice_id: wing_ywen
text: "今日嘅天氣相當唔錯。"
instruction: (空)
```

**instruct2 模式**(更穩,強制粵語 anchor):
```
voice_id: wing_ywen  # 還是用 Wing 粵語 ref
text: "今日嘅天氣相當唔錯。"
instruction: "请用广东话表达"
```

⚠️ **粵語白話字** 推薦用法:
- 「我係」「冇」「喺」「嘅」「咁」「啲」「畀」「嚟」「咗」「唔」
- 用簡體中文輸入(因為 ttsfrd 訓練資料偏簡)
- 別中英混排太多

---

## 🧠 各引擎踩坑清單(我們踩過的)

### CosyVoice 系列(2/3)

| ⚠️ 坑 | 修法 | 來源 |
|---|---|---|
| Wetext 把中文搞爛 → 飄到日文/越南腔 | `text_frontend=False`(必設)| 官方 example.py NOTE |
| `inference_zero_shot` 不接 prompt 前綴 | 加 `"You are a helpful assistant.<\|endofprompt\|>"` 前綴 | example.py CV3 範例 |
| 長文飄音 | **sentence-split**(逐句餵 generator)| example.py bi-streaming |
| 訓練 silent kill | `train_dataset partition=False` + `--timeout 300` | GitHub Issue #517/#1727 |
| Checkpoint 寫 MFS 卡 | symlink 到 `/dev/shm` RAM disk | 自己想的 |
| 50 分鐘資料 fine-tune 沒效 | 跳過 fine-tune,**直接用 RL base + 對的設定** | 今天實測 |
| Cantonese zero-shot 飄 | 用 `inference_instruct2` + 「请用广东话表达」 | example.py CV3 |
| Use `AutoModel` 不是 `CosyVoice2` | 官方 example.py 標準 | example.py |
| ttsfrd > wetext | 裝 `ttsfrd-0.4.2`(需下載 CosyVoice-ttsfrd 資源)| README |
| **fp16=True**(短文穩定)| `AutoModel` 預設處理,不用顯式設 | — |
| SWA warning | config.json 設 `sliding_window: null` | — |
| RunPod port 沒 expose | 用 expose 過的 port(我們用 8888)| — |
| **CV2 已過時** | 升 `Fun-CosyVoice3-0.5B-2512` | README 第一行 |

### GPT-SoVITS

| ⚠️ 坑 | 修法 |
|---|---|
| v3 24kHz 輸出有金屬感 | 換 **v4 或 v2Pro/ProPlus** |
| 訓練資料要切片到 5-10 秒 | 用 webui 預處理 |
| 訓練要先抽 BERT/HuBERT 特徵 | webui 自動,別手動 |
| 推論要 ref audio + ref text | ref text 跟 ref audio **一字不漏對齊**(同 CV3) |
| 中英混排 | 直接寫,引擎處理還行 |
| RunPod SSH proxy 不支援 SCP | **先 GoTTY → start sshd → 用 TCP SSH 的 port 才能 scp** |

### RVC(Retrieval-based Voice Conversion)

| ⚠️ 坑 | 修法 |
|---|---|
| 需要乾淨的 vocal,有 BGM 會壞 | 用 UVR5 / Demucs 先分離人聲 |
| Pitch 偏移要對 | 男聲變女聲 +12,女聲變男聲 -12(半音)|
| Crepe vs RMVPE pitch extractor | **RMVPE 較準**,Crepe 較慢 |
| Index 比例(retrieve mix ratio) | 太高 → 太像訓練資料,失去原本表情 |

---

## 🛠️ Onyx 標準合成 stack(目前最佳)

### 中文/英文/日文/韓文 TTS(用 CV3 Pod)
```python
# server.py 已部署
AutoModel(model_dir='Fun-CosyVoice3-0.5B')
inference_zero_shot(
    text_generator(sentences),  # sentence-split
    "You are a helpful assistant.<|endofprompt|>" + ref_transcript,
    ref_wav_path,
    stream=False,
    text_frontend=False,
)
```

### 粵語 / 方言 / 情緒控制(用 CV3 Pod)
```python
inference_instruct2(
    text_generator(sentences),
    "You are a helpful assistant. 请用广东话表达。<|endofprompt|>",
    ref_wav_path,
    stream=False,
    text_frontend=False,
)
```

### 配音替換 RVC(用 GPT-SoVITS Pod)
```http
POST https://a52pzfcunv6ov8-80.proxy.runpod.net/v1/audio/speech
Authorization: Bearer onyx-eric-key-2024
Content-Type: application/json

{
  "model": "tts-1",
  "input": "要念的文字",
  "voice": "eric_warm_slow",  # 預設 7 種情緒
  "response_format": "wav",
  "speed": 1.0
}
```

---

## 📊 在哪個引擎做什麼工作(我的決策矩陣)

| 場景 | 引擎 | 為什麼 |
|---|---|---|
| 一般中文配音 | **Qwen3-TTS** 或 **CV3** | Qwen3 中文 WER 業界最低,3秒克隆;CV3 已部署當對照(待 6/23 shootout 定案) |
| 粵語配音 | **CV3 + instruct2** | 18 方言原生支援;Qwen3 粵語待實測、Higgs 是備案 |
| 多情緒 Eric | **CV3 + 7 個情緒 ref** | 直接從 416 訓練檔挑,zero-shot |
| 已錄音換 Eric 聲 | **GPT-SoVITS RVC**(舊 pod)| 唯一做 voice conversion 的 |
| 客戶要 ElevenLabs 同等 | **Qwen3-TTS / CV3 + sentence-split** | Qwen3 客觀贏 ElevenLabs;CV3 + ttsfrd 已驗證夠用 |
| 不能商用的場景 | ❌ Fish Speech / Fish Audio S2(非商用授權,自架不能商用) | — |
| 想試最新 SOTA | **Qwen3-TTS**(中文)/ **Higgs v3**(多語) | Qwen3 中文最強;Higgs 10M 小時、100+ 語 |

---

## 🚀 未來升級路線(優先序)

### Phase A — 本月可做
- [ ] **CV3 上線多情緒 Eric**(7 個 ref 從 FAAM 訓練檔挑)
- [ ] **Wing 粵語 production**(用 instruct2 + 4-5 個情境 ref)
- [ ] **GPT-SoVITS Pod 整合**(後台串接 OpenAI 相容 API)
- [ ] **RVC 後台 UI**(上傳音檔 → 換成 Eric)

### Phase B — 下個月
- [ ] **GPT-SoVITS v2Pro 重訓 Eric**(取代舊 8-epoch model,解「機器人感」)
- [ ] **Wing GPT-SoVITS 訓練**(粵語 production model)
- [ ] **vLLM 加速 CV3**(從 README:支援 vLLM 0.11+,~3x 加速)
- [ ] **TensorRT-LLM**(README:4x 加速,production 必備)

### Phase C — 試新引擎
- [ ] 🔥 **Qwen3-TTS vs CV3 vs 訓練模型 shootout**(`VOICE_LAB/experiments/2026-06-23_...`)← **最高優先,解機器人感的正解**
- [ ] **Higgs Audio v3** 部署測試(10M 小時、100+ 語,SGLang 自架或 Boson API)
- [ ] **Chatterbox** 英文場景測試(MIT 商用 + 盲測贏 ElevenLabs)
- [ ] **IndexTTS-2** 情緒控制測試(影視配音用)

> ⚠️ Phase B 的「GPT-SoVITS v2Pro 重訓 Eric」**先別做** —— 依 [00_DIAGNOSIS](VOICE_LAB/00_DIAGNOSIS_clone-vs-train.md),機器人感的正解是**換 zero-shot 引擎**,不是再訓一次。等 shootout 證明 zero-shot 鎖不住身份,才回來做 few-shot 微調。

---

## 💼 商用授權清單

| 引擎 | 授權 | 商用 | 注意 |
|---|---|---|---|
| **Qwen3-TTS** 🆕 | Apache 2.0 | ✅ | 無 royalty,中文最強 |
| **CosyVoice 3** | Apache 2.0 | ✅ | 無 royalty |
| **GPT-SoVITS** | MIT | ✅ | 無 royalty |
| **Chatterbox** | MIT | ✅ | 無 royalty,可 self-host + 改 weights |
| **Higgs Audio v3** | Apache 2.0 | ✅ | 無 royalty(v2→v3) |
| **Fish Audio S2 / S2 Pro** 🆕 | Fish Audio Research License | ❌ | **自架非商用!**商用只能買它 API |
| **XTTS-v2** | Coqui Public License | ⚠️ | 商用要看條款 |
| **F5-TTS** | 學術用途 | ⚠️ | 商用要洽談 |
| **Fish Speech V1.5** | CC-BY-NC-SA-4.0 | ❌ | **非商用!** |
| **OpenVoice v2** | MIT | ✅ | — |
| **ElevenLabs** | 商業 | ✅ | 月費 $22-99,有條款限制 |

---

## 🎙️ Reference Audio 製作 SOP(各引擎共通)

### 規格
- **格式**: WAV PCM(別用 MP3 壓縮過)
- **取樣率**: 24 kHz 或 48 kHz(CV3 內部 24 kHz)
- **位深**: 16-bit 或 24-bit
- **聲道**: **Mono**
- **長度**: 5-15 秒(8-12 秒甜蜜點)
- **內容**: 平鋪直敘、無背景音、無回音、無激烈情緒

### 多情緒 Reference 策略(以 Eric 為例)
不要只用一個 ref,做 **7 種風格 voice profile**:

| Profile | 語速 | 情緒 | 適用 |
|---|---|---|---|
| `eric_excited_fast` | 快 | 興奮 | 電視購物、限時搶購 |
| `eric_excited_medium` | 中 | 興奮 | 3C、促銷 |
| `eric_confident_medium` | 中 | 自信 | 美妝、健康食品 |
| `eric_neutral_medium` | 中 | 中性 | 一般產品、播報 |
| `eric_neutral_slow` | 慢 | 中性 | 精品、奢侈品 |
| `eric_warm_medium` | 中 | 溫暖 | 居家、親子 |
| `eric_warm_slow` | 慢 | 溫暖 | 食品、生活風格 |

### Transcript(逐字稿)規則
- **一字不漏對齊音檔**(包含「嗯」「啊」「呃」)
- **標點符號反映實際停頓**
- 數字 / 英文 / 專有名詞 **保留原樣**
- 簡繁中文 **保持一致**(別半繁半簡)

---

## 📚 必看文件

### CosyVoice
- [README](https://github.com/FunAudioLLM/CosyVoice/blob/main/README.md)
- [example.py](https://github.com/FunAudioLLM/CosyVoice/blob/main/example.py) — **最重要,所有用法**
- [Demos CV3](https://funaudiollm.github.io/cosyvoice3/)
- [Issue #517](https://github.com/FunAudioLLM/CosyVoice/issues/517) — 訓練 timeout 修法
- [Issue #1727](https://github.com/FunAudioLLM/CosyVoice/issues/1727) — 同上

### Qwen3-TTS 🆕
- [GitHub](https://github.com/QwenLM/Qwen3-TTS) — `pip install -U qwen-tts`,模型 `Qwen/Qwen3-TTS-12Hz-1.7B-Base`
- [License (Apache 2.0)](https://github.com/QwenLM/Qwen3-TTS/blob/main/LICENSE)

### GPT-SoVITS
- [README](https://github.com/RVC-Boss/GPT-SoVITS/blob/main/README.md)
- [v3v4 features wiki](https://github.com/RVC-Boss/GPT-SoVITS/wiki/GPT%E2%80%90SoVITS%E2%80%90v3v4%E2%80%90features-(%E6%96%B0%E7%89%B9%E6%80%A7))

### RVC
- [RVC-Project WebUI](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI)
- [annotated-rvc 技術細節](https://gudgud96.github.io/2024/09/26/annotated-rvc/)

### 對比與評測
- [Best Open-Source TTS 2026 (FindSkill)](https://findskill.ai/blog/best-open-source-tts-2026/)
- [Chatterbox vs ElevenLabs blind test](https://www.resemble.ai/chatterbox/)
- [Higgs Audio v2](https://github.com/boson-ai/higgs-audio)

---

## 🎯 Onyx 客戶常見需求 → 引擎對照

| 客戶說 | 我選 | 設定 |
|---|---|---|
| 「念這段廣告詞,Eric 的聲音」 | CV3 + `eric_*` ref | zero_shot,sentence-split |
| 「念這段粵語旁白,Wing 的聲音」 | CV3 + Wing ref | instruct2 + `请用广东话表达` |
| 「我這段配音員的錄音換成 Eric」 | GPT-SoVITS RVC | `/v1/audio/speech` 或 voice_conversion endpoint |
| 「四川話版的廣告」 | CV3 + 任何中文 ref | instruct2 + `请用四川话表达` |
| 「興奮的促銷」 | CV3 + `eric_excited_fast` ref | zero_shot(已經興奮)或 instruct2 加強 |
| 「冷靜的新聞播報」 | CV3 + `eric_neutral_slow` ref | zero_shot |
| 「日文 / 韓文版本」 | CV3 | cross_lingual + `<|jp|>` / `<|ko|>` tag |
| 「跨語言:同一個聲音念多國語言」 | **CV3** | 同一個 ref,不同 lang tag |

---

## 🔥 我的「絕不再踩」清單

1. ❌ **不用 CosyVoice 2** — 永遠用 **CosyVoice 3**
2. ❌ **不要忘 `text_frontend=False`** — README NOTE 第一段
3. ❌ **不要直接 `from cosyvoice.cli.cosyvoice import CosyVoice2`** — 用 `AutoModel`
4. ❌ **粵語不要走 zero_shot** — 走 `inference_instruct2`
5. ❌ **長文不要一次塞** — 用 sentence-split generator
6. ❌ **訓練不要用 default --timeout=60** — 設 `300`
7. ❌ **訓練不要用 `partition=True`** — 單 GPU 設 `False`
8. ❌ **不要寫 checkpoint 到 MFS** — symlink `/dev/shm`
9. ❌ **不要從已 fine-tune 過的 ckpt 繼續訓** — 一定從 vanilla pretrained
10. ❌ **不要忘記 strip metadata key** — `epoch / step` 要剝才能當 inference llm.pt
11. ❌ **不要用 nohup** — 用 `tmux` 對抗 SSH 斷線
12. ❌ **不要 polling 太頻繁** — SSH 連線高頻可能被 RunPod 殺
13. ❌ **不要用 Fish Speech 做商用** — CC-BY-NC 不可商用
14. ❌ **Reference transcript 不要漏字** — embedding 會崩
15. ❌ **不要混用簡繁中文** — ttsfrd 會混亂

---

## ⏱️ 各模型載入時間參考(RTX 4090)

| 模型 | Load 時間 | VRAM | 推論速度(RTF)|
|---|---|---|---|
| CosyVoice 3 RL | 60-90s | 4-5 GB | 0.5-0.7 |
| GPT-SoVITS v4 | 30s | 4 GB | 0.8 |
| Higgs Audio v2 3B | 90s | 8 GB | 0.6 |
| F5-TTS | 30s | 3 GB | 1.0 |
| RVC inference | 10s | 2 GB | 0.3 |

---

## 🧪 測試提示詞(快速驗證新 setup)

| 測試 | 文字 | Voice | Instruction | 預期 |
|---|---|---|---|---|
| 普通話短文 | `你好,大家好,我是 Eric` | `Eric` | (空) | 普通話男聲 |
| 普通話長文 | (4 句正體中文) | `Eric` | (空) | 不飄,sentence-split 切句 |
| 粵語 | `大家好,我係 Wing,今日同你介紹...` | `wing_ywen` | `请用广东话表达` | 標準粵語 |
| 興奮促銷 | `限時搶購,只剩三天!` | `eric_excited_fast` | (空) | 急促興奮 |
| 慢念精品 | `品味,從每一個細節開始。` | `eric_neutral_slow` | (空) | 沉穩慢念 |
| 跨語言 | `<|en|>Hello and welcome.` | `Eric` | (空) | Eric 念英文 |

---

> **這份文件持續更新**。每次踩到新坑、發現新引擎、跑通新流程都加進來。
> 目標:當我下次遇到「為什麼又出 bug」的問題時,先翻這份。

---

## ⏰ 下次強制 Review:**2026-08-23**

如果今天日期已經超過上面那個 → 翻到本檔開頭 **「每季 Review Checklist」** 跑一遍,更新 Last Updated + 加 version history。
