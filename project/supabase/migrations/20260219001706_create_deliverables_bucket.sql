/*
  # Create deliverables storage bucket

  Creates the 'deliverables' bucket for storing completed order files
  (audio deliverables for voice and music orders).

  - Public bucket so clients can download via public URL
  - Storage policies for admin upload and public download
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deliverables',
  'deliverables',
  true,
  524288000,
  ARRAY['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/aiff', 'audio/x-aiff', 'audio/flac', 'audio/ogg', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can download deliverables"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'deliverables');

CREATE POLICY "Authenticated users can upload deliverables"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'deliverables');

CREATE POLICY "Authenticated users can update deliverables"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'deliverables');
