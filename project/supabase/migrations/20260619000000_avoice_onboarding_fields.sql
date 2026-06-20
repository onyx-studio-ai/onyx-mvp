/*
  # AVOICE-merge onboarding: extra talent_applications fields

  ## Background
  Re-onboarding the ~2000 AVOICE talents into Onyx via /apply/voice needs
  a few fields the form doesn't capture yet. Most of the new design REUSES
  existing columns — only the genuinely new ones are added here:

  REUSED (no change):
  - languages text[]        → 可配語言 + 口音(多選,每筆「語言·口音」)
  - voice_types text[]      → 聲音給人的感覺(溫暖/沉穩/活潑/親切/磁性/自信/年輕/成熟…)
  - specialties text[]      → 能接的案件類型(廣告/旁白/遊戲/角色配音/TTS…)
  - recording_environment, microphone_model, has_home_studio → 錄音環境

  ## New columns on talent_applications
  - display_name        text         — 公開顯示名稱(full_name 仍為法定真名,不公開)
  - messaging_contacts  jsonb        — { line, whatsapp, telegram }(選填,只存不驗證)
  - coop_accept_jobs    boolean t    — ① 接案配音(預設願意)
  - coop_open_buyout    boolean f    — ② 開放聲音買斷
  - coop_ai_clone       boolean f    — ③ 將聲音製作為 AI(會用到聲音)
  - coop_ai_training    boolean f    — ④ 錄製 AI 訓練素材(不會用到聲音)
  - low_price_data_optin boolean f   — 願意收到低價數據採集案資訊
  - excluded_countries  text[] '{}'  — 不接案的國家/地區(自填,逐案仍會標來源國)

  All additive + idempotent (ADD COLUMN IF NOT EXISTS); safe to re-run.
  Phone is collected but NOT verified (no paid SMS); email is verified.
*/

ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS display_name        text   NOT NULL DEFAULT '';
ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS messaging_contacts  jsonb  NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS coop_accept_jobs    boolean NOT NULL DEFAULT true;
ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS coop_open_buyout    boolean NOT NULL DEFAULT false;
ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS coop_ai_clone       boolean NOT NULL DEFAULT false;
ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS coop_ai_training    boolean NOT NULL DEFAULT false;
ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS low_price_data_optin boolean NOT NULL DEFAULT false;
ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS excluded_countries  text[] NOT NULL DEFAULT '{}';
ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS coop_proofread      boolean NOT NULL DEFAULT false;
