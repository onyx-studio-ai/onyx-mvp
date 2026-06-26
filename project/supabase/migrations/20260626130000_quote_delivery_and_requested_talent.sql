/*
  # Talent on-platform delivery + structured "requested talent"

  Two gaps being closed:

  1. marketplace_quotes.delivery_url / delivery_uploaded_at
     A talent whose audition was ACCEPTED currently has no on-platform way to hand
     in the final recording — delivery happened off-platform. These columns let the
     won talent upload the finished audio against their accepted quote, and let Onyx
     see + download it from the admin marketplace view.

  2. marketplace_briefs.requested_talent
     The /hire form's "指定配音員" field was only ever folded into the free-text brief,
     so admins couldn't see/filter it. Store it as a first-class field.

  Additive + idempotent.
*/
ALTER TABLE marketplace_quotes ADD COLUMN IF NOT EXISTS delivery_url         text;
ALTER TABLE marketplace_quotes ADD COLUMN IF NOT EXISTS delivery_uploaded_at timestamptz;

ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS requested_talent text;
