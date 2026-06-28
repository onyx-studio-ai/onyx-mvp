-- The currency the client sets at posting becomes the single source of truth for
-- the whole deal: the talent quotes in it (no picking another), so the production
-- order + Paddle checkout bill that exact currency. Previously the currency only
-- lived inside the free-text `budget` field (e.g. "USD 7500"), so a USD brief could
-- end up as a TWD order if the talent picked a different currency when quoting.

ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS budget_currency text;

-- Backfill existing rows: pull a known currency code out of the budget / rate text.
UPDATE marketplace_briefs
SET budget_currency = (regexp_match(upper(coalesce(budget, '') || ' ' || coalesce(rate_note, '')), '(USD|TWD|CNY|RMB|GBP|EUR|JPY|KRW|HKD)'))[1]
WHERE budget_currency IS NULL
  AND (budget ~* '(USD|TWD|CNY|RMB|GBP|EUR|JPY|KRW|HKD)' OR rate_note ~* '(USD|TWD|CNY|RMB|GBP|EUR|JPY|KRW|HKD)');

-- Normalise RMB → CNY.
UPDATE marketplace_briefs SET budget_currency = 'CNY' WHERE budget_currency = 'RMB';
