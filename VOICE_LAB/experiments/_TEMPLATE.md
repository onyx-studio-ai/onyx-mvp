<!-- 複製這份,改檔名為 YYYY-MM-DD_<voice>_<簡述>.md，例如 2026-06-20_eric_zeroshot-vs-train.md -->

# 實驗:<一句話標題>

- **日期**:YYYY-MM-DD
- **聲音 / 語言**:例如 Eric / 普通話 + 粵語
- **想驗證什麼(假設)**:例如「zero-shot 設定對了就接近官方 demo,不必訓練」
- **階層**:L0 克隆 / L1 微調 / L2 RVC(見 00_DIAGNOSIS)

## 設定 Config

| 項目 | 值 |
|---|---|
| 引擎 / 版本 | 例如 Fun-CosyVoice3-0.5B-2512 |
| 模式 | zero_shot / instruct2 / fine-tune |
| ref 音檔 | 路徑 + 長度 + 取樣率/位深(務必確認 48k/24bit 沒被降) |
| ref prompt_text | 一字不漏對齊 ref |
| 關鍵旗標 | text_frontend=False / sentence-split / lr / epoch … |
| Pod / GPU | 例如 u46xxo7nkayx80 (A40) |

## 結果

- **輸出檔**:路徑(放 `~/Desktop/<task>/` 或 06 Onyx Studio)
- **盲聽打分**(1–5):音色像 ___ / 腔對不對 ___ / 自然度 ___
- **A/B 對照**:跟誰比、誰贏

## 結論(最重要,一定要填)

- ✅ 成功的話:對的設定是什麼?寫進 MASTER_GUIDE 了嗎?
- ❌ 失敗的話:死在哪一個具體操作點?有沒有加進「絕不再踩」清單?
- **下一步試什麼**:
