-- Add payment method and payment details to talents table
ALTER TABLE talents ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('paypal', 'bank_transfer'));
ALTER TABLE talents ADD COLUMN IF NOT EXISTS payment_details JSONB DEFAULT NULL;
