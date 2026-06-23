"""
阿宏 Stage B — VAD slice + SenseVoice ASR for 112 pure-monolog wavs.

Pipeline:
  1. Walk /workspace/data/ahong_raw/**/*.wav (112 files, 7.48 hr at 48 kHz mono)
  2. SileroVAD (via funasr) → segment each wav into 3-15 sec sub-clips
  3. SenseVoiceSmall ASR each sub-clip → text
  4. Post-process: s2twp, brand fix, preserve TW colloquial particles
  5. Write 16 kHz mono PCM slices to /workspace/data/ahong_slices/
  6. Emit /workspace/data/ahong_sv_segments.jsonl

Each output record:
  {"id":"ahong_NNNNNN", "src":"失戀.wav", "topic":"失戀",
   "start":12.4, "end":18.6, "dur":6.2,
   "text":"我那時候真的覺得啦..."}

GPU: SenseVoiceSmall ~6 GB VRAM — safe to run while Wing CV3 trains (~10 GB).
"""
import os, json, glob, re, sys
from pathlib import Path

import numpy as np
import librosa
import soundfile as sf
from opencc import OpenCC

# ── paths ────────────────────────────────────────────────────────────────
RAW_DIR = "/workspace/data/ahong_raw"
SLICE_DIR = "/workspace/data/ahong_slices"
META_OUT = "/workspace/data/ahong_sv_segments.jsonl"
SV_MODEL = "/workspace/CosyVoice/pretrained_models/SenseVoiceSmall"
SR = 16000
os.makedirs(SLICE_DIR, exist_ok=True)

# ── language / text post-processing ───────────────────────────────────────
s2t = OpenCC("s2twp")

# Brand / acronym corrections (SV usually transcribes English in lowercase)
BRAND_RE = [
    (r"\bspotify\b", "Spotify"),
    (r"\bsportify\b", "Spotify"),
    (r"\bbanner\b", "Banner"),
    (r"\bhp\b", "HP"),
    (r"\bmac\b", "Mac"),
    (r"\bwindows\b", "Windows"),
    (r"\bwifi\b", "Wi-Fi"),
    (r"\busb\b", "USB"),
    (r"\bgforce\s*now\b|\bg\s*force\s*now\b", "GeForce Now"),
    (r"\bipad\b", "iPad"),
    (r"\biphone\b", "iPhone"),
    (r"\bnba\b", "NBA"),
]

# TW conventions (s2twp covers most; this is extra cleanup)
TW_TERMS = [
    # leave colloquials alone — 啦 喔 欸 吼 捏 嘿 都保留
]

def post_process(text: str) -> str:
    t = s2t.convert(text)
    for pat, rep in BRAND_RE:
        t = re.sub(pat, rep, t, flags=re.IGNORECASE)
    for a, b in TW_TERMS:
        t = t.replace(a, b)
    return t.strip()


def topic_from_filename(fn: str) -> str:
    name = os.path.splitext(os.path.basename(fn))[0]
    name = re.sub(r"^文本_", "", name)
    return name


# ── audio I/O + VAD ───────────────────────────────────────────────────────
def load_resample(path, target_sr=SR):
    """Load wav (any sample rate) → 16 kHz mono float32."""
    wav, orig_sr = sf.read(path)
    if wav.ndim > 1:
        wav = wav.mean(axis=1)
    if orig_sr != target_sr:
        wav = librosa.resample(wav.astype(np.float32), orig_sr=orig_sr, target_sr=target_sr)
    return wav.astype(np.float32)


def vad_segment(wav, sr=SR, top_db=30, min_len=2.0, max_len=12.0):
    """Energy-based VAD via librosa.effects.split."""
    intervals = librosa.effects.split(wav, top_db=top_db)
    out = []
    for s, e in intervals:
        dur = (e - s) / sr
        if dur < min_len:
            continue
        if dur <= max_len:
            out.append((s, e))
        else:
            # split long segments at silence — naive: equal cuts
            n = int(np.ceil(dur / max_len))
            step = (e - s) // n
            for i in range(n):
                a = s + i * step
                b = min(e, s + (i + 1) * step)
                if (b - a) / sr >= min_len:
                    out.append((a, b))
    return out


# ── SenseVoice ASR loader ─────────────────────────────────────────────────
def load_sensevoice():
    from funasr import AutoModel
    m = AutoModel(
        model=SV_MODEL,
        trust_remote_code=True,
        disable_update=True,
        device="cuda:0",
    )
    print(f"SenseVoice loaded from {SV_MODEL}")
    return m


def asr_clip(model, wav, language="zh"):
    """ASR a numpy clip → cleaned text."""
    try:
        res = model.generate(
            input=wav,
            cache={},
            language=language,
            use_itn=True,
            batch_size_s=60,
            merge_vad=False,
        )
        raw = res[0]["text"] if res else ""
        # SV outputs tags like <|zh|><|NEUTRAL|>... → strip
        raw = re.sub(r"<\|[^|]+\|>", "", raw).strip()
        return raw
    except Exception as e:
        print(f"    ASR fail: {e}")
        return ""


# ── main ──────────────────────────────────────────────────────────────────
def main():
    wavs = sorted([w for w in glob.glob(f"{RAW_DIR}/**/*.wav", recursive=True)
                   if not os.path.basename(w).startswith("._")])
    print(f"Found {len(wavs)} wavs in {RAW_DIR}")

    sv = load_sensevoice()

    idx = 0
    total_segs = 0
    with open(META_OUT, "w", encoding="utf-8") as fo:
        for i, wav_path in enumerate(wavs):
            topic = topic_from_filename(wav_path)
            src = os.path.basename(wav_path)
            try:
                wav = load_resample(wav_path)
            except Exception as e:
                print(f"[{i+1}/{len(wavs)}] {src} LOAD FAIL: {e}")
                continue

            segs = vad_segment(wav)
            print(f"[{i+1}/{len(wavs)}] {src} ({len(wav)/SR:.1f}s) → {len(segs)} segments")

            for j, (s, e) in enumerate(segs):
                clip = wav[s:e]
                if len(clip) < SR * 1.5:
                    continue
                text_raw = asr_clip(sv, clip)
                text = post_process(text_raw)
                if not text or len(text) < 2:
                    continue
                seg_id = f"ahong_{idx:06d}"
                slice_path = os.path.join(SLICE_DIR, f"{seg_id}.wav")
                sf.write(slice_path, clip, SR, subtype="PCM_16")
                rec = {
                    "id": seg_id,
                    "src": src,
                    "topic": topic,
                    "start": round(s / SR, 3),
                    "end": round(e / SR, 3),
                    "dur": round((e - s) / SR, 3),
                    "text": text,
                    "text_raw": text_raw,
                }
                fo.write(json.dumps(rec, ensure_ascii=False) + "\n")
                idx += 1

            total_segs += len(segs)

    print()
    print(f"DONE. Wrote {idx} segments → {META_OUT}")
    print(f"Slices: {SLICE_DIR}")


if __name__ == "__main__":
    main()
