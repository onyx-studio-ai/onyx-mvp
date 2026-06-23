-- Talent application: "do you have voice-directing experience?" (collaboration option ⑥).
-- A talent who can direct sessions (guide other talents on performance/delivery/emotion).
alter table talent_applications
  add column if not exists coop_voice_director boolean not null default false;

notify pgrst, 'reload schema';
