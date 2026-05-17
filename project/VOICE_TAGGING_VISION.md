# Voice Demo Tagging Pipeline (MVP -> Scale)

> ⚠️ **ASPIRATIONAL DESIGN — NOT IMPLEMENTED**
>
> This document describes a future auto-tagging system. **It is not what the
> codebase currently does.** As of 2026-05-15:
>
> - **Talent IDs are UUIDs**, not the `TAL-<lang>-<nnnn>` scheme proposed in §2.
> - **Demo files are stored as URLs** in the `talents.demo_urls` JSONB column;
>   there is no `DEM-*` ID, no version field, no checksum.
> - The DB has only **three tagging columns**: `languages[]`, `gender`,
>   `tags[]` (free-text). None of the §3 fields (`age_tone`, `accent`,
>   `record_quality`, `confidence_score`, `needs_review`, `rate_tier`, ...)
>   exist in the schema.
> - There is **no auto-tagging pipeline** (§4). No ASR step, no audio feature
>   extraction, no AI classifier, no review queue.
> - Tags are **manually assigned by an admin** via `app/[locale]/admin/talents/`.
>
> Treat the rest of this document as a vision / future-phase plan, not as a
> description of the current system. Before referencing any naming scheme or
> field from this doc in new code, confirm it actually exists in the schema.

## 0) 目標
- 把上萬個配音員 DEMO 變成可搜尋、可篩選、可商務化使用的資產。
- 降低人工標註時間，讓 AI 先做 80%，人工只做關鍵覆核。
- 可直接供業務與製作部快速配對人才與報價。

---

## 1) 適用範圍
- 適用對象：所有配音員 DEMO（歷史檔 + 新增檔）。
- 優先順序：先處理高使用頻率語言與高成交類型（廣告、遊戲、TTS）。

---

## 2) 命名與 ID 規則（一定要先做）

## Talent ID（配音員）
- 格式：`TAL-<語系>-<4位流水號>`
- 範例：`TAL-ZH-0231`, `TAL-EN-1042`

## Demo ID（音檔）
- 格式：`DEM-<TalentID>-<用途>-<語言>-<版本>`
- 範例：`DEM-TAL-ZH-0231-AD-ZH-TW-v1`

## 檔名規則
- 格式：`<DemoID>_<秒數>s_<YYYYMMDD>.wav`
- 範例：`DEM-TAL-ZH-0231-AD-ZH-TW-v1_28s_20260414.wav`

## 版本規則
- 內容或後製有變更：`v1 -> v2`
- 只改 metadata：不升版，只更新資料庫欄位與時間戳記

---

## 3) 標籤字典（Tag Taxonomy）

## A. 固定欄位（必填）
- `language`: zh-TW / zh-CN / en-US / ja-JP ...
- `gender_voice`: male / female / androgynous
- `age_tone`: child / teen / young_adult / adult / mature
- `accent`: taiwanese / beijing / cantonese / neutral / ...
- `use_case`: ad / game / narration / tts / character / e-learning
- `record_quality`: studio / home_pro / home_basic

## B. 聲音特徵（可複選）
- `timbre`: warm / bright / deep / crisp / soft / textured
- `energy`: low / medium / high
- `pace`: slow / medium / fast
- `emotion`: calm / friendly / authoritative / dramatic / playful / serious
- `style`: natural / commercial / cinematic / conversational / anime

## C. 商務欄位（業務必用）
- `rate_tier`: S / A / B / C
- `rush_available`: yes / no
- `revision_tendency`: low / medium / high
- `license_preference`: yearly / perpetual / case_by_case
- `tts_ready`: yes / no
- `status`: active / hold / unavailable

## D. 系統欄位（不可少）
- `confidence_score`: 0.00-1.00
- `needs_review`: true / false
- `review_owner`: human_id
- `last_reviewed_at`: timestamp

---

## 4) 自動化流程（Pipeline）

1. **Ingest**
- 新 DEMO 進入 `inbox` 資料夾即觸發流程。

2. **Preprocess**
- 音量正規化、去靜音、截取代表片段（15-30 秒）。

3. **ASR + Language Detect**
- 轉寫文字、偵測語言/口音。

4. **Audio Feature Extraction**
- 抽取語速、音高、能量、停頓、音色向量（embedding）。

5. **AI Tagging**
- 以「轉寫文本 + 音訊特徵 + 標籤字典」生成標籤與 confidence。

6. **Rule Validation**
- 格式檢查、必要欄位檢查、衝突檢查（例如 `tts_ready=no` 但 `use_case=tts`）。

7. **Write to DB**
- 寫入資料庫（Notion/Airtable/Postgres）。

8. **Human Review Queue**
- `confidence_score < 0.75` 或規則衝突 -> 進人工覆核。

9. **Publish Search Index**
- 通過覆核後進入可搜尋索引（供業務查找）。

---

## 5) 人工覆核策略（省工版）
- 只覆核低信心與高商業價值樣本，不全量重看。
- 每日抽檢：至少 50 筆（或當日新增量的 5%）。
- 抽檢不通過率 > 10% 時，回頭調整提示詞與規則。

---

## 6) MVP（前 14 天）

## Day 1-2
- 建立 ID/檔名規範與資料庫欄位。
- 定義 20 個核心標籤（先不要超過 20）。

## Day 3-5
- 跑首批 1,000 個 DEMO 自動標籤。
- 建立覆核佇列與信心分數閾值。

## Day 6-9
- 人工覆核高價值樣本，修正標籤規則。
- 完成「可搜尋」介面 MVP。

## Day 10-14
- 追加第二批資料，驗證速度與品質。
- 輸出準確率報告，確認是否擴到全量。

---

## 7) KPI（標註系統）
- `auto_tag_coverage`: 自動標註覆蓋率（目標 > 85%）
- `review_rate`: 人工覆核比例（目標 < 20%）
- `tag_accuracy`: 抽檢準確率（目標 > 90%）
- `search_success_rate`: 業務能在 3 分鐘內找到可用 demo 的比例（目標 > 80%）
- `time_to_shortlist`: 從需求到 shortlist 的平均時間（目標逐月下降）

---

## 8) 成本控制
- 先用低成本模型做初標，僅低信心資料送高能力模型二次判定。
- 音檔先切代表片段再分析，避免全檔推理成本。
- 已標註資料只做增量更新，不重跑全量。
- 週期性清理重複檔案與無效版本。

---

## 9) 風險與防呆
- 風險：同一人才多 ID、重複檔、錯語言分類、標籤漂移。
- 防呆：
  - 新增前先比對聲紋近似度與檔案 hash。
  - 規則衝突一律進覆核，不直接上線。
  - 每週固定回訓標籤字典與提示詞。

---

## 10) 與現有部門串接
- 業務與製作部：以標籤搜尋人才、快速組 shortlist。
- 行銷部：取用已授權 demo 做案例內容素材池。
- 法務部：綁定授權欄位，避免錯用素材。
- 工程部（ONYX）：維護索引、搜尋、推薦與 API。

---

## 11) Agent 預設指令（可直接用）
- `業務：用「語言=zh-TW、用途=廣告、情緒=權威」找前10位demo`
- `製作：把低信心標籤佇列今天清到0`
- `工程：檢查demo去重結果，輸出重複檔報告`
- `總管：給我本週demo標註KPI與風險`
