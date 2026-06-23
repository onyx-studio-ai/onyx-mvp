-- Optional English / romanized name for talents (shown on the English site).
-- Names are never machine-translated; 繁↔簡 is handled by OpenCC at publish time,
-- and the English variant comes from this self-provided value (or falls back to
-- the original name when blank).
alter table talents add column if not exists english_name text;
alter table talent_applications add column if not exists english_name text;

notify pgrst, 'reload schema';
