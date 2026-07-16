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
- [x] **fishaudio/fish-speech** 看是否改授權成可商用 —— 2026-07-16 查:**沒改成免費商用,反而更緊**(無 1.6;新版 S2 從 Apache 收成 Research License)。但官方有付費商用窗口($10k/月起)→ 判 🟡 非死路。見 X4
- [x] **boson-ai/higgs-audio** 看是否出 v3 / 新方言 —— 2026-07-16 查:v3 已出(`bosonai/higgs-tts-3-4b`)但**權重 Research & Non-Commercial 禁商用**(主檔原誤標 Apache✅,已改 🔴)。見 X4
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
| v1.4 | 2026-07-16 | **X4 授權矩陣全數複驗回寫(Wing 2026-07-16 拍板)**:剩下 8 列用五步 SOP 逐條驗完,授權矩陣 11 列至此**全數複驗**。①🚨 **Higgs Audio v3 從「第一梯隊 Apache ✅ 可商用」改判 🔴** —— 權重是 Research & Non-Commercial(禁商用),Apache 只蓋 code;主檔從 v1.1 首記就抓錯徽章(比 XTTS/F5 危險因在第一梯隊)②**Fish Speech 紅→🟡** —— 官方點名有付費商用窗口($10k/月),非死路;順手結掉季 review 待辦(沒改、更緊)③**Fish S2「只能買 API」改寫** —— Enterprise 有 on-prem 可談;🚨 API 預設拿聲音訓練、ZDR 只 Enterprise 有④**OpenVoice v2 梯隊補授權行**(原缺)⑤**Chatterbox 補 PerTh 浮水印註記 + GPT-SoVITS 補兩保留**(底模資料源未公開 / g2p_en→distance GPL 傳遞依賴,僅散布軟體時需換);⑥三色對照黃燈定義擴充「非商用但有活的付費窗口」。生產主力 CV3/GPT-SoVITS 複驗綠燈;乾淨綠燈骨幹 = Qwen3/CV3/GPT-SoVITS/Chatterbox/OpenVoice v2。配套:`VOICE_LAB/research/daily/2026-07-16.md`。後續 X5(掃第三梯隊)/X6(浮水印 vs AI 標示法規、底模透明度) |
| v1.3 | 2026-07-15 | **授權地雷回寫(Wing 2026-07-15 拍板)**:①**修正兩列判定 ⚠️→❌** —— XTTS-v2(權重 CPML 非商用 + Coqui 2024-01 倒閉無人能賣)、F5-TTS(權重 CC-BY-NC 源自 Emilia、**微調洗不掉**、官方不發授權);②新增**三色對照**(綠=標準 Apache/MIT 才進 IP 保證交付 / 黃=可出成品但不當訓練料 / 紅=不進商用交付);③新增**選型五步查核 SOP**;④「絕不再踩」加 **#16 徽章≠權重授權 / #17 禁改進他模型的別當訓練料 / #18 微調洗不掉授權**。查證後確認生產線未使用 XTTS/F5(現行 GPT-SoVITS MIT + CV3 Apache 皆綠)=潛在地雷非事故。配套:`VOICE_LAB/授權地雷清單_提案稿.md`、`VOICE_LAB/research/daily/2026-07-15.md`。✅其餘 8 列權重授權已由 v1.4(X4)複驗完成 |
| v1.2 | 2026-07-06 | Voice Lab 自學 B1/B2 回寫:**`zero_shot`=身份最像 / `instruct2`=表情但犧牲音色**(兩者 trade-off、疊不起來,Issue #1314);instruct2 三陷阱(唸出指令 #1802、表情↔咬字 CER trade-off、控不了音色)進 CosyVoice 踩坑表;粵語 instruct2 標「待實聽驗證、護城河仍押 RVC」。配套:`VOICE_LAB/research/daily/2026-07-06.md`、`VOICE_LAB/REF_CHECKLIST.md` |

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
位置:**`/Volumes/WingAI SSD/Claude/Projects/工程部/Onyx_語音資產/`**(2026-06-24 大整理:權重→`_models/`、ref→`_refs/`、語料→頂層)

| 檔案 | 用途 | 大小 | 內容 / 對應 prompt_text |
|---|---|---|---|
| `_models/eric_gpt_e15.ckpt` | GPT 模組 epoch 15 | 148 MB | — |
| `_models/eric_sovits_e100_s5400.pth` | SoVITS 模組 epoch 100 step 5400(早期 checkpoint) | 81 MB | — |
| `_models/eric_sovits_v2pro_final.pth` | **SoVITS v2Pro 最終權重 → production 用這個** | 908 MB | — |
| `_refs/eric_ref.wav` ⭐ | **production ref(楊日漢授權聲明)** | 1.3 MB | `我是楊日漢，我確認本段聲音由我本人於2026年3月18號親自錄製。` |
| `_refs/eric_ref_high.wav` | 廣告稿乾淨版(FAAM0113 的處理版) | 1.2 MB | `年度最大電玩展強勢登場。主機與遊戲片整套購買，立即為您省下兩千元。` |
| `eric_train_data/` (419 wav + `eric_filelist.txt`) | 原始訓練資料(切片,48k/16bit/~8s) | 424 MB | — |
| `…/Onyx_語音資產/eric/TTS 1小時 Eric音檔/` ⭐ | **完整語料庫** | — | `eric_training_dataset.csv`(417 句,**id/text/emotion/speed** 標,挑 ref 神器)+ `原檔/`(長錄音 FAAM001-128 等 48k/24bit)+ `聲音認證.wav`(57s 自然講話)。風格=溫暖旁白+促銷口播 |

> **⚠️ 2026-05-30 踩坑:** voice-ai-platform `voices.yaml` 一開始用 `FAAM0113.wav` (raw 訓練廣告片段) 當 ref → **大陸腔**。
> GPT 才訓 15 epoch,prosody 高度依賴 ref,**ref 用了廣告腔的訓練資料 = 結果就是廣告腔/大陸腔**。
> 解法:換成 `eric_ref.wav`(楊日漢的授權聲明,自然講話節奏)→ 台灣腔回來。
> Production config 永遠用 `eric_ref.wav` + 對應 prompt_text(見上表)。

### Wing(GPT-SoVITS v2Pro,2026-05-29 訓的,粵語)
位置:**`/Volumes/WingAI SSD/Claude/Projects/工程部/Onyx_語音資產/_models/wing_sovits_backup_20260529/`**

訓練資料來源:`/Volumes/WingAI SSD/Claude/Projects/工程部/Onyx_語音資產/Wing/transcripts/wing_ads_sliced/`(324 切片,34.2 分鐘 zh-hk Spotify 廣告)
訓練 pod:`u46xxo7nkayx80` (A40 48GB, EU-SE-1) — 同台跑 Eric

| 檔案 | 用途 | 大小 |
|---|---|---|
| `wing-e1.ckpt` ~ `wing-e8.ckpt` | GPT 模組 8 個 epoch(每個 148 MB) | 1.2 GB |
| `wing_e1_s60.pth` ~ `wing_e8_s480.pth` | SoVITS 模組 8 個 epoch(每個 135 MB) | 1.1 GB |
| `wing_ads_0004.wav` | inference ref audio(~4.7s)| 300 KB |

**production 用 epoch 8**(`wing-e8.ckpt` + `wing_e8_s480.pth`),ref `wing_ads_0004.wav`,prompt_text="無間斷收聽音樂,全無限制。",prompt_lang=`yue`(粵語).

> 📍 **2026-06-23 更正**:`wing_ads_0004.wav` **不在** backup 資料夾,實際在
> `/Volumes/WingAI SSD/Claude/Projects/工程部/Onyx_語音資產/Wing/transcripts/wing_ads_sliced/wing_ads_0004.wav`
> (實測 44.1k/mono/16bit/**3.4s**,不是 ~4.7s;偏短,同夾 324 切片可挑 8-12s 更好的)。weights 才在 backup 夾。

⚠️ 已驗證 TTS 跑得起來,粵語腔。後續可以比較 epoch 4/6/8 哪個最好聽。

### 阿宏 — 呂冠彥 (Onyx Bravo,台灣男聲) ⚠️ 2026-06-23 補登
> **原 GPT-SoVITS 訓練權重:全碟搜不到 = 已遺失**(.ckpt/.pth 都沒備份到本機)。
> **但不影響** —— 走 zero-shot 只要 raw 人聲 ref,不需要那個訓練模型。

| 資產 | 位置 | 說明 |
|---|---|---|
| **原始人聲(5hr,可訓練/克隆)** | `…/Onyx_語音資產/2026041201 數據堂 冠彥 TTS 5小時/交檔/`(7 個日期夾,共 112 wav,**48k/mono/24bit**) | **自然台灣對話**(美食/手帳/拍照/颱風…),非廣告腔;每檔 2.7–6.5 分鐘長,要切句 |
| ✅ **逐字稿(2026-06-24 更正:一直都在!)** | 數據堂母資料夾的 **5 個 .xlsx 錄音腳本**:`台湾话_文案演绎(单句).xlsx`、`…长尾语料(单句).xlsx`(1169 句)、`M43…新增0506.xlsx`、`台灣在地口語引導對話清單.xlsx` 等 | topic-keyed(`topic_001_turn_01_Speaker2_001`→文字),對應交檔 wav。**阿宏完整可訓練,不必 whisper** |
| 已切好的 ref 候選 | `~/Desktop/voice-shootout-refs/Ahong_阿宏_候選A/B_水果_*.wav`(各 ~10.5s,silencedetect 切的乾淨整句) | 對應文字到 xlsx 撈 |
| 舊模型輸出(僅參考) | `…/Onyx_語音資產/ahong_v2/{01_ref_round1,02_ref_round2,03_onyx_bravo_16langs}` | 都是**合成**輸出,非人聲;**154Hz/e12 是 winner** |

> 💎 阿宏這 5hr = **有逐字稿的自然台灣對話料**,是做台灣腔(BreezyVoice 微調/克隆)的黃金素材。模型丟了不要緊,料齊隨時重做。

### Nova(身份待確認)
位置:`/Volumes/WingAI SSD/Claude/Projects/工程部/Onyx_語音資產/_models/nova_train_data/` + `nova_preprocess_final/`

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
- **授權**: 🟢 **MIT(免費商用)** —— 權重(`lj1995/GPT-SoVITS`)標準未改動 MIT,LICENSE 史上零加料;內建 vocoder/HuBERT/RoBERTa/SV 全 MIT 或 Apache,已複驗
  - ⚠️ 兩個保留(不改判色):①底模訓練資料來源官方**從未公開**(無法自證乾淨,屬透明度風險)②`g2p_en` 傳遞依賴 GPL 套件 `distance`(issue #2776 未解)—— **只在「打包散布軟體」時觸發 GPL,pod 上跑推論當服務不受影響**,哪天要把引擎打包給客戶再換掉 → 見 X6
- **官方**: https://github.com/RVC-Boss/GPT-SoVITS

#### 3. **Chatterbox / Chatterbox-Turbo**(Resemble AI)— 黑馬
- **盲測**: **65.3% 聽眾偏好 Chatterbox-Turbo > ElevenLabs**(24.5%)
- **授權**: 🟢 **MIT,可商用,無 royalty**(六版權重全標準未改動 MIT,已複驗)
  - ⚠️ **輸出硬編碼嵌入 PerTh 神經浮水印**(程式碼無開關):只是 1-bit「AI 生成」旗標,**不含 Resemble 品牌、不含可回溯 ID**,對客戶交付實務無影響。授權沒禁移除、可 fork 刪掉;但**移除前先確認 AI 標示法規**(歐盟 AI Act 下保留浮水印可能反而是合規資產)→ 見 X6
- **語言**: 英文主力,中文/法文/西班牙文 beta
- **粵語**: ❌ 沒有
- **官方**: https://github.com/resemble-ai/chatterbox

#### 4. **Higgs Audio v3**(Boson AI)— 新銳(2026 升 v3,原 v2 已過)
- **授權**: 🔴 **程式碼 Apache 2.0 / 權重 Research & Non-Commercial ❌ 禁商用**(權重 LICENSE「BOSON HIGGS TTS 3 RESEARCH AND NON-COMMERCIAL LICENSE」2026-07-08 版)
  - 🚨 **Apache 徽章只蓋 GitHub code,不蓋權重**;`bosonai/higgs-tts-3-4b` 權重公開不用申請,但商用全面禁止(v2 曾有 10 萬 AAU 免費門檻,v3 直接取消)
  - 🚨 §IV(b)(i) **禁拿它/衍生/輸出去 train/fine-tune/distill/improve 任何 foundational 生成模型** → 連當自家模型訓練料都不行
  - 商用唯一路徑 = contact@boson.ai 另簽付費授權。**帳面 zero-shot 極強但不能上線,別被 SOTA 沖昏頭**
  - ⚠️ **位置待重排**(X5):權重禁商用,不符「第一梯隊=可上線等級」定義,應下移
- **特色**: **10M+ 小時訓練**,zero-shot 表現極強;v3 = `bosonai/higgs-tts-3-4b`(4B,舊 ID `higgs-audio-v3-tts-4b` 已 307 重導)
- **語言**: 100+ 語言;v2 原生四川話/粵語(v3 方言待 pod 上實測確認)
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
- **授權**: 🟡 **程式碼 Apache 2.0 / 權重 Bilibili 自訂**(門檻式:MAU<1億 且 年營收<¥10億 可商用,Onyx 遠低於→落在允許區)
  - ⚠️ §4.1c **不得用它/其衍生去改進其他商用 AI 模型** → **只能當推論端出成品的工具,不能當自家模型的訓練料**
  - ⚠️ §9 **中文版為準**;§6 陸法 + 上海仲裁。**客戶要 IP 保證時避開**
- **特色**: 精準控制每段的「時長」(影視配音用)、emotion 可獨立指定
- **語言**: 中、英、日
- **粵語**: ❌ 未來會加
- **官方**: https://github.com/index-tts/index-tts2 · 評估:[IndexTTS-2_商用評估.md](VOICE_LAB/IndexTTS-2_商用評估.md)

#### 7. **F5-TTS**— 學術 SOTA
- **授權**: 🔴 **程式碼 MIT / 權重 CC-BY-NC ❌ 非商用** —— 限制源自訓練資料 **Emilia**(爬來的)
  - 🚨 **微調洗不掉**(維護者原話:finetune 後照樣不能商用);官方**不發**商用授權
  - 唯一商用解 = 自有可商用資料**從零重訓**。**品質頂尖但不能碰,別被 SOTA 沖昏頭**
- **品質**: 純 voice clone 品質頂尖
- **語言**: 中、英
- **粵語**: ❌
- **缺點**: 長文有 chunking seam,速度慢

#### 8. **XTTS-v2**(Coqui)— 多語老牌
- **授權**: 🔴 **程式碼 MPL 2.0 / 權重 CPML ❌ 非商用**
  - 🚨 Coqui 公司 **2024-01 倒閉 → 無人能賣商用授權**,「待洽談」是死路(2023 年曾賣 ~$365/年,窗口已不存在)
  - 社群 fork 仍能跑,但**授權不因 fork 而改變**;網路上「XTTS 免費商用」的教學文是錯的
- **語言**: 17 種語言
- **粵語**: ❌(歸類在「中文」)
- **6 秒 reference 就能 clone**

#### 9. **Fish Speech V1.5**(fishaudio)
- **品質**: TTS Arena ELO 1339(top tier)
- **授權**: 🟡 **權重 CC-BY-NC-SA-4.0(自架非商用,下載須勾 non-commercial ONLY)** —— 但官方點名有付費商用授權窗口($10k/月起,business@fish.audio)→ 可談非死路;無 1.6,新版 S2 更緊
- **語言**: 中英日

#### 10. **Fish Audio S2 / S2 Pro**(fishaudio,2026 新)— 帳面最強,但授權是坑
- **客觀**: Seed-TTS WER 0.54%(中)、MiniMax 24 語測 11 語 WER 第一、17 語 sim 第一,**含粵語贏 ElevenLabs/MiniMax**
- **授權**: 🔴 **權重 Fish Audio Research License** —— 自架非商用;商用需另簽(Enterprise 有 on-prem 可談,business@fish.audio,非「只能買 API」)。🚨 **API 預設拿上傳聲音訓練模型,ZDR 只有 Enterprise 有 → 拿到書面 ZDR 前,客戶/配音員聲音禁進 API(含免費測試)**。**自架方案直接跳過**
- **官方**: https://fish.audio/blog/fish-audio-open-sources-s2/

#### 11. **OpenVoice v2**(MyShell)— 情緒/風格轉換強
- **授權**: 🟢 **MIT ✅**(v1+v2 於 2024-04 從 CC-BY-NC 改判,權重+程式碼皆商用免費;相依 base speaker **MeloTTS 亦全 MIT,不污染**,已複驗)
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
3. **Higgs Audio v3** ✅ v2 原生支援(v3 待實測)—— ⚠️ 粵語能力歸能力,**權重禁商用,交付不能用**
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

> 🧪 **待實聽驗證(Voice Lab B2, 2026-07-06):** instruct2 的方言清單「有列粵語」≠「道地」。翻遍 CosyVoice3 論文**找不到任何粵語/方言品質數字或專門優化**,CV3 重點是擴多語資料量。所以上面「CV3 + instruct2 粵語」是**候選路線,不是已證明道地**——道不道地要靠實聽 A/B(已登記 GPU 實驗)。**護城河結論維持:道地粵語仍押 RVC/口音專訓,別因為清單有列就下線 RVC。**

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
| 🚩 instruct2 **會犧牲音色相似度**(身份掉) | 鎖招牌身份(Eric/Wing/客戶指定)用 `zero_shot`;instruct2 只在「情緒>像本人」時用。**別以為 zero_shot+instruct2 能疊加**(音色會讓給風格) | GitHub Issue #1314(open/stale);Voice Lab B1 |
| 🚩 instruct2 **把指令文字唸出來**(3s→6s) | 上線前先測一句確認指令沒被唸出;中招=踩到 `frontend_instruct2` 誤把 instruct_text 當 prompt_text 的版本,更新 commit | GitHub Issue #1802;Voice Lab B1 |
| 🚩 instruct2 **越用力控情緒、字錯率越高**(表情↔咬字 trade-off) | 每次 instruct2 產出**必過 CER 關**(whisper 轉回比稿);細膩/中間強度情緒改走「挑帶該情緒的 ref」(A3),別硬用指令 | Voice Lab B2(EmoInstruct-TTS arXiv 2606.20650) |
| instruct2 **控不了音色/嗓子** | 音色只能靠 ref;文字指令對 timbre 的顯式控制「尚未實現」 | Voice Lab B2(CosyVoice2 官方) |
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
| 粵語配音 | **CV3 + instruct2** | 18 方言原生支援;Qwen3 粵語待實測。~~Higgs 備案~~ **Higgs 禁商用不能當交付備案**,粵語備案改走 GPT-SoVITS v2+ |
| 多情緒 Eric | **CV3 + 7 個情緒 ref** | 直接從 416 訓練檔挑,zero-shot |
| 已錄音換 Eric 聲 | **GPT-SoVITS RVC**(舊 pod)| 唯一做 voice conversion 的 |
| 客戶要 ElevenLabs 同等 | **Qwen3-TTS / CV3 + sentence-split** | Qwen3 客觀贏 ElevenLabs;CV3 + ttsfrd 已驗證夠用 |
| 商用交付**避開**的引擎 | ❌ Higgs v3 / F5-TTS / XTTS-v2 / Fish Speech / Fish Audio S2(自架皆非商用) | Higgs v3 帳面最強但**禁商用**;綠燈骨幹見商用授權清單 |
| 想試最新 SOTA(**僅內部評估,不上線**) | **Qwen3-TTS**(中文,🟢 可商用)/ **Higgs v3**(多語,🔴 禁商用只能內部試) | Qwen3 中文最強且可上線;Higgs 10M 小時、100+ 語但**權重禁商用,交付要另簽 contact@boson.ai** |

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
- [ ] **Higgs Audio v3** 部署測試(10M 小時、100+ 語,SGLang 自架或 Boson API)—— ⚠️ **僅內部評估,權重禁商用,不得進客戶交付**(見授權矩陣)
- [ ] **Chatterbox** 英文場景測試(MIT 商用 + 盲測贏 ElevenLabs)
- [ ] **IndexTTS-2** 情緒控制測試(影視配音用)

> ⚠️ Phase B 的「GPT-SoVITS v2Pro 重訓 Eric」**先別做** —— 依 [00_DIAGNOSIS](VOICE_LAB/00_DIAGNOSIS_clone-vs-train.md),機器人感的正解是**換 zero-shot 引擎**,不是再訓一次。等 shootout 證明 zero-shot 鎖不住身份,才回來做 few-shot 微調。

---

## 💼 商用授權清單

| 引擎 | 授權 | 商用 | 注意 |
|---|---|---|---|
| **Qwen3-TTS** 🆕 | Apache 2.0 | ✅ | 無 royalty,中文最強(權重標準未改動,已複驗) |
| **CosyVoice 3** | Apache 2.0 | ✅ | 無 royalty(權重標準未改動,已複驗;「academic」免責只針對 demo 樣本) |
| **GPT-SoVITS** | MIT | ✅ | 無 royalty(權重標準未改動,已複驗)。保留:底模資料源未公開 + `g2p_en→distance` GPL 傳遞依賴(僅散布軟體時需換,pod 推論不受影響) |
| **Chatterbox** | MIT | ✅ | 無 royalty,可 self-host + 改 weights。輸出內建 PerTh 浮水印(AI 生成旗標非品牌,可 fork 移除,移除前先確認 AI 標示法規) |
| **Higgs Audio v3** | 程式碼 Apache 2.0 / **權重 Research & Non-Commercial**(2026-07-08 版) | ❌ | **權重禁商用**;Apache 只蓋 code。v2 曾有 10 萬 AAU 免費門檻,v3 取消;§IV(b)(i) 禁拿輸出訓練/改進他模型。商用需 contact@boson.ai 另簽 |
| **Fish Audio S2 / S2 Pro** 🆕 | 權重 Fish Audio Research License | ❌ | 自架非商用;商用需另簽(Enterprise 有 on-prem 可談,business@fish.audio)。🚨 **API 預設拿上傳聲音訓練模型,ZDR 只有 Enterprise 有 → 拿到書面 ZDR 前,客戶/配音員聲音禁進 API(含免費測試)** |
| **XTTS-v2** | 程式碼 MPL 2.0 / **權重 CPML** | ❌ | **權重非商用**;Coqui 公司 **2024-01 倒閉,無人能賣商用授權**→「待洽談」是死路。社群 fork 能跑,但**授權不因 fork 而改變** |
| **F5-TTS** | 程式碼 MIT / **權重 CC-BY-NC** | ❌ | 限制源自訓練資料 **Emilia**;**微調也洗不掉**(維護者原話);官方不發商用授權,唯一解是自有資料**從零重訓** |
| **Fish Speech V1.5** | 權重 CC-BY-NC-SA-4.0(下載須勾 non-commercial ONLY) | 🟡 | 自架非商用;**但官方點名有付費商用授權**(自架 $10k/月起,business@fish.audio)→ 可談非死路。無 1.6,新版 S2 更緊 |
| **OpenVoice v2** | MIT | ✅ | — |
| **ElevenLabs** | 商業 | ✅ | 月費 $22-99,有條款限制 |

> ✅ **全 11 列權重授權已於 2026-07-15(XTTS/F5)+ 2026-07-16(其餘 8 列,X4)用下方 SOP 逐條複驗完成。** X4 抓到:Higgs v3 主檔原標「第一梯隊 Apache ✅」實為權重禁商用(已改 ❌)、Fish Speech 有付費商用窗口(紅→🟡)、Fish S2「只能買 API」不精確(已補 on-prem/ZDR)。乾淨綠燈骨幹 = Qwen3-TTS / CosyVoice 3 / GPT-SoVITS / Chatterbox / OpenVoice v2 五支。

### 🚩 三色對照(判定標準)

| 燈 | 定義 | 能不能進客戶交付 | 例 |
|---|---|---|---|
| 🟢 **綠** | 權重掛**標準未改動**的 Apache 2.0 / MIT,無附加限制 | ✅ 可,含 IP 保證 | CosyVoice 3、GPT-SoVITS、Qwen3-TTS、Chatterbox |
| 🟡 **黃** | 權重可商用**但有自訂條款**(規模門檻 / 外國法管轄 / 禁改進他模型),**或非商用但有活的付費商用窗口** | ⚠️ 可出成品,**不得**當自家模型訓練料;**客戶要 IP 保證時避開** | IndexTTS-2(Bilibili 門檻式)、Fish Speech(自架非商用但官方有付費授權窗口) |
| 🔴 **紅** | 權重非商用**且**商用窗口不存在(死路) | ❌ 不進任何商用交付,內部評估可 | XTTS-v2(Coqui 倒閉)、F5-TTS(不發授權)、Higgs v3(禁商用)、Fish Audio S2(自架) |

### 🔍 選型五步查核 SOP(判「能不能商用」照這個跑)

1. **權重在哪?** 找到實際下載的那包(HF repo / `model_dir`),**不是** GitHub 首頁。
2. **讀權重 LICENSE 全文** —— 不是徽章、不是 README 摘要。
   - 反例① 別被徽章騙成「可商用」:XTTS-v2 掛 MPL 2.0 但權重是 CPML 非商用。
   - 反例② 也別被免責聲明嚇成「非商用」:CV3 的 README「for academic purposes only」只在講 demo 樣本,不是模型本體(差點誤殺)。
3. **搜四個關鍵詞**:`commercial` / `improve any` / `prevail` / `training data`。
   - `improve any` → 有沒有「不得用於改進其他 AI 模型」(IndexTTS-2 §4.1c、CPML、Llama 系都有)
   - `prevail` → 以哪個語言版本為準(IndexTTS-2 §9「中文版為準」→ 英文判讀只算初判)
   - `training data` → 限制是不是訓練資料傳染來的(F5-TTS 因 Emilia)→ **這種微調洗不掉**
4. **非綠燈的話,確認窗口還活著嗎** —— 有沒有活著的公司/團隊真的能簽給你?(Coqui 已倒 / F5-TTS 明說不發 → 兩者「待洽談」都是死路)
5. **判色 + 記錄**:綠/黃/紅寫進上面矩陣,黃燈要註明限制範圍。

> 📋 完整通則與案例:[VOICE_LAB/授權地雷清單_提案稿.md](VOICE_LAB/授權地雷清單_提案稿.md)
> ⚠️ 非律師意見。對客戶簽 IP 保證前仍應由法務複核。

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
13. ❌ **不要用 Fish Speech / Fish Audio S2 / Higgs v3 自架做商用** — 皆非商用權重(Fish Speech CC-BY-NC 有付費窗口=🟡 / Higgs v3 Research&NC 禁商用=🔴,雖帳面最強);要用先另簽授權
14. ❌ **Reference transcript 不要漏字** — embedding 會崩
15. ❌ **不要混用簡繁中文** — ttsfrd 會混亂
16. ❌ **不要看 GitHub 徽章判商用** — **程式碼授權 ≠ 權重授權**,要讀**權重**那份 LICENSE 全文(XTTS-v2 = MPL 2.0 配 CPML 非商用;F5-TTS = MIT 配 CC-BY-NC)
17. ❌ **不要拿「禁止改進其他 AI 模型」的模型輸出去訓自家商用模型** — IndexTTS-2 §4.1c / Llama 系都有這條;它們只能當**推論端出成品的工具**,不能當造自家模型的原料
18. ❌ **不要相信「微調就能洗掉非商用授權」** — 訓練資料傳染的限制(F5-TTS/Emilia)**微調後照樣非商用**,唯一解是用自有可商用資料**從零重訓**

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
