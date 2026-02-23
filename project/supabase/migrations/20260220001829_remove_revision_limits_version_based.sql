/*
  # Remove Revision Limits for Version-Based Workflow

  Since we're moving to an unlimited version iteration model (方案B),
  we no longer need revision counters. The new workflow is:
  
  - Unlimited versions (v1, v2, v3...)
  - Client confirms when satisfied
  - No artificial limits
  
  This migration:
  1. Removes revision_count and max_revisions from music_orders
  2. These fields are no longer used in the version-based workflow
*/

-- Remove revision tracking columns (no longer needed)
ALTER TABLE music_orders 
  DROP COLUMN IF EXISTS revision_count,
  DROP COLUMN IF EXISTS max_revisions;
