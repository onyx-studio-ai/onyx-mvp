/*
  # TTS / AI casting cases (客戶端聲音變 AI)

  A casting call can now be flagged as a client-side AI/TTS engagement — where the
  talent's recording is turned into an AI voice for a CLIENT (e.g. 网C1279 wants a
  台灣國語 一男一女 TTS corpus). This is NOT Onyx training its own model (that path
  lives in /voice + /voice-id); the talent signs the CLIENT's authorization, not
  Onyx's affidavit.

  ai_type drives two gates in the app layer:
    - who gets invited / can see the case (only talents who opted in via the
      matching coop flag: 'clone' → coop_ai_clone, 'training' → coop_ai_training)
    - a "TTS / AI 案" badge shown to talents so they know before auditioning

  Values: NULL / '' = ordinary (real-person) casting call — unchanged behaviour.
          'clone'    = 聲音會被製成 AI(用到本人聲音)   → filters coop_ai_clone
          'training' = AI 訓練素材(不會用到本人聲音)    → filters coop_ai_training

  Additive + idempotent. Existing casting calls stay ai_type = NULL, so nothing
  about the current real-person flow changes.
*/

ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS ai_type text;

notify pgrst, 'reload schema';
