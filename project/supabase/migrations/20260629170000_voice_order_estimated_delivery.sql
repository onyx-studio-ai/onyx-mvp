-- Voice orders get an internal "estimated/promised delivery date" the admin sets
-- (music_orders already has this). Shown to the client on their order; setting it
-- does NOT email (the workflow email only fires on a status change).
ALTER TABLE voice_orders ADD COLUMN IF NOT EXISTS estimated_delivery_date date;
