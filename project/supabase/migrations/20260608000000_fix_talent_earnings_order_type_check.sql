-- Fix talent_earnings order_type check constraint
-- Original constraint only allowed 'voice' | 'music'
-- Phase 1 manual earnings added 'manual' and 'orchestra' but never updated this constraint
-- Adding all four valid values: voice, music, orchestra, manual

ALTER TABLE talent_earnings
  DROP CONSTRAINT IF EXISTS talent_earnings_order_type_check;

ALTER TABLE talent_earnings
  ADD CONSTRAINT talent_earnings_order_type_check
  CHECK (order_type IN ('voice', 'music', 'orchestra', 'manual'));
