/*
  # Create Talent Submissions Storage Bucket

  ## Summary
  Creates the talent-submissions storage bucket for storing WAV demo files submitted by talent applicants.

  ## Storage Structure
  - Bucket: talent-submissions (public)
    - voice-actors/ — WAV files from VO applicants
    - singers/      — WAV files from Singer applicants

  ## Security
  - Anyone (anon) can upload files (for public application form)
  - Authenticated users can read and manage files
  - File size limit: 52428800 bytes (50MB)
  - Allowed MIME types: audio/wav, audio/x-wav only
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'talent-submissions',
  'talent-submissions',
  true,
  52428800,
  ARRAY['audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream'];

-- Allow anon to upload to talent-submissions
CREATE POLICY "Anon can upload talent submissions"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'talent-submissions');

-- Allow public read access
CREATE POLICY "Public can read talent submissions"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'talent-submissions');

-- Allow authenticated to update/delete
CREATE POLICY "Authenticated can manage talent submissions"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'talent-submissions');
