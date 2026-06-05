/*
  # Add explicit Terms-of-Service / Privacy / AUP consent capture

  ## Background
  /apply/voice Step 7 currently captures 5 consent items, but NONE of
  them is an explicit "I agree to Onyx's Terms of Service, Privacy
  Policy, and Acceptable Use Policy." The existing `consent_terms`
  column despite its name actually captures the originality / IP
  declaration ("the submitted audio is my own voice, not synthesized,
  not infringing"), not Terms acceptance — so it can't double as
  legal-agreement consent.

  This migration adds `consent_legal_agreement` to talent_applications
  so the new UI checkbox has somewhere to write to (audit trail —
  required to prove a talent agreed if there's ever a dispute).

  ## Changes to talent_applications
  - consent_legal_agreement (boolean) — explicit acceptance of Onyx's
    Terms of Service, Privacy Policy, and Acceptable Use Policy.
    Defaults to false; the application form rejects submission unless
    it's true.

  ## Note on consent_terms (NOT renamed here)
  `consent_terms` stays in the DB as-is (misleading name, captures
  originality declaration). Renaming would break compat with existing
  rows and require backfill. A future migration could rename and
  copy data, but for now we live with the legacy name and document
  it in code comments.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_applications'
      AND column_name = 'consent_legal_agreement'
  ) THEN
    ALTER TABLE talent_applications
      ADD COLUMN consent_legal_agreement boolean NOT NULL DEFAULT false;
  END IF;
END $$;
