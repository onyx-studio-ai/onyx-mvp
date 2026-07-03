/*
  # Restricted, encrypted talent payout details

  Sensitive payout data (Taiwan 勞務報酬: legal name + national ID + address +
  bank account; overseas: PayPal email) lives here, isolated from the main talents
  table. The whole detail payload is stored ENCRYPTED (AES-256-GCM, app-layer key
  in Vercel env PAYOUT_ENC_KEY) — a DB/backup leak yields ciphertext only.

  Access: RLS ON with NO policies → only the service_role (our server APIs) can
  read/write. Talents reach their own row exclusively through session-scoped server
  endpoints; clients never touch it.

  Plaintext columns are non-sensitive routing/status only (region, method, whether
  completed) so the payouts UI can list "who still needs to fill this in" without
  decrypting anything.
*/

CREATE TABLE IF NOT EXISTS talent_payout_details (
  talent_id     uuid PRIMARY KEY REFERENCES talents(id) ON DELETE CASCADE,
  region        text NOT NULL DEFAULT '',    -- 'TW' | 'overseas'
  payout_method text NOT NULL DEFAULT '',    -- 'bank_transfer' | 'paypal'
  enc_payload   text,                         -- AES-256-GCM ciphertext of the detail JSON
  completed     boolean NOT NULL DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE talent_payout_details ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: service_role bypasses RLS; everyone else is denied.

notify pgrst, 'reload schema';
