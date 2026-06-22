-- Talent profile redesign (Phase 1): structured fields + draft/publish snapshot.
--
-- The talents ROW is now the talent's editable DRAFT. What clients see lives in
-- published_snapshot (jsonb) — only an admin promotes the draft into the snapshot.
-- Any talent edit flips pending_review=true so an admin knows to re-review and
-- republish; the public roster/profile keep showing the last approved snapshot
-- until then. This is the cheapest correct way to do "edits don't go live until
-- reviewed" — one snapshot column, no separate drafts/versioning table.
--
-- Structured, separately-filterable fields replace the old single mixed `tags`
-- array: voice_traits (聲線特質) and specialties (用途/專長). `tags` is kept ONLY
-- for the Onyx-managed service classification (AI Voice / TTS Data / Proofreading).
-- demos becomes categorized: [{category,name,url,language,seconds}]; the legacy
-- flat demo_urls is preserved for back-compat reads.
--
-- All additive + idempotent (ADD COLUMN IF NOT EXISTS); safe to re-run.

alter table public.talents
  add column if not exists voice_traits       text[]  not null default '{}',   -- 聲線特質, canonical EN keys (see lib/talent-taxonomy)
  add column if not exists specialties        text[]  not null default '{}',   -- 用途/專長, canonical EN keys
  add column if not exists demos              jsonb   not null default '[]'::jsonb, -- [{category,name,url,language,seconds}]
  add column if not exists location           text,                            -- country/region (implies timezone)
  add column if not exists availability_note  text,                            -- free-text work-time reference
  add column if not exists credits            text,                            -- 合作單位 / 經歷 (also feeds search later)
  add column if not exists equipment          text,                            -- 錄音器材 (optional)
  add column if not exists studio_partner     text,                            -- 專業錄音室/錄音師合作 (optional)
  add column if not exists published_snapshot jsonb,                            -- approved public version (null = never published)
  add column if not exists pending_review     boolean not null default false;  -- has unpublished edits awaiting admin

-- Public bucket for square headshots. Talents upload via a server-minted signed
-- URL into talent-photos/<talent-id>/; served via the public URL. Image is
-- cropped + compressed client-side before upload, so only one small file lands.
insert into storage.buckets (id, name, public)
values ('talent-photos', 'talent-photos', true)
on conflict (id) do nothing;

-- Backfill: live talents get a snapshot from their current columns so the public
-- roster/profile (which now read published_snapshot) keep showing them. Only
-- public-safe fields go in — never email/phone/payment_details/internal_cost.
update public.talents
set published_snapshot = jsonb_strip_nulls(jsonb_build_object(
  'name',         name,
  'languages',    to_jsonb(coalesce(languages,    '{}'::text[])),
  'gender',       gender,
  'accent',       accent,
  'bio',          bio,
  'tags',         to_jsonb(coalesce(tags,         '{}'::text[])),
  'voice_traits', to_jsonb(coalesce(voice_traits, '{}'::text[])),
  'specialties',  to_jsonb(coalesce(specialties,  '{}'::text[])),
  'demos',        coalesce(demos, '[]'::jsonb),
  'demo_urls',    coalesce(demo_urls, '[]'::jsonb),
  'headshot_url', headshot_url,
  'sample_url',   sample_url,
  'location',     location,
  'credits',      credits,
  'category',     category
))
where is_active = true and published_snapshot is null;

notify pgrst, 'reload schema';
