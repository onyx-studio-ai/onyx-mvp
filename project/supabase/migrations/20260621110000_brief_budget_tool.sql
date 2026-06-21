/*
  # Brief: budget mode + live-session tool

  budget_type lets the client say whether `budget` is an "Up to" ceiling or a
  "Fixed" price (industry-standard phrasing). live_session_tool captures the
  preferred conferencing platform for a live-directed session (Zoom / Google
  Meet / Source-Connect / other).

  Additive + idempotent.
*/
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS budget_type        text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS live_session_tool  text;
