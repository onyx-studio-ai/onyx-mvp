-- Direct invite: a client can name a specific talent to record (the "指定配音員"
-- button on a public profile). We already store the free-text name in
-- requested_talent; this links it to the actual talent record so the admin can
-- guarantee that talent is included when the brief is published (the casting
-- vetting gate auto-includes / pre-checks the requested talent).
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS requested_talent_id uuid;
