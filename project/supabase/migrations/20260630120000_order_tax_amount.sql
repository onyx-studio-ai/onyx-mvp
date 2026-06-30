-- Record payment tax separately from the base price. Paddle uses EXTERNAL tax
-- (it adds each country's VAT/sales tax on top, then collects + remits it), so the
-- tax is NOT Onyx revenue and the order's `price` should stay the agreed base.
-- `amount_paid` = the gross the customer actually paid (base + tax); `tax_amount`
-- = the tax portion. Lets the finance view show base revenue cleanly.
ALTER TABLE voice_orders     ADD COLUMN IF NOT EXISTS amount_paid numeric, ADD COLUMN IF NOT EXISTS tax_amount numeric;
ALTER TABLE music_orders     ADD COLUMN IF NOT EXISTS amount_paid numeric, ADD COLUMN IF NOT EXISTS tax_amount numeric;
ALTER TABLE orchestra_orders ADD COLUMN IF NOT EXISTS amount_paid numeric, ADD COLUMN IF NOT EXISTS tax_amount numeric;
