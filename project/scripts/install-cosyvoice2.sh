#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Onyx CosyVoice 2 — RunPod auto-installer (v2 — tmux-wrapped, setuptools-pinned)
#
# What it does (idempotent — safe to re-run):
#   0. Re-spawn itself inside a tmux session if not already inside one
#      (so it survives web terminal disconnect)
#   1. Clone CosyVoice 2 to /workspace/CosyVoice
#   2. Create venv with pinned setuptools<70 (newer breaks grpcio)
#   3. Install dependencies — grpcio forced to use binary wheel
#   4. Download CosyVoice2-0.5B base model (3-4 GB)
#   5. Write FastAPI server (server.py)
#   6. Start server inside a SECOND tmux session
#   7. Print public URL
#
# Usage (run from RunPod web terminal):
#   curl -sL https://raw.githubusercontent.com/onyx-studio-ai/onyx-mvp/main/project/scripts/install-cosyvoice2.sh | bash
#
# After running, you can SAFELY close the web terminal.
# Reattach to install progress:    tmux attach -t cosyvoice-install
# Reattach to running API server:  tmux attach -t cosyvoice
# Tail install log:                tail -f /workspace/cosyvoice-install.log
# Tail server log:                 tail -f /workspace/cosyvoice-server.log
# Stop server:                     tmux kill-session -t cosyvoice
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# Step 0a: Re-spawn inside tmux if not already there
# ─────────────────────────────────────────────────────────────────────────────
SCRIPT_URL="https://raw.githubusercontent.com/onyx-studio-ai/onyx-mvp/main/project/scripts/install-cosyvoice2.sh"
SESSION="cosyvoice-install"

if [ -z "$TMUX" ] && [ -z "$ONYX_INSTALL_RESPAWNED" ]; then
  # Make sure tmux is available
  if ! command -v tmux &> /dev/null; then
    echo "Installing tmux..."
    apt-get update -qq > /dev/null 2>&1 && apt-get install -y -qq tmux > /dev/null 2>&1
  fi

  # Download script to /tmp (so tmux session has a stable file to source)
  curl -sL "$SCRIPT_URL" -o /tmp/install-cosyvoice2.sh
  chmod +x /tmp/install-cosyvoice2.sh

  # Kill any existing install session (in case of re-run)
  tmux kill-session -t "$SESSION" 2>/dev/null || true

  # Spawn new tmux session running this script (with respawn flag set)
  tmux new-session -d -s "$SESSION" \
    "ONYX_INSTALL_RESPAWNED=1 /tmp/install-cosyvoice2.sh; echo ''; echo 'Install finished. Press Ctrl+B then D to detach.'; exec bash"

  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  ✅ Install started in background (tmux session: $SESSION)"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  echo "  📺 Watch progress LIVE:"
  echo "       tmux attach -t $SESSION"
  echo "       (then Ctrl+B then D to detach — install keeps running)"
  echo ""
  echo "  📜 Or just tail the log file:"
  echo "       tail -f /workspace/cosyvoice-install.log"
  echo ""
  echo "  💡 You can SAFELY close this web terminal now."
  echo "       The install will keep running. Re-open terminal anytime"
  echo "       and tail the log to see progress."
  echo ""
  echo "  ⏱  Expected runtime: 15-25 min (pip install + 3-4 GB download)"
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 0b: We're inside tmux now — proceed with install
# ─────────────────────────────────────────────────────────────────────────────

set -e

LOG_FILE="/workspace/cosyvoice-install.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Onyx CosyVoice 2 Auto-Installer (running in tmux)"
echo "  Started: $(date)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Step 0: Sanity checks
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ Step 0: Environment check"
echo "  PWD: $(pwd)"
echo "  Python: $(python --version 2>&1)"
echo "  GPU: $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || echo '(no GPU detected)')"
echo "  Disk: $(df -h /workspace | tail -1)"
echo ""

# Required tools
for cmd in git python pip nvidia-smi; do
  if ! command -v $cmd &> /dev/null; then
    echo "❌ Missing required command: $cmd"
    exit 1
  fi
done

# Install tmux if missing (so server survives terminal close)
if ! command -v tmux &> /dev/null; then
  echo "▶ Installing tmux..."
  apt-get update -qq && apt-get install -y -qq tmux
fi

# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Clone CosyVoice (idempotent)
# ─────────────────────────────────────────────────────────────────────────────
cd /workspace
if [ ! -d "/workspace/CosyVoice" ]; then
  echo "▶ Step 1: Cloning CosyVoice repo..."
  git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git CosyVoice
else
  echo "▶ Step 1: CosyVoice already cloned, skipping."
fi
cd /workspace/CosyVoice

# Ensure submodules pulled
git submodule update --init --recursive 2>&1 | tail -3 || true

# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Python venv
# ─────────────────────────────────────────────────────────────────────────────
# CosyVoice 2 depends on `pynini` (Tensorflow textgrid lib) which CANNOT be
# pip-installed reliably — it has C++ dependencies that only conda's binary
# packages provide. So we abandon the venv approach and install miniconda,
# then create a conda env exactly like CosyVoice 2's official README does.
#
# Image already has system PyTorch 2.9.0 + CUDA 12.8 but we make a fresh
# conda env (Python 3.10) to match upstream's tested combination.
# ─────────────────────────────────────────────────────────────────────────────

# Remove any old broken venv from previous attempts
if [ -d "/workspace/CosyVoice/venv" ]; then
  echo "▶ Step 2a: Removing old (broken) venv from previous attempt..."
  rm -rf /workspace/CosyVoice/venv
fi

# Install miniconda into /workspace (persists across pod restarts)
CONDA_DIR="/workspace/miniconda3"
if [ ! -d "$CONDA_DIR" ]; then
  echo "▶ Step 2b: Installing Miniconda..."
  wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh
  bash /tmp/miniconda.sh -b -p "$CONDA_DIR"
  rm -f /tmp/miniconda.sh
else
  echo "▶ Step 2b: Miniconda exists at $CONDA_DIR, reusing."
fi

# Source conda
source "$CONDA_DIR/etc/profile.d/conda.sh"

# Accept Anaconda Terms of Service for default channels — required since
# Anaconda Inc. added this gate in 2024. Without these two accepts the very
# first `conda install` blocks asking interactively, and our -y flag does NOT
# answer it. Run upfront so the rest of the script doesn't trip on it.
echo "▶ Step 2c: Accepting Anaconda Terms of Service..."
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main 2>/dev/null || true
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r 2>/dev/null || true

# Create conda env for CosyVoice (idempotent)
if ! conda env list | grep -q "^cosyvoice "; then
  echo "▶ Step 2d: Creating conda env 'cosyvoice' (Python 3.10)..."
  conda create -n cosyvoice -y python=3.10
else
  echo "▶ Step 2d: conda env 'cosyvoice' exists, reusing."
fi

conda activate cosyvoice
echo "  Active Python: $(which python) ($(python --version 2>&1))"

# ─────────────────────────────────────────────────────────────────────────────
# Step 3: Install dependencies (10-15 min first run)
#
# Order matters:
#   3a. pynini via conda (no pip equivalent exists for the C++ build)
#   3b. Pin setuptools<70 so anything that DOES build from source can import
#       pkg_resources
#   3c. CosyVoice requirements.txt (most packages have wheels)
#   3d. Extras for the API server
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ Step 3a: Installing pynini via conda (only conda has the wheels)..."
# --override-channels: only use conda-forge, skip default channels (avoids ToS prompt)
conda install -y --override-channels -c conda-forge pynini==2.1.5 2>&1 | tail -5

echo "▶ Step 3b: Pinning pip and setuptools for compatibility..."
pip install -U 'pip<25' wheel 'setuptools<70' 2>&1 | tail -3

# CRITICAL: pip's isolated build environments default to the LATEST setuptools
# (currently 82+), even when the host venv has a pinned older version. Many
# Python packages (grpcio, WeTextProcessing, others CosyVoice depends on) have
# setup.py that imports pkg_resources, which setuptools removed in 70+. Result:
# "ModuleNotFoundError: No module named 'pkg_resources'" mid-build.
#
# Fix: PIP_CONSTRAINT — pip honors it in build environments too, forcing
# isolated build envs to use the same setuptools<70 as the host venv.
echo "▶ Step 3b-fix: Pinning setuptools in pip's isolated build environments..."
cat > /tmp/pip-build-constraints.txt <<'CONSTRAINTS'
setuptools<70
wheel<1
CONSTRAINTS
export PIP_CONSTRAINT=/tmp/pip-build-constraints.txt
echo "  PIP_CONSTRAINT set: $PIP_CONSTRAINT"

echo "▶ Step 3c: Installing CosyVoice requirements (this is the long part)..."
# Prefer binary wheels to avoid source builds (some packages don't have wheels
# for Python 3.10 — they'll fall back to source which usually works fine)
pip install -r /workspace/CosyVoice/requirements.txt 2>&1 | tail -15

echo "▶ Step 3d: Installing extras for FastAPI server..."
pip install fastapi 'uvicorn[standard]' python-multipart huggingface_hub modelscope 2>&1 | tail -3

# Clear the constraint env var so it doesn't affect anything else in the script
unset PIP_CONSTRAINT

echo "▶ Verifying PyTorch + CUDA..."
python -c "
import torch
print(f'PyTorch: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')
    print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')
"

# ─────────────────────────────────────────────────────────────────────────────
# Step 4: Download CosyVoice2-0.5B base model (3-4 GB)
# ─────────────────────────────────────────────────────────────────────────────
mkdir -p pretrained_models
if [ ! -d "/workspace/CosyVoice/pretrained_models/CosyVoice2-0.5B" ] || \
   [ ! -f "/workspace/CosyVoice/pretrained_models/CosyVoice2-0.5B/llm.pt" ]; then
  echo "▶ Step 4: Downloading CosyVoice2-0.5B model (3-4 GB)..."
  huggingface-cli download FunAudioLLM/CosyVoice2-0.5B \
    --local-dir /workspace/CosyVoice/pretrained_models/CosyVoice2-0.5B \
    2>&1 | tail -10
else
  echo "▶ Step 4: Model already downloaded, skipping."
fi

echo "  Model files:"
ls -lh /workspace/CosyVoice/pretrained_models/CosyVoice2-0.5B/ | head -10

# ─────────────────────────────────────────────────────────────────────────────
# Step 5: Write FastAPI server (server.py)
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ Step 5: Writing FastAPI server..."
cat > /workspace/CosyVoice/server.py << 'PYEOF'
"""
Minimal FastAPI server exposing CosyVoice 2 for Onyx platform.

Endpoints:
  GET  /health              → liveness check
  POST /synthesize          → generate audio (zero-shot voice cloning)
  POST /upload_reference    → upload a new reference voice (returns voice_id)
  GET  /voices              → list available reference voices

Reference voices live in /workspace/CosyVoice/references/<voice_id>/
  {voice_id}.wav  — the reference audio (5-30 sec)
  {voice_id}.txt  — the exact transcript of the reference audio
"""
import os, sys, io, json, uuid, time
from pathlib import Path

sys.path.append('/workspace/CosyVoice/third_party/Matcha-TTS')

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import torchaudio

from cosyvoice.cli.cosyvoice import CosyVoice2
from cosyvoice.utils.file_utils import load_wav

REFS_DIR = Path('/workspace/CosyVoice/references')
REFS_DIR.mkdir(exist_ok=True)

print("Loading CosyVoice2-0.5B...")
cosyvoice = CosyVoice2(
    '/workspace/CosyVoice/pretrained_models/CosyVoice2-0.5B',
    load_jit=False, load_trt=False, fp16=False,
)
SAMPLE_RATE = cosyvoice.sample_rate
print(f"✅ CosyVoice2 ready (sample_rate={SAMPLE_RATE})")

app = FastAPI(title="Onyx CosyVoice 2 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SynthRequest(BaseModel):
    text: str
    voice_id: str = "default"
    instruction: str = ""   # optional emotion / style hint, e.g. "用興奮的語氣"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "CosyVoice2-0.5B",
        "sample_rate": SAMPLE_RATE,
        "voices": [p.stem for p in REFS_DIR.glob("*.wav")],
    }


@app.get("/voices")
def list_voices():
    voices = []
    for wav in REFS_DIR.glob("*.wav"):
        txt = wav.with_suffix(".txt")
        voices.append({
            "voice_id": wav.stem,
            "audio_path": str(wav),
            "has_transcript": txt.exists(),
            "size_bytes": wav.stat().st_size,
        })
    return {"voices": voices}


@app.post("/upload_reference")
async def upload_reference(
    voice_id: str = Form(...),
    transcript: str = Form(...),
    audio: UploadFile = File(...),
):
    """Upload a new reference voice.

    Body (multipart/form-data):
      voice_id   — short identifier, e.g. "eric_zh"
      transcript — exact text in the audio (Chinese OK)
      audio      — the .wav file (5-30 sec recommended)
    """
    voice_id = voice_id.strip().replace("/", "_").replace(" ", "_")
    if not voice_id:
        raise HTTPException(400, "voice_id is required")

    wav_path = REFS_DIR / f"{voice_id}.wav"
    txt_path = REFS_DIR / f"{voice_id}.txt"

    with open(wav_path, "wb") as f:
        f.write(await audio.read())
    txt_path.write_text(transcript.strip(), encoding="utf-8")

    return {"voice_id": voice_id, "wav": str(wav_path), "transcript_len": len(transcript)}


@app.post("/synthesize")
def synthesize(req: SynthRequest):
    voice_id = req.voice_id
    wav_path = REFS_DIR / f"{voice_id}.wav"
    txt_path = REFS_DIR / f"{voice_id}.txt"

    if not wav_path.exists():
        raise HTTPException(404, f"Voice not found: {voice_id}. Upload via /upload_reference first.")
    if not txt_path.exists():
        raise HTTPException(500, f"Transcript missing for voice {voice_id}")

    prompt_speech = load_wav(str(wav_path), 16000)
    prompt_text = txt_path.read_text(encoding="utf-8").strip()

    # Prepend instruction if supplied, e.g. "<興奮>今天是個好日子"
    text = f"<{req.instruction}>{req.text}" if req.instruction.strip() else req.text

    audio_buffer = io.BytesIO()
    for result in cosyvoice.inference_zero_shot(text, prompt_text, prompt_speech, stream=False):
        torchaudio.save(audio_buffer, result['tts_speech'], SAMPLE_RATE, format="wav")
        break  # take first chunk

    audio_buffer.seek(0)
    return StreamingResponse(audio_buffer, media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
PYEOF
echo "  ✅ /workspace/CosyVoice/server.py written"

# ─────────────────────────────────────────────────────────────────────────────
# Step 6: Start server in tmux (so it survives terminal close)
# ─────────────────────────────────────────────────────────────────────────────
echo "▶ Step 6: Starting CosyVoice 2 API server in tmux..."

# Kill existing session if any
tmux kill-session -t cosyvoice 2>/dev/null || true

# Start fresh tmux session
tmux new-session -d -s cosyvoice "cd /workspace/CosyVoice && source /workspace/miniconda3/etc/profile.d/conda.sh && conda activate cosyvoice && python server.py 2>&1 | tee /workspace/cosyvoice-server.log"

sleep 5

# Health check
echo "  Waiting for server to come up (model loading takes 30-60 sec)..."
for i in $(seq 1 60); do
  if curl -s -f http://localhost:8080/health > /dev/null 2>&1; then
    echo "  ✅ Server responded (took ${i}s)"
    break
  fi
  if [ $i -eq 60 ]; then
    echo "  ⚠️  Server didn't respond in 60s. Check log: tail -f /workspace/cosyvoice-server.log"
  fi
  sleep 1
done

# ─────────────────────────────────────────────────────────────────────────────
# Step 7: Print URL for Claude to integrate
# ─────────────────────────────────────────────────────────────────────────────
POD_ID=$(echo "${RUNPOD_POD_ID:-}" | tr -d '\n')
if [ -z "$POD_ID" ]; then
  POD_ID=$(hostname | awk -F'-' '{print $1}')
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ ALL DONE"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Public URL (send this to Claude):"
echo ""
echo "    https://${POD_ID}-8080.proxy.runpod.net"
echo ""
echo "  Verify it works (run on your laptop):"
echo "    curl https://${POD_ID}-8080.proxy.runpod.net/health"
echo ""
echo "  Useful commands:"
echo "    tail -f /workspace/cosyvoice-server.log    # live server log"
echo "    tmux attach -t cosyvoice                   # attach to server session"
echo "    tmux kill-session -t cosyvoice             # stop server"
echo ""
echo "═══════════════════════════════════════════════════════════"
