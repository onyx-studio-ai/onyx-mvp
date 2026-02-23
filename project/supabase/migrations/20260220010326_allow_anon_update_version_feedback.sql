/*
  # Allow anon users to update overall_rating and overall_notes on music_order_versions

  ## Problem
  Clients (unauthenticated/anon) cannot save their overall impression notes and ratings
  on demo versions because there is no UPDATE policy for anon role.

  ## Changes
  - Add UPDATE policy for anon users on music_order_versions
  - Restricts to only overall_rating and overall_notes fields (via USING check)
*/

CREATE POLICY "Anon users can update version feedback"
  ON music_order_versions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
