/*
  # Add revision_request column to music_order_versions

  1. Changes
    - `music_order_versions`
      - Add `revision_request` (text, nullable) — stores the client's explicit revision request text,
        separate from `overall_notes` (overall impression notes typed in the feedback panel)

  2. Notes
    - This allows the admin to see both the overall impression notes and the specific revision
      change request as distinct fields.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_order_versions' AND column_name = 'revision_request'
  ) THEN
    ALTER TABLE music_order_versions ADD COLUMN revision_request text DEFAULT '';
  END IF;
END $$;
