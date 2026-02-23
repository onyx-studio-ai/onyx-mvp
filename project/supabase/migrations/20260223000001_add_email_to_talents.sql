-- Add email column to talents table for Voice ID and contract communications
ALTER TABLE talents ADD COLUMN IF NOT EXISTS email TEXT;
