# 🎓 Voice Lab 自學課程表

> 每日自學例程的「進度表」。每天挑**下一個還沒打勾**的主題,徹底搞懂、寫筆記、打勾。
> 順序由淺到深:**聲音生成基本功 → CosyVoice 精通 → 品質除錯 → 微調 → RVC → 評測 → 最後:對嘴 lip-sync。**
> 學完一輪後,改成「深化已學主題 + 追最新進展」。

## 規矩
- 一天一主題,寧可慢而扎實。學到的每條都要能操作、附真實來源。
- 任何主題學完若冒出新子題,加到對應 Module 末尾。
- **對嘴(Module G)等聲音生成(A–F)學通了才開** —— 一次只打一場仗。

---

## Module A — 地基:克隆 vs 訓練的本質
- [ ] A1 zero-shot 克隆原理:speaker embedding 怎麼讓模型「讀一段參考就模仿」
- [ ] A2 怎麼量化「像不像 / 好不好聽」:SIM(相似度)、CER(字錯率)、MOS(主觀分)
- [ ] A3 reference audio 為什麼決定一切:長度、乾淨度、腔調、情緒

## Module B — CosyVoice3 精通
- [ ] B1 `inference_zero_shot` vs `instruct2`:差別、各自何時用
- [ ] B2 情緒 / 方言指令控制(instruct2)的極限在哪
- [ ] B3 長文 sentence-split 與 seam(接縫)問題的根因與解法
- [ ] B4 跨語言:同一個 ref 念多國語言的限制與技巧

## Module C — 品質與除錯
- [ ] C1 出大陸腔的所有成因與修法(ref / prompt_text / text_frontend)
- [ ] C2 取樣率 / 位深 pipeline:怎麼確保 48k/24bit 全程不被降
- [ ] C3 over-train 為什麼會崩、early-stop 怎麼判讀

## Module D — GPT-SoVITS few-shot 微調
- [ ] D1 何時值得從 zero-shot 升級到 few-shot(成本 vs 收益)
- [ ] D2 half_weights vs full ckpt:部署要用哪個、為什麼錯了會變另一個人
- [ ] D3 訓練資料「多樣性 > 數量」:情境配比怎麼抓
- [ ] D4 超參數(lr / epoch / batch)的安全範圍

## Module E — RVC 聲音轉換
- [ ] E1 RVC 原理 + pitch shift(男↔女 ±12 半音)
- [ ] E2 UVR5 / Demucs 去 BGM 前處理
- [ ] E3 index ratio 對「保留原表情 vs 像目標聲」的取捨

## Module F — 評測與 A/B(讓「好不好」可量化)
- [ ] F1 盲聽 A/B 流程怎麼設計才公平
- [ ] F2 自動化客觀指標(SIM / CER)怎麼跑、怎麼讀

## Module G — 對嘴 / Lip-sync(聲音精通後才開)
- [ ] G1 talking-head / lip-sync 全景:wav2lip / SadTalker / 2026 最新 SOTA
- [ ] G2 音訊驅動 vs 影片驅動,各自適合什麼
- [ ] G3 我們現有素材 / 流程怎麼接上對嘴

---

## 學習日誌
- 每日筆記在 `research/daily/<YYYY-MM-DD>.md`。
- 重大結論記得回寫 `00_DIAGNOSIS` 或 MASTER_GUIDE「絕不再踩」清單。
