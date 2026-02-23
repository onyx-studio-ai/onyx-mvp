/*
  # Fix Talents RLS - Allow Anonymous Access

  ## Problem
  The existing "Anyone can view active talents" policy uses the `public` pseudo-role
  which does not exist in Supabase. This means anonymous (unauthenticated) users cannot
  read talents, causing the Vocal Artists grid to show empty.

  ## Changes
  - Drop the broken `public` role policy on talents
  - Re-create it properly targeting `anon` and `authenticated` roles
*/

DROP POLICY IF EXISTS "Anyone can view active talents" ON talents;

CREATE POLICY "Anyone can view active talents"
  ON talents
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
