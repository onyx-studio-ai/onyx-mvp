-- The client can provide the FINAL script as pasted text (script_text) OR as an
-- uploaded file (PDF / DOC / TXT…). Store the uploaded file's URL here.
ALTER TABLE voice_orders ADD COLUMN IF NOT EXISTS script_file_url text;
