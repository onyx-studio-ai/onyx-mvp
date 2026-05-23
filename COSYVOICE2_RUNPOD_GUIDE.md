# CosyVoice 2 on RunPod — Onyx 部署指南

> 寫給 Wing。Step-by-step，照著做就能跑起來。
> 預計 90 分鐘從零部署到能 call API。

## 為什麼選 RunPod

- 不用買 GPU 硬體
- 按小時計費（~$0.50/hr A5000，月費約 $360 if always-on）
- 可以隨時關機停費
- 美國伺服器，全球延遲 OK

---

## 階段 0：準備

### 你需要的帳號
- RunPod (https://runpod.io) — 信用卡儲值 $50 起步
- HuggingFace (https://huggingface.co) — 免費，下載 CosyVoice 2 model 用

### 你需要的本地檔案（你已有）
- `Eric Ref.wav` — 5-15 秒情緒中性 reference audio
- 一段對應的中文逐字稿
- 粵語 1-2 小時精選資料（之後 fine-tune 用，第一階段不需要）

---

## 階段 1：開 RunPod Pod（15 分鐘）

### 1.1 註冊 + 儲值

1. 開 https://runpod.io → Sign Up
2. 左側 menu → **Billing** → **Add Funds** → 儲 $50（夠跑 100 小時 A5000）
3. 設定 2FA（建議）

### 1.2 選 GPU + 開 Pod

1. 左側 menu → **Pods** → **+ Deploy**
2. 選 GPU：
   - **推薦**：RTX A5000 (24GB VRAM) — $0.36/hr
   - 預算多：RTX 4090 (24GB) — $0.69/hr
   - 預算少：RTX 3090 (24GB) — $0.22/hr — **這個夠用！**
3. 選 Pod Template：
   - 搜尋 `"PyTorch 2.4"` 或 `"PyTorch 2.1 + cu121"`
   - 選有 `Jupyter` + `Web Terminal` 的
4. 設定：
   - **Pod Name**: `onyx-cosyvoice2`
   - **Volume**: 50GB（裝 model + 訓練資料夠用）
   - **Container Disk**: 50GB
   - **Expose Ports**: 8080 (API), 8888 (Jupyter)
5. 點 **Deploy On-Demand**

### 1.3 Pod 起來後

- 等 1-3 分鐘
- 點 pod → **Connect** → 選 **Start Web Terminal** 或 **Connect to Jupyter Lab**

---

## 階段 2：安裝 CosyVoice 2（20 分鐘）

進入 Web Terminal，依序執行：

### 2.1 Clone repo

```bash
cd /workspace
git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git
cd CosyVoice
```

### 2.2 裝 Python 環境

```bash
# 用 conda（環境較乾淨）
conda create -n cosyvoice python=3.10 -y
conda activate cosyvoice

# 或直接 pip（簡單）
pip install -r requirements.txt
pip install modelscope huggingface_hub

# 額外需要的 audio 工具
apt-get install -y sox libsox-dev ffmpeg
```

### 2.3 下載 base model

CosyVoice 2 有兩個 size：
- **CosyVoice2-0.5B** — 小、快、品質 OK（推薦先用這個）
- **CosyVoice2-300M** — 更小、更快、品質略遜

```bash
# 方法 1：從 HuggingFace 下載（推薦）
huggingface-cli download FunAudioLLM/CosyVoice2-0.5B --local-dir pretrained_models/CosyVoice2-0.5B

# 方法 2：從 ModelScope 下載（中國 mirror，更快）
# pip install modelscope
# python -c "from modelscope import snapshot_download; snapshot_download('iic/CosyVoice2-0.5B', local_dir='pretrained_models/CosyVoice2-0.5B')"
```

下載約 2-3 GB，等 5-10 分鐘。

---

## 階段 3：測試 Zero-shot（10 分鐘）

### 3.1 上傳 Eric Ref.wav 到 pod

從本地電腦：

```bash
# 在你 Mac 上跑（替換 POD_SSH 為 RunPod 給你的 SSH 連線資訊）
scp "Eric Ref.wav" root@POD_SSH:/workspace/CosyVoice/

# 或用 Web Terminal 的 upload 按鈕（更簡單）
```

### 3.2 寫測試 Python script

在 Web Terminal：

```bash
cd /workspace/CosyVoice
nano test_eric.py
```

貼入：

```python
import sys
sys.path.append('third_party/Matcha-TTS')
from cosyvoice.cli.cosyvoice import CosyVoice2
from cosyvoice.utils.file_utils import load_wav
import torchaudio

# 載入 base model
cosyvoice = CosyVoice2('pretrained_models/CosyVoice2-0.5B', load_jit=False, load_trt=False, fp16=False)

# Eric reference
prompt_speech_16k = load_wav('Eric Ref.wav', 16000)
prompt_text = "專業運動鞋搭載最新避震科技，能有效減輕跑步時對膝蓋產生的衝擊力。"

# Test 1: Zero-shot 中性
texts = [
    "您好，這是 Onyx Studios 的 Eric，今天為您介紹凡音文化的全新配音服務。",
    "史無前例的震撼折扣，精選商品全面對折回饋，請立即拿起電話完成預購。",
    # Test instruction control
    "<嘆息>他終於走了。",
    "<興奮>哇！你竟然真的來了！",
]

for i, text in enumerate(texts):
    for j, j_audio in enumerate(cosyvoice.inference_zero_shot(text, prompt_text, prompt_speech_16k, stream=False)):
        torchaudio.save(f'eric_test_{i}_{j}.wav', j_audio['tts_speech'], cosyvoice.sample_rate)
        print(f'✅ Generated eric_test_{i}_{j}.wav')
```

跑：

```bash
python test_eric.py
```

### 3.3 下載結果聽

```bash
# 在 pod 上把 wav 移到一個 public folder
mv eric_test_*.wav /workspace/

# 從 Mac 下載
scp root@POD_SSH:/workspace/eric_test_*.wav .
```

或用 Jupyter Lab 直接 download。

**聽看看品質**：
- 跟你 GPT-SoVITS 訓 1 小時的 Eric 比
- 跟 ElevenLabs V3 的 PVC Eric 比
- 情緒 instruction 有效嗎？

---

## 階段 4：API 化（30 分鐘）

讓 CosyVoice 2 變成 REST API，Onyx 平台可以 call。

### 4.1 寫簡單 FastAPI server

```bash
pip install fastapi uvicorn python-multipart

cd /workspace/CosyVoice
nano server.py
```

貼入：

```python
import sys, os, io
sys.path.append('third_party/Matcha-TTS')
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from cosyvoice.cli.cosyvoice import CosyVoice2
from cosyvoice.utils.file_utils import load_wav
import torchaudio
import torch

app = FastAPI()

# 啟動時載入 model（避免每次 request 重 load）
print("Loading CosyVoice 2...")
cosyvoice = CosyVoice2('pretrained_models/CosyVoice2-0.5B', load_jit=False, load_trt=False, fp16=False)
print("✅ Model loaded")

# Eric reference（預先載入）
ERIC_REF_AUDIO = load_wav('Eric Ref.wav', 16000)
ERIC_REF_TEXT = "專業運動鞋搭載最新避震科技，能有效減輕跑步時對膝蓋產生的衝擊力。"

class SynthRequest(BaseModel):
    text: str
    voice: str = "eric"  # 之後可加更多 voice
    instruction: str = ""  # optional emotion instruction

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/synthesize")
def synthesize(req: SynthRequest):
    if req.voice != "eric":
        raise HTTPException(status_code=400, detail=f"Unknown voice: {req.voice}")
    
    # 組合 instruction
    text = f"<{req.instruction}>{req.text}" if req.instruction else req.text
    
    # 生成
    audio_buffer = io.BytesIO()
    for result in cosyvoice.inference_zero_shot(text, ERIC_REF_TEXT, ERIC_REF_AUDIO, stream=False):
        torchaudio.save(audio_buffer, result['tts_speech'], cosyvoice.sample_rate, format='wav')
        break  # 只取第一段
    
    audio_buffer.seek(0)
    return StreamingResponse(audio_buffer, media_type="audio/wav")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

### 4.2 啟動 server

```bash
python server.py
```

應該看到：
```
INFO:     Uvicorn running on http://0.0.0.0:8080
```

### 4.3 用 RunPod public URL 對外 expose

RunPod pod 詳細頁 → **Connect** → 找 **HTTP Services** → 應該看到 port 8080 的 public URL，類似：
```
https://abc123-8080.proxy.runpod.net
```

### 4.4 測試 API

從本地 Mac：

```bash
curl -X POST "https://abc123-8080.proxy.runpod.net/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text": "您好，我是 Eric，歡迎來到 Onyx Studios", "voice": "eric", "instruction": "興奮"}' \
  --output eric_api_test.wav
```

聽 eric_api_test.wav — 如果有聲音 = API 通了 ✅

---

## 階段 5：給 Claude（我）接 Onyx 平台

把 RunPod 給的 URL 丟給我：

```
https://abc123-8080.proxy.runpod.net
```

我會：
- 寫 `/api/voice/cosyvoice/synthesize` Onyx endpoint
- 加 cache（同樣 text + voice 不重打 API）
- 加 rate limit（防濫用）
- 加 admin voice usage 儀表板
- 串到客戶試聽 UI

---

## 階段 6：粵語 fine-tune（之後做，1 週後）

### 6.1 準備資料

粵語 10 小時 → 篩選 1-2 小時 diverse 段落：

```
建議分佈：
  陳述句 30%
  疑問句 15%
  感嘆句 10%
  對話 20%
  旁白 15%
  情緒多樣（happy, sad, angry, neutral, urgent, calm）10%
```

切成 5-15 秒 segments，每段一個 .wav。

### 6.2 寫 manifest 檔

```
wav1.wav|你今日食咗飯未啊？
wav2.wav|呢個價錢真係太貴喇！
wav3.wav|希望你過得開心。
...
```

### 6.3 跑 fine-tune

```bash
cd /workspace/CosyVoice

python tools/extract_embedding.py --dir data/wing_cantonese --onnx_path pretrained_models/CosyVoice2-0.5B/campplus.onnx

# 訓練（GPU 跑 4-8 小時）
python cosyvoice/bin/train.py \
    --config config/cosyvoice2.yaml \
    --train_data data/wing_cantonese/train.list \
    --dev_data data/wing_cantonese/dev.list \
    --model_dir checkpoints/wing_cantonese \
    --pretrained_model pretrained_models/CosyVoice2-0.5B
```

訓練完成 → 你就有「粵語 Wing」 voice 可以 inference。

---

## 預計成本

| 階段 | 時間 | GPU 費用 |
|---|---|---|
| 部署 + 安裝 | 1 小時 | ~$0.50 |
| Eric zero-shot 測試 | 1 小時 | ~$0.50 |
| API 啟動 | 持續 | $360/月 24x7 |
| 粵語 fine-tune | 4-8 小時 | ~$3-6 |

**業務跑起來前**：先**按需開關** pod，不用 24x7。每次測試 1 小時 = $0.50。

**業務開始後**：always-on $360/月（這時應該已經回本）。

---

## Known Issues + Fix

### Issue 1：`/synthesize` 回 HTTP 500，traceback 結尾是 `TypeError: Invalid file: tensor([[-0.0027, ...]])`

**症狀**
- `/upload_reference` 200 OK、`/voices` 200 OK，但 `/synthesize` 一律 500。
- Server log 最底一行：
  ```
  TypeError: Invalid file: tensor([[-0.0027, -0.0044, ...]])
  ```
  往上看 traceback 經過：
  `server.py:124 → cosyvoice/cli/cosyvoice.py:96 → frontend.py:172 → frontend.py:121 → file_utils.py:45 → torchaudio/_backend/soundfile.py:27 → soundfile.py:1212`

**根因**
這個版本的 `cosyvoice/cli/frontend.py` 裡，`_extract_spk_embedding` 跟 `_extract_speech_feat` 都對 `prompt_wav` 直接呼叫 `load_wav(prompt_wav, 16000 or 24000)` — 也就是 **期待傳路徑字串**，而不是 tensor。

但範本 server.py 寫成：
```python
prompt_speech = load_wav(str(wav_path), 16000)  # ← 先 load 成 tensor
cosyvoice.inference_zero_shot(text, prompt_text, prompt_speech, stream=False)
```
tensor 傳進 frontend → frontend 再 `torchaudio.load(tensor)` → 炸。

**修法（1 行）**
`/workspace/CosyVoice/server.py` 的 `/synthesize`：
- 刪掉 `prompt_speech = load_wav(str(wav_path), 16000)` 那行。
- `inference_zero_shot` 第三個參數改傳 `str(wav_path)`：
```python
for result in cosyvoice.inference_zero_shot(
    text, prompt_text, str(wav_path), stream=False
):
```

**一鍵 patch（在 RunPod terminal）**
```bash
cd /workspace/CosyVoice
cp server.py server.py.bak
python3 - <<'EOF'
import re
p = open("server.py").read()
p = re.sub(r'\s*prompt_speech = load_wav\(str\(wav_path\), 16000\)\n', '\n', p)
p = p.replace(
    "cosyvoice.inference_zero_shot(text, prompt_text, prompt_speech, stream=False)",
    "cosyvoice.inference_zero_shot(text, prompt_text, str(wav_path), stream=False)",
)
open("server.py", "w").write(p)
print("patched")
EOF
diff server.py.bak server.py
```

**重啟 server**
```bash
pkill -f "python.*server.py"
cd /workspace/CosyVoice
nohup /workspace/miniconda3/envs/cosyvoice/bin/python server.py \
  > /workspace/cosyvoice-server.log 2>&1 &
sleep 30 && tail -20 /workspace/cosyvoice-server.log
```
看到 `Uvicorn running on http://0.0.0.0:8080` 就是好了，回後台再點 Generate 測。

---

### Issue 2：`bash: conda: command not found`

Pod 重開後 shell 沒 source conda init。兩個解法擇一：

```bash
# 解法 A：每次 terminal 開新的就先 source 一次
source /workspace/miniconda3/etc/profile.d/conda.sh
conda activate cosyvoice

# 解法 B：直接用絕對路徑跑 python（最穩，腳本裡推薦）
/workspace/miniconda3/envs/cosyvoice/bin/python server.py
```

---

### Note：本文件範本 server.py vs 實際部署的差異

階段 4 的 server.py 範本是**單 voice (Eric)** 早期版本。實際部署在 RunPod 上跑的是**多 voice 擴充版**，多了 `/upload_reference` 跟 `/voices` 兩個 endpoint，邏輯不同。

重建環境時：**用 RunPod 上現有的 `/workspace/CosyVoice/server.py` 為準**，不要照本文件階段 4 抄。或先 `cp server.py server.py.fresh` 備好一份能用的版本到 repo 裡。

---

## 卡關時找我

任何 step 卡住 → 截圖或貼錯誤訊息給我，我立刻 debug。
