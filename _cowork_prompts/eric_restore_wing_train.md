# Cowork Mission — Eric 復活 + Wing 雙引擎 fine-tune (CV3 + GPT-SoVITS v2Pro)

> 給 Cowork Claude:這是一個 self-contained 任務,完成後 Onyx Studios 後台要同時有:
> - **CV3 Wing(粵語 fine-tune)** 在 admin/voices(現有 CV3 pod)
> - **GPT-SoVITS Wing + Eric** 在 admin/sovits(新 GPT-SoVITS pod,有 RVC voice conversion)
>
> 預估總時長 6-10 小時(兩個訓練平行跑可以省 3 小時)。
> 客戶端是 Mac(macOS),要用 computer-use MCP + Terminal SSH 操作 RunPod pods。
>
> **架構:兩台 pod 平行作業**
> - **Pod 1 — CV3 pod `7k8u5nzkzs9xpa` (gothic_plum_flea)**:已存在,跑 CV3 + Eric refs。任務:**fine-tune CV3 Wing 粵語版**
> - **Pod 2 — 新 GPT-SoVITS pod**(user 用 template + volume 剛 deploy):任務:**Eric 從本機備份復活 + Wing GPT-SoVITS v2Pro fine-tune**

---

## 🎯 最終交付

完成時必須四件事都對:
1. **CV3 Wing**(粵語 fine-tuned voice)上線在 `7k8u5nzkzs9xpa-8888.proxy.runpod.net`,admin/voices 看得到
2. **GPT-SoVITS Eric** 復活在新 pod,做 TTS + voice conversion
3. **GPT-SoVITS Wing**(zh-hk fine-tuned)上線在新 pod,跟 Eric 並列
4. 三組權重全部 rsync 備份到本機(Wing CV3 / Wing GPT-SoVITS / Eric 已備份)

---

## 📋 前置條件(User Wing 會先做完)

### Pod 1 (CV3) 連線資訊
- **Pod ID**: `7k8u5nzkzs9xpa` (gothic_plum_flea)
- **HTTP endpoint**: `https://7k8u5nzkzs9xpa-8888.proxy.runpod.net`
- **SSH**: 從 RunPod console Connect 頁撈
- **狀態**: User 會先 **Start** 這台(目前 Stopped)

### Pod 2 (新 GPT-SoVITS) 連線資訊 — User 提供
- **新 pod ID** (e.g. `xyz12345abcde`)
- **HTTP endpoint URL** (e.g. `https://xyz12345abcde-80.proxy.runpod.net`)
- **SSH 連線**:`root@<POD_ID>.ssh.runpod.io -p <PORT> -i ~/.ssh/id_ed25519`
- **API Bearer token**(沿用舊的 `onyx-eric-key-2024`,template 改過就用實際的)

如果 user 還沒給,先問 user 要這些值,**不要瞎猜**。

---

## 📂 本機關鍵路徑(全部在 WingAI SSD)

```
基地: /Volumes/WingAI SSD/Claude/Projects/工程部/

# Eric 備份權重(已 rename,內容是 GPT-SoVITS v2Pro 訓的)
onyx-platform/eric_gpt_e15.ckpt              # 148 MB — GPT 模組
onyx-platform/eric_sovits_v2pro_final.pth    # 908 MB — SoVITS production 權重
onyx-platform/eric_sovits_e100_s5400.pth     #  81 MB — 早期 SoVITS(備用)
onyx-platform/eric_ref.wav                   # 1.3 MB — Eric reference audio(推論用)
onyx-platform/eric_ref_high.wav              # 1.2 MB — 高品質乾淨版 ref

# Wing 訓練資料
訓練資料/Wing/transcripts/wing_ads_sliced/    # 324 個切片 wav (wing_ads_0001~0324.wav)
                                              # 364 MB,共 34.2 min,zh-hk 粵語廣告
                                              # ⚠️ 用這個資料夾,不是 sliced_ads/(那個是舊命名重複拷貝)
訓練資料/Wing/transcripts/wing_ads_sliced_training.txt  # 324 entries 訓練 filelist
                                              # 格式:<path>|wing|ZH|<text>
                                              # path 已經對齊上面那個資料夾,wav filename 完全 match,不用 patch
                                              # 但 path 是本機絕對路徑,要 patch 成 pod 上的相對位置
訓練資料/Wing/transcripts/wing_ads_proofread_list.txt   # 校對過的 transcript 列表
訓練資料/Wing/Wing/                            # 原始未切音檔(備份用)

# Master Guide(必讀)
onyx-platform/onyx-platform/VOICE_AI_MASTER_GUIDE.md
  → 特別看「絕不再踩清單」+「GPT-SoVITS 踩坑」+「訓練資產 rsync SOP」
```

---

## 🔄 任務 — 兩台 pod 平行作業

> **執行策略**:Phase A(Eric 復活)在 Pod 2 做;Phase B-CV3 跟 Phase B-SoVITS 在不同 pod **平行** 跑(兩個訓練同時開,省 3 小時)。
>
> 推薦順序:
> 1. 先把 Phase A 跑完(30-60 min)
> 2. 同時開兩個 tmux session:
>    - tmux session 1:Pod 1 跑 Phase B-CV3 Wing
>    - tmux session 2:Pod 2 跑 Phase B-SoVITS Wing
> 3. 兩邊都在訓練時,你可以開始準備 Phase C 收尾(更新 config 等)

---

### Phase A — Eric 復活(Pod 2,預估 30-60 分鐘)

#### A.1 SSH 進新 pod,檢查環境
```bash
ssh root@<POD_ID>.ssh.runpod.io -p <PORT> -i ~/.ssh/id_ed25519
cd /workspace
ls -la
# 應該看到 GPT-SoVITS/ 資料夾(template 帶的)
cd GPT-SoVITS
git log -1  # 確認版本
ls GPT_weights* SoVITS_weights* refs/ pretrained_models/ 2>/dev/null
```

#### A.2 檢查 network volume 是否已有舊 Eric 權重
```bash
find /workspace -name "*.ckpt" -o -name "*sovits*.pth" 2>/dev/null | head
```
如果找到舊的 Eric 權重在 volume 裡,**先 backup 再覆蓋**:
```bash
mkdir -p /workspace/_legacy_backup_$(date +%Y%m%d)
mv /workspace/GPT-SoVITS/GPT_weights*/*eric* /workspace/_legacy_backup_$(date +%Y%m%d)/ 2>/dev/null
mv /workspace/GPT-SoVITS/SoVITS_weights*/*eric* /workspace/_legacy_backup_$(date +%Y%m%d)/ 2>/dev/null
```

#### A.3 從本機 rsync 上權重
從本機 macOS Terminal(不是 ssh 進去之後):
```bash
SSH_CMD='ssh -p <PORT> -i ~/.ssh/id_ed25519'
BASE='/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform'
POD='root@<POD_ID>.ssh.runpod.io'

# GPT 模組
rsync -avhP -e "$SSH_CMD" \
  "$BASE/eric_gpt_e15.ckpt" \
  "$POD:/workspace/GPT-SoVITS/GPT_weights_v2Pro/eric_gpt_e15.ckpt"

# SoVITS production 權重(production 用 final,不用 e100_s5400)
rsync -avhP -e "$SSH_CMD" \
  "$BASE/eric_sovits_v2pro_final.pth" \
  "$POD:/workspace/GPT-SoVITS/SoVITS_weights_v2Pro/eric_sovits_v2pro_final.pth"

# Reference audio
rsync -avhP -e "$SSH_CMD" \
  "$BASE/eric_ref.wav" "$BASE/eric_ref_high.wav" \
  "$POD:/workspace/refs/"
```

⚠️ **如果 template 用的目錄結構不同**(例如 `GPT_weights/` 而不是 `GPT_weights_v2Pro/`)— ssh 進 pod 用 `find / -type d -name "*GPT_weights*"` 找正確路徑再 rsync。

#### A.4 設定 voice-ai-platform server 知道有 Eric voice
ssh 進 pod 後:
```bash
cat /workspace/voice-ai-platform/voices.yaml 2>/dev/null || find /workspace -name "voices.yaml" -o -name "voice_config*"
```
編輯設定檔加入 Eric voice 條目(具體格式看 template 本來怎麼寫的):
```yaml
voices:
  eric_warm_slow:
    gpt: /workspace/GPT-SoVITS/GPT_weights_v2Pro/eric_gpt_e15.ckpt
    sovits: /workspace/GPT-SoVITS/SoVITS_weights_v2Pro/eric_sovits_v2pro_final.pth
    ref_audio: /workspace/refs/eric_ref_high.wav
    ref_text: "<Eric ref audio 對應的中文文字 — 從 master guide 或本機 eric_train_data/eric_filelist.txt 撈>"
    language: zh
    default_speed: 0.95
```

⚠️ **ref_text 一定要對** — GPT-SoVITS 用 ref text 做語音 prompt,寫錯念出來會走音。從 `onyx-platform/eric_train_data/eric_filelist.txt` 比對 ref audio 的 filename 找正確 transcript。

#### A.5 啟動 server + 驗證
```bash
cd /workspace/voice-ai-platform  # 或 template 設定的位置
# 通常用 tmux + uvicorn 起服務
tmux new -d -s sovits 'python -m uvicorn main:app --host 0.0.0.0 --port 80 --log-level info > /workspace/sovits.log 2>&1'
sleep 30
tail -50 /workspace/sovits.log
```
看 log 確認模型載入成功、沒有 OOM、Bearer auth 有套用。

從本機 Mac Terminal 測試:
```bash
URL="https://<NEW_POD_ID>-80.proxy.runpod.net"
KEY="onyx-eric-key-2024"

# Health
curl -sS "$URL/health" -H "Authorization: Bearer $KEY"

# TTS
curl -sS -X POST "$URL/v1/audio/speech" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","input":"您好,我是 Onyx Studios 的 Eric。今天測試 GPT-SoVITS v2Pro 復活。","voice":"eric_warm_slow","response_format":"wav"}' \
  -o /tmp/eric_test.wav
afplay /tmp/eric_test.wav   # 本機播放
```

✅ Phase A 完成判定:`afplay` 播出的聲音聽得出是 Eric 的聲音 + 文字正確。

---

### Phase B-CV3 — CV3 Wing fine-tune(Pod 1 / gothic_plum_flea,預估 2-4 小時)

> 跟 Eric Phase 1 同一套 playbook。**從 vanilla pretrained 開始**,不要從已 fine-tune 的繼續訓(踩坑 #5)。
> 主要參考:`COSYVOICE2_RUNPOD_GUIDE.md` 階段 6 + `COSYVOICE_CHEATSHEET.md` 踩坑 #5-#8。

#### B-CV3.1 SSH 進 CV3 pod + 確認環境
```bash
ssh root@7k8u5nzkzs9xpa.ssh.runpod.io -p <PORT> -i ~/.ssh/id_ed25519
cd /workspace/CosyVoice
ls pretrained_models/  # 期待 Fun-CosyVoice3-0.5B 在
ls refs/                # 期待 Eric refs 在(zero-shot 用的)
df -h /dev/shm          # 確認 /dev/shm 夠大(>10 GB)
```

#### B-CV3.2 上傳 Wing 訓練資料到 CV3 pod
從本機 macOS Terminal:
```bash
CV3_POD='root@7k8u5nzkzs9xpa.ssh.runpod.io'
CV3_SSH='ssh -p <PORT> -i ~/.ssh/id_ed25519'
WING='/Volumes/WingAI SSD/Claude/Projects/工程部/訓練資料/Wing'

# 上傳 324 切片 wav
rsync -avhP -e "$CV3_SSH" \
  "$WING/transcripts/wing_ads_sliced/" \
  "$CV3_POD:/workspace/CosyVoice/data/wing_cantonese/wavs/"

# 上傳 filelist
rsync -avhP -e "$CV3_SSH" \
  "$WING/transcripts/wing_ads_sliced_training.txt" \
  "$CV3_POD:/workspace/CosyVoice/data/wing_cantonese/"
```

#### B-CV3.3 轉 filelist 成 CV3 manifest 格式
ssh 進 CV3 pod 後:
```bash
cd /workspace/CosyVoice/data/wing_cantonese

# CV3 manifest 格式:wav_path\ttext\tspeaker\tlang
# 本機 filelist:<local_path>|wing|ZH|<text>
# 要轉成:/workspace/CosyVoice/data/wing_cantonese/wavs/wing_ads_NNNN.wav|<text>

python3 <<'EOF'
import os
out_train = open('train.list', 'w', encoding='utf-8')
out_dev = open('dev.list', 'w', encoding='utf-8')
with open('wing_ads_sliced_training.txt', encoding='utf-8') as f:
    lines = [l.strip() for l in f if l.strip()]
print(f"total: {len(lines)}")
# 留 90% 訓練,10% dev
split = int(len(lines) * 0.9)
for i, l in enumerate(lines):
    parts = l.split('|')
    if len(parts) < 4: continue
    orig_path, _, _, text = parts[0], parts[1], parts[2], parts[3]
    # 換成 pod 上的路徑
    fname = os.path.basename(orig_path)
    pod_path = f'/workspace/CosyVoice/data/wing_cantonese/wavs/{fname}'
    # CV3 manifest:wav|utt_id|spk_id|lang|text
    utt_id = fname.replace('.wav','')
    line = f'{pod_path}|{utt_id}|wing|yue|{text}\n'
    if i < split:
        out_train.write(line)
    else:
        out_dev.write(line)
out_train.close(); out_dev.close()
print(f"train: {split} | dev: {len(lines)-split}")
EOF

head -2 train.list
wc -l train.list dev.list
```

**注意 `yue` 不是 `zh`** — 粵語標籤要對才會用對的 ttsfrd / wetext frontend。

#### B-CV3.4 extract embedding(speaker 向量)
```bash
cd /workspace/CosyVoice
python tools/extract_embedding.py \
  --dir data/wing_cantonese/wavs \
  --onnx_path pretrained_models/Fun-CosyVoice3-0.5B/campplus.onnx
# 會輸出 spk2embedding.pt 跟 utt2embedding.pt 到 wavs/
```

#### B-CV3.5 跑 fine-tune
**永遠從 vanilla pretrained 開始(踩坑 #5)**:
```bash
tmux new -s wing_cv3 -d \
  'cd /workspace/CosyVoice && \
   python cosyvoice/bin/train.py \
     --config conf/cosyvoice2.yaml \
     --train_data data/wing_cantonese/train.list \
     --cv_data data/wing_cantonese/dev.list \
     --model llm \
     --checkpoint pretrained_models/Fun-CosyVoice3-0.5B/llm.pt \
     --model_dir /dev/shm/wing_cv3_training/ \
     --train_engine torch_ddp \
     --num_workers 2 \
     --prefetch 100 \
     --partition false \
     --timeout 300 \
     > /workspace/wing_cv3.log 2>&1'

# 監看
tmux attach -t wing_cv3   # Ctrl+B then D detach
# 或
watch -n 60 'tail -30 /workspace/wing_cv3.log'
```

⚠️ **絕不再踩(直接從 Eric Phase 1 教訓):**
- `--partition false` (master guide 踩坑 #1,Issue #517 — partition=True 會炸)
- `--timeout 300` (踩坑 #2,Issue #1727)
- checkpoint 寫到 `/dev/shm/`(踩坑 #3,MFS 寫死)
- 用 tmux(踩坑 #7,SSH 斷線會殺 nohup)
- 只跑 1-2 epoch,**epoch 0 通常就是 best**(踩坑 #5 overfit,Eric Phase 1 印證過)

#### B-CV3.6 訓練完成 → 把 checkpoint 從 /dev/shm 撈出來 + 剝乾淨
```bash
# 訓練存的 epoch_0_whole.pt 含 'epoch'/'step' 等 metadata,推論會 fail(踩坑 #6)
python3 <<'EOF'
import torch
src = '/dev/shm/wing_cv3_training/epoch_0_whole.pt'  # 或 epoch_1/2
dst = '/workspace/CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B/llm_wing.pt'
ckpt = torch.load(src, map_location='cpu')
clean = {k:v for k,v in ckpt.items()
         if k not in ['epoch','step','lr','optimizer','scheduler','tag','time']}
torch.save(clean, dst)
print(f"clean keys: {len(clean)} | saved to {dst}")
EOF

ls -la /workspace/CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B/llm_wing.pt
```

#### B-CV3.7 設 Wing voice + 重啟 server
編輯 `cosyvoice_server.py`(在 onyx-platform repo 裡)讓它認 Wing voice。或更簡單,加 Wing ref audio 到 `refs/`:
```bash
# 用切片裡發音最乾淨的當 ref
# 推薦從 sliced_ads 裡挑 wing_ads_0017.wav(預設,Cowork 可自行挑)
cp /workspace/CosyVoice/data/wing_cantonese/wavs/wing_ads_0017.wav /workspace/CosyVoice/refs/wing_ref.wav

# 找對應 transcript 加入 voice config
grep wing_ads_0017 /workspace/CosyVoice/data/wing_cantonese/train.list
```

重啟 CosyVoice server(用 `/workspace/CosyVoice/scripts/restart-cosyvoice.sh` 或 tmux 內手動):
```bash
# 服務本來怎麼起的看 onyx-platform repo 的 scripts/restart-cosyvoice.sh
bash /workspace/restart-cosyvoice.sh   # 或對應路徑
sleep 30
curl -sS https://7k8u5nzkzs9xpa-8888.proxy.runpod.net/health
```

#### B-CV3.8 測試 CV3 Wing
從本機:
```bash
CV3_URL="https://7k8u5nzkzs9xpa-8888.proxy.runpod.net"

curl -sS -X POST "$CV3_URL/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text":"你好,我係 Wing,Onyx Studios 嘅粵語配音示範。","voice_id":"wing","instruction":"用粵語講"}' \
  -o /tmp/wing_cv3_test.wav
afplay /tmp/wing_cv3_test.wav
```

✅ Phase B-CV3 判定:聽起來像 Wing + 粵語腔(不是普通話)+ 文字對。

---

### Phase B-SoVITS — Wing GPT-SoVITS fine-tune(Pod 2 / 新 pod,預估 3-6 小時)

> ⚡ 這跟 Phase B-CV3 **平行跑**,兩台不同 pod 互不影響。
> 主要參考:GPT-SoVITS v2Pro README + master guide「GPT-SoVITS 系列」section。

#### B.1 上傳 Wing 訓練資料到 GPT-SoVITS pod
從本機 macOS Terminal:
```bash
SOVITS_POD='root@<POD_ID>.ssh.runpod.io'
SOVITS_SSH='ssh -p <PORT> -i ~/.ssh/id_ed25519'
WING='/Volumes/WingAI SSD/Claude/Projects/工程部/訓練資料/Wing'

# 切片 wav(用 transcripts/wing_ads_sliced/,wav filename 跟 filelist 對齊)
rsync -avhP -e "$SOVITS_SSH" \
  "$WING/transcripts/wing_ads_sliced/" \
  "$SOVITS_POD:/workspace/wing_data/wavs/"

# Filelist
rsync -avhP -e "$SOVITS_SSH" \
  "$WING/transcripts/wing_ads_sliced_training.txt" \
  "$SOVITS_POD:/workspace/wing_data/"
```

#### B.2 Patch filelist 路徑(本機路徑 → pod 路徑)
ssh 進 pod 後:
```bash
cd /workspace/wing_data
# 原 filelist 路徑長這樣:
# /Volumes/WingAI SSD/Claude/Projects/工程部/訓練資料/Wing/transcripts/wing_ads_sliced/wing_ads_0001.wav|wing|ZH|...
# 注意實際 wav 名是 1.zh-hk_audio_*_NNNNNNN_NNNNNNN.wav,不是 wing_ads_NNNN.wav
# 要 sanity check:filelist 裡的 wav filename 是否對得上 wavs/ 裡實際檔名

# 如果 filename 不一致,看 transcripts/transcribe_log.json 找 mapping
# 暴力解:就用 wavs/ 裡實際檔名 + 原 transcript 重新生 filelist

ls wavs/ | head -5
head -3 wing_ads_sliced_training.txt
```
如果 filename 不匹配,**先停下來問 user** 怎麼處理 mapping。寧可問一次,不要訓出垃圾。

如果 filename OK,把絕對路徑 patch 成 pod 上的相對路徑:
```bash
sed -i 's|/Volumes/WingAI SSD/Claude/Projects/工程部/訓練資料/Wing/transcripts/wing_ads_sliced/|/workspace/wing_data/wavs/|g' wing_ads_sliced_training.txt
head -3 wing_ads_sliced_training.txt  # 驗證
```

#### B.3 GPT-SoVITS 訓練 pipeline

依 template 用的 GPT-SoVITS 版本走標準 3 步:

**Step 1: Dataset formatting**(語音特徵 + ASR token 預處理)
```bash
cd /workspace/GPT-SoVITS
source venv/bin/activate  # 如 template 有 venv;沒有的話就用系統 python
export PYTHONPATH=$(pwd)

# 用 webui CLI 或直接呼叫 prepare scripts
# GPT-SoVITS 標準入口在 webui.py 或 GPT_SoVITS/prepare_datasets/*
# 看 template 提供的 README/run.sh

# 確認所需 pretrained_models 已存在(template 應該帶了)
ls pretrained_models/  # 期待 chinese-hubert-base / chinese-roberta-wwm-ext-large / s2G488k.pth 等
```

⚠️ **絕不再踩(從 master guide):**
- `partition=False` 不要設 True,會炸
- 加 `--timeout 300` 給 dataloader
- checkpoint 路徑用 `/dev/shm`(避免 MFS 寫死)— `--save_dir /dev/shm/wing_training/`
- 訓練完馬上 rsync 出 /dev/shm 到 /workspace 持久區(否則 pod 重啟資料沒了)

**Step 2: SoVITS 訓練**(預估 1.5-2h on RTX 4090)
```bash
# 通常會跑 50-200 epoch,wing 34min 資料用 100 epoch 起跳
# 標準命令(以 GPT-SoVITS v2Pro 為例):
python GPT_SoVITS/s2_train.py \
  --config /workspace/wing_data/s2.json \
  --save_dir /dev/shm/wing_training/sovits/ \
  > /workspace/wing_sovits.log 2>&1 &

# 監看
watch -n 30 'tail -20 /workspace/wing_sovits.log'
```

**Step 3: GPT 訓練**(預估 1-1.5h)
```bash
python GPT_SoVITS/s1_train.py \
  --config /workspace/wing_data/s1.yaml \
  --save_dir /dev/shm/wing_training/gpt/ \
  > /workspace/wing_gpt.log 2>&1 &

watch -n 30 'tail -20 /workspace/wing_gpt.log'
```

訓練完成 → 把最後的 checkpoint rsync 到 /workspace 持久區:
```bash
cp /dev/shm/wing_training/sovits/G_final.pth \
   /workspace/GPT-SoVITS/SoVITS_weights_v2Pro/wing_sovits_v2pro_final.pth
cp /dev/shm/wing_training/gpt/e<N>.ckpt \
   /workspace/GPT-SoVITS/GPT_weights_v2Pro/wing_gpt_e<N>.ckpt
```

#### B.4 選 Wing ref audio
從 `/workspace/wing_data/wavs/` 挑一個**乾淨、3-10 秒、字正腔圓**的 wav 當 ref。建議:
- 找 sliced_ads 裡發音清楚 + 沒有背景音樂干擾的
- 對應 transcript 從 filelist 撈出來

```bash
# 假設挑了 wing_ads_0017.wav
cp /workspace/wing_data/wavs/wing_ads_0017.wav /workspace/refs/wing_ref.wav
# 找對應 transcript
grep wing_ads_0017 /workspace/wing_data/wing_ads_sliced_training.txt
```

#### B.5 更新 voice config 加 Wing
```yaml
voices:
  eric_warm_slow:
    # ... 同 Phase A
  wing_yue_default:
    gpt: /workspace/GPT-SoVITS/GPT_weights_v2Pro/wing_gpt_e<N>.ckpt
    sovits: /workspace/GPT-SoVITS/SoVITS_weights_v2Pro/wing_sovits_v2pro_final.pth
    ref_audio: /workspace/refs/wing_ref.wav
    ref_text: "<從上步撈的 transcript>"
    language: yue   # 粵語 — 注意!不是 zh
    default_speed: 1.0
```

#### B.6 重啟 server + 驗證 Wing
```bash
tmux kill-session -t sovits
tmux new -d -s sovits 'python -m uvicorn main:app --host 0.0.0.0 --port 80 > /workspace/sovits.log 2>&1'
sleep 30
```

從本機測 Wing:
```bash
curl -sS -X POST "$URL/v1/audio/speech" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","input":"你好,我係 Wing,Onyx Studios 嘅粵語配音示範。","voice":"wing_yue_default","response_format":"wav"}' \
  -o /tmp/wing_test.wav
afplay /tmp/wing_test.wav
```

✅ Phase B 完成判定:聽起來是 Wing 的聲音 + 是粵語腔(不是普通話)+ 字正確。

---

### Phase C — 備份 + 收尾(預估 30 分鐘)

#### C.1 rsync 兩套 Wing 權重到本機(防再次丟失!)
從本機 macOS Terminal:
```bash
DATE=$(date +%Y%m%d)
BACKUP_BASE="/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform"

# === Wing GPT-SoVITS 備份 ===
SOVITS_BK="$BACKUP_BASE/wing_sovits_backup_$DATE"
mkdir -p "$SOVITS_BK"
rsync -avhP -e "ssh -p <SOVITS_PORT> -i ~/.ssh/id_ed25519" \
  "root@<SOVITS_POD_ID>.ssh.runpod.io:/workspace/GPT-SoVITS/GPT_weights_v2Pro/wing_gpt_*.ckpt" \
  "$SOVITS_BK/wing_gpt_final.ckpt"
rsync -avhP -e "ssh -p <SOVITS_PORT> -i ~/.ssh/id_ed25519" \
  "root@<SOVITS_POD_ID>.ssh.runpod.io:/workspace/GPT-SoVITS/SoVITS_weights_v2Pro/wing_sovits_v2pro_final.pth" \
  "$SOVITS_BK/wing_sovits_v2pro_final.pth"
rsync -avhP -e "ssh -p <SOVITS_PORT> -i ~/.ssh/id_ed25519" \
  "root@<SOVITS_POD_ID>.ssh.runpod.io:/workspace/refs/wing_ref.wav" \
  "$SOVITS_BK/wing_ref.wav"

# === Wing CV3 備份 ===
CV3_BK="$BACKUP_BASE/wing_cv3_backup_$DATE"
mkdir -p "$CV3_BK"
rsync -avhP -e "ssh -p <CV3_PORT> -i ~/.ssh/id_ed25519" \
  "root@7k8u5nzkzs9xpa.ssh.runpod.io:/workspace/CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B/llm_wing.pt" \
  "$CV3_BK/llm_wing.pt"
rsync -avhP -e "ssh -p <CV3_PORT> -i ~/.ssh/id_ed25519" \
  "root@7k8u5nzkzs9xpa.ssh.runpod.io:/workspace/CosyVoice/refs/wing_ref.wav" \
  "$CV3_BK/wing_ref.wav"
rsync -avhP -e "ssh -p <CV3_PORT> -i ~/.ssh/id_ed25519" \
  "root@7k8u5nzkzs9xpa.ssh.runpod.io:/workspace/CosyVoice/data/wing_cantonese/train.list" \
  "$CV3_BK/train.list"
```

#### C.2 更新 Master Guide
編輯 `/Volumes/WingAI SSD/Claude/Projects/工程部/onyx-platform/onyx-platform/VOICE_AI_MASTER_GUIDE.md`:
- **新 pod section** 加進 pod 表(取代死掉的 a52pzfcunv6ov8 條目)
- **訓練資產位置** 區塊加 Wing 條目,指向 `wing_backup_YYYYMMDD/` 路徑
- **下次強制 review 日期** 不變(2026-08-23)

commit + push:
```bash
cd /Volumes/WingAI\ SSD/Claude/Projects/工程部/onyx-platform/onyx-platform
git add VOICE_AI_MASTER_GUIDE.md
git commit -m "docs(voice): Wing GPT-SoVITS v2Pro production deploy + restore Eric

- New pod <POD_ID> replacing dead a52pzfcunv6ov8
- Wing zh-hk first production model, 34min train data, e<N> epochs
- Both Eric/Wing weights backed up locally"
git push origin main
```

#### C.3 通知 user
回報:
- ✅ 新 pod URL: `<URL>`
- ✅ Eric voice 復活(presets: eric_warm_slow + 任何其他你建的)
- ✅ Wing voice 第一版上線(preset: wing_yue_default)
- ⏭️ User 要做:Vercel 改 `NEXT_PUBLIC_SOVITS_API_URL` 成新 URL + redeploy
- 📊 訓練 metrics: SoVITS 最終 loss / GPT 最終 loss / 訓練時長
- 🎧 兩個示範 wav 檔(eric / wing)位置

---

## 🚨 萬一卡關的 escalation

任何階段卡 > 30 分鐘無進展,**停下來,問 user**,不要硬幹:

| 症狀 | 可能原因 | 先檢查 |
|---|---|---|
| SSH connection refused | Pod 還在啟動 / SSH port 沒 expose | RunPod console 看 pod state + Connect 頁的 SSH 指令 |
| Template 沒帶 GPT-SoVITS code | 拿錯 template | ssh 進去 `ls /workspace`、`find / -name "GPT-SoVITS" -type d` |
| Eric TTS 念出來破音/雜訊 | ref_text 對不上 ref audio | 重對 transcript |
| Wing 訓練 loss 不收斂 | filelist 路徑錯 / pretrained 缺檔 | 看 log 看哪 step 卡住 |
| 訓練中途 OOM | RTX 4090 顯存不夠 | 降 batch_size 一半重跑 |
| Pod 突然 stop / migrate | 跟舊 pod 一樣 GPU shortage | 立刻 rsync 出已有 checkpoint,再決定 |

---

## 📝 完成後填這份回報模板給 user

```
雙引擎 Voice Deploy 完成 (YYYY-MM-DD HH:MM):

═══ Pod 1 (CV3) ═══
Pod: 7k8u5nzkzs9xpa (gothic_plum_flea)
URL: https://7k8u5nzkzs9xpa-8888.proxy.runpod.net (no auth)

✅ Eric: 沿用原 zero-shot ref(不動)
✅ Wing (CV3 fine-tune, 粵語):
   - Trained: 1 epoch on 324 wav (34.2 min)
   - Best epoch: <N>(印證踩坑 #5 epoch 0/1 是 best)
   - llm checkpoint cleaned, saved to llm_wing.pt
   - Test: /tmp/wing_cv3_test.wav (粵語 + 像 Wing ✅)

═══ Pod 2 (新 GPT-SoVITS) ═══
Pod: <SOVITS_POD_ID> (RunPod region: <REGION>)
URL: https://<SOVITS_POD_ID>-80.proxy.runpod.net
Bearer: onyx-eric-key-2024

✅ Eric (eric_warm_slow):
   - Restored from local backup
   - GPT: eric_gpt_e15.ckpt
   - SoVITS: eric_sovits_v2pro_final.pth
   - Test: /tmp/eric_test.wav (已 afplay 確認 OK)

✅ Wing (wing_yue_default, GPT-SoVITS v2Pro fine-tune):
   - Trained from scratch on 324 sliced ads, 34.2 min, zh-hk
   - SoVITS: <X> epochs, final loss <Y>
   - GPT: <X> epochs, final loss <Y>
   - GPT: wing_gpt_e<N>.ckpt
   - SoVITS: wing_sovits_v2pro_final.pth
   - Test: /tmp/wing_sovits_test.wav (粵語 + 像 Wing ✅)

═══ 本機備份 ═══
✅ Eric (已存在):/Volumes/WingAI SSD/.../onyx-platform/eric_*.ckpt/pth/wav
✅ Wing GPT-SoVITS: /Volumes/WingAI SSD/.../onyx-platform/wing_sovits_backup_YYYYMMDD/
✅ Wing CV3: /Volumes/WingAI SSD/.../onyx-platform/wing_cv3_backup_YYYYMMDD/

═══ 文件 ═══
✅ Master Guide updated + git committed: <COMMIT_HASH>

═══ ⏭️ User TODO ═══
- Vercel:NEXT_PUBLIC_SOVITS_API_URL = https://<SOVITS_POD_ID>-80.proxy.runpod.net
- Vercel:redeploy production
- admin/voices 試 CV3 Wing(粵語 instruction)
- admin/sovits 試 GPT-SoVITS Eric + Wing TTS + voice conversion
```
