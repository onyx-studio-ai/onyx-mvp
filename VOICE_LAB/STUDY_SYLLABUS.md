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
- [x] A1 zero-shot 克隆原理:speaker embedding 怎麼讓模型「讀一段參考就模仿」 — 2026-07-06 ✅ (daily/2026-07-06.md)
- [x] A2 怎麼量化「像不像 / 好不好聽」:SIM(相似度)、CER(字錯率)、MOS(主觀分) — 2026-07-06 ✅ (daily/2026-07-06.md 第二課)
- [x] A3 reference audio 為什麼決定一切:長度、乾淨度、腔調、情緒 — 2026-07-06 ✅ (daily/2026-07-06.md 第三課) · Module A 地基完成
- [x] A4 (由 A1 衍生) speaker embedding 能不能存下來重用?同一配音員快取 embedding 省不省 ref 重讀 — 2026-07-06 ✅ (daily/2026-07-06.md 第六課)
- [x] A5 (由 A1 衍生) CAM++ / d-vector / x-vector 差別;為什麼 CosyVoice3 還要額外餵 prompt 原始 mel(音色+錄音環境一起複製) — 2026-07-07 ✅ (daily/2026-07-07.md 第二課)

- [x] A6 (由 A4 衍生) 生產「配音員快取層」SOP:Eric/Wing/阿宏 各註冊 spk_id → save_spkinfo 存進 volume,當配音員資產歸檔(類比 voices.yaml) — 2026-07-08 ✅ (daily/2026-07-08.md)。查到官方 API `add_zero_shot_spk`/`save_spkinfo`,spk2info.pt 存 `{model_dir}`。三坑:CV2 預設無此檔/存模型目錄要獨立備份/instruct2+spk_id 會混亂
- [x] A7 (由 A5+A6 衍生) 把 A6 的 SOP 正式寫成 `VOICE_LAB/配音員快取層_SOP.md` — 2026-07-11 ✅ [配音員快取層_SOP.md](配音員快取層_SOP.md)。spk2info.pt(免洗快取,綁模型版本)+ 原始黃金 ref wav(48k母檔=真資產)雙備份;換代六步「拿母檔在新模型重註冊」不搬舊張量;manifest 拆「公開只寫代號」+「受限真名對照表」(🚨修掉舊草稿把配音員真名寫進 repo 的漏洞);新增 base_version 欄接 D2
- [x] A8 (由 A5 衍生) 基準 ref 必須棚錄級乾淨無混響 — 2026-07-11 ✅ (daily/2026-07-11.md)。查證 zero-shot 預設會把 prompt 聲學環境(底噪/混響/麥克風染色)透穿進輸出(arXiv 2502.07345「背景保留是預設、移除才要專門機制」+ CosyVoice 官方「clone 前先清乾淨」);ref 一經註冊成 spk_id,那份髒鎖進快取、乘進所有交付。建議在 00_DIAGNOSIS 第二節症狀表補一列(不直接改)
- [x] A9 (由 A6 衍生) 盤點生產機 spk2info 快取 + 待註冊清單 — 2026-07-11 ✅ (daily/2026-07-11.md)。🔑靜態查 voices.yaml 發現**現行生產是 GPT-SoVITS(現場讀 refer_wav_path),非 CosyVoice spk2info**→三位都尚未註冊 spk2info(引擎概念不同,非漏做);設計待註冊清單模板 + 開 pod 六步補齊 + `torch.load` 查快取 keys 指令

## Module B — CosyVoice3 精通
- [x] B1 `inference_zero_shot` vs `instruct2`:差別、各自何時用 — 2026-07-06 ✅ (daily/2026-07-06.md 第四課)
- [x] B2 情緒 / 方言指令控制(instruct2)的極限在哪 — 2026-07-06 ✅ (daily/2026-07-06.md 第五課)
- [x] B3 長文 sentence-split 與 seam(接縫)問題的根因與解法 — 2026-07-07 ✅ (daily/2026-07-07.md)
- [x] B4 跨語言:同一個 ref 念多國語言的限制與技巧 — 2026-07-08 ✅ (daily/2026-07-08.md 第二課)。`inference_cross_lingual` 不需 prompt_text;中↔英最穩;**中→日有雷(漢字重疊)須 CV3 或先轉假名**;口音來自模型非配音員(印證既有鐵律)
- [x] B5 (由 B3 衍生) 長文合成 SOP 實作:切句界→鎖 spk_id→修尾+響度正規化→crossfade,並實測「前段音訊尾巴當聲學提示」的接縫改善 — 2026-07-08 ✅ (daily/2026-07-08.md 第四課)。四步 pipeline + Python 骨架:pydub crossfade(~40ms)+ pyloudnorm(EBU R128)+ 全程鎖 48k/24bit。進階款「前段尾巴當聲學提示」待 GPU 實測
- [x] B6 (由 B4 衍生) 「多語交付能力矩陣」 — 2026-07-11 ✅ [多語交付能力矩陣.md](多語交付能力矩陣.md)。查證各引擎官方語言(CV2 中英日韓+方言 / CV3 9 語 / BreezyVoice 台灣中文);分工=台灣腔走 Breezy、外語走 CV3、9 語外不接;可批次 vs 逐句驗收分級(日/韓/歐/粵逐句);話術「用您的音色說英文」非「您的英文配音」;一顆 spk_id 服務多語

## Module C — 品質與除錯
- [x] C1 出大陸腔的所有成因與修法(ref / prompt_text / text_frontend) — 2026-07-08 ✅ (daily/2026-07-08.md 第三課)。**四軸診斷**:①模型本體(大陸廠底子,換 ref 救不掉)②ref ③文本前端 ④prompt_text。🔑挖到 **BreezyVoice**(聯發科開源,基於 CosyVoice 專訓台灣腔 + 注音多音字控制)= 台灣腔現成候選解
- [x] C2 取樣率 / 位深 pipeline:怎麼確保 48k/24bit 全程不被降 — 2026-07-09 ✅ (daily/2026-07-09.md)。**48k/24bit = 檔案室母帶,不是餵模型的格式**(CV2 只吃 16k/輸出 24k、GPT-SoVITS 訓練 32k);糊掉三根因=①源頭已壞②升頻冒充高解析(生假高頻)③無聲降級;防法=守母帶+從母帶各自降(soxr_hq)+頻譜看硬牆/ffprobe 驗真假。🔑交付上限由模型定(24k/32k)→ 別賣「48kHz 高解析」
- [x] C3 over-train 為什麼會崩、early-stop 怎麼判讀 — 2026-07-09 ✅ (daily/2026-07-09.md 第二課)。**根因=loss–quality divergence**(2026-03 論文正式命名):料太單一時微調會把缺陷/雜訊一起放大,**val loss 一路降、DNS-MOS 卻掉**。🔑可量門檻:訓練料**能量變化度 >13 dB** 才適合微調,太平的走 zero-shot。early-stop 鐵律:LLM-based TTS 不能看 loss 挑 checkpoint,要**每 N epoch 存檔+聽感/DNS-MOS 挑**。徵兆:機器人/嗡嗡、跳字重複、音色 drift。解釋了記憶「同腔 overfit」「CV3 epoch4 停」
- [x] C9 (由 C3 衍生) 寫 `energy_std.py` 收料閘門 — 2026-07-09 ✅ [energy_std.py](energy_std.py)。純 ffmpeg 解碼 + Python 標準庫算幀能量std(零依賴)。≥15綠/13-15黃/<13紅「別微調走 zero-shot」。已實測:平料 0.00dB 紅、多樣料 14.46dB 黃,判別正確;綠燈 exit 0 可接 CI
- [x] C10 (由 C3 衍生) early-stop + Day1 smoke test SOP — 2026-07-09 ✅ [早停與Day1_smoke_test_SOP.md](早停與Day1_smoke_test_SOP.md)。三道閘門(規格/多樣性/早停)+ Day1「小步先跑+每N epoch存檔+固定測試句」+ 別看loss挑checkpoint + over-train崩兆清單 + 官方epoch速查
- [x] C11 (由 C3 衍生) mixed training 抗過擬合評估 — 2026-07-11 ✅ (daily/2026-07-11.md)。arXiv 2603.10904:混訓每人 11–22% 料、相似度僅差 5–9%,MOS 變異 0.008 vs 單人 0.052(抗過擬合硬指標,低 6.5×)+零樣本泛化紅利。一次養多配音員應混訓>各自單訓(尤救窄料/單一腔者);決策鏈 zero-shot→混訓→CSP-FT→全單人訓。值得 GPU 實測但排 BreezyVoice A/B 之後。⚠️論文編號 agent 查證(2026-03),數字 GPU 實測時再核
- [x] C4 (由 C1 衍生) 🔑評估 BreezyVoice 接進 Onyx — 2026-07-08 ✅ 報告 [BreezyVoice_商用評估.md](BreezyVoice_商用評估.md)。**授權 Apache 2.0 可商用(綠燈)**;注音 `[:ㄏㄠ3]` 覆寫解多音字(g2pW 23難例修至剩1錯);能吃配音員 ref;與 CV3 分工(台灣腔中文走 Breezy、跨語言走 CV3)。臨門一腳=GPU A/B 盲聽(待 Wing 排小預算)
- [x] C5 (由 C1 衍生) pronunciation inpainting / 注音控制串多音字掃描鐵律 — 2026-07-11 ✅ [多音字修正_SOP.md](多音字修正_SOP.md)。四步:掃描→定位→覆寫(Breezy 注音 [:ㄏㄠ3] / CV 拼音 inpainting)→逐字驗收。根因=g2p 猜錯(第③軸)非克隆;Breezy 論文 23 難例修至剩 1 錯;YAGNI 先做對照表+掃描腳本解 90%,地名人工校對
- [x] C6 (由 C2 衍生) 產出 [取樣率位深_鐵律.md](取樣率位深_鐵律.md) 單頁 — 2026-07-09 ✅。pipeline 圖 + 無聲降級三兇手 + 頻譜看硬牆判造假 + ffprobe 抽驗指令 + 7 條鐵律
- [x] C7 (由 C2 衍生) 寫純本機 [check_audio.sh](check_audio.sh) — 2026-07-09 ✅。批次 ffprobe 驗取樣率/位深/codec(標 lossy/非母帶)+ `--spectrogram` 產頻譜圖 PNG。已實測:真 48k 掃頻滿頻到 22.4k、假母帶(16k升48k)在 8kHz 撞硬牆+鏡像混疊,一眼分辨。可當 Module F 自動化 QC 基礎
- [x] C8 (由 C2 衍生) 行銷/報價話術:引擎上限 24k/32k 不得標「48kHz 高解析配音」 — 2026-07-11 ✅ (daily/2026-07-11.md)。CV2 輸出 24k、GPT-SoVITS 訓練 32k;48k 是母帶容器非引擎解析度。紅線=不吹高解析,可講「48kHz WAV 相容後製」但不當賣點。與 check_audio.sh 頻譜驗真一致
- [x] C12 (由 C4 衍生) 🔑 CV3 權重釋出後的商用授權釐清 — 2026-07-12 ✅ (daily/2026-07-12.md)。**判定:CV3 可商用**。GitHub LICENSE 是標準未改動 Apache 2.0、無額外商用限制;README「for academic purposes only」那句是在講**展示的 demo 範例音檔**(取自網路),不是限制模型本體。🔑通則教訓:判商用要**讀 LICENSE 全文**,別被 README 免責聲明嚇到(免責常只針對 demo 樣本)。Wing 拍板 B)=CV3 升商用主力

## Module D — GPT-SoVITS few-shot 微調
- [x] D1 何時值得從 zero-shot 升級到 few-shot(成本 vs 收益) — 2026-07-10 ✅ (daily/2026-07-10.md)。**判準不是「像不像」**(音色 zero-shot 已夠)而是①要不要上千句長期身份鎖死②zero-shot 反覆漏某本人固定表情換 ref 補不回。成本只在「大量×長期重用」才攤得掉,偶爾用永遠 zero-shot。🔑新知:**部分微調 CSP-FT 只調 ~8% 參數、快 2×、較不 over-train**,升級時應優先於全模型訓。前置閘門=昨天的 energy_std>13dB + Day1 早停
- [x] D2 half_weights vs full ckpt:部署要用哪個、為什麼錯了會變另一個人 — 2026-07-10 ✅ (daily/2026-07-10.md 第二課)。950MB=訓練用存檔(含 optimizer 狀態≈參數×14),導出後只剩權重轉半精度=85–135MB。**變別人常不報錯**:①讀不對包裝→靜默回退原廠 base ②v3/v4 導出的是 LoRA 差量,推論要疊回原廠 base(s2Gv3/v4),缺 base=聽到 base 聲。驗收只能靠固定測試句盲聽,不能只看有無報錯。SoVITS=.pth/GPT=.ckpt 不可互指
- [x] D3 訓練資料「多樣性 > 數量」:情境配比怎麼抓 — 2026-07-11 ✅ (daily/2026-07-11.md)。**硬數字**:多樣性挑的 12h ≈ 全量 25h(MOS 3.614 vs 3.587,少 52% 料同效),且勝隨機挑/音素平衡挑(arXiv 2309.08127)。多樣性要撐開**三軸**=語言(BERT)/音素(wav2vec2)/韻律情緒。🔑盲點:`energy_std.py` 只管聲學一軸,沒管「內容多樣/音素覆蓋」→收料閘門不能只看它。切句號不切靜音。onboarding A/B/C 配比=撐開韻律軸,聊天桶最大
- [x] D4 超參數(lr / epoch / batch)的安全範圍 — 2026-07-11 ✅ (daily/2026-07-11.md 第二課)。**官方預設就是安全中心,別加碼**:SoVITS epoch 8(v1/v2)/**2(v3/v4,因是 LoRA base 已強)**,GPT epoch 10–15,lr ~1e-5,`text_low_lr_rate=0.4`(壓文字端 lr 保護 base 發音)。**batch=VRAM 旋鈕非品質旋鈕**,不夠先砍 GPT batch。過訓兩端:GPT→掉字/漏字、SoVITS→音色崩。保險在紀律(每 epoch 存+聽感挑,不看 loss)非參數
- [x] D5 (由 D1 衍生) 部分微調(CSP-FT,arXiv 2501.14273) — 2026-07-11 ✅ (daily/2026-07-11.md 第三課)。查實層選擇:用加權和量每層對情緒/說話人的貢獻,**只調『貢獻最高+最低』兩層、凍其餘**=只動~8%參數、快2×、追平全微調、大幅減 catastrophic forgetting(=C3 窄資料硬訓崩的學名)。升級順序:zero-shot→CSP-FT→才全微調。⚠️WebUI 無現成按鈕,要改訓練碼選層凍層=待 GPU+工程
- [x] D6 (由 D3 衍生) 收料三軸驗收單頁 — 2026-07-11 ✅ [資料多樣性_三軸驗收.md](資料多樣性_三軸驗收.md)。三軸分開驗全過才收:①聲學/韻律 energy_std≥13dB ②語言(內容/句型夠散)③音素(常見音都出現)。最前面警語:energy_std 只覆蓋一軸、綠燈≠料夠多樣。對接 onboarding A/B/C 桶
- [x] D7 (由 D3 衍生) 「語料瘦身器」原型 coreset_pick.py — 2026-07-11 ✅ [coreset_pick.py](coreset_pick.py)。BERT(語言軸)+wav2vec2(音素軸)特徵 + 貪婪挑最遠子集(farthest-point);x-vector 單人退化故不算。⚠️非零依賴、需下載 BERT~400MB+wav2vec2~360MB、CPU 可跑但比 energy_std 重、**原型碼尚未實跑**;重依賴延後 import,語法已過
- [x] D8 (由 D1–D5 衍生) few-shot 微調決策鏈提案稿 — 2026-07-11 ✅ [few-shot微調決策鏈.md](few-shot微調決策鏈.md)。D1–D5 濃縮成鏈(要不要訓→三軸前置閘→先 CSP-FT 再全訓→官方預設當安全中心+每 epoch 存盲聽挑→部署拿 half_weights)+ 五關卡速查表 + 四點回寫 00_DIAGNOSIS 清單。⚠️提案稿,動主檔前給 Wing 過目不硬改

## Module E — RVC 聲音轉換
- [x] E1 RVC 原理 + pitch shift(男↔女 ±12 半音) — 2026-07-11 ✅ (daily/2026-07-11.md)。RVC=內容(ContentVec)/音高(RMVPE F0)/音色(FAISS 目標特徵庫)三者解耦,VITS 合成。f0_up_key 半音、+12=一個八度、男→女建議+12。🔑坐實「Wing RVC + pitch+2 = 女聲」原理:音高與音色是分開兩條輸入,+2 只平移基頻不動音色 identity→不必重訓;大位移(±12)易破音,要更女聲應換女模型而非硬拉 f0
- [x] E2 UVR5 / Demucs 去 BGM 前處理 — 2026-07-11 ✅ (daily/2026-07-11.md)。UVR5=前端工具(可掛 MDX-Net/Demucs v4/MDX23C/Mel-RoFormer + Ensemble),Demucs=其中一個引擎(可 CLI 單跑)。批次自動走 Demucs CLI;要頂規人聲純淨度走 UVR5+Mel-RoFormer/MDX23C。殘留 BGM/混響會被 ContentVec/F0 當訊號學走→出水聲抖動(同「模型把髒東西當訊號」鐵律)。去完接 48k/24bit 母帶紀律
- [x] E3 index ratio 對「保留原表情 vs 像目標聲」的取捨 — 2026-07-11 ✅ (daily/2026-07-11.md)。index rate α=每幀 FAISS top-k 目標向量與原特徵線性內插比例;高→少音色洩漏更像目標但訓練集音質差時反扣分+沙啞,低→保留原表情。官方 FAQ:訓練集夠好夠長則 index 不重要。⚠️來源分歧:WebUI 預設 0.75(社群 0.6–0.75)vs 論文解析 α≈0.3=版本差非矛盾。作法:0.75 起跳,料不如輸入源就降。與 E2 串:料乾淨才敢推高換相似度

## Module F — 評測與 A/B(讓「好不好」可量化)
- [x] F1 盲聽 A/B 流程怎麼設計才公平 — 2026-07-11 ✅ (daily/2026-07-11.md)。三件套=盲測+隨機化+錨點;MUSHRA(ITU-R BS.1534-3)hidden reference/anchor、單題≤12理想7、crowdsource 5-6、聽眾15-20、後驗剔除隱藏參考評<90者。多系統排名用MUSHRA、A/B對決用CMOS(F4)
- [x] F2 自動化客觀指標(SIM / CER)怎麼跑、怎麼讀 — 2026-07-11 ✅ (daily/2026-07-11.md)。SIM=speaker verification(WavLM/ECAPA/ERes2Net)cosine,與SMOS相關僅~0.50-0.55(有正相關不強);CER=Whisper-Large v3轉錄比字級編輯距離。兩陷阱:ASR自身錯會虛報CER(要複核逐字稿)、絕對值不可跨模型比。皆純CPU免費但只是MOS代理,定案仍需真人
- [x] F3 (由 A2 衍生) Mac 本機「SIM+CER+UTMOS」純 CPU 自動評分腳本 — 2026-07-11 ✅ [eval_score.py](eval_score.py)。SIM=Resemblyzer/CER=faster-whisper+純標準庫Levenshtein(中文字級+正規化)/UTMOS=SpeechMOS。manifest(CSV/JSONL)或目錄模式,三欄著色不給總分,缺套件跳該欄。⚠️非零依賴、首次下載數百MB權重、尚未實跑(待venv裝依賴小批校準門檻)。已過py_compile
- [x] F4 (由 A2 衍生) 盲聽測試設計:CMOS -3~+3 + 埋陷阱樣本剔除不認真聽眾 — 2026-07-11 ✅ (daily/2026-07-11.md)。CMOS成對比較比絕對MOS省人更靈敏;TTSDS2配方每10題3陷阱(1壞合成+2真人),須答對壞樣本+認出1真人否則作廢;crowdsource加播完整段/反應時間/歷史通過率。日常挑ref/epoch以CMOS為主力,多系統排名才用MUSHRA

### Module C 新增(2026-07-12 追新進展冒出)
- 見 C12。

### Module E/G 新增候選(2026-07-12)
- [x] X1 🆕 IndexTTS-2 商用評估(Bilibili,2025-09 開源):情緒控制 + 時長控制解耦,主打影片配音對時軸(對嘴) — 2026-07-13 ✅ 報告 [IndexTTS-2_商用評估.md](IndexTTS-2_商用評估.md)。**判定:黃燈,非 Apache 2.0(修正昨天誤判)**。權重走 Bilibili 自訂「Model Use License Agreement」=門檻式(MAU<1億 且 年營收<人民幣10億 可商用免書面授權;超線另談;陸法管轄+上海仲裁+內容限制)。Onyx 規模遠低於門檻→今天合法可商用,但授權層級劣於 BreezyVoice/CV3 的乾淨 Apache→定位「對時軸/情緒專用工具」非 IP-保證骨幹。🔑通則:分開看程式碼授權 vs 權重授權,讀權重 LICENSE 全文。已納入下次 GPU 盲聽(Wing 07-12 拍板)
- [x] X2 (由 X1 衍生) 追蹤 [Issue #228](https://github.com/index-tts/index-tts/issues/228) 官方是否回覆釐清 Apache vs 商用限制矛盾 — 2026-07-14 ✅ (daily/2026-07-14.md)。**官方至今未回覆、Issue 仍 OPEN → 昨天黃燈判定不變**。但這次直接讀 `INDEX_MODEL_LICENSE` 全文挖到兩條漏掉條款:①Section 4.1c **不得用它/衍生去改進其他(商用)AI 模型**(直接掐死「拿輸出當自家模型訓練料」)②Section 9 **中文版為準**(英文判讀只能當初判)。商用門檻(2.2 MAU>1億或營收>人民幣10億)、陸法+上海仲裁(6)複核與昨天一致。收斂:改成「下次為 IndexTTS-2 做實作決策前再查一次」,不佔每日例程
- [x] X3 (由 X1+X2 衍生) 授權地雷清單 — 2026-07-15 ✅ 提案稿 [授權地雷清單_提案稿.md](授權地雷清單_提案稿.md)。橫向查證 XTTS-v2/F5-TTS 後**通則從 3 條變 5 條**:①程式碼≠權重(三案例坐實:XTTS MPL2.0/CPML❌、F5 MIT/CC-BY-NC❌、IndexTTS2 Apache/自訂⚠️,非特例是常態)②「不得改進其他 AI 模型」條款(IndexTTS2 §4.1c、CPML、Llama)③語言版本為準 ④🆕**訓練資料傳染且微調洗不掉**(F5 因 Emilia 掛 NC,維護者原話 finetune 後照樣不能商用→唯一解從零重訓)⑤🆕**「⚠️待洽談」要先確認窗口還在**(Coqui 2024-01 倒閉無人能賣/F5 明說不發→實為紅燈)。+ 三色對照 + 五步查核 SOP。⚠️抓到**主檔兩列判定過寬**(XTTS/F5 ⚠️→❌);grep 確認生產未使用兩者(GPT-SoVITS MIT + CV3 Apache 皆綠)=潛在地雷非事故。**✅ Wing 2026-07-15 拍板 A=准改主檔,已落地 v1.3**(兩列修正+三色對照+五步 SOP+絕不再踩 #16-18)。落地時**掃同類又抓到更嚴重的**:第二梯隊三個引擎(IndexTTS-2/F5/XTTS)**梯隊段落全部沒有授權行**(第一梯隊都有)→ 讀者最先讀的地方只看到「品質頂尖/6秒 clone」看不到紅燈,已補三段

- [x] X4 (由 X3 衍生) 拿五步查核 SOP 重驗主檔授權矩陣**剩下 8 列** — 2026-07-16 ✅ (daily/2026-07-16.md)。8 個查核員各查一引擎、每個查兩地方(矩陣列+梯隊授權行)。**抓到 1 個第一梯隊的重大錯 + 3 個不精確**:①🚨 **Higgs Audio v3 主檔標「第一梯隊 Apache 2.0 ✅ 可商用」實為權重 Research & Non-Commercial 禁商用**(徽章只蓋 code;v2 首發就是 Community License,主檔從第一天抓錯;比昨天 XTTS/F5 更危險因在第一梯隊)②Fish Speech 紅→黃(官方點名有付費商用窗口 $10k/月,非死路;順手結掉「看是否改授權」待辦=沒改、更緊)③Fish S2「只能買 API」不精確(Enterprise 有 on-prem 可談;🚨 API 預設拿聲音訓練、ZDR 只 Enterprise 有)④OpenVoice v2 梯隊段落缺授權行。**兩支生產主力(CV3/GPT-SoVITS)複驗綠燈**。乾淨綠燈骨幹=CV3/GPT-SoVITS/Qwen3/Chatterbox/OpenVoice v2 五支。⚠️提案 diff 已備,動主檔前給 Wing 拍板(比照 X3);打勾+新子題已落。**授權矩陣 11 列至此全數逐條驗過。**

### Module X 收尾後續(2026-07-16 冒出)
- [x] X5 (由 X4 衍生) Wing 拍板後落地主檔修正 — 2026-07-16 ✅ 主檔升 **v1.4**。六處(Higgs 改🔴/Fish Speech 紅→🟡/Fish S2 改寫/OpenVoice 補授權行/Chatterbox 浮水印+GPT-SoVITS 兩保留/拿掉矩陣警語)全落地,**且掃同類又抓到四處沒同步**(治本協定應驗):①梯隊 #9 Fish Speech 授權行還是舊紅 ②梯隊 #10 Fish S2「只能買 API」舊敘述 ③決策矩陣「想試最新 SOTA」推薦 Higgs 沒禁商用警告+粵語備案還掛 Higgs ④粵語排行/部署待辦/絕不再踩 #13 都沒提 Higgs 禁商用 → 全部補齊。**教訓再次成立:改矩陣表≠改完,梯隊段落/決策矩陣/場景表/待辦/絕不再踩五個地方都要掃。**
  🚩 **仍待做**:第三梯隊(Voxtral/CV2/Bark/VITS/XTTS-v1)未逐一驗權重授權 —— 它們標「跳過/已淘汰」風險低,但為徹底可補;移到 X5b。
- [ ] X5b (由 X5 衍生) 掃第三梯隊 5 個引擎有沒有被當可商用挑走的殘留風險(優先度低,都已標淘汰)
- [ ] X6 (由 X4 衍生) 綠燈引擎的「營運級」細節建檔:Chatterbox PerTh 浮水印 vs 歐盟 AI Act 標示義務(移除還是保留才對?)、GPT-SoVITS 底模資料透明度風險。這兩條是「授權綠燈但交付仍要注意」的獨立議題
- [ ] X7 授權線收尾後,自學回到**技術深化 / 追業界新模型**(A–G 主體已學通,進入「深化+追新」階段)

## Module G — 對嘴 / Lip-sync(聲音精通後才開)
- [x] G1 talking-head / lip-sync 全景:wav2lip / SadTalker / 2026 最新 SOTA — 2026-07-11 ✅ (daily/2026-07-11.md)。兩世代分水嶺:GAN(Wav2Lip嘴準/SadTalker單圖全頭)→ latent diffusion(MuseTalk MIT可商用即時、LatentSync 720p)。商用天花板 OmniHuman1.5(閉源API);2026新SOTA=daVinci-MagiHuman(Apache2.0可商用、1080p/7語)。🔑自架可商用雙支柱=MuseTalk+daVinci;⚠️Wav2Lip原repo標非商用勿直接上線
- [x] G2 音訊驅動 vs 影片驅動,各自適合什麼 — 2026-07-11 ✅ (daily/2026-07-11.md)。音訊驅動=語音當條件推嘴型(我們有聲音+臉,對路);影片驅動=另一演員表演搬到目標臉(visual dubbing,需來源表演影片,不對路)。VideoReTalking雖吃既有影片仍屬音訊驅動子類。🔑Onyx 鎖定音訊驅動分支
- [x] G3 我們現有素材 / 流程怎麼接上對嘴 — 2026-07-11 ✅ (daily/2026-07-11.md)。管線:TTS/RVC語音(守母帶)+授權照片/影片→音訊驅動模型(自架首選MuseTalk MIT)→加C2PA/AI揭露→交付。GPU量級與聲音克隆同級。🚨倫理紅線2026已入法:EU AI Act要AI人臉影片揭露+機器可讀標記、紐約數位替身法要書面同意+補償;開源多不自帶浮水印→Voice ID授權書須增補肖像/數位替身條款

---

## 學習日誌
- 每日筆記在 `research/daily/<YYYY-MM-DD>.md`。
- 重大結論記得回寫 `00_DIAGNOSIS` 或 MASTER_GUIDE「絕不再踩」清單。
