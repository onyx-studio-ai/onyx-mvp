-- Multi-talent casting: a multi-role brief is fulfilled by several talents, each
-- getting their own sub-order (one voice_order per awarded role, grouped by
-- brief_id). role_name records which role this sub-order covers (null = a
-- single-voice / general order, unchanged).
ALTER TABLE voice_orders ADD COLUMN IF NOT EXISTS role_name text;
