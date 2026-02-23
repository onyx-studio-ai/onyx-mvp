/*
  # Add Version Limits by Plan (方案A)

  Plan-based revision limits:
  - AI Curator: 1 revision (1次修改)
  - Pro-Arrangement: 3 revisions (3次修改) 
  - Masterpiece: Unlimited (無限修改)
  
  Changes:
  1. Add version_count to music_orders (tracks how many versions uploaded)
  2. Add max_versions based on tier
  3. Keep version-based workflow but with limits
  
  Notes:
  - version_count increments each time admin uploads a new version
  - When version_count >= max_versions, client must confirm (can't request more changes)
  - Masterpiece has max_versions = -1 (unlimited)
*/

-- Add version tracking columns
ALTER TABLE music_orders 
  ADD COLUMN IF NOT EXISTS version_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_versions INTEGER DEFAULT 1;

-- Set max_versions based on tier for existing orders
UPDATE music_orders 
SET max_versions = CASE 
  WHEN tier = 'masterpiece' THEN -1
  WHEN tier = 'pro-arrangement' THEN 3
  ELSE 1
END
WHERE max_versions IS NULL OR max_versions = 1;

-- Add comment
COMMENT ON COLUMN music_orders.version_count IS 'Number of versions uploaded (v1, v2, v3...)';
COMMENT ON COLUMN music_orders.max_versions IS 'Maximum versions allowed (-1 = unlimited). AI Curator=1, Pro=3, Masterpiece=-1';
