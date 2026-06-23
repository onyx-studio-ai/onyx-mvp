"""
阿宏 Stage C — Build paginated audit HTML for ~2500 SV-transcribed segments.

Reads:  /workspace/data/ahong_sv_segments.jsonl
Writes: /workspace/data/ahong_chunks/chunk_{1..6}.html + index.html

Features:
  - 5-6 paginated chunks (~1 MB each, snappy in browser)
  - Per row: audio player + SV text (editable) + topic + duration
  - localStorage accumulation across chunks (key: "ahong_edits_v1")
  - "📥 匯出修正" downloads single JSON across all chunks
  - Visual cue: rows already-edited highlighted green
"""
import json, os, html, math

JSONL = "/workspace/data/ahong_sv_segments.jsonl"
OUT_DIR = "/workspace/data/ahong_chunks"
SLICES_REL = "../ahong_slices"   # relative to chunks/ HTML location
N_CHUNKS = 6
PREV_EDITS_JSON = "/workspace/data/ahong_user_edits.json"

os.makedirs(OUT_DIR, exist_ok=True)

# Optional: load previous edits (for re-runs)
prev = {}
if os.path.exists(PREV_EDITS_JSON):
    prev = json.load(open(PREV_EDITS_JSON))

rows = []
with open(JSONL) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))

print(f"Loaded {len(rows)} segments, prev edits: {len(prev)}")
chunk_size = math.ceil(len(rows) / N_CHUNKS)

CSS = """<style>
body{font-family:-apple-system,"PingFang TC",sans-serif;max-width:1400px;margin:20px auto;padding:0 20px}
.head{background:#f4f4f7;padding:12px 20px;border-radius:8px;margin-bottom:20px;position:sticky;top:0;z-index:10;box-shadow:0 1px 5px rgba(0,0,0,.05)}
.row{border-bottom:1px solid #eee;padding:10px 0;display:grid;grid-template-columns:200px 80px 1fr;gap:14px;align-items:start}
.id{font-family:monospace;color:#888;font-size:11px}
.id .topic{display:inline-block;background:#e0e8ff;padding:1px 6px;border-radius:3px;font-size:10px;color:#235;margin-left:4px}
.dur{font-family:monospace;color:#aaa;font-size:11px;margin-top:2px}
.col{font-size:15px;line-height:1.5}
.editable[contenteditable=true]{background:#fffae0;outline:1px dashed #c90;padding:4px 6px;cursor:text;min-height:1.4em;border-radius:3px}
.editable.modified{background:#fde7d0;outline:2px solid #f60}
.editable.done{background:#e0ffe6;outline:1px solid #4a4}
audio{height:24px;width:170px;display:block;margin-top:4px}
.btn{background:#1d1d1f;color:#fff;padding:7px 14px;border:none;border-radius:5px;cursor:pointer;font-size:13px;margin-right:6px;text-decoration:none;display:inline-block}
.nav{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.nav a{padding:6px 12px;background:#fff;border:1px solid #ddd;border-radius:5px;text-decoration:none;color:#333;font-size:13px}
.nav a.current{background:#1d1d1f;color:#fff;border-color:#1d1d1f}
.raw{font-size:10px;color:#aaa;margin-top:4px;font-family:monospace}
</style>"""

JS_BLOCK = """
window.edits = Object.assign({}, window.PREV || {});
var lsv = JSON.parse(localStorage.getItem(window.KEY) || "{}");
for (var k in lsv) window.edits[k] = lsv[k];
document.querySelectorAll(".editable").forEach(function(el){
  var id = el.dataset.segid;
  if (window.edits[id] != null && window.edits[id] !== el.dataset.orig) {
    el.textContent = window.edits[id];
    el.classList.add("modified");
  }
});
function updCount(){
  var n = Object.keys(lsv).length;
  var total = Object.keys(window.edits).length;
  document.getElementById("savesync").textContent = "本頁修正:" + n + " | 累積全部:" + total;
}
function onEdit(el){
  var id = el.dataset.segid; var v = el.textContent.trim();
  if (v !== el.dataset.orig){
    lsv[id] = v; window.edits[id] = v;
    el.classList.add("modified");
  } else {
    delete lsv[id]; delete window.edits[id];
    el.classList.remove("modified");
  }
  localStorage.setItem(window.KEY, JSON.stringify(lsv));
  updCount();
}
function exportEdits(){
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(window.edits, null, 2)], {type:"application/json"}));
  a.download = "ahong_edits_" + new Date().toISOString().slice(0,16).replace(/[:T]/g,"-") + ".json";
  a.click();
}
updCount();
"""

prev_js = json.dumps(prev, ensure_ascii=False)

for ci in range(N_CHUNKS):
    start = ci * chunk_size
    end = min(start + chunk_size, len(rows))
    chunk = rows[start:end]
    if not chunk:
        continue
    fname = f"chunk_{ci+1}.html"
    out_path = os.path.join(OUT_DIR, fname)

    p = []
    p.append('<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">')
    p.append(f'<title>阿宏 audit {ci+1}/{N_CHUNKS}</title>{CSS}</head><body>')
    p.append('<div class="head">')
    p.append(f'<h2>阿宏 audit 第 {ci+1}/{N_CHUNKS} 段 · {chunk[0]["id"]} – {chunk[-1]["id"]} ({len(chunk)} 段)</h2>')
    p.append('<p style="font-size:13px;color:#555;margin:4px 0">阿宏(冠彥)講話是自由發揮的台灣國語,SV ASR 已轉寫並 s2twp 繁體化。請抓錯字 / 補語助詞 / 修標點。</p>')
    p.append('<div class="nav">')
    for i in range(N_CHUNKS):
        cls = ' class="current"' if i == ci else ''
        p.append(f'<a href="chunk_{i+1}.html"{cls}>第 {i+1} 段</a>')
    p.append('</div>')
    p.append('<div style="margin-top:8px">')
    p.append('<button class="btn" onclick="exportEdits()">📥 匯出累積修正</button>')
    p.append('<span id="savesync" style="font-size:13px;color:#666;margin-left:8px">載入中...</span>')
    p.append('</div></div>')

    for r in chunk:
        rid = r["id"]
        topic = r.get("topic","")
        text = r["text"]
        raw = r.get("text_raw","")
        p.append(f'<div class="row" data-id="{rid}">')
        p.append(f'<div class="id">{rid}<span class="topic">{html.escape(topic)}</span>')
        p.append(f'<div class="dur">{r["dur"]}s</div>')
        p.append(f'<audio controls preload="none" src="{SLICES_REL}/{rid}.wav"></audio></div>')
        p.append(f'<div class="dur" style="font-size:11px;color:#999">SV 信心 N/A</div>')
        p.append('<div class="col"><div style="font-size:11px;color:#888">SV(可改)</div>')
        p.append(f'<div class="editable" contenteditable="true" data-orig="{html.escape(text)}" data-segid="{rid}" oninput="onEdit(this)">{html.escape(text)}</div>')
        if raw and raw != text:
            p.append(f'<div class="raw">raw: {html.escape(raw)}</div>')
        p.append('</div></div>')

    p.append('<script>window.KEY="ahong_edits_v1";window.PREV=' + prev_js + ';' + JS_BLOCK + '</script>')
    p.append('</body></html>')

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("".join(p))
    sz = os.path.getsize(out_path) / 1024
    print(f"  chunk_{ci+1}.html: {len(chunk)} rows, {sz:.0f} KB")

# Index
idx = []
idx.append('<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">')
idx.append('<title>阿宏 audit index</title>')
idx.append('<style>body{font-family:-apple-system,"PingFang TC",sans-serif;max-width:600px;margin:50px auto;padding:20px}')
idx.append('a{display:block;padding:14px 18px;background:#f4f4f7;margin-bottom:8px;border-radius:6px;text-decoration:none;color:#333;font-size:15px}')
idx.append('a:hover{background:#1d1d1f;color:#fff}h2{margin-top:0}</style></head><body>')
idx.append(f'<h2>阿宏 audit ({len(rows)} 段)</h2>')
idx.append('<p>每 chunk 約 ~1 MB,秒開。修正會自動存到瀏覽器,在任一 chunk 按「匯出」拿全部累積。</p>')
for i in range(N_CHUNKS):
    s = i * chunk_size
    e = min(s + chunk_size, len(rows))
    if s >= len(rows): break
    idx.append(f'<a href="chunk_{i+1}.html">第 {i+1} 段 · {rows[s]["id"]} – {rows[e-1]["id"]} ({e-s} 段)</a>')
idx.append('</body></html>')
with open(os.path.join(OUT_DIR, "index.html"), "w", encoding="utf-8") as f:
    f.write("".join(idx))

print(f"\n→ Index at {OUT_DIR}/index.html")
print(f"→ Sync chunks/ + slices/ to local Desktop to review")
