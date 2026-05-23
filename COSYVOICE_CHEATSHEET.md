# CosyVoice 通透備忘錄 — Onyx 自用,別再踩坑

> 讀過官方 README.md / example.py / FAQ.md / tokenizer.py / common.py 後寫的
> 為什麼別人 demo 那麼好,我們做出來像越南腔?幾乎全是這份沒讀。

---

## 🚨 必踩坑 — 已經踩過的,**永遠別再踩**

### #1 `text_frontend=False` 一定要設!

官方 [example.py](https://github.com/FunAudioLLM/CosyVoice/blob/main/example.py) 的 cosyvoice2_example 第一行 NOTE 寫明:

```python
# NOTE if you want to reproduce the results on https://funaudiollm.github.io/cosyvoice2,
# please add text_frontend=False during inference
```

**沒設 → wetext 文本正規化把你的字搞爛 → 念出來變日文/越南腔/亂碼。**

server.py 寫法:
```python
cosyvoice.inference_zero_shot(text, prompt_text, ref_wav, stream=False, text_frontend=False)
```

### #2 粵語不能用 zero_shot,要用 instruct2 + 指令

**錯誤(我們之前的做法):**
```python
cosyvoice.inference_zero_shot("今日嘅天氣", "粵語逐字稿", "wing.wav")  # 念不出粵語
```

**正確 — CosyVoice2 用 cross_lingual + 語言 tag:**
```python
cosyvoice.inference_cross_lingual("<|yue|>今日嘅天氣", "wing.wav")
```

支援的語言 tag(在 text 開頭):
| Tag | 語言 |
|---|---|
| `<|zh|>` | 中文(普通話) |
| `<|en|>` | English |
| `<|ja|>` | 日語 |
| `<|yue|>` | 粵語 |
| `<|ko|>` | 韓語 |

**CosyVoice3 用 instruct2 + 自然語言指令(更強):**
```python
cosyvoice.inference_instruct2(
    "今日嘅天氣相當唔錯。",
    "You are a helpful assistant. 请用广东话表达。<|endofprompt|>",
    "wing.wav"
)
```

### #3 用 `AutoModel` 不是 `CosyVoice2`

官方 API:
```python
from cosyvoice.cli.cosyvoice import AutoModel
cv = AutoModel(model_dir='pretrained_models/CosyVoice2-0.5B')
```

不要直接 `from cosyvoice.cli.cosyvoice import CosyVoice2`(雖然也行,但 API 不穩定)。

### #4 Reference transcript 跟 audio 一定要一字不漏對齊

`prompt_text` 是 reference wav 的逐字稿,不對齊 → speaker embedding 飄掉:
- 連口頭禪「嗯」「啊」「呃」都要寫
- 停頓處要對應的逗號
- 不准筆誤、漏字、多字

### #5 Fine-tune 容易 overfit

- 50 分鐘資料 + lr=1e-5 → epoch_1 就到頂,epoch_2+ 開始 overfit
- 從已 fine-tune 過的 checkpoint 繼續訓 → 變更爛(我們踩了 2 次)
- **永遠從 vanilla pretrained 開始 fine-tune**

### #6 訓練 checkpoint 不能直接當 inference llm.pt

訓練存的 `epoch_N_whole.pt` 含 `epoch` / `step` metadata key。推論載入會 fail:
```
RuntimeError: Error(s) in loading state_dict: Unexpected key(s) "epoch", "step"
```

**要剝乾淨才能 deploy:**
```python
ckpt = torch.load(src)
clean = {k:v for k,v in ckpt.items() if k not in ['epoch','step','lr','optimizer','scheduler','tag','time']}
torch.save(clean, dst)
```

### #7 RunPod SSH 斷線會殺 nohup,要用 tmux

```bash
# ❌ 這個會死
nohup python train.py > log 2>&1 & disown

# ✅ 這個會活
tmux new-session -d -s ft 'python train.py > log 2>&1'
```

### #8 Sliding Window Attention warning 要處理

啟動 log 看到:
```
Sliding Window Attention is enabled but not implemented for `sdpa`;
unexpected results may be encountered.
```

修法:把 model config 的 SWA 關掉
```bash
# /workspace/CosyVoice/pretrained_models/CosyVoice2-0.5B/CosyVoice-BlankEN/config.json
"sliding_window": null,
"use_sliding_window": false,
```

### #9 fp16=True 影響短文輸出穩定性

CosyVoice2 weights 是 fp16/bf16 訓的。`fp16=False`(fp32 推論)會讓短文輸出歪。
```python
cosyvoice = CosyVoice2(model_dir, load_jit=False, load_trt=False, fp16=True)
```

### #10 Pod port 沒 expose 8080,要用 8888(Jupyter 那個 port)

RunPod 開 pod 時只 expose 了 8888(Jupyter)。server.py 在 8080 跑 → proxy 打不到 → 502。
**改 server.py:`uvicorn.run(..., port=8888)`** 借用 Jupyter 那個 port。

下次開 pod **記得 expose port 8080**。

---

## 📚 完整 inference 模式表

CosyVoice 有 5 種模式,**用錯模式 = 結果一定爛**:

| 模式 | 用途 | 範例 |
|---|---|---|
| `inference_sft` | 內建 voice (中文男/中文女) | `('hello', '中文女')` |
| `inference_zero_shot` | 給 reference + transcript clone | `('text', 'ref text', 'ref.wav')` |
| `inference_cross_lingual` | 跨語言 / 同 reference 念別的語言 | `('<|en|>hello', 'ref.wav')` |
| `inference_instruct2` | 自然語言指令(語言、情緒、語速) | `('text', '请用广东话表达。<|endofprompt|>', 'ref.wav')` |
| `inference_vc` | Voice conversion(source → target) | `(source.wav, target_speaker.wav)` |

---

## 🏷️ Fine-grained control tags(在 text 內加)

CosyVoice2 支援:
- `[laughter]` 或 `<laughter>...</laughter>` — 笑聲
- `[breath]`, `[quick_breath]` — 換氣
- `<strong>...</strong>` — 重音
- `[cough]`, `[clucking]`, `[accent]`, `[noise]`, `[sigh]`, `[hissing]`
- `[lipsmack]`, `[mn]`, `[vocalized-noise]`

範例:
```
"在他講述那個荒誕故事的過程中,他突然[laughter]停下來,因為他自己也被逗笑了[laughter]。"
"在面對挑戰時,他展現了非凡的<strong>勇氣</strong>與<strong>智慧</strong>。"
```

---

## 🌏 Instruct2 支援的方言(common.py 內建)

```
请用广东话表达 / 请用东北话表达 / 请用甘肃话表达 / 请用贵州话表达
请用河南话表达 / 请用湖北话表达 / 请用湖南话表达 / 请用江西话表达
请用闽南话表达 / 请用宁夏话表达 / 请用山西话表达 / 请用陕西话表达
请用山东话表达 / 请用上海话表达 / 请用四川话表达 / 请用天津话表达
请用云南话表达
```

用法:
```python
cosyvoice.inference_instruct2(
    "句子內容",
    "You are a helpful assistant. 请用广东话表达。<|endofprompt|>",
    "ref.wav"
)
```

還有非方言指令:
- "Please say a sentence as loudly as possible.<|endofprompt|>"
- "请用尽可能快地语速说一句话。<|endofprompt|>"
- 情緒 / 語氣 等

---

## 💾 Save speaker for reuse(避免每次傳 reference)

```python
# 第一次:存起來
cosyvoice.add_zero_shot_spk('prompt transcript', './ref.wav', 'my_voice_id')
cosyvoice.save_spkinfo()

# 之後:用 id 即可,不用每次傳 wav
cosyvoice.inference_zero_shot('要合成的文字', '', '', zero_shot_spk_id='my_voice_id')
```

這個比每次重 load reference 快很多,production 應該用這個。

---

## 🆕 升級到 CosyVoice 3(強烈推薦!)

官方 README 第一句寫:

> **We strongly recommend using `Fun-CosyVoice3-0.5B` for better performance.**

| Model | 中文 CER ↓ | Speaker Sim ↑ |
|---|---|---|
| CosyVoice2-0.5B | 1.45 | 75.7 |
| **Fun-CosyVoice3-0.5B-2512** | **1.21** | **78.0** |
| **Fun-CosyVoice3-0.5B-2512_RL** | **0.81** | 77.4 |

CosyVoice3 比 CosyVoice2 **快 2 倍精準**,而且原生支援 18+ 中文方言(含粵語、四川話、上海話...)。

**下載:**
```python
from huggingface_hub import snapshot_download
snapshot_download('FunAudioLLM/Fun-CosyVoice3-0.5B-2512',
                  local_dir='pretrained_models/Fun-CosyVoice3-0.5B')
```

**用法跟 CosyVoice2 一樣**,改 `model_dir` 即可:
```python
cosyvoice = AutoModel(model_dir='pretrained_models/Fun-CosyVoice3-0.5B')
```

---

## 🛠️ ttsfrd vs wetext(中文文本正規化器)

**ttsfrd** 是官方更好的中文 frontend,比 wetext 強很多。但需要額外安裝:

```bash
git clone https://www.modelscope.cn/iic/CosyVoice-ttsfrd.git pretrained_models/CosyVoice-ttsfrd
cd pretrained_models/CosyVoice-ttsfrd/
unzip resource.zip -d .
pip install ttsfrd_dependency-0.1-py3-none-any.whl
pip install ttsfrd-0.4.2-cp310-cp310-linux_x86_64.whl
```

裝了之後,CosyVoice 自動偵測並用 ttsfrd。**但用 `text_frontend=False` 兩個都會 skip**。

---

## 🚀 部署選項

| 方式 | 優點 | 加速 |
|---|---|---|
| FastAPI (`runtime/python/fastapi`) | 簡單,Python only | 1x |
| gRPC (`runtime/python/grpc`) | 多 client / async | 1x |
| vLLM (vllm_example.py) | LLM 推論加速 | ~3x |
| **TensorRT-LLM** (`runtime/triton_trtllm`) | **官方推薦,最快** | **4x** |

我們現在用簡單 FastAPI。Production 之後可以考慮 TensorRT-LLM。

---

## 🐛 Hotfix:多音字 / 讀錯字 用 Pinyin 強制

CosyVoice3 支援用拼音強制正確發音:
```
'高管也通过电话、短信、微信等方式对报道[j][ǐ]予好评。'
                                    ↑     ↑
                                  jiyu 的「給」要念成 jǐ(才不會念成 gěi)
```

中文有破音字,production 配音必備這個。

---

## 📝 日文要轉片假名

CosyVoice3 念日文時,**必須先把漢字轉成片假名**:

```
原文(會念錯):
歴史的世界においては、過去は単に過ぎ去ったものではない、プラトンのいう如く非有が有である。

轉成片假名(正確):
レキシ テキ セカイ ニ オイ テ ワ、カコ ワ タンニ スギサッ タ モノ デ ワ ナイ、
プラトン ノ イウ ゴトク ヒ ユー ガ ユー デ アル。
```

---

## ✅ Onyx 標準 server.py 應該長這樣(關鍵設定)

```python
from cosyvoice.cli.cosyvoice import AutoModel
import torchaudio

# Init
cv = AutoModel(model_dir='pretrained_models/Fun-CosyVoice3-0.5B')  # 用 V3!
SAMPLE_RATE = cv.sample_rate

# Synth — 普通中文
def synth_zh(text, ref_wav, ref_text):
    for j in cv.inference_zero_shot(
        text, ref_text, ref_wav,
        stream=False,
        text_frontend=False  # ← 一定要設
    ):
        return j['tts_speech']

# Synth — 粵語
def synth_yue(text, ref_wav):
    instruct = 'You are a helpful assistant. 请用广东话表达。<|endofprompt|>'
    for j in cv.inference_instruct2(
        text, instruct, ref_wav,
        stream=False, text_frontend=False
    ):
        return j['tts_speech']

# Synth — 英文
def synth_en(text, ref_wav):
    for j in cv.inference_cross_lingual(
        f'<|en|>{text}', ref_wav,
        stream=False, text_frontend=False
    ):
        return j['tts_speech']
```

---

## 📚 看過的官方資源

- [README.md](https://github.com/FunAudioLLM/CosyVoice/blob/main/README.md)
- [example.py](https://github.com/FunAudioLLM/CosyVoice/blob/main/example.py)
- [FAQ.md](https://github.com/FunAudioLLM/CosyVoice/blob/main/FAQ.md)
- [Demos](https://funaudiollm.github.io/cosyvoice2/)、[CV3 Demos](https://funaudiollm.github.io/cosyvoice3/)
- [CosyVoice 2 Paper](https://arxiv.org/pdf/2412.10117)
- [CosyVoice 3 Paper](https://arxiv.org/pdf/2505.17589)
- tokenizer.py:tokenizer special tokens
- common.py:instruct list (方言指令)

---

## 🎯 Onyx 上線 checklist

下次重新部署時對著這份做:

- [ ] 用 **Fun-CosyVoice3-0.5B**(不要再用 CosyVoice2-0.5B)
- [ ] 開 pod 時 **expose port 8080**
- [ ] 安裝 **ttsfrd**(雖然用 `text_frontend=False` 也能跑,但 ttsfrd 更穩)
- [ ] server.py 用 `AutoModel`,`fp16=True`,`text_frontend=False`
- [ ] Reference transcript 對齊到一字不漏
- [ ] 粵語用 `inference_instruct2` 不要用 `zero_shot`
- [ ] 模型 / 訓練 / 啟動全部用 **tmux** 不是 nohup
- [ ] SWA `sliding_window=null`(config.json 改一下)
- [ ] Fine-tune 永遠從 vanilla pretrained 開始,**不要從 fine-tuned 繼續訓**
- [ ] Fine-tune checkpoint 部署前要 strip metadata key
