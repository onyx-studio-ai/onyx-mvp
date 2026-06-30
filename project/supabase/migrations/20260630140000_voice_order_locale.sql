-- Capture the client's UI language at self-serve voice checkout, so the order
-- confirmation / receipt / workflow emails go out in their language (the casting
-- flow already does this via the application locale; self-serve had none).
ALTER TABLE voice_orders ADD COLUMN IF NOT EXISTS locale text;
