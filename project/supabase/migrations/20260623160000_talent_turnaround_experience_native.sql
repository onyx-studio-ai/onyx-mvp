-- More precise talent data for client decisions + search:
--   turnaround        = typical delivery time (24h / 1-2d / …)
--   years_experience  = exact years (credibility + filterable)
--   native_languages  = which of the talent's languages are native (badge on profile)
alter table talents
  add column if not exists turnaround text,
  add column if not exists years_experience integer,
  add column if not exists native_languages text[] default '{}';

alter table talent_applications
  add column if not exists turnaround text,
  add column if not exists years_experience integer,
  add column if not exists native_languages text[] default '{}';

notify pgrst, 'reload schema';
