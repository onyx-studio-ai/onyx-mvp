# 🎙️ Voice Lab — Onyx 聲音自學系統

> 建於 2026-06-18。目的:**讓「下一次的我」站在「這一次的紀錄」上,不重犯同樣的錯。**

## 為什麼有這個資料夾

Claude(模型本身)不會越用越聰明 —— 它的「腦」每次對話都是固定的。
但**我們累積的紀錄會越疊越厚**,而 Claude 每次開工都會先讀這裡。
所以真正在「學習、變強」的是**這套系統**,不是模型的腦。學習活在筆記裡。

這正好對症我們的真正病根(見 [`00_DIAGNOSIS_clone-vs-train.md`](00_DIAGNOSIS_clone-vs-train.md)):
失敗幾乎都不是「不夠厲害」,是「選錯路 + 沒紀律」。紀錄就是那份紀律。

## 資料夾結構

```
VOICE_LAB/
├── README.md                      ← 你在看的這份(怎麼運作)
├── 00_DIAGNOSIS_clone-vs-train.md ← 核心:該克隆還是該訓練?決策樹
├── STUDY_SYLLABUS.md              ← 每日自學的課程表(進度打勾)
├── experiments/                   ← 每次實驗一個檔(config + 結果 + 成敗原因)
│   └── _TEMPLATE.md
└── research/
    ├── _TEMPLATE.md
    └── daily/                     ← 每日自學筆記落這裡(YYYY-MM-DD.md)
```

## 三條鐵則

1. **先 zero-shot,再考慮訓練。** 預設用 CosyVoice3 克隆;證明不夠才往 GPT-SoVITS 微調。
2. **每個實驗都要留檔。** 不管成功失敗,複製 `experiments/_TEMPLATE.md`,填 config + 結果 + 一句「學到什麼」。失敗的紀錄比成功的更值錢。
3. **學到新坑,當場更新 [MASTER_GUIDE](../VOICE_AI_MASTER_GUIDE.md) 的「絕不再踩」清單。** 不要等季度 review。

## 跟既有文件的關係

| 文件 | 角色 |
|---|---|
| [VOICE_AI_MASTER_GUIDE.md](../VOICE_AI_MASTER_GUIDE.md) | 長期戰略 + 引擎梯隊 + 絕不再踩清單(穩定知識) |
| [VOICE_TRAINING_LESSONS.md](../VOICE_TRAINING_LESSONS.md) | 訓練資料/pipeline 的硬教訓 |
| **VOICE_LAB/**(這裡) | **活的實驗紀錄 + 每週新進展**(會一直長) |

## 每日自學 + 提案例程

一個排程代理(`voice-ai-weekly-scan`,在 `~/.claude/scheduled-tasks/`)**每天倫敦 08:03 自動跑**:
從 `STUDY_SYLLABUS.md` 挑下一個還沒學的主題、徹底搞懂、寫進 `research/daily/`,並提出「下一步想試什麼 + 需要 Wing 決定的事」。
分工:**Claude 負責學 + 提案,Wing 只負責決定。**

**這個例程只研究、只提案 → 絕不開 GPU、零成本。** GPU 實驗一律等 Wing 決定後、在線上對話時才跑,並設預算上限。
（Wing 目前人在英國,所以排程用倫敦時間。）
