/*
  # Allow anon uploads to deliverables bucket

  The admin interface uses the anon key (not authenticated session), so uploads
  from the admin panel were being blocked by the authenticated-only INSERT policy.

  Changes:
  - Drop the existing INSERT policy that only allows authenticated users
  - Add new INSERT policy that allows both authenticated and anon roles to upload
    to the deliverables bucket
*/

DROP POLICY IF EXISTS "Authenticated users can upload deliverables" ON storage.objects;

CREATE POLICY "Anyone can upload deliverables"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'deliverables');
