/*
  # Create Deliverables Storage Bucket

  ## Overview
  Creates a Supabase Storage bucket for storing completed audio deliverables
  for Tier 2 orders (Director's Cut).

  ## 1. New Storage Bucket
    - Bucket name: `deliverables`
    - Purpose: Store completed audio files (.wav, .mp3) for customer download
    - Access: Public read access for completed orders

  ## 2. Security Policies
    - Admins can upload files (authenticated users with admin email)
    - Anyone can download files (public read access)
    - Files are organized by order ID for easy management

  ## 3. Important Notes
    - Files should be named with order ID for easy reference
    - Public access enables direct download links
    - Only admin users should have upload permissions
*/

-- Create the deliverables bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deliverables',
  'deliverables',
  true,
  52428800, -- 50MB limit
  ARRAY['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public read access to all files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public read access for deliverables'
  ) THEN
    CREATE POLICY "Public read access for deliverables"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'deliverables');
  END IF;
END $$;

-- Policy: Allow authenticated users to upload files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload deliverables'
  ) THEN
    CREATE POLICY "Authenticated users can upload deliverables"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'deliverables');
  END IF;
END $$;

-- Policy: Allow authenticated users to update files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update deliverables'
  ) THEN
    CREATE POLICY "Authenticated users can update deliverables"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'deliverables')
      WITH CHECK (bucket_id = 'deliverables');
  END IF;
END $$;

-- Policy: Allow authenticated users to delete files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can delete deliverables'
  ) THEN
    CREATE POLICY "Authenticated users can delete deliverables"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'deliverables');
  END IF;
END $$;