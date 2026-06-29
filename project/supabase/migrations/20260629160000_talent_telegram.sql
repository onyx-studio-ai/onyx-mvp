-- Telegram notifications for talents. telegram_chat_id is set once the talent
-- /start's the bot via their personal deep-link (telegram_link_token). With a
-- chat_id on file we push award / message / revision alerts alongside email.
ALTER TABLE talents
  ADD COLUMN IF NOT EXISTS telegram_chat_id    text,
  ADD COLUMN IF NOT EXISTS telegram_link_token text;
CREATE INDEX IF NOT EXISTS idx_talents_tg_token ON talents(telegram_link_token);
