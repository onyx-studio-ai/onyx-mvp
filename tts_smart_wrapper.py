#!/usr/bin/env python3
"""
TTS Smart Wrapper — 修長 input + 混合語言 + 過訓殘留漏字
2026-05-31

Pipeline:
  input → tokenize (語言+標點邊界)
        → 每段獨立 API call (cut0 + 對應 text_lang)
        → 跑 N 次取最長 (處理 truncation 不穩)
        → silenceremove 裁靜音
        → acrossfade 80ms 黏接
        → 輸出單一 wav

Use case:
  - Wing/阿宏/Eric 長句 + 中英混合
  - 模型過訓導致長句漏字
  - 客戶端 API 透明使用

Dependencies:
  pip install requests
  brew install ffmpeg

Usage CLI:
  python tts_smart_wrapper.py \\
    --url https://9vjktvfw20sxzs-80.proxy.runpod.net \\
    --key onyx-eric-key-2024 \\
    --voice wing \\
    --text "Spotify Premium 全新體驗,立即試用。" \\
    --output out.wav

Usage as module:
  from tts_smart_wrapper import generate_smart_tts
  generate_smart_tts(url, key, voice, text, output_path)
"""
import argparse, json, os, re, subprocess, sys, tempfile
from pathlib import Path
import urllib.request
import urllib.error


# ============================================================================
# Tokenization — 將輸入文本切成 (text, lang) 段
# ============================================================================

_PUNCT_HARD = "。！？!?"           # 強分隔(必切)
_PUNCT_SOFT = "，,；;：:、"        # 弱分隔(切但段間銜接緊)
_PUNCT_ALL = _PUNCT_HARD + _PUNCT_SOFT


def _char_lang(c: str) -> str:
    """Classify single character: 'en' | 'zh' | 'punct' | 'space' | 'other'."""
    if c in _PUNCT_ALL or c in ".,!?;:":
        return "punct"
    if c.isspace():
        return "space"
    # CJK Unified Ideographs + extensions
    o = ord(c)
    if (0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF or
        0x20000 <= o <= 0x2A6DF or 0xF900 <= o <= 0xFAFF):
        return "zh"
    if c.isascii() and c.isalpha():
        return "en"
    return "other"


def tokenize(text: str, chinese_lang: str = "auto_yue") -> list[tuple[str, str]]:
    """
    Split text at language boundaries + hard/soft punctuation.

    Returns list of (segment_text, text_lang) tuples.

    Example:
      "Spotify Premium 全新體驗,立即試用。"
        → [("Spotify Premium", "en"),
           ("全新體驗,", "auto_yue"),
           ("立即試用。", "auto_yue")]
    """
    segments = []
    cur_text = ""
    cur_lang = None  # 'en' / 'zh' / None

    def flush(extra=""):
        nonlocal cur_text, cur_lang
        seg = (cur_text + extra).strip()
        if seg:
            lang = "en" if cur_lang == "en" else chinese_lang
            segments.append((seg, lang))
        cur_text = ""
        cur_lang = None

    for c in text:
        cl = _char_lang(c)

        if cl == "punct":
            # 標點屬於前一段
            cur_text += c
            flush()
            continue

        if cl in ("space", "other"):
            # 空白/其他字元:歸入當前段(不分割)
            if cur_text:
                cur_text += c
            continue

        # cl in ("en", "zh")
        if cur_lang is None:
            cur_lang = cl
            cur_text = c
        elif cl == cur_lang:
            cur_text += c
        else:
            # language change → flush + start new
            flush()
            cur_lang = cl
            cur_text = c

    flush()
    return segments


# ============================================================================
# TTS API call with retry-for-longest strategy
# ============================================================================

def call_tts(url_base: str, api_key: str, voice: str, text: str,
             text_lang: str, response_format: str = "wav") -> bytes:
    """Single API call to /v1/audio/speech."""
    req_body = {
        "model": "tts-1",
        "voice": voice,
        "input": text,
        "response_format": response_format,
        "extra_body": {"language": text_lang},
    }
    req = urllib.request.Request(
        f"{url_base}/v1/audio/speech",
        data=json.dumps(req_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "tts-smart-wrapper/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def generate_segment(url_base, api_key, voice, text, text_lang,
                     num_tries=3, tmpdir=None) -> Path:
    """
    Generate one segment, try N times, return file with LONGEST audio
    (= least truncated by over-fit model).
    """
    tmpdir = Path(tmpdir or tempfile.mkdtemp())
    tmpdir.mkdir(parents=True, exist_ok=True)
    best_path = None
    best_dur = 0.0

    for i in range(num_tries):
        audio_bytes = call_tts(url_base, api_key, voice, text, text_lang)
        p = tmpdir / f"try_{i}_{text_lang}.wav"
        p.write_bytes(audio_bytes)
        d = audio_duration(p)
        if d > best_dur:
            best_dur = d
            best_path = p

    return best_path


def audio_duration(path: Path) -> float:
    """Get audio file duration in seconds via ffprobe."""
    try:
        out = subprocess.check_output([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=nw=1:nk=1", str(path)
        ], stderr=subprocess.DEVNULL, timeout=10)
        return float(out.strip())
    except Exception:
        return 0.0


# ============================================================================
# Audio post-processing — silence trim + acrossfade glue
# ============================================================================

def trim_silence(in_path: Path, out_path: Path, thresh_db: float = -40):
    """Remove leading and trailing silence below threshold."""
    af = (
        f"silenceremove="
        f"start_periods=1:start_duration=0:start_threshold={thresh_db}dB:"
        f"stop_periods=-1:stop_duration=0.05:stop_threshold={thresh_db}dB"
    )
    subprocess.run([
        "ffmpeg", "-y", "-v", "error",
        "-i", str(in_path), "-af", af, str(out_path)
    ], check=True)


def glue_with_crossfade(wav_paths: list[Path], out_path: Path,
                         xfade_seconds: float = 0.08):
    """Crossfade-glue N wav files into one continuous wav."""
    if not wav_paths:
        raise ValueError("no wav files to glue")
    if len(wav_paths) == 1:
        # just copy
        out_path.write_bytes(wav_paths[0].read_bytes())
        return

    # build filtergraph: chain acrossfade pairwise
    inputs = []
    for p in wav_paths:
        inputs += ["-i", str(p)]

    filt_parts = []
    cur = "[0:a]"
    for i in range(1, len(wav_paths)):
        next_in = f"[{i}:a]"
        out_lbl = f"[a{i}]" if i < len(wav_paths) - 1 else "[out]"
        filt_parts.append(
            f"{cur}{next_in}acrossfade=d={xfade_seconds}:c1=tri:c2=tri{out_lbl}"
        )
        cur = out_lbl

    filt = ";".join(filt_parts)
    subprocess.run([
        "ffmpeg", "-y", "-v", "error",
        *inputs,
        "-filter_complex", filt,
        "-map", "[out]",
        str(out_path),
    ], check=True)


# ============================================================================
# End-to-end pipeline
# ============================================================================

def generate_smart_tts(url_base: str, api_key: str, voice: str, text: str,
                       output_path: str, chinese_lang: str = "auto_yue",
                       num_tries: int = 3, xfade_seconds: float = 0.08,
                       verbose: bool = True) -> Path:
    """
    Main pipeline:
      1. Tokenize at language+punctuation boundaries
      2. Generate each segment (N tries, pick longest)
      3. Silence-trim each
      4. Crossfade-glue all
      5. Write final wav
    """
    tmpdir = Path(tempfile.mkdtemp(prefix="smart_tts_"))
    segments = tokenize(text, chinese_lang)

    if verbose:
        print(f"[smart_tts] Tokenized into {len(segments)} segments:", file=sys.stderr)
        for i, (t, l) in enumerate(segments):
            print(f"  [{i}] lang={l:10s} text={t!r}", file=sys.stderr)

    # Step 1: generate each segment (N tries, keep longest)
    raw_paths = []
    for i, (seg_text, seg_lang) in enumerate(segments):
        if verbose:
            print(f"[smart_tts] Generating segment {i} ({num_tries} tries)...", file=sys.stderr)
        p = generate_segment(url_base, api_key, voice, seg_text, seg_lang,
                             num_tries=num_tries, tmpdir=tmpdir / f"seg{i}")
        if verbose:
            print(f"  → {p} ({audio_duration(p):.2f}s)", file=sys.stderr)
        raw_paths.append(p)

    # Step 2: trim silence per segment
    trim_paths = []
    for i, p in enumerate(raw_paths):
        tp = tmpdir / f"trim_{i}.wav"
        trim_silence(p, tp)
        if verbose:
            print(f"[smart_tts] Trimmed {i}: {audio_duration(p):.2f}s → {audio_duration(tp):.2f}s", file=sys.stderr)
        trim_paths.append(tp)

    # Step 3: glue with crossfade
    out_path = Path(output_path)
    glue_with_crossfade(trim_paths, out_path, xfade_seconds=xfade_seconds)

    if verbose:
        print(f"[smart_tts] DONE → {out_path} ({audio_duration(out_path):.2f}s)", file=sys.stderr)

    return out_path


# ============================================================================
# CLI
# ============================================================================

def main():
    ap = argparse.ArgumentParser(description="TTS Smart Wrapper")
    ap.add_argument("--url", required=True, help="Gateway base URL, e.g. https://...runpod.net")
    ap.add_argument("--key", required=True, help="API key (Bearer token)")
    ap.add_argument("--voice", required=True, help="Voice name (wing, eric, ahong, ...)")
    ap.add_argument("--text", required=True, help="Text to speak")
    ap.add_argument("--output", required=True, help="Output WAV path")
    ap.add_argument("--chinese-lang", default="auto_yue",
                    help="Lang code for Chinese segments (auto_yue for Wing, auto for Eric/阿宏)")
    ap.add_argument("--num-tries", type=int, default=3,
                    help="Tries per segment (longer = less truncation risk, more $)")
    ap.add_argument("--xfade", type=float, default=0.08,
                    help="Crossfade overlap in seconds")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    out = generate_smart_tts(
        args.url, args.key, args.voice, args.text, args.output,
        chinese_lang=args.chinese_lang,
        num_tries=args.num_tries,
        xfade_seconds=args.xfade,
        verbose=not args.quiet,
    )
    print(str(out))


if __name__ == "__main__":
    main()
