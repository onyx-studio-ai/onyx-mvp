#!/usr/bin/env python3
# 匯入「凡音_總名單_客戶與配音員.xlsx」(四信箱合併總表)→ prospects。
# 分頁對應:配音員→talent、聽打員→proofreader(note標校對)、客戶→client(一 email 一列、掛公司)、
#           ⚠冷名單→talent 但 status=suppressed(永不寄,存證)。
# 預設 dry-run(只報表);--commit 才寫入。email 小寫唯一鍵,多來源/多格 email 自動去重。
# 跑法:  uv run --with openpyxl python3 scripts/import-master-prospects.py [--commit]

import re, sys, json, argparse, urllib.request, urllib.parse
from pathlib import Path
from collections import Counter

MASTER = Path("/Volumes/WingAI SSD/Claude/Projects/Admin/Email整理/凡音_總名單_客戶與配音員.xlsx")
ENV = Path(__file__).resolve().parent.parent / ".env"
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

LANG_RULES = [
    (("粵", "廣東", "广东", "cantonese", "香港", "hong kong"), "Cantonese · Hong Kong"),
    (("大陸", "大陆", "普通話", "普通话", "mainland", "简体", "簡體"), "Mandarin · Mainland"),
    (("台灣", "台湾", "國語", "国语", "taiwan", "繁體中文", "台語", "台语"), "Mandarin · Taiwan"),
    (("日文", "日語", "日语", "japanese"), "Japanese"),
    (("韓", "韩", "korean"), "Korean"),
    (("泰", "thai"), "Thai"),
    (("越", "vietnam"), "Vietnamese"),
    (("印尼", "indonesia"), "Indonesian"),
    (("西班牙", "spanish"), "Spanish"),
    (("法文", "法語", "法语", "french"), "French"),
    (("德", "german"), "German"),
]

def norm_langs(raw):
    if not raw: return []
    t = str(raw).lower(); out = []
    for keys, val in LANG_RULES:
        if any(k.lower() in t for k in keys) and val not in out: out.append(val)
    if any(k in t for k in ("english", "英文", "英語", "英语")) or re.search(r"\beng\b", t):
        v = "English · American" if any(k in t for k in ("us", "american", "美")) else \
            "English · British" if any(k in t for k in ("uk", "british", "英國", "英国")) else "English"
        if v not in out: out.append(v)
    return out

# 性別/地區只認「明確字樣」(鐵律:絕不用猜的,不從姓名推)。兩性都出現→留空;多地矛盾→留空。
GENDER_F = ("女聲", "女声", "女配", "女主播", "女生", "female", "♀")
GENDER_M = ("男聲", "男声", "男配", "男主播", "男生", "male", "♂")
def norm_gender(*texts):
    t = " ".join(str(x or "") for x in texts).lower()
    f = any(k in t for k in GENDER_F); m = any(k in t for k in GENDER_M)
    if f and not m: return "female"
    if m and not f: return "male"
    return ""

REGION_RULES = [
    (("香港", "hong kong"), "香港"),
    (("台灣", "台湾", "台北", "taiwan", "台語", "台语"), "台灣"),
    (("大陸", "大陆", "北京", "上海", "廣州", "广州", "深圳", "mainland", "中國", "中国"), "中國大陸"),
    (("馬來西亞", "马来西亚", "malaysia"), "馬來西亞"),
    (("新加坡", "singapore"), "新加坡"),
    (("日本", "japan"), "日本"),
    (("韓國", "韩国", "korea"), "韓國"),
    (("美國", "美国", "american", "usa"), "美國"),
    (("英國", "英国", "britain", "united kingdom"), "英國"),
    (("加拿大", "canada"), "加拿大"),
    (("澳洲", "australia"), "澳洲"),
    (("泰國", "泰国", "thailand"), "泰國"),
    (("越南", "vietnam"), "越南"),
    (("印尼", "indonesia"), "印尼"),
    (("菲律賓", "菲律宾", "philippine"), "菲律賓"),
    (("印度", "india"), "印度"),
    (("法國", "法国", "france"), "法國"),
    (("德國", "德国", "germany"), "德國"),
]
def norm_region(*texts):
    t = " ".join(str(x or "") for x in texts).lower()
    hits = {val for keys, val in REGION_RULES if any(k.lower() in t for k in keys)}
    return next(iter(hits)) if len(hits) == 1 else ""

def cell(v): return "" if v is None else str(v).strip()
def emails_in(*cells):
    seen = []
    for c in cells:
        for m in EMAIL_RE.findall(str(c or "")):
            e = m.strip().lower()
            if e not in seen: seen.append(e)
    return seen

def load_env():
    kv = {}
    for line in ENV.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("="); kv[k.strip()] = v.strip().strip('"')
    return kv["NEXT_PUBLIC_SUPABASE_URL"], kv["SUPABASE_SERVICE_ROLE_KEY"]

def parse():
    import openpyxl
    wb = openpyxl.load_workbook(MASTER, read_only=True, data_only=True)
    warm = {}   # email -> row(dict)  (可邀)
    cold = {}   # email -> row(dict)  (suppressed)
    skipped = []

    def add(bucket, email, **kw):
        if email in bucket:
            m = bucket[email]
            m["languages"] = sorted(set(m.get("languages", [])) | set(kw.get("languages", [])))
            for k in ("name", "company", "country", "gender"):
                if not m.get(k) and kw.get(k): m[k] = kw[k]
            if kw.get("note") and kw["note"] not in (m.get("note") or ""):
                m["note"] = (m.get("note", "") + " | " + kw["note"]).strip(" |")
        else:
            bucket[email] = dict(email=email, **kw)

    for ws in wb.worksheets:
        t = ws.title
        data = list(ws.iter_rows(min_row=2, values_only=True))
        if t == "配音員":
            for r in data:
                r = list(r) + [""] * 5
                name, lang, note = cell(r[0]), cell(r[3]), cell(r[4])
                es = emails_in(r[2], r[0])
                if not es:
                    if name: skipped.append(("配音員", name))
                    continue
                add(warm, es[0], name=name, kind="talent", company="",
                    country=norm_region(lang, note), gender=norm_gender(name, lang, note),
                    languages=norm_langs(lang), note=(f"[{lang}] {note}" if lang else note).strip(), source="finevoice")
        elif t == "聽打員":
            for r in data:
                r = list(r) + [""] * 5
                name, lang, note = cell(r[0]).lstrip("✅ ").strip(), cell(r[3]), cell(r[4])
                es = emails_in(r[2], r[0])
                if not es:
                    if name: skipped.append(("聽打員", name))
                    continue
                add(warm, es[0], name=name, kind="proofreader", company="",
                    country=norm_region(lang, note), gender=norm_gender(name, lang, note),
                    languages=norm_langs(lang), note=("校對 · " + note if note else "校對"), source="finevoice")
        elif t == "客戶":
            for r in data:
                r = list(r) + [""] * 11
                company, country = cell(r[0]), cell(r[7])
                note = " · ".join(x for x in [cell(r[8]), cell(r[9]), cell(r[10])] if x)
                es = emails_in(r[2], r[3], r[4], r[5], r[6])   # 5 個聯絡欄,每格可多 email
                if not es:
                    if company: skipped.append(("客戶", company))
                    continue
                for e in es:   # 一 email 一列,都掛同公司
                    add(warm, e, name="", kind="client", company=company, country=country, gender="",
                        languages=[], note=note, source="finevoice")
        elif t.startswith("⚠") or "冷名單" in t:
            for r in data:
                r = list(r) + [""] * 5
                es = emails_in(r[0])
                if not es: continue
                note = " · ".join(x for x in [cell(r[1]), cell(r[3]), cell(r[4])] if x)
                import re as _re
                region = _re.sub(r"[\U0001F000-\U0001FAFF\u2600-\u27BF]", "", cell(r[1])).strip()
                add(cold, es[0], name="", kind="talent", company="", country=region, gender="",
                    languages=[], note=note, source="drip")

    # 冷名單優先:同 email 若也出現在暖名單,一律以 suppressed 為準(安全)。
    for e in list(warm.keys()):
        if e in cold: warm.pop(e, None)
    return list(warm.values()), list(cold.values()), skipped

def sb(url, key, method, path, body=None, extra=None):
    req = urllib.request.Request(url + path, method=method,
        data=json.dumps(body).encode() if body is not None else None)
    req.add_header("apikey", key); req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    for k, v in (extra or {}).items(): req.add_header(k, v)
    with urllib.request.urlopen(req) as r:
        raw = r.read().decode(); return r.status, (json.loads(raw) if raw else None)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true")
    args = ap.parse_args()
    warm, cold, skipped = parse()
    url, key = load_env()

    joined = set()
    try:
        _, d = sb(url, key, "GET", "/rest/v1/talents?select=email&limit=6000")
        joined = {str(x["email"]).lower() for x in (d or []) if x.get("email")}
    except Exception as e:
        print(f"⚠️ 讀 talents 失敗(不影響 dry-run):{e}")
    existing = set(); existing_rows = {}
    try:
        _, d = sb(url, key, "GET", "/rest/v1/prospects?select=email,name,company,country,gender,languages,note&limit=10000")
        for x in (d or []):
            e = str(x.get("email") or "").lower()
            if e: existing.add(e); existing_rows[e] = x
    except Exception as e:
        print(f"⚠️ 讀 prospects 失敗:{e}")

    # 合併策略:Excel 是聯絡資料的 source of truth(name/company/country/gender/languages 新值優先、
    # 空值沿用 DB);note 例外 —— 後台的 note 是往來紀錄,Wing 手寫的內容不能丟:
    # 以 Excel note 為底,DB note 有而 Excel 沒有的片段附加在後(去重)。
    for p in warm + cold:
        ex = existing_rows.get(p["email"])
        if not ex: continue
        for k in ("name", "company", "country", "gender"):
            if not p.get(k) and ex.get(k): p[k] = ex[k]
        p["languages"] = sorted(set(p.get("languages", [])) | set(ex.get("languages") or []))
        dbn, xln = str(ex.get("note") or "").strip(), str(p.get("note") or "").strip()
        if dbn and dbn not in xln:
            p["note"] = (xln + (" ｜ " if xln else "") + dbn)[:2000]

    kinds = Counter(p["kind"] for p in warm)
    would_join = [p for p in warm if p["email"] in joined]
    new_warm = [p for p in warm if p["email"] not in existing]
    langc = Counter()
    for p in warm:
        if p["kind"] == "talent":
            for l in (p["languages"] or ["(未分類)"]): langc[l] += 1

    print("=" * 60)
    print(f"暖名單(可邀):{len(warm)} 筆 → 配音員 {kinds.get('talent',0)} / 客戶 {kinds.get('client',0)} / 校對 {kinds.get('proofreader',0)}")
    print(f"冷名單(→ suppressed 存證):{len(cold)} 筆")
    print(f"其中「新的、DB 還沒有」:{len(new_warm)} 筆;已存在會合併:{len(warm)-len(new_warm)} 筆")
    print(f"已在平台 talents → 會標 joined:{len(would_join)} 筆")
    print(f"跳過(無 email):{len(skipped)} 筆")
    from collections import Counter as _C
    gc = _C(p.get("gender") or "(未標)" for p in warm if p["kind"] == "talent")
    rc = _C(p.get("country") or "(未標)" for p in warm)
    print(f"性別(配音員):{dict(gc)}")
    print(f"地區 top10:{rc.most_common(10)}")
    print("-" * 60)
    print("配音員語言分布:")
    for l, n in langc.most_common(): print(f"   {l:26} {n}")
    print("-" * 60)
    print("配音員樣本(前 6):")
    for p in [x for x in warm if x['kind']=='talent'][:6]:
        print(f"   {(p['name'] or '')[:14]:14} {p['email']:34} {','.join(p['languages']) or '—'}")
    print("客戶樣本(前 6):")
    for p in [x for x in warm if x['kind']=='client'][:6]:
        print(f"   {(p['company'] or '')[:22]:22} {p['email']:34} {p['country']}")
    print("冷名單樣本(前 4):")
    for p in cold[:4]: print(f"   {p['email']:40} {(p['note'] or '')[:30]}")
    print("=" * 60)

    if not args.commit:
        print("DRY-RUN,沒寫入任何東西。確認後加 --commit。")
        return

    def upsert(rows, with_status=None):
        if not rows: return
        payload = []
        for p in rows:
            row = dict(email=p["email"], name=p.get("name") or None, kind=p["kind"],
                       company=p.get("company") or None, country=p.get("country") or None,
                       gender=p.get("gender") or None,
                       languages=p.get("languages", []), note=p.get("note") or None, source=p["source"])
            if with_status: row["status"] = with_status
            payload.append(row)
        for i in range(0, len(payload), 200):
            st, _ = sb(url, key, "POST", "/rest/v1/prospects?on_conflict=email",
                       payload[i:i+200], {"Prefer": "resolution=merge-duplicates,return=minimal"})
            print(f"   upsert {i}-{i+len(payload[i:i+200])} → HTTP {st}")

    print(f"寫入暖名單 {len(warm)} 筆(不帶 status,保留既有 joined/suppressed)…")
    upsert(warm)
    print(f"寫入冷名單 {len(cold)} 筆(status=suppressed)…")
    upsert(cold, with_status="suppressed")

    ins = [e for e in (p["email"] for p in warm) if e in joined]
    for i in range(0, len(ins), 50):
        chunk = ins[i:i+50]
        q = "(" + ",".join(urllib.parse.quote(e) for e in chunk) + ")"
        sb(url, key, "PATCH", f"/rest/v1/prospects?status=eq.active&email=in.{q}",
           {"status": "joined"}, {"Prefer": "return=minimal"})
    print(f"標記 joined:{len(ins)} 筆已在平台者。")
    print("✅ 匯入完成。")

if __name__ == "__main__":
    main()
