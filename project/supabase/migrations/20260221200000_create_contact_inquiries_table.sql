-- Create contact_inquiries table for managing customer inquiries
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'HELLO',
  source TEXT DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  notes TEXT,
  replies JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by status and department
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON contact_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_department ON contact_inquiries(department);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created_at ON contact_inquiries(created_at DESC);

-- Enable RLS
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (admin operations)
CREATE POLICY "service_role_full_access_inquiries" ON contact_inquiries
  FOR ALL USING (true) WITH CHECK (true);

-- Allow anonymous inserts (from contact form)
CREATE POLICY "anon_insert_inquiries" ON contact_inquiries
  FOR INSERT TO anon WITH CHECK (true);
