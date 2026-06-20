/*
  # Fix application_number generation (duplicate-key collisions)

  The original generate_application_number() used COUNT(*) + 1, which collides:
  - On concurrency: two inserts read the same COUNT → same number → the second
    fails on the unique constraint.
  - After deletions: COUNT drops below the highest existing suffix, so the next
    number equals an existing one → collision.

  Real applicants hit "duplicate key value violates unique constraint
  talent_applications_application_number_key" and lost their submissions.

  Fix: take MAX(existing suffix) + 1 (deletion-safe), and serialise per-day
  generation with a transaction advisory lock (concurrency-safe).
*/

CREATE OR REPLACE FUNCTION generate_application_number()
RETURNS TRIGGER AS $$
DECLARE
  date_str text;
  seq_num integer;
BEGIN
  date_str := to_char(now(), 'YYYYMMDD');
  -- Serialise concurrent inserts for the same day so they can't grab the same number.
  PERFORM pg_advisory_xact_lock(hashtext('talent_app_number_' || date_str));
  -- MAX(existing suffix) + 1 — never collides with an existing number, even after deletions.
  SELECT COALESCE(MAX(split_part(application_number, '-', 3)::int), 0) + 1
  INTO seq_num
  FROM talent_applications
  WHERE application_number LIKE 'APP-' || date_str || '-%';
  NEW.application_number := 'APP-' || date_str || '-' || LPAD(seq_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
