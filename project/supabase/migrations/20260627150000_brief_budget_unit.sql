-- Pricing basis for the client's budget (整案 / 每句 / 每字 / 每分鐘 / 每小時) so the
-- client states whether e.g. "50000" is a whole-project budget or per-line, etc.
-- Defaults to 整案 (whole project) — the common case — when not set.
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS budget_unit text;
