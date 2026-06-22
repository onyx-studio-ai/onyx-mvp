-- Voice age range (兒童/青少年/青年/中年/熟齡) — a top client filter. Multi-value
-- because one talent can cover a range. Canonical keys in voice_ages; localized
-- at render (see VOICE_AGES in lib/talent-taxonomy). Additive + idempotent.

alter table public.talents
  add column if not exists voice_ages text[] not null default '{}';

notify pgrst, 'reload schema';
