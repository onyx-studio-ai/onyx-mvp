-- Two-way reviews after a casting order completes:
--   reviewer_type='client' → the client rating the TALENT (shown publicly on the
--                            talent's profile: avg stars + count + comments)
--   reviewer_type='talent' → the talent rating the CLIENT (internal only)
-- One review per side per order.

CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL,
  brief_id      uuid,
  talent_id     uuid,
  reviewer_type text NOT NULL CHECK (reviewer_type IN ('client', 'talent')),
  rating        int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, reviewer_type)
);

-- Fast public lookup of a talent's (client-authored) ratings.
CREATE INDEX IF NOT EXISTS idx_reviews_talent_public
  ON marketplace_reviews (talent_id)
  WHERE reviewer_type = 'client';
