// AI 聲音授權合約全文(Phase 2 定稿,Wing 2026-07-19 逐條拍板)
// 英文為正本(與 legal/terms s26 體系一致);中文為對照參考。
// 術語沿用 terms 既有定義:AI Twin / Training Materials / Archive Status。

export const CONTRACT_VERSION = 'v1.2-2026-07-20';

export const CONTRACT_EN = `AI VOICE LICENSING AGREEMENT (Master Version)

Between: the undersigned voice talent ("Licensor") and Fine Entertainment Co., Ltd. / Onyx Studios ("Platform").

1. DEFINITIONS. "Training Materials" means recordings provided by Licensor under this Agreement; "AI Twin" means the voice model built from the Training Materials; "Generated Content" means audio generated with the AI Twin under client commissions.

2. GRANT AND SCOPE. Licensor authorizes Platform to build, host and operate the AI Twin and to generate content for clients, within the scopes elected by Licensor in the attached Schedule: (a) Standard Commercial use (always included): narration, audiobooks, e-learning, video, podcasts, applications and similar general commercial uses; (b) Paid Advertising (optional): paid media placement across all channels, in perpetuity; (c) Cross-lingual Generation (optional): generation in languages other than Chinese.

3. EXCLUSIVITY. This license is EXCLUSIVE as to the Training Materials recorded for Platform and the AI Twin derived therefrom: Licensor shall not license or provide such materials, model or derivatives to any other platform or third party. Licensor's natural voice, human voiceover work and new independent recordings elsewhere remain entirely unrestricted; this clause is not a non-compete.

4. TERM AND TERMINATION. This license is perpetual. Licensor may at any time direct Platform (in writing or via the talent portal) to stop accepting NEW generation commissions; Platform shall delist within seven (7) business days. Content generated and delivered prior to termination remains perpetually licensed and unaffected. Licensor irrevocably agrees that pre-termination deliveries remain valid in perpetuity and waives all claims in respect thereof against Platform and its clients.

5. REVENUE SHARE. For every generation using Licensor's AI Twin, Licensor receives twenty-five percent (25%) of the published list price of the plan actually purchased by the client, corresponding to the usage volume. Details are itemized in the talent portal; settlement follows Platform's standard talent-payout mechanism. Licensor bears their own taxes. The 25% ratio is unaffected by Platform price adjustments.

6. TRAINING MATERIALS AND SUPPLEMENTARY RECORDING. Licensor records per Platform's scripts and specifications (quiet environment, professional home-studio equipment, WAV 48kHz/24-bit). Non-conforming materials may be rejected for re-recording. To continuously improve the AI Twin, Licensor agrees to cooperate with supplementary recording upon Platform's invitation; such materials fall under this same Agreement.

6-bis. PATCH RECORDING. Where a client requests localized re-recording, Platform may invite Licensor first; such patch recording is part of the revenue-share collaboration hereunder and carries no separate fee. Licensor may decline. If declined or unavailable, Platform may complete the patch via AI alternatives, including voice-conversion technology rendered in the AI Twin's timbre.

7. REVIEW AND LISTING. The AI Twin is listed per use-case after Platform review. Licensor may request delisting of any or all use-cases at any time (effective per Clause 4).

8. OWNERSHIP AND PROTECTION. Model weights, pipelines and infrastructure are Platform's sole property; Licensor retains all personality rights in their natural voice — only the license granted herein is transferred. Licensor shall not demand extraction, copying or delivery of model weights or technical parameters. Platform undertakes: (i) never to sell or transfer the voice model or Training Materials to third parties; (ii) clients acquire usage rights to Generated Content only, never the model; (iii) Generated Content carries machine-readable provenance marks (C2PA and similar) for compliance and abuse prevention.

9. REPRESENTATIONS. Licensor represents the Training Materials are their own voice with full authority to license. Platform will require clients to commit to lawful use. For damage caused by a client's or third party's unlawful use of Generated Content, Platform shall assist Licensor in pursuing such party; having fulfilled its marking and reasonable-care obligations hereunder, Platform bears no further liability therefor.

10. ARCHIVAL. Upon termination, the AI Twin converts to Archive Status and is retained permanently — solely for verification of previously sold licenses, response to legal disputes, and regulatory compliance — and is never again used for new commercial generation. Deletion requests for Training Materials follow Platform's Privacy Policy.

11. CONFIDENTIALITY. Licensor shall keep confidential: revenue-share ratios and settlement amounts, the terms of this Agreement, Platform's technical pipelines and operational methods, scripts and corpus specifications, client information, and any non-public business information. This obligation survives termination for five (5) years; for trade secrets, it survives for as long as the information remains secret. Disclosures required by law or information lawfully in the public domain are excepted. Damages for Licensor's breach of confidentiality are NOT subject to any liability cap in this Agreement.

12. LIMITATION OF LIABILITY. Platform's aggregate liability to Licensor under this Agreement is capped at the total revenue share actually received by Licensor hereunder, except where mandatory law prohibits such limitation.

13. GOVERNING LAW, VENUE AND LANGUAGE. This Agreement is governed by the laws of Taiwan (R.O.C.) regardless of Licensor's nationality or residence, with the Taiwan New Taipei District Court as the court of first instance with exclusive jurisdiction. This English version is the master; translations are for reference only.

14. ENTIRE AGREEMENT. This Agreement constitutes the entire agreement on AI voice licensing and supersedes all prior understandings. Electronic signature has the same effect as written signature.`;

export const CONTRACT_ZH = `AI 聲音授權合約(中文對照,以英文正本為準)

立合約書人:配音員(下稱「授權人」)與凡音文化有限公司/Onyx Studios(下稱「平台」)。

1. 定義:「語料」指授權人依本合約提供之錄音;「AI 聲音」指以語料建立之聲音模型;「生成內容」指依客戶委託以 AI 聲音生成之語音。

2. 授權標的與範圍(依附表勾選):(一)標準商用(必含):旁白、有聲書、課程、影片、Podcast、應用程式等;(二)廣告投放(選勾):付費媒體投放,永久、全通路;(三)跨語言生成(選勾)。

3. 專屬性:就為平台錄製之語料及由此建立之 AI 聲音模型,本授權為專屬授權——不得將該語料、模型或衍生物提供予其他平台或第三方。授權人之自然聲音、真人配音工作及於其他場合之全新錄音完全不受限制;本條不構成競業限制。

4. 期限與終止:本授權永久有效。授權人得隨時通知停止接受新生成委託,平台於七個工作日內下架;終止前已交付之內容永久有效。授權人不可撤銷地同意既有交付永久有效,並放棄就此向平台及其客戶求償。

5. 分潤:每筆生成使用,授權人分得該筆使用對應之公告牌價(依客戶實際購買方案)之 25%;後台逐筆可查,結算依平台人才分潤機制,稅務自負;平台調價不影響 25% 比例。

6. 語料與補錄:依平台稿件及規格錄製(安靜環境、專業宅錄設備、WAV 48kHz/24bit),不符者退件重錄。授權人同意於平台邀請時配合補錄,適用同一授權與分潤。

6-1. 補丁錄音:客戶請求局部補錄時,平台得優先邀請授權人本人;補錄屬本合約分潤合作之一部分,不另計報酬。授權人得婉拒;婉拒或不可用時,平台得以 AI 替代方案(含音色轉換技術)完成。

7. 審核與上架:AI 聲音經平台審核後逐用途上架;授權人得隨時要求下架(效力依第 4 條)。

8. 權屬與保護:模型權重、管線與基礎設施屬平台所有;授權人保留自然聲音之人格權益。授權人不得要求提取模型權重。平台承諾:不出售模型或語料;客戶僅取得生成內容使用權;生成內容嵌入機器可讀標識(C2PA 等)。

9. 聲明與保證:授權人聲明語料為本人聲音且有權授權;平台要求客戶承諾合法使用。因客戶或第三人違法使用致授權人受損者,平台協助追究;平台已履行標識與合理注意義務者,不另負賠償責任。

10. 歸檔:授權終止後,模型轉為歸檔狀態永久保留——僅用於已售授權驗證、法律爭議與法規遵循,不再用於新的商業生成;語料刪除依平台隱私政策。

11. 保密:授權人對下列事項負保密義務:分潤比例與結算金額、本合約條款內容、平台之技術流程與營運方式、稿件與語料規格、客戶資訊,及任何未公開之商業資訊。保密義務於終止後持續五年;屬營業秘密者,持續至不再具秘密性為止。法律要求揭露或已合法公開者不在此限。授權人違反保密義務之損害賠償,不受本合約任何責任上限之限制。

12. 責任限制:平台對授權人之全部賠償責任,以授權人自本合約累計實際獲得之分潤總額為上限;法律強制規定不得限制者,從其規定。

13. 準據法與語言:不論授權人國籍或居住地,以中華民國法律為準據法,台灣新北地方法院為第一審專屬管轄法院;英文版為正本,其他語言僅供參考。

14. 完整合意:本合約構成完整合意,取代先前一切約定;電子簽署與書面簽署具同一效力。`;
