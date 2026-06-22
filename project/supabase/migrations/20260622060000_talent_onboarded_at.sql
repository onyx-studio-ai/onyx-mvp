-- Separate "onboarded" (talent agreed to terms + got an account) from
-- "published" (is_active = visible on the public roster).
--
-- Before: agreeing to the cooperation terms set is_active = true, so a talent
-- went live on the roster immediately with their APPLICATION data — before they
-- logged in to review/polish their own profile and before an admin's final check.
--
-- After: onboarding sets onboarded_at; is_active stays false until an admin
-- reviews the talent's polished profile and publishes them.

alter table public.talents
  add column if not exists onboarded_at timestamptz;
