# Wing GPT-SoVITS 重訓計畫 v3

> 2026-05-30 — 照官方 + 社群實證寫的完整 plan,**執行時嚴格按此走,不腦補**

## 為什麼需要 v3

之前的 Wing 訓練:
- SoVITS 訓到 e46,GPT 訓到 e20 → **過訓 5-8 倍**(官方 8/10 epoch)
- ref audio 用訓練資料(wing_ads_*)→ prosody leak
- v2 + cut5 + temp 0.85 → 隨機性過大

結果:聲調飄,字錯,「鈍 AI」感

## 參考來源

- [GPT-SoVITS 官方 README](https://github.com/RVC-Boss/GPT-SoVITS)
- [官方使用手冊 EN](https://rentry.co/GPT-SoVITS-guide)
- [官方使用手冊 CN (yuque)](https://www.yuque.com/baicaigongchang1145haoyuangong/ib3g1e)
- [v2Pro features wiki](https://github.com/RVC-Boss/GPT-SoVITS/wiki/GPT%E2%80%90SoVITS%E2%80%90features-(%E5%90%84%E7%89%88%E6%9C%AC%E7%89%B9%E6%80%A7))
- [Cantonese issue #2673 / #189 / #1558](https://github.com/RVC-Boss/GPT-SoVITS/issues/2673)
- [Tech Shinobi VITS 訓練實戰](https://techshinobi.org/posts/vits-re/)
- [ailia Medium 微調研究](https://medium.com/axinc-ai/gpt-sovits-a-zero-shot-speech-synthesis-model-with-customizable-fine-tuning-e4c72cd75d87)

---

## 資料盤點(已確認)

| 資產 | 位置 | 狀態 |
|---|---|---|
| 源頭 wav (235 個) | `/workspace/data/wing_sources_raw/` | ✅ rsync 完 5.2 GB |
| 切片 metadata | `/workspace/data/wing_sv_segments.jsonl` | ✅ 8757 段 |
| 用戶校過的文本 | `/workspace/data/wing_user_edits.json` | ✅ 281 條(覆蓋自動 ASR) |
| 廣告 gold | `/workspace/data/wing_data/wing_ads_*.wav` | 324 條(可選加進去 L1) |

---

## 完整流程(每步驟有確認點,失敗就 stop 問用戶,不腦補)

### Phase 1 — 資料準備(45 min,寫腳本一鍵跑)

**1.1 Slicing(用既有 timestamp 切)**
- Input: 235 個 source wavs + segments.jsonl 的 (start, end) timestamps
- Output: 8757 個 16 kHz mono wav 在 `/workspace/data/wing_sliced/`
- Drop 規則:
  - 長度 < 2 秒(GPT-SoVITS 不接受)
  - 長度 > 12 秒(過長拖訓練)
  - text 空 / 長度 < 2 字
- **預期保留** ~7500 段

**1.2 文本後處理**
- 套用 `wing_user_edits.json`(281 條覆蓋)
- opencc s2twp 統一繁體
- HK 詞修正:軟件/打印機
- 移除明顯雜訊段(text 內含太多 [music] 等標籤)

**1.3 生成 metadata.list**
```
/workspace/data/wing_sliced/wing_NNNNNN.wav|wing|yue|逐字稿文本
```

**1.4 加入 L1 廣告 gold(324 條)**
- 它有真實逐字稿 (wing.list)
- 文本品質高,可當訓練 anchor
- 但比例只占 ~4%,不會主導訓練

**1.5 確認點** — 在 webUI 跑前先檢查:
- metadata.list 行數 = wav 檔案數
- 隨機抽 20 行人工讀過(防 ASR 大錯)
- 平均單句長度 5-10 秒
- 失敗就 stop 問用戶

### Phase 2 — WebUI 訓練(~1.5 hr)

> 用 GPT-SoVITS 官方 WebUI(port 9874 or 9871,不是 8080 那個 admin)

**2.1 找對 webui port**(8080 是 voice-ai-platform admin,不是訓練)
- ssh 進 pod
- 啟動 GPT-SoVITS webui: `/app/GPT-SoVITS/go-webui.sh` 或類似
- 確認 url 後告訴用戶

**2.2 Stage 5.1 — 一鍵格式化**
- 上傳 metadata.list
- 模型名:`wing-v3`
- 點 "Start one-click formatting"
- 等完成

**2.3 Stage 5.2 — 訓 SoVITS**
- version: **v2Pro**(粵語強,SV embedding)
- batch_size: **2**(A40 有 48 GB,可以)
- **total_epochs: 8**(官方推薦,絕對不能加)
- save_every: 4(會留 epoch 4 + epoch 8 兩個 ckpt)
- DPO: **OFF**
- 開跑,A40 大概 30-40 min

**2.4 Stage 5.2 — 訓 GPT**(SoVITS 完才能跑,不能並行)
- batch_size: **2**
- **total_epochs: 10**(官方推薦)
- save_every: 5(會留 epoch 5 + epoch 10)
- DPO: **OFF**
- 開跑,A40 大概 20-30 min

**2.5 確認點** — 每個 epoch save 時看 loss curve:
- SoVITS loss 應該平穩下降
- 若 loss 5 epoch 後反升 → 立刻 stop,使用早 epoch
- 若 loss 完全沒降 → 資料有問題,stop 問用戶

### Phase 3 — 推論測試(15 min)

**3.1 選正確 ref audio**
- **絕對不能用訓練資料**(會 prosody leak)
- 候選 1:user_edits 列表內找一段「最自然講話」(非廣告/旁白 tone)
- 候選 2:Wing 真實口語對話片段(若有)
- 必須 5-10 秒,清楚字,中性 tone
- 注意 prompt_text 必須跟 ref audio 一字不差

**3.2 推論 5 個測試**
參數(社群實證):
- text_lang: `all_yue`(強制粵語)
- prompt_lang: `yue`
- temperature: **0.5**(stability sweet spot)
- top_p: **0.7**
- top_k: 20
- speed: 1.0
- text_split_method: cut0(不切短句)

測試文:
1. 短 ad: "Spotify Premium 全新體驗,立即試用。"
2. 品牌: "凡音文化,為你打造專屬聲音識別。"
3. 長旁白: "喺呢個瞬息萬變嘅時代,每一個品牌都需要一個獨特嘅聲音。"
4. 教學: "今日我哋一齊嚟學習一個重要嘅概念。"
5. PSA: "為咗你同你家人嘅健康,請保持社交距離。"

下載 `~/Desktop/wing_v3_official/`

### Phase 4 — A/B 評估(用戶聽)

對比 3 組:
- 現在 production(wing_force_yue/)
- 新訓 v3 epoch 10 GPT + epoch 8 SoVITS
- 新訓 v3 epoch 5 GPT + epoch 4 SoVITS(保險)

讓用戶選哪組進 production。

### Phase 5 — 部署(5 min)

選定的 ckpt → 改 voices.yaml:
```yaml
wing:
  version: v2Pro
  gpt_weights: /app/.../wing-v3-eN.ckpt
  sovits_weights: /app/.../wing-v3_eM.pth
  refer_wav_path: /workspace/data/.../[非訓練資料]
  prompt_text: [ref audio 對應文本]
  prompt_lang: yue
  temperature: 0.5
  top_p: 0.7
  text_split_method: cut0
```

備份舊 config (`voices.yaml.bak_v2_46`),gateway 5 秒 auto-reload。

### Phase 6(Optional)— CV3 zero-shot 平行(2 hr)

**只有在 Phase 5 結果仍不滿意才啟動**

- 開新 pod EU-SE-1,Python 3.10 image(避開 ttsfrd 坑)
- 裝真正的 ttsfrd binary(modelscope `iic/CosyVoice-ttsfrd`)
- Zero-shot inference 用 Wing ref audio
- 不訓練,只推論
- 比較 vs GPT-SoVITS v3

---

## 不會做的事(防腦補)

❌ epoch 加碼(>10 / >8)
❌ 換 ref audio 看會不會剛好猜中
❌ 中途修改 temperature 直到聽起來對(改完寫紀錄)
❌ 同時亂裝其他引擎打架
❌ 把訓練資料當 ref 用
❌ 跳過 Phase 1 文本品質檢查

---

## 失敗 stop point

每個 phase 完成後檢查指標,失敗就 stop 問用戶:

| Phase | 失敗條件 | 動作 |
|---|---|---|
| 1 | metadata.list < 5000 行 / 文本錯誤率 > 30% | stop |
| 2 SoVITS | loss 5 epoch 後反升 / 完全沒降 | stop,用早 epoch |
| 2 GPT | 同上 | stop |
| 3 | 5 段全部都是水聲 / garbage | stop,檢查 webui config |
| 4 | 用戶覺得 3 組都不行 | 進 Phase 6 CV3 |

---

## 時間 + 成本

| Phase | 時間 | A40 GPU |
|---|---|---|
| 1 | 45 min | 不用 |
| 2 SoVITS | 30-40 min | ✅ |
| 2 GPT | 20-30 min | ✅ |
| 3 | 15 min | ✅(輕)|
| 4 | 5 min | 不用 |
| 5 | 5 min | 不用 |
| **合計** | **~2 hr** | **~$1** |

Phase 6 若啟動 +2 hr / $1。
