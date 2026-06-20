/*
  # Store the applicant's UI locale on each application

  Lets every applicant-facing email (confirmation now, approve/reject later)
  go out in the language the talent actually filled the form in — zh-TW / zh-CN
  / en. The /apply/talent form already sends `locale`; the submit route stores
  it here, and the admin approve/reject flow reads it back.

  Additive + idempotent. Existing rows default to '' (→ English fallback).
*/

ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT '';
