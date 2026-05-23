"""
Onyx CosyVoice 3 (Fun-CosyVoice3-0.5B) inference server.

Production-locked configuration that produces ElevenLabs-comparable Chinese TTS:
  - Model: Fun-CosyVoice3-0.5B-2512 (RL fine-tuned variant + Eric fine-tune)
  - Loader: AutoModel API (auto-detects CV3 model_dir)
  - Frontend: ttsfrd (official Alibaba normalizer; falls back to wetext if absent)
  - Inference: text_frontend=False (REQUIRED — per official README NOTE)
  - Prompt format: prefixed with "You are a helpful assistant.<|endofprompt|>"
    (CV3 standard format — without this, output drifts to other languages)

This file is the canonical version. The pod at /workspace/CosyVoice/server.py
should mirror this exactly.

Endpoints:
  GET  /health              → liveness check + model info
  POST /synthesize          → generate audio (zero-shot voice cloning)
  POST /upload_reference    → upload a new reference voice
  GET  /voices              → list available reference voices

Reference voices live in /workspace/CosyVoice/references/
  <voice_id>.wav  — reference audio (5-30 sec, clean studio recording)
  <voice_id>.txt  — exact transcript of the reference audio (word-for-word)
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

from cosyvoice.cli.cosyvoice import AutoModel
from cosyvoice.utils.file_utils import load_wav

MODEL_DIR = '/workspace/CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B'
REFS_DIR = Path('/workspace/CosyVoice/references')
REFS_DIR.mkdir(exist_ok=True)

print(f"Loading {MODEL_DIR}...")
cosyvoice = AutoModel(model_dir=MODEL_DIR)
SAMPLE_RATE = cosyvoice.sample_rate
print(f"✅ CosyVoice ready (sample_rate={SAMPLE_RATE})")

app = FastAPI(title="Onyx CosyVoice 3 API")
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
        "model": "Fun-CosyVoice3-0.5B",
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


import re


def split_into_sentences(text: str):
    """Split Chinese/English text into sentences by punctuation.

    Long-text TTS drift in CosyVoice is largely solved by feeding text one
    sentence at a time (bi-streaming pattern shown in official example.py).
    We split on Chinese full-stops, question/exclamation marks, semicolons,
    and English equivalents, keeping the punctuation attached.
    """
    # Split on ., 。, !, ！, ?, ？, ;, ；  but keep the delimiter
    parts = re.split(r'(?<=[。！？!?；;])', text.strip())
    # Filter empty + strip whitespace
    sentences = [s.strip() for s in parts if s.strip()]
    # If no terminal punctuation found, fall back to comma-splits or whole text
    if len(sentences) <= 1 and len(text) > 80:
        # Long text without punctuation — split on commas as fallback
        sentences = [s.strip() for s in re.split(r'(?<=[,，])', text.strip()) if s.strip()]
    return sentences or [text]


@app.post("/synthesize")
def synthesize(req: SynthRequest):
    """Synthesize speech.

    Two modes (auto-routed based on req.instruction):
    -  Empty instruction → inference_zero_shot (best for "just clone the
       voice and read this text" — same language as reference).
    -  Non-empty instruction → inference_instruct2 (CV3 instruction-controlled;
       use this for Cantonese, emotion, speed control, etc.)

    Both modes use sentence-split (bi-streaming) for stable long-text synthesis.
    """
    voice_id = req.voice_id
    wav_path = REFS_DIR / f"{voice_id}.wav"
    txt_path = REFS_DIR / f"{voice_id}.txt"

    if not wav_path.exists():
        raise HTTPException(404, f"Voice not found: {voice_id}. Upload via /upload_reference first.")
    if not txt_path.exists():
        raise HTTPException(500, f"Transcript missing for voice {voice_id}")

    # Split target text into sentences (official bi-streaming pattern — prevents
    # long-text drift). Works for both zero_shot and instruct2.
    sentences = split_into_sentences(req.text)

    def text_generator():
        for s in sentences:
            yield s

    instruction = req.instruction.strip()
    use_instruct = bool(instruction)

    audio_chunks = []

    if use_instruct:
        # CV3 instruction-controlled mode. Format from official example.py:
        # "You are a helpful assistant. {natural-language directive}<|endofprompt|>"
        # Used for: Cantonese ("请用广东话表达"), emotion, speed, etc.
        instruct_text = f"You are a helpful assistant. {instruction}<|endofprompt|>"
        for result in cosyvoice.inference_instruct2(
            text_generator(), instruct_text, str(wav_path),
            stream=False,
            text_frontend=False,
        ):
            audio_chunks.append(result['tts_speech'])
    else:
        # Pure zero-shot clone. prompt_text = reference transcript with the
        # mandatory "You are a helpful assistant.<|endofprompt|>" prefix that
        # anchors language so output doesn't drift to other languages.
        prompt_text = "You are a helpful assistant.<|endofprompt|>" + txt_path.read_text(encoding="utf-8").strip()
        for result in cosyvoice.inference_zero_shot(
            text_generator(), prompt_text, str(wav_path),
            stream=False,
            text_frontend=False,
        ):
            audio_chunks.append(result['tts_speech'])

    # Stitch all chunks together
    if not audio_chunks:
        raise HTTPException(500, "synthesis produced no audio")
    combined = torch.cat(audio_chunks, dim=1) if len(audio_chunks) > 1 else audio_chunks[0]

    audio_buffer = io.BytesIO()
    torchaudio.save(audio_buffer, combined, SAMPLE_RATE, format="wav")
    audio_buffer.seek(0)
    return StreamingResponse(audio_buffer, media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8888, log_level="info")
