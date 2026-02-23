/*
  # Fix talent-submissions bucket MIME type restrictions

  ## Summary
  The upload was failing with HTTP 400 because the browser was sending a MIME type
  that didn't match the bucket's allowed_mime_types list. Different operating systems
  and browsers may report WAV files with different MIME types (e.g. audio/wav,
  audio/x-wav, audio/wave, application/octet-stream, or even an empty string).

  This migration relaxes the MIME type restriction on the bucket to accept all
  common audio MIME types, so legitimate WAV uploads are not rejected.

  The file extension validation (WAV only) is enforced on the frontend instead.
*/

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'application/octet-stream',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  ''
]
WHERE id = 'talent-submissions';
