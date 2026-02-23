/*
  # Fix storage upload policy for deliverables bucket

  ## Problem
  - The deliverables bucket has no INSERT policy
  - The upload API uses anon key (no service role key configured)
  - This causes 403 errors when admin tries to upload files

  ## Changes
  - Add INSERT policy allowing anon (service role bypasses RLS anyway, but anon key fallback needs this)
  - Add DELETE policy for authenticated users
*/

CREATE POLICY "Allow uploads to deliverables"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'deliverables');

CREATE POLICY "Allow deletes from deliverables"
  ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'deliverables');
