/*
  # Talent saved quote templates

  A talent can save reusable templates for their audition 自我介紹 and 修改政策 (e.g. a
  game template, an ad template) and pick one when auditioning. Stored per-talent as
  JSONB so there's no extra table:

    quote_templates = {
      "intro":    [ { "name": "廣告", "body": "…" }, … ],
      "revision": [ { "name": "遊戲", "body": "…" }, … ]
    }

  Additive + idempotent.
*/
ALTER TABLE talents ADD COLUMN IF NOT EXISTS quote_templates jsonb NOT NULL DEFAULT '{}'::jsonb;
