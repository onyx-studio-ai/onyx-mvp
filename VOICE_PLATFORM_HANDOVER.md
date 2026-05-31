# Onyx Voice Platform — Handover Doc

> Last updated: **2026-05-31** | Author: Claude (with WingAI) | Read this BEFORE touching any voice infra

## TL;DR

| Voice | Status | Type | Use case |
|---|---|---|---|
| **Eric** (eric) | ✅ Production | GPT-SoVITS v2Pro TTS | Taiwan male 廣告/旁白 |
| **Wing** (wing) | ⚠️ Has long-sentence cutoff | GPT-SoVITS v2Pro TTS | 粵語廣告/旁白 |
| **阿宏** (ahong) | ✅ Production(2026-05-31 train)| GPT-SoVITS v2Pro TTS | 台灣國語對話/陪聊 |
| **Eric RVC** (eric_rvc) | ✅ Production | RVC voice conversion | 跨語言(input audio → Eric 音色) |

**Live pod:** `9vjktvfw20sxzs` EU-SE-1 RunPod
**Gateway URL:** `https://9vjktvfw20sxzs-80.proxy.runpod.net`
**API key:** `onyx-eric-key-2024` (Bearer)
**Admin UI:** `/admin/sovits` on platform (Vercel)
**SSH alias:** `wing` (in `~/.ssh/config`)

---

## 🚨 BLOCKING RULES — violate = production breaks

### 1. SoVITS sovits_weights MUST be `half_weights` (~85-150 MB), NEVER full training ckpt (~950 MB)

```
✅ eric_sovits_e100_s5400.pth     (85 MB)   ← inference 用
❌ eric_sovits_v2pro_final.pth    (951 MB)  ← training resume 用,放這裡聽起來「像老人/人妖」
```

Filename hints:
- `*_e<N>_s<M>.pth` 通常是 half_weights ✅
- `*_final.pth`, `G_xxxxx.pth`, `D_xxxxx.pth` 通常是 full training state ❌

The 951 MB file loads without error, but inference outputs **drift to a different voice character entirely**.

**Quick check:**
```bash
ls -la /app/models/custom_voices/gptsovits/eric/eric_sovits*.pth
# 必須選 80-150MB 那個,別選 500+MB 的
```

Detail: `memory/feedback_gpt_sovits_use_half_weights_not_full_ckpt.md`

### 2. RVC pipeline 必須吃「真人音檔 / 高品質外部 TTS」,不能餵自家過訓 TTS

```
✅ 客戶錄音 → RVC eric → Eric 音色版
✅ ElevenLabs / OpenAI TTS → RVC eric → Eric 音色
❌ 自家過訓 Eric TTS → RVC eric → 雙重不穩(pitch wobble compounds)
❌ 自家 Wing TTS → RVC eric → Wing 粵語 prosody bleed
```

**為什麼:** RVC 保留 input pitch contour;若 input 來自過訓 TTS,prosody 飄調直接傳到輸出。**voice_convert endpoint 就是為了打破 TTS+RVC chain**。

Detail: `memory/feedback_rvc_real_audio_in_not_tts_chain.md`

### 3. 訓練 step 數對齊 Eric April baseline (5400 steps),別爆

April Eric 訓 SoVITS 5400 step → 為什麼成功的基準:

```
target_epoch = 5400 / (corpus_size / batch_size)
```

| Voice | Corpus | 推薦 epoch | 我們訓的 | Over-fit? |
|---|---|---|---|---|
| Eric April | 418 | 26 | 26 (~5400 step) | ✅ 完美 |
| Wing v3 | 8318 | **~1.5** | **8** | ❌ 6× over |
| Wing v4 | 7410 | **~1.5** | 6 | ❌ 4× over |
| **Wing v5**(2026-05-31) | 7410 | 1.5 | **2** (~7400 step) | ⚠️ 略多但合理 |
| 阿宏 v1 | 597 | **18** | 12 (~3576 step) | ✅ 接近 |

GPT 同理 — Eric April GPT 15 epoch,複製到 阿宏 也 work。

### 4. ckpt 三地保存(本次教訓)

訓出 working ckpt 立刻:
1. `scp` 下 Mac SSD(`/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/`)
2. 上 cloud backup(S3 / GDrive)
3. 寫 MD5 紀錄

別只信 RunPod network volume — 已刪 volume 救不回。

---

## Production voices.yaml(/workspace/data/configs/voices.yaml on pod)

```yaml
voices:
  eric:
    name: Eric (Onyx Studios)
    type: tts
    version: v2Pro
    gpt_weights: /app/models/custom_voices/gptsovits/eric/eric_gpt_e15.ckpt   # 155 MB
    sovits_weights: /app/models/custom_voices/gptsovits/eric/eric_sovits_e100_s5400.pth  # ⚠️ 85 MB half_weights,別改成 _final.pth
    refer_wav_path: /workspace/data/eric_ref.wav
    prompt_text: 我是楊日漢，我確認本段聲音由我本人於2026年3月18號親自錄製。
    prompt_lang: zh
    temperature: 0.6
    top_p: 0.6
    top_k: 20
    text_split_method: cut5

  wing:
    name: Wing (Onyx Studios)
    type: tts
    version: v2Pro
    gpt_weights: /app/GPT-SoVITS/GPT_weights_v2Pro/wing-v5-e2.ckpt   # 2026-05-31 trained
    sovits_weights: /app/GPT-SoVITS/SoVITS_weights_v2Pro/wing-v4_e2_s7410.pth
    refer_wav_path: /workspace/data/wing_sliced/wing_004915.wav
    prompt_text: 透過在日常生活中進行簡單的改變,就可以幫助你降低患腦退化症的風險。
    prompt_lang: yue
    temperature: 0.5
    top_p: 0.7
    text_split_method: cut5

  ahong:
    name: 阿宏 (Onyx Studios)
    type: tts
    version: v2Pro
    gpt_weights: /app/GPT-SoVITS/GPT_weights_v2Pro/ahong-e15.ckpt
    sovits_weights: /app/GPT-SoVITS/SoVITS_weights_v2Pro/ahong_e12_s3588.pth
    refer_wav_path: /workspace/data/ahong_slices/ahong_000216.wav
    prompt_text: 活在自己的舒適圈裡面都不知道外面的世界有那麼多不同的樣貌。
    prompt_lang: zh
    temperature: 0.6

  eric_rvc:
    name: Eric RVC (voice conversion)
    type: rvc_pipeline
    base_tts_voice: eric  # 注意:用 voice_convert endpoint 時這個被 bypass
    rvc_model_name: eric_e10
    target_f0_hz: 107          # auto-pitch 對齊基準(Eric ~107 Hz)
    pitch: -3                  # default for TTS chain mode
    f0_method: harvest
    index_rate: 1.0
    filter_radius: 5
    rms_mix_rate: 0
    protect: 0.5
```

---

## Architecture

```
Browser  →  Gateway (FastAPI)  →  GPT-SoVITS workers (ports 9881-4)
                              \→  RVC workers (ports 7866-7)

Endpoints:
  POST /v1/audio/speech         TTS                 (text in → audio out)
  POST /v1/audio/voice_convert  RVC voice conv      (audio in → audio out)
  GET  /v1/voices               List all voices
  GET  /health                  Status check
```

### Voice types

| Type | Input | Pipeline |
|---|---|---|
| `tts` | text | text → GPT-SoVITS worker → audio |
| `rvc_pipeline` (via /speech) | text | text → base_tts_voice → audio → RVC worker → audio |
| `rvc_pipeline` (via /voice_convert) | **audio** | audio → RVC worker → audio (skip TTS,正確用法) |

---

## Known Issues

### Wing 長句中間斷句(unsolved)

長句(>15 字)模型 ~3 sec 強制 EOS,後半丟失。

**已試過(都只能緩解):**
- 換 ref audio(影響大,從廣告 ref 換 dementia ref → tone 改善但長度沒救)
- 改 text_split_method(cut0/cut3/cut5)
- 改 temp / top_p
- Smart wrapper(`onyx-platform/tts_smart_wrapper.py`)切句重抽接黏 — 客戶端可用,但 latency 高

**真正的解:**
- 收集**對話型粵語 corpus**(目前 corpus 都是 dementia 教育旁白 narration,模型沒學過長對話 prosody)
- 或上 商業粵語 TTS(ElevenLabs Pro / Azure)

詳見: `memory/project_wing_cv3_positioning.md`

### 阿宏 corpus 還有 5/6 沒 QC

只 QC 了 chunk 1 (597 段),chunks 2-6 (2980 段) 沒看過。若要擴 corpus 重訓 v2:
- 用 ASR 原文直接訓也 OK(音檔品質才是關鍵,文本錯字影響小)
- 或 user 繼續 QC chunks 2-6

QC tool: `/Users/wingai/Desktop/ahong_audit/ahong_chunks/chunk_N.html`

---

## How To: 加新 voice

### TTS 訓練(GPT-SoVITS v2Pro)

1. **Slice + transcribe** → `metadata.list` 格式 `path|spk|lang|text`
2. **Prep stages on pod**(在 `/app/GPT-SoVITS/`):
   ```bash
   export PYTHONPATH=/app/GPT-SoVITS/GPT_SoVITS:/app/GPT-SoVITS
   mkdir -p logs/<exp>/logs_s2_v2Pro logs/<exp>/logs_s1_v2Pro TEMP  # ⚠️ 必須先 mkdir,否則 SoVITS save 會 crash
   
   # 1A BERT
   inp_text=<list> inp_wav_dir="" exp_name=<exp> opt_dir=logs/<exp> \
     bert_pretrained_dir=/app/.../chinese-roberta-wwm-ext-large \
     i_part=0 all_parts=1 _CUDA_VISIBLE_DEVICES=0 is_half=True version=v2Pro \
     /app/venvs/gpt-sovits/bin/python GPT_SoVITS/prepare_datasets/1-get-text.py
   
   # 1B HuBERT
   inp_text=<list> ... cnhubert_base_dir=/app/.../chinese-hubert-base ... \
     /app/venvs/gpt-sovits/bin/python GPT_SoVITS/prepare_datasets/2-get-hubert-wav32k.py
   
   # 1C SV embedding (v2Pro only)
   inp_text=<list> ... sv_path=/app/.../sv/pretrained_eres2netv2w24s4ep4.ckpt ... \
     /app/venvs/gpt-sovits/bin/python GPT_SoVITS/prepare_datasets/2-get-sv.py
   
   # 1D semantic
   inp_text=<list> ... pretrained_s2G=/app/.../v2Pro/s2Gv2Pro.pth s2config_path=GPT_SoVITS/configs/s2v2Pro.json ... \
     /app/venvs/gpt-sovits/bin/python GPT_SoVITS/prepare_datasets/3-get-semantic.py
   
   # rename per-part files (因 all_parts=1)
   mv logs/<exp>/2-name2text-0.txt logs/<exp>/2-name2text.txt
   mv logs/<exp>/6-name2semantic-0.tsv logs/<exp>/6-name2semantic.tsv
   ```
3. **SoVITS train**: epoch = `5400 * batch_size / corpus_size` (對齊 Eric step)
4. **GPT train**: 15 epoch (per April Eric)
   - 用 `gsv-v2final-pretrained/s1bert25hz-5kh-...` (v2 vocab 732),別用 2kh-longer (v1 vocab 512)
   - config 加 `train_semantic_path` + `train_phoneme_path` keys(s1longer-v2.yaml template 漏掉)
5. **Deploy:**
   - Half weights 從 `SoVITS_weights_v2Pro/` 跟 `GPT_weights_v2Pro/` 抓
   - 加進 voices.yaml,version: v2Pro
   - Gateway auto-reload(5 秒)

完整 working script 範例: `/tmp/ahong_train.sh` on pod

### RVC 訓練

1. **Slice + preprocess** wav to 40k mono
2. **Feature extraction** (HuBERT + f0)
3. **Train RVC v2** (`/workspace/RVC-train`):
   ```bash
   python infer/modules/train/train.py \
     -e <exp> -sr 40k -f0 1 -bs 4 -g 0 \
     -te 20 -se 5 -l 1 -c 0 -sw 1 -v v2 \
     -pg assets/pretrained_v2/f0G40k.pth \
     -pd assets/pretrained_v2/f0D40k.pth
   ```
4. **Build index** (faiss):
   ```bash
   python tools/infer/train-index-v2.py  # 改 inp_root 指向你的 logs/<exp>/3_feature768
   ```
5. **Deploy:**
   - `cp <exp>_e<N>_s<M>.pth /app/models/custom_voices/rvc/<name>/model.pth`
   - `cp added_*.index /app/models/custom_voices/rvc/<name>/model.index`
   - voices.yaml 加 `type: rvc_pipeline` 設定

### Patches & deps installed on pod(別忘了)

- `matplotlib 3.8.4` (3.10 + numpy 2.x 移除 `tostring_rgb`,RVC utils.py 已 patch 改用 `frombuffer(buffer_rgba())`)
- `scipy, tensorboardX, tensorboard, librosa, pyworld, faiss-cpu` 都裝過(`pip install --break-system-packages`)
- Gateway venv 額外 `librosa numpy`(voice_convert 用 pyin)

---

## Quick Reference

### Paths(pod)

```
/app/gateway/main.py                                  Gateway FastAPI
/app/gateway/voices.yaml                              Voices config (auto-reload)
/app/models/custom_voices/gptsovits/<voice>/          TTS weights deploy
/app/models/custom_voices/rvc/<voice>/                RVC weights deploy (model.pth + optional model.index)
/app/GPT-SoVITS/                                      GPT-SoVITS source + training
/app/GPT-SoVITS/SoVITS_weights_v2Pro/                 half_weights auto-save 到這
/app/GPT-SoVITS/GPT_weights_v2Pro/                    half_weights auto-save 到這
/workspace/data/configs/voices.yaml                   Symlinked to /app/gateway/voices.yaml
/workspace/data/ahong_slices/, wing_sliced/, eric_maleA/   Training corpora
/app/venvs/gpt-sovits/bin/python                      正確 python (有 transformers, librosa 等)
/app/venvs/gateway/bin/python                         Gateway python
```

### Paths(Mac SSD)

```
/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/
├── eric_gpt_e15.ckpt                155 MB Eric GPT(MD5 685808...)
├── eric_sovits_e100_s5400.pth       85 MB  Eric SoVITS half_weights ⭐ production 用
├── eric_sovits_v2pro_final.pth      951 MB Eric SoVITS full ckpt ❌ 別載
├── eric_models.tar.gz               1 GB   原始 training package
└── wing_sovits_backup_20260529/     Wing v1 ckpts (e1-e8 GPT + SoVITS)
```

### Supervisor 控制

```bash
ssh wing 'supervisorctl -s unix:///tmp/supervisor.sock status'
ssh wing 'supervisorctl -s unix:///tmp/supervisor.sock restart gateway'  # 只重啟 gateway,workers 不動
```

### API 範例

```bash
# TTS
curl -X POST https://9vjktvfw20sxzs-80.proxy.runpod.net/v1/audio/speech \
  -H "Authorization: Bearer onyx-eric-key-2024" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","voice":"eric","input":"你好","response_format":"wav"}' \
  -o out.wav

# Voice convert (RVC, audio in → audio out)
curl -X POST https://9vjktvfw20sxzs-80.proxy.runpod.net/v1/audio/voice_convert \
  -H "Authorization: Bearer onyx-eric-key-2024" \
  -F "audio=@my_recording.wav" \
  -F "target_voice=eric_rvc" \
  -F "response_format=wav" \
  -o eric_version.wav
# Response headers: X-Pitch-Shift, X-Input-F0-Hz
```

---

## Memory Files Index (for AI agents)

讀這些 memory files 完整理解專案:

| File | Topic |
|---|---|
| `MEMORY.md` | Index of all memory |
| `feedback_gpt_sovits_use_half_weights_not_full_ckpt.md` | 🔥 BLOCKING: half_weights rule |
| `feedback_rvc_real_audio_in_not_tts_chain.md` | 🔥 BLOCKING: RVC input rule |
| `feedback_follow_docs_search_first.md` | DOCS first → web search → no improv |
| `feedback_must_read_master_guide_before_action.md` | Read VOICE_AI_MASTER_GUIDE first |
| `feedback_persistent_memory_obligation.md` | Save everything to memory immediately |
| `feedback_tts_taiwan_accent.md` | No mainland accent for Onyx voices |
| `reference_runpod.md` | Pod API key + volume |
| `reference_voice_deployments.md` | Production voice configs |
| `reference_gpt_sovits_training_official_params.md` | Official train params |
| `reference_gateway_voice_convert_endpoint.md` | voice_convert API spec |
| `reference_tts_smart_wrapper.md` | Smart wrapper logic (long-text safe) |
| `project_eric_rvc_v1.md` | Eric RVC ckpts + deployment |
| `project_wing_cv3_positioning.md` | Wing v3/v4 training history |
| `project_ahong_v1_deployed.md` | 阿宏 v1 (2026-05-31 success) |
| `project_voice_training_lessons.md` | Eric/Wing/阿宏 training lessons |
| `user_eric_yang_rihan.md` | Eric voice actor info |
| `reference_male_voice_recording_sow.md` | 60 min supplementary recording SOW |
| `reference_voice_onboarding_sop.md` | Onyx Studios voice onboarding SOP |

---

## What's NOT done(下一個工程師接手清單)

1. ⚠️ **Wing 長句 cutoff** — 真正解是收 對話型粵語 corpus 或上商業粵語 TTS
2. ⚠️ **`/admin/sovits` 還沒做 voice CRUD UI** — 目前只能 ssh 改 voices.yaml,沒辦法在後台新增 voice
3. ⚠️ **upload audio for new voice training UI** — 客戶上傳音檔 → trigger 訓練 workflow,完全沒做
4. ⚠️ **Wing v5 訓完還沒驗證**(2026-05-31 凌晨剛訓,需要 listen test)
5. ⚠️ **CV3 線**(Higgs Audio v2 / Chatterbox 等實驗)未啟動,在 master guide Phase B/C
6. ⚠️ **路易士 60 min 補錄** 還沒交件(等到了重訓 Eric v2 with more tone variety)

---

## Contact

- **User:** WingAI(roughxcase@gmail.com)
- **Voice talent contact:** 路易士(Louis)recording engineer
- **Live pod:** `9vjktvfw20sxzs` EU-SE-1 RunPod(別停別刪)
- **Volume:** `0xx2d4ptz2 implicit_tan_marsupial` EU-SE-1 100 GB(別刪)
