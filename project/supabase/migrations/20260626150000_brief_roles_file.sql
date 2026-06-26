/*
  # Client-attached role sheet on a brief

  For role-based casting (game / drama / animation), the client fills the fixed-
  column Onyx role template and uploads it on /hire. We keep the file on the brief
  so the admin's casting form can auto-import the roles (precise, since the columns
  are fixed) instead of re-uploading.

  Additive + idempotent.
*/
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS roles_file_url text;
