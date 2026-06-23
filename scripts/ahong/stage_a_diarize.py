"""
冠彥 (阿宏) Stage A: Speaker diarization for the 78 chat WAVs that have no _muted variant.

Strategy: anchor-embedding
  1. Extract 阿宏's speaker embedding (prototype) from the 34 *_muted.wav files
     (those are guaranteed 阿宏-only — user voice was silenced by 數據堂)
  2. VAD-segment each of the 78 unmuted dialog WAVs into 2-15 sec clips
  3. Compute each clip's embedding using campplus.onnx (CV3's built-in speaker encoder)
  4. Cosine-similarity to 阿宏 prototype:
       sim ≥ 0.65 → KEEP (阿宏)
       sim < 0.45 → DROP (user)
       0.45–0.65 → mark UNCERTAIN (flag for Stage C audit)

Outputs:
  /workspace/data/ahong_segments.jsonl   # all kept segments with timestamps + sim
  /workspace/data/ahong_segments_audit.jsonl  # uncertain ones for manual review
  /workspace/data/ahong_slices/          # extracted wav slices (16 kHz mono)

Dependencies (must already be installed on pod):
  - onnxruntime-gpu  (for campplus.onnx)
  - librosa, soundfile, numpy
  - funasr SileroVAD model

DO NOT RUN until Wing CV3 training finishes — they'd compete for GPU.
"""
import os
import sys
import json
import glob
import re
from pathlib import Path

import numpy as np
import librosa
import soundfile as sf
import onnxruntime as ort

# Paths on the RunPod (wing pod / u46xxo7nkayx80)
BASE = "/workspace/data/ahong_raw"            # rsync from local: 2026041201 數據堂 冠彥 TTS 5小時/交檔/
SLICES_DIR = "/workspace/data/ahong_slices"   # output 16kHz mono slices
META_JSONL = "/workspace/data/ahong_segments.jsonl"
AUDIT_JSONL = "/workspace/data/ahong_segments_audit.jsonl"

CAMPPLUS_ONNX = "/workspace/CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B-2512/campplus.onnx"

SR = 16000
KEEP_SIM = 0.65
DROP_SIM = 0.45

os.makedirs(SLICES_DIR, exist_ok=True)


# ──────────────────────────────────────────────────────────────────────────────
# 1. campplus speaker encoder via ONNX
# ──────────────────────────────────────────────────────────────────────────────

class CamppPlusEncoder:
    """Wraps campplus.onnx — expects 80-dim fbank, returns 192-dim L2-normalized embedding."""

    def __init__(self, onnx_path):
        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if "CUDAExecutionProvider" in ort.get_available_providers()
            else ["CPUExecutionProvider"]
        )
        self.sess = ort.InferenceSession(onnx_path, providers=providers)
        self.input_name = self.sess.get_inputs()[0].name

    @staticmethod
    def _fbank(wav, sr=SR):
        import torchaudio.compliance.kaldi as kaldi
        import torch
        if wav.ndim > 1:
            wav = wav.mean(axis=0)
        wav_t = torch.from_numpy(wav).float().unsqueeze(0) * (1 << 15)  # to int16 range
        fbank = kaldi.fbank(
            wav_t,
            num_mel_bins=80,
            sample_frequency=sr,
            dither=0,
        )
        fbank = fbank - fbank.mean(dim=0, keepdim=True)
        return fbank.unsqueeze(0).numpy()  # (1, T, 80)

    def embed(self, wav, sr=SR):
        feat = self._fbank(wav, sr)
        emb = self.sess.run(None, {self.input_name: feat})[0]  # (1, 192)
        emb = emb / (np.linalg.norm(emb, axis=-1, keepdims=True) + 1e-9)
        return emb[0]


# ──────────────────────────────────────────────────────────────────────────────
# 2. Build 阿宏 prototype from 34 _muted clips
# ──────────────────────────────────────────────────────────────────────────────

def load_wav(path, sr=SR):
    """Load any wav, resample to 16k mono."""
    wav, orig_sr = sf.read(path)
    if wav.ndim > 1:
        wav = wav.mean(axis=1)
    if orig_sr != sr:
        wav = librosa.resample(wav.astype(np.float32), orig_sr=orig_sr, target_sr=sr)
    return wav.astype(np.float32)


def detect_voiced_segments(wav, sr=SR, top_db=30, min_len=1.5, max_len=12.0):
    """Use librosa.effects.split for non-silent regions, then refine length."""
    intervals = librosa.effects.split(wav, top_db=top_db)
    out = []
    for s, e in intervals:
        dur = (e - s) / sr
        if dur < min_len:
            continue
        if dur <= max_len:
            out.append((s, e))
        else:
            # cut into max_len chunks at silence boundaries (simple)
            n = int(np.ceil(dur / max_len))
            step = (e - s) // n
            for i in range(n):
                out.append((s + i * step, min(e, s + (i + 1) * step)))
    return out


def build_ahong_prototype(encoder, muted_files):
    """Average embedding across many 3-8 sec clips from muted recordings (阿宏 only)."""
    embs = []
    for mp in muted_files:
        wav = load_wav(mp)
        segs = detect_voiced_segments(wav, top_db=35, min_len=2.0, max_len=8.0)
        # take up to 5 clips per file
        for s, e in segs[:5]:
            clip = wav[s:e]
            if len(clip) < SR * 1.5:
                continue
            embs.append(encoder.embed(clip))
    if not embs:
        raise RuntimeError("No anchor embeddings extracted — check muted files")
    proto = np.mean(np.stack(embs), axis=0)
    proto = proto / (np.linalg.norm(proto) + 1e-9)
    print(f"  Prototype built from {len(embs)} 阿宏 clips across {len(muted_files)} files.")
    return proto


# ──────────────────────────────────────────────────────────────────────────────
# 3. Process the 78 dialog WAVs
# ──────────────────────────────────────────────────────────────────────────────

def cosine(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def topic_from_filename(fn):
    """ '文本_創業_陪聊.wav' → '創業'  /  '失戀_陪聊.wav' → '失戀' """
    name = os.path.splitext(os.path.basename(fn))[0]
    name = re.sub(r"^文本_", "", name)
    name = re.sub(r"_陪聊$|_muted$", "", name)
    return name


def process_dialog_wav(encoder, proto, wav_path, idx_offset, kept_writer, audit_writer):
    """VAD-split, embed each, classify, save 阿宏 slices."""
    wav = load_wav(wav_path)
    segs = detect_voiced_segments(wav, top_db=30, min_len=1.5, max_len=12.0)
    topic = topic_from_filename(wav_path)
    src = os.path.basename(wav_path)

    n_kept = n_audit = n_drop = 0
    for i, (s, e) in enumerate(segs):
        clip = wav[s:e]
        if len(clip) < SR * 1.2:
            continue
        emb = encoder.embed(clip)
        sim = cosine(emb, proto)
        seg_id = f"ahong_{idx_offset:06d}"
        idx_offset += 1
        rec = {
            "id": seg_id,
            "src": src,
            "topic": topic,
            "start": round(s / SR, 3),
            "end": round(e / SR, 3),
            "dur": round((e - s) / SR, 3),
            "spk_sim": round(sim, 3),
        }
        if sim >= KEEP_SIM:
            # save slice
            slice_path = os.path.join(SLICES_DIR, f"{seg_id}.wav")
            sf.write(slice_path, clip, SR, subtype="PCM_16")
            kept_writer.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n_kept += 1
        elif sim >= DROP_SIM:
            audit_writer.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n_audit += 1
        else:
            n_drop += 1
    return idx_offset, (n_kept, n_audit, n_drop)


# ──────────────────────────────────────────────────────────────────────────────
# 4. Main
# ──────────────────────────────────────────────────────────────────────────────

def main():
    print(f"Loading campplus.onnx → {CAMPPLUS_ONNX}")
    if not os.path.exists(CAMPPLUS_ONNX):
        print("ERROR: campplus.onnx not found at", CAMPPLUS_ONNX)
        sys.exit(1)
    enc = CamppPlusEncoder(CAMPPLUS_ONNX)

    # Find _muted files anywhere under BASE
    muted = sorted(glob.glob(f"{BASE}/**/*_muted.wav", recursive=True))
    muted = [m for m in muted if not os.path.basename(m).startswith("._")]
    print(f"Found {len(muted)} _muted files (anchor set)")
    if len(muted) < 5:
        print("WARNING: very few muted files for anchor; results may be noisy.")
    proto = build_ahong_prototype(enc, muted)
    np.save("/workspace/data/ahong_proto.npy", proto)
    print("Prototype saved → /workspace/data/ahong_proto.npy")

    # 78 dialog files = all *_陪聊.wav files that do NOT have a _muted sibling
    all_chat = sorted(glob.glob(f"{BASE}/**/*_陪聊.wav", recursive=True))
    all_chat = [c for c in all_chat if not os.path.basename(c).startswith("._")]
    muted_topics = {topic_from_filename(m) for m in muted}
    dialog_to_diarize = [c for c in all_chat if topic_from_filename(c) not in muted_topics]
    print(f"陪聊 total: {len(all_chat)} | already-muted topics: {len(muted_topics)} | NEED diarize: {len(dialog_to_diarize)}")

    idx = 0
    totals = [0, 0, 0]
    with open(META_JSONL, "w") as kw, open(AUDIT_JSONL, "w") as aw:
        for i, dp in enumerate(dialog_to_diarize):
            print(f"  [{i+1}/{len(dialog_to_diarize)}] {os.path.basename(dp)}", end=" ")
            try:
                idx, (k, a, d) = process_dialog_wav(enc, proto, dp, idx, kw, aw)
                totals = [totals[0]+k, totals[1]+a, totals[2]+d]
                print(f"→ keep:{k} audit:{a} drop:{d}")
            except Exception as e:
                print(f"FAILED: {e}")

    print()
    print(f"DONE. Kept: {totals[0]}  Audit: {totals[1]}  Drop: {totals[2]}")
    print(f"Slices: {SLICES_DIR}")
    print(f"Meta:   {META_JSONL}")
    print(f"Audit:  {AUDIT_JSONL}")


if __name__ == "__main__":
    main()
