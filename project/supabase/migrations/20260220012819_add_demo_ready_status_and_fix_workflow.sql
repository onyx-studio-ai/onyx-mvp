/*
  # Add demo_ready status to music order workflow

  ## Summary
  The workflow needs a distinct "demo_ready" stage between "in_production" (initial)
  and "version_ready" (revision review). This separates:
  - Direction demo phase: client picks a creative direction from multiple sketches
  - Revision version phase: client reviews full tracks and requests changes until satisfied

  ## Changes
  1. No schema changes needed (status is a text field)
  2. Update the STATUS_LABELS reference only in application code
  3. Add helper comment documenting the full state machine

  ## Full state machine:
  paid → in_production → demo_ready → in_production → version_ready → awaiting_final → completed
                                          ↑                    ↓
                                          └────────────────────┘ (revision loop)
*/

-- No DDL changes needed; status column is already text type
-- This migration documents the new state machine for reference
SELECT 1;
